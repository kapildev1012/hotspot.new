import { Request, Response } from 'express';
import { AuditLog, User } from '../models/index.js';
import { AuthService } from '../services/authService.js';
import { UserRole } from '../types/index.js';
import { asyncHandler } from '../utils/errors.js';

/**
 * Get all users (Admin only)
 */
export const getUsers = asyncHandler(async (req: Request, res: Response) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 10;
  const search = req.query.search as string;
  const role = req.query.role as string;
  const storeId = req.query.storeId as string;
  const isActive = req.query.isActive as string;

  // Build filter
  const filter: any = {};
  
  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } },
    ];
  }
  
  if (role && Object.values(UserRole).includes(role as UserRole)) {
    filter.role = role;
  }
  
  if (storeId) {
    filter.storeId = storeId;
  }
  
  if (isActive !== undefined) {
    filter.isActive = isActive === 'true';
  }

  const users = await User.find(filter)
    .populate('storeId', 'name code')
    .select('-password -refreshToken -passwordResetToken -emailVerificationToken')
    .sort({ createdAt: -1 })
    .limit(limit * 1)
    .skip((page - 1) * limit);

  const total = await User.countDocuments(filter);

  res.json({
    success: true,
    data: {
      users,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    },
  });
});

/**
 * Get user by ID
 */
export const getUserById = asyncHandler(async (req: Request, res: Response) => {
  const { userId } = req.params;

  const user = await User.findById(userId)
    .populate('storeId', 'name code address')
    .select('-password -refreshToken -passwordResetToken -emailVerificationToken');

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
 * Create new user (Admin only)
 */
export const createUser = asyncHandler(async (req: Request, res: Response) => {
  const { name, email, password, role, storeId, permissions, phone, address } = req.body;

  // Validate required fields
  if (!name || !email || !password) {
    return res.status(400).json({
      success: false,
      error: 'Name, email, and password are required',
    });
  }

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
  const userPermissions = permissions || AuthService.getDefaultPermissions(role || UserRole.VIEWER);

  // Create user
  const user = await User.create({
    name,
    email,
    password,
    role: role || UserRole.VIEWER,
    storeId,
    permissions: userPermissions,
    phone,
    address,
    emailVerified: true, // Admin-created users are auto-verified
  });

  // Log activity
  await AuditLog.logActivity(
    req.user.id,
    req.user.name,
    'USER_CREATE',
    'User',
    {
      method: req.method,
      endpoint: req.originalUrl,
      userAgent: req.get('User-Agent'),
      ipAddress: req.ip,
      metadata: { createdUserId: user._id, role: user.role },
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
    phone: user.phone,
    address: user.address,
    isActive: user.isActive,
    emailVerified: user.emailVerified,
    createdAt: user.createdAt,
  };

  res.status(201).json({
    success: true,
    data: { user: userResponse },
    message: 'User created successfully',
  });
});

/**
 * Update user (Admin or self)
 */
export const updateUser = asyncHandler(async (req: Request, res: Response) => {
  const { userId } = req.params;
  const { name, role, storeId, permissions, phone, address, isActive } = req.body;

  const user = await User.findById(userId);
  if (!user) {
    return res.status(404).json({
      success: false,
      error: 'User not found',
    });
  }

  // Track changes for audit log
  const changes: Array<{ field: string; oldValue: any; newValue: any }> = [];

  // Only admins can change role, permissions, and isActive status
  const isAdmin = ['SUPER_ADMIN', 'WAREHOUSE_MANAGER'].includes(req.user.role);
  const isSelf = req.user.id === userId;

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

  // Admin-only fields
  if (isAdmin) {
    if (role && role !== user.role) {
      changes.push({ field: 'role', oldValue: user.role, newValue: role });
      user.role = role;
      
      // Update permissions based on new role if permissions not explicitly provided
      if (!permissions) {
        const newPermissions = AuthService.getDefaultPermissions(role);
        changes.push({ field: 'permissions', oldValue: user.permissions, newValue: newPermissions });
        user.permissions = newPermissions;
      }
    }

    if (storeId !== undefined && storeId !== user.storeId) {
      changes.push({ field: 'storeId', oldValue: user.storeId, newValue: storeId });
      user.storeId = storeId;
    }

    if (permissions && JSON.stringify(permissions) !== JSON.stringify(user.permissions)) {
      changes.push({ field: 'permissions', oldValue: user.permissions, newValue: permissions });
      user.permissions = permissions;
    }

    if (isActive !== undefined && isActive !== user.isActive) {
      changes.push({ field: 'isActive', oldValue: user.isActive, newValue: isActive });
      user.isActive = isActive;
    }
  }

  await user.save();

  // Log user update
  if (changes.length > 0) {
    await AuditLog.logActivity(
      req.user.id,
      req.user.name,
      isSelf ? 'PROFILE_UPDATE' : 'USER_UPDATE',
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

  // Populate store info
  await user.populate('storeId', 'name code');

  res.json({
    success: true,
    data: { user },
    message: 'User updated successfully',
  });
});

/**
 * Delete user (Admin only)
 */
export const deleteUser = asyncHandler(async (req: Request, res: Response) => {
  const { userId } = req.params;

  const user = await User.findById(userId);
  if (!user) {
    return res.status(404).json({
      success: false,
      error: 'User not found',
    });
  }

  // Prevent deleting yourself
  if (req.user.id === userId) {
    return res.status(400).json({
      success: false,
      error: 'Cannot delete your own account',
    });
  }

  // Soft delete (deactivate) instead of hard delete
  user.isActive = false;
  user.email = `deleted_${Date.now()}_${user.email}`; // Prevent email conflicts
  await user.save();

  // Log user deletion
  await AuditLog.logActivity(
    req.user.id,
    req.user.name,
    'USER_DELETE',
    'User',
    {
      method: req.method,
      endpoint: req.originalUrl,
      userAgent: req.get('User-Agent'),
      ipAddress: req.ip,
      metadata: { deletedUserId: user._id, deletedUserEmail: user.email },
    },
    'SUCCESS',
    user._id
  );

  res.json({
    success: true,
    message: 'User deleted successfully',
  });
});

/**
 * Get user permissions
 */
export const getUserPermissions = asyncHandler(async (req: Request, res: Response) => {
  const { userId } = req.params;

  const user = await User.findById(userId).select('permissions role');
  if (!user) {
    return res.status(404).json({
      success: false,
      error: 'User not found',
    });
  }

  res.json({
    success: true,
    data: {
      permissions: user.permissions,
      role: user.role,
      defaultPermissions: AuthService.getDefaultPermissions(user.role),
    },
  });
});

/**
 * Update user permissions (Admin only)
 */
export const updateUserPermissions = asyncHandler(async (req: Request, res: Response) => {
  const { userId } = req.params;
  const { permissions } = req.body;

  if (!Array.isArray(permissions)) {
    return res.status(400).json({
      success: false,
      error: 'Permissions must be an array',
    });
  }

  const user = await User.findById(userId);
  if (!user) {
    return res.status(404).json({
      success: false,
      error: 'User not found',
    });
  }

  const oldPermissions = [...user.permissions];
  user.permissions = permissions;
  await user.save();

  // Log permission update
  await AuditLog.logActivity(
    req.user.id,
    req.user.name,
    'USER_PERMISSIONS_UPDATE',
    'User',
    {
      method: req.method,
      endpoint: req.originalUrl,
      userAgent: req.get('User-Agent'),
      ipAddress: req.ip,
      changes: [
        { field: 'permissions', oldValue: oldPermissions, newValue: permissions },
      ],
    },
    'SUCCESS',
    user._id
  );

  res.json({
    success: true,
    data: { permissions: user.permissions },
    message: 'User permissions updated successfully',
  });
});

/**
 * Get user activity/audit logs
 */
export const getUserActivity = asyncHandler(async (req: Request, res: Response) => {
  const { userId } = req.params;
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;

  const user = await User.findById(userId);
  if (!user) {
    return res.status(404).json({
      success: false,
      error: 'User not found',
    });
  }

  const logs = await AuditLog.find({ actorUserId: userId })
    .sort({ timestamp: -1 })
    .limit(limit * 1)
    .skip((page - 1) * limit);

  const total = await AuditLog.countDocuments({ actorUserId: userId });

  res.json({
    success: true,
    data: {
      logs,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    },
  });
});

/**
 * Reset user password (Admin only)
 */
export const resetUserPassword = asyncHandler(async (req: Request, res: Response) => {
  const { userId } = req.params;
  const { password } = req.body;

  // If no password provided, generate a random one
  const newPassword = password || AuthService.generateSecurePassword();

  // Validate password strength
  const passwordValidation = AuthService.validatePassword(newPassword);
  if (!passwordValidation.isValid) {
    return res.status(400).json({
      success: false,
      error: 'Password validation failed',
      details: passwordValidation.errors,
    });
  }

  const user = await User.findById(userId);
  if (!user) {
    return res.status(404).json({
      success: false,
      error: 'User not found',
    });
  }

  // Update password and invalidate sessions
  user.password = newPassword;
  user.refreshToken = undefined;
  await user.save();

  // Log password reset
  await AuditLog.logActivity(
    req.user.id,
    req.user.name,
    'USER_PASSWORD_RESET',
    'User',
    {
      method: req.method,
      endpoint: req.originalUrl,
      userAgent: req.get('User-Agent'),
      ipAddress: req.ip,
      metadata: { targetUserId: user._id },
    },
    'SUCCESS',
    user._id
  );

  res.json({
    success: true,
    data: { temporaryPassword: password ? undefined : newPassword },
    message: 'User password reset successfully',
  });
});