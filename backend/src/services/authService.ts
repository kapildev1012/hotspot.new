import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';
import { IUser } from '../models/User.js';

export interface JWTPayload {
  userId: string;
  email: string;
  role: string;
  storeId?: string;
  permissions: string[];
  tokenType: 'access' | 'refresh';
}

export class AuthService {
  /**
   * Generate access and refresh tokens for a user
   */
  static generateTokens(user: IUser): { accessToken: string; refreshToken: string } {
    const payload: Omit<JWTPayload, 'tokenType'> = {
      userId: user._id,
      email: user.email,
      role: user.role,
      storeId: user.storeId,
      permissions: user.permissions,
    };

    const accessToken = jwt.sign(
      { ...payload, tokenType: 'access' },
      config.jwtSecret,
      { expiresIn: config.jwtExpire }
    );

    const refreshToken = jwt.sign(
      { ...payload, tokenType: 'refresh' },
      config.jwtRefreshSecret,
      { expiresIn: config.jwtRefreshExpire }
    );

    return { accessToken, refreshToken };
  }

  /**
   * Verify and decode access token
   */
  static verifyAccessToken(token: string): JWTPayload {
    try {
      const decoded = jwt.verify(token, config.jwtSecret) as JWTPayload;
      if (decoded.tokenType !== 'access') {
        throw new Error('Invalid token type');
      }
      return decoded;
    } catch (error) {
      throw new Error('Invalid or expired access token');
    }
  }

  /**
   * Verify and decode refresh token
   */
  static verifyRefreshToken(token: string): JWTPayload {
    try {
      const decoded = jwt.verify(token, config.jwtRefreshSecret) as JWTPayload;
      if (decoded.tokenType !== 'refresh') {
        throw new Error('Invalid token type');
      }
      return decoded;
    } catch (error) {
      throw new Error('Invalid or expired refresh token');
    }
  }

  /**
   * Generate password reset token
   */
  static generateResetToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Generate email verification token
   */
  static generateVerificationToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Hash password reset token for storage
   */
  static hashResetToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  /**
   * Check if user has required permission
   */
  static hasPermission(userPermissions: string[], requiredPermission: string): boolean {
    // Super admin has all permissions
    if (userPermissions.includes('*')) {
      return true;
    }

    // Check exact permission match
    if (userPermissions.includes(requiredPermission)) {
      return true;
    }

    // Check wildcard permissions (e.g., 'products:*' includes 'products:read')
    const [resource, action] = requiredPermission.split(':');
    const wildcardPermission = `${resource}:*`;
    
    return userPermissions.includes(wildcardPermission);
  }

  /**
   * Check if user has any of the required roles
   */
  static hasRole(userRole: string, allowedRoles: string[]): boolean {
    return allowedRoles.includes(userRole);
  }

  /**
   * Check if user can access specific store
   */
  static canAccessStore(userRole: string, userStoreId: string | undefined, targetStoreId: string): boolean {
    // Super admin and warehouse manager can access all stores
    if (['SUPER_ADMIN', 'WAREHOUSE_MANAGER'].includes(userRole)) {
      return true;
    }

    // Store-specific roles can only access their own store
    if (['STORE_MANAGER', 'STORE_CLERK'].includes(userRole)) {
      return userStoreId === targetStoreId;
    }

    // Auditor and viewer can access all stores (read-only)
    if (['AUDITOR', 'VIEWER'].includes(userRole)) {
      return true;
    }

    return false;
  }

  /**
   * Get default permissions for a role
   */
  static getDefaultPermissions(role: string): string[] {
    const permissions: Record<string, string[]> = {
      SUPER_ADMIN: ['*'],
      WAREHOUSE_MANAGER: [
        'warehouse:read',
        'warehouse:write',
        'inventory:read',
        'inventory:write',
        'products:read',
        'products:write',
        'transfers:approve',
        'reports:read',
        'alerts:read',
        'alerts:write',
        'stores:read',
        'users:read',
        'batches:read',
        'batches:write',
      ],
      STORE_MANAGER: [
        'store:read',
        'store:write',
        'inventory:read',
        'inventory:write',
        'products:read',
        'transactions:read',
        'transactions:write',
        'transfers:create',
        'reports:read',
        'alerts:read',
        'users:read',
        'batches:read',
      ],
      STORE_CLERK: [
        'store:read',
        'inventory:read',
        'inventory:write',
        'products:read',
        'transactions:create',
        'transactions:read',
        'batches:read',
      ],
      AUDITOR: [
        'inventory:read',
        'products:read',
        'transactions:read',
        'reports:read',
        'alerts:read',
        'stores:read',
        'warehouse:read',
        'batches:read',
        'users:read',
      ],
      VIEWER: [
        'inventory:read',
        'products:read',
        'reports:read',
        'batches:read',
      ],
    };

    return permissions[role] || [];
  }

  /**
   * Validate password strength
   */
  static validatePassword(password: string): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (password.length < 8) {
      errors.push('Password must be at least 8 characters long');
    }

    if (!/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }

    if (!/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }

    if (!/\d/.test(password)) {
      errors.push('Password must contain at least one number');
    }

    if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      errors.push('Password must contain at least one special character');
    }

    return { isValid: errors.length === 0, errors };
  }

  /**
   * Generate a secure random password
   */
  static generateSecurePassword(length: number = 12): string {
    const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const lowercase = 'abcdefghijklmnopqrstuvwxyz';
    const numbers = '0123456789';
    const symbols = '!@#$%^&*(),.?":{}|<>';
    
    const allChars = uppercase + lowercase + numbers + symbols;
    let password = '';
    
    // Ensure at least one character from each category
    password += uppercase[Math.floor(Math.random() * uppercase.length)];
    password += lowercase[Math.floor(Math.random() * lowercase.length)];
    password += numbers[Math.floor(Math.random() * numbers.length)];
    password += symbols[Math.floor(Math.random() * symbols.length)];
    
    // Fill the rest randomly
    for (let i = 4; i < length; i++) {
      password += allChars[Math.floor(Math.random() * allChars.length)];
    }
    
    // Shuffle the password
    return password.split('').sort(() => Math.random() - 0.5).join('');
  }
}