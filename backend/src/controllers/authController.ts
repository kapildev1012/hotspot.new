import { Request, Response } from 'express';
import redisClient from '../config/redis.js';
import { AuditLog, User } from '../models/index.js';
import { AuthService } from '../services/authService.js';
import { asyncHandler } from '../utils/errors.js';

/**
 * Register a new user
 */
export const register = asyncHandler(async (req: Request, res: Response) => {
  const { name, email, password, role, storeId, permissions } = req.body;

  // Validate password strength
  const passwordValidation = AuthService.validatePassword(password);
  if (!passwordValidation.isValid) {
    return res.status(400).json({
      success: false,
      error: 'Password validation failed',
      details: passwordValidation.errors,
    });
  }

  // Check if user already exists
  const existingUser = await User.findOne({ email });
  if (existingUser) {
    return res.status(400).json({
      success: false,
      error: 'User with this email already exists',
    });
  }

  // Set default permissions if not provided
  const userPermissions = permissions || AuthService.getDefaultPermissions(role || 'VIEWER');

  // Create user
  const user = await User.create({
    name,
    email,
    password,
    role: role || 'VIEWER',
    storeId,
    permissions: userPermissions,
    emailVerificationToken: AuthService.generateVerificationToken(),
  });

  // Generate tokens
  const tokens = AuthService.generateTokens(user);

  // Save refresh token
  user.refreshToken = tokens.refreshToken;
  await user.save();

  // Log activity
  await AuditLog.logActivity(
    user._id,
    user.name,
    'USER_REGISTER',
    'User',
    {
      method: req.method,
      endpoint: req.originalUrl,
      userAgent: req.get('User-Agent'),
      ipAddress: req.ip,
    },
    'SUCCESS',
    user._id
  );

  // Remove sensitive data
  const userResponse = {
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    storeId: user.storeId,
    permissions: user.permissions,
    isActive: user.isActive,
    emailVerified: user.emailVerified,
  };

  res.status(201).json({
    success: true,
    data: {
      user: userResponse,
      tokens,
    },
    message: 'User registered successfully',
  });
});

/**
 * Login user
 */
export const login = asyncHandler(async (req: Request, res: Response) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      success: false,
      error: 'Email and password are required',
    });
  }

  // Find user and include password
  const user = await User.findOne({ email }).select('+password +refreshToken');
  if (!user || !user.isActive) {
    await AuditLog.logActivity(
      'unknown',
      'Unknown',
      'LOGIN_FAILED',
      'User',
      {
        method: req.method,
        endpoint: req.originalUrl,
        userAgent: req.get('User-Agent'),
        ipAddress: req.ip,
        metadata: { email, reason: 'User not found or inactive' },
      },
      'FAILURE'
    );

    return res.status(401).json({
      success: false,
      error: 'Invalid credentials',
    });
  }

  // Check password
  const isPasswordValid = await user.comparePassword(password);
  if (!isPasswordValid) {
    await AuditLog.logActivity(
      user._id,
      user.name,
      'LOGIN_FAILED',
      'User',
      {
        method: req.method,
        endpoint: req.originalUrl,
        userAgent: req.get('User-Agent'),
        ipAddress: req.ip,
        metadata: { reason: 'Invalid password' },
      },
      'FAILURE',
      user._id
    );

    return res.status(401).json({
      success: false,
      error: 'Invalid credentials',
    });
  }

  // Generate tokens
  const tokens = AuthService.generateTokens(user);

  // Save refresh token and update last login
  user.refreshToken = tokens.refreshToken;
  user.lastLogin = new Date();
  await user.save();

  // Log successful login
  await AuditLog.logActivity(
    user._id,
    user.name,
    'USER_LOGIN',
    'User',
    {
      method: req.method,
      endpoint: req.originalUrl,
      userAgent: req.get('User-Agent'),
      ipAddress: req.ip,
    },
    'SUCCESS',
    user._id
  );

  // Remove sensitive data
  const userResponse = {
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    storeId: user.storeId,
    permissions: user.permissions,
    isActive: user.isActive,
    emailVerified: user.emailVerified,
    lastLogin: user.lastLogin,
  };

  res.json({
    success: true,
    data: {
      user: userResponse,
      tokens,
    },
    message: 'Login successful',
  });
});

/**
 * Logout user
 */
export const logout = asyncHandler(async (req: Request, res: Response) => {
  const { refreshToken } = req.body;

  // Get token from header
  let accessToken: string | undefined;
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    accessToken = req.headers.authorization.split(' ')[1];
  }

  // Blacklist the access token if provided
  if (accessToken) {
    await redisClient.set(`blacklist:${accessToken}`, 'true', 24 * 60 * 60); // 24 hours
  }

  // Find user and clear refresh token
  if (refreshToken) {
    const user = await User.findOne({ refreshToken }).select('+refreshToken');
    if (user) {
      user.refreshToken = undefined;
      await user.save();

      // Log logout
      await AuditLog.logActivity(
        user._id,
        user.name,
        'USER_LOGOUT',
        'User',
        {
          method: req.method,
          endpoint: req.originalUrl,
          userAgent: req.get('User-Agent'),
          ipAddress: req.ip,
        },
        'SUCCESS',
        user._id
      );
    }
  }

  res.json({
    success: true,
    message: 'Logout successful',
  });
});

/**
 * Refresh access token
 */
export const refreshToken = asyncHandler(async (req: Request, res: Response) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return res.status(400).json({
      success: false,
      error: 'Refresh token is required',
    });
  }

  // Verify refresh token
  let decoded;
  try {
    decoded = AuthService.verifyRefreshToken(refreshToken);
  } catch (error) {
    return res.status(401).json({
      success: false,
      error: 'Invalid or expired refresh token',
    });
  }

  // Find user with this refresh token
  const user = await User.findOne({ 
    _id: decoded.userId, 
    refreshToken,
    isActive: true 
  }).select('+refreshToken');

  if (!user) {
    return res.status(401).json({
      success: false,
      error: 'Invalid refresh token',
    });
  }

  // Generate new tokens
  const tokens = AuthService.generateTokens(user);

  // Save new refresh token
  user.refreshToken = tokens.refreshToken;
  await user.save();

  res.json({
    success: true,
    data: { tokens },
    message: 'Token refreshed successfully',
  });
});

/**
 * Get current user profile
 */
export const getProfile = asyncHandler(async (req: Request, res: Response) => {
  const user = await User.findById(req.user.id)
    .populate('storeId', 'name code address')
    .select('-password -refreshToken');

  if (!user) {
    return res.status(404).json({
      success: false,
      error: 'User not found',
    });
  }

  res.json({
    success: true,
    data: { user },
  });
});

/**
 * Update user profile
 */
export const updateProfile = asyncHandler(async (req: Request, res: Response) => {
  const { name, phone, address, avatar } = req.body;
  
  const user = await User.findById(req.user.id);
  if (!user) {
    return res.status(404).json({
      success: false,
      error: 'User not found',
    });
  }

  // Track changes for audit log
  const changes: Array<{ field: string; oldValue: any; newValue: any }> = [];
  
  if (name && name !== user.name) {
    changes.push({ field: 'name', oldValue: user.name, newValue: name });
    user.name = name;
  }
  
  if (phone && phone !== user.phone) {
    changes.push({ field: 'phone', oldValue: user.phone, newValue: phone });
    user.phone = phone;
  }
  
  if (address && address !== user.address) {
    changes.push({ field: 'address', oldValue: user.address, newValue: address });
    user.address = address;
  }
  
  if (avatar && avatar !== user.avatar) {
    changes.push({ field: 'avatar', oldValue: user.avatar, newValue: avatar });
    user.avatar = avatar;
  }

  await user.save();

  // Log profile update
  if (changes.length > 0) {
    await AuditLog.logActivity(
      user._id,
      user.name,
      'PROFILE_UPDATE',
      'User',
      {
        method: req.method,
        endpoint: req.originalUrl,
        userAgent: req.get('User-Agent'),
        ipAddress: req.ip,
        changes,
      },
      'SUCCESS',
      user._id
    );
  }

  res.json({
    success: true,
    data: { user },
    message: 'Profile updated successfully',
  });
});

/**
 * Change password
 */
export const changePassword = asyncHandler(async (req: Request, res: Response) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({
      success: false,
      error: 'Current password and new password are required',
    });
  }

  // Validate new password strength
  const passwordValidation = AuthService.validatePassword(newPassword);
  if (!passwordValidation.isValid) {
    return res.status(400).json({
      success: false,
      error: 'Password validation failed',
      details: passwordValidation.errors,
    });
  }

  // Get user with password
  const user = await User.findById(req.user.id).select('+password +refreshToken');
  if (!user) {
    return res.status(404).json({
      success: false,
      error: 'User not found',
    });
  }

  // Verify current password
  const isCurrentPasswordValid = await user.comparePassword(currentPassword);
  if (!isCurrentPasswordValid) {
    await AuditLog.logActivity(
      user._id,
      user.name,
      'PASSWORD_CHANGE_FAILED',
      'User',
      {
        method: req.method,
        endpoint: req.originalUrl,
        userAgent: req.get('User-Agent'),
        ipAddress: req.ip,
        metadata: { reason: 'Invalid current password' },
      },
      'FAILURE',
      user._id
    );

    return res.status(400).json({
      success: false,
      error: 'Current password is incorrect',
    });
  }

  // Update password
  user.password = newPassword;
  user.refreshToken = undefined; // Invalidate all sessions
  await user.save();

  // Log password change
  await AuditLog.logActivity(
    user._id,
    user.name,
    'PASSWORD_CHANGE',
    'User',
    {
      method: req.method,
      endpoint: req.originalUrl,
      userAgent: req.get('User-Agent'),
      ipAddress: req.ip,
    },
    'SUCCESS',
    user._id
  );

  res.json({
    success: true,
    message: 'Password changed successfully. Please login again.',
  });
});

/**
 * Forgot password - send reset link
 */
export const forgotPassword = asyncHandler(async (req: Request, res: Response) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({
      success: false,
      error: 'Email is required',
    });
  }

  const user = await User.findOne({ email, isActive: true });
  if (!user) {
    // Don't reveal if email exists for security
    return res.json({
      success: true,
      message: 'If an account with that email exists, we have sent a password reset link.',
    });
  }

  // Generate reset token
  const resetToken = AuthService.generateResetToken();
  user.passwordResetToken = AuthService.hashResetToken(resetToken);
  user.passwordResetExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
  await user.save();

  // Log password reset request
  await AuditLog.logActivity(
    user._id,
    user.name,
    'PASSWORD_RESET_REQUEST',
    'User',
    {
      method: req.method,
      endpoint: req.originalUrl,
      userAgent: req.get('User-Agent'),
      ipAddress: req.ip,
    },
    'SUCCESS',
    user._id
  );

  // TODO: Send reset email
  // const resetURL = `${req.protocol}://${req.get('host')}/api/auth/reset-password/${resetToken}`;
  // await sendPasswordResetEmail(user.email, resetURL);

  res.json({
    success: true,
    message: 'If an account with that email exists, we have sent a password reset link.',
  });
});

/**
 * Reset password with token
 */
export const resetPassword = asyncHandler(async (req: Request, res: Response) => {
  const { token } = req.params;
  const { password } = req.body;

  if (!password) {
    return res.status(400).json({
      success: false,
      error: 'Password is required',
    });
  }

  // Validate new password strength
  const passwordValidation = AuthService.validatePassword(password);
  if (!passwordValidation.isValid) {
    return res.status(400).json({
      success: false,
      error: 'Password validation failed',
      details: passwordValidation.errors,
    });
  }

  // Hash the token and find user
  const hashedToken = AuthService.hashResetToken(token);
  const user = await User.findOne({
    passwordResetToken: hashedToken,
    passwordResetExpires: { $gt: new Date() },
    isActive: true,
  }).select('+passwordResetToken +passwordResetExpires');

  if (!user) {
    return res.status(400).json({
      success: false,
      error: 'Invalid or expired reset token',
    });
  }

  // Update password and clear reset token
  user.password = password;
  user.passwordResetToken = undefined;
  user.passwordResetExpires = undefined;
  user.refreshToken = undefined; // Invalidate all sessions
  await user.save();

  // Log password reset
  await AuditLog.logActivity(
    user._id,
    user.name,
    'PASSWORD_RESET',
    'User',
    {
      method: req.method,
      endpoint: req.originalUrl,
      userAgent: req.get('User-Agent'),
      ipAddress: req.ip,
    },
    'SUCCESS',
    user._id
  );

  res.json({
    success: true,
    message: 'Password reset successfully. Please login with your new password.',
  });
});