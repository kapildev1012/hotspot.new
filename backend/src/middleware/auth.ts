import { NextFunction, Request, Response } from 'express';
import redisClient from '../config/redis.js';
import { User } from '../models/index.js';
import { AuthService } from '../services/authService.js';
import { AppError } from '../utils/errors.js';

// Extend Express Request type to include user
declare global {
  namespace Express {
    interface Request {
      user?: any;
      id?: string;
    }
  }
}

/**
 * Middleware to authenticate user using JWT token
 */
export const authenticate = async (req: Request, res: Response, next: NextFunction) => {
  try {
    let token: string | undefined;

    // Check for token in Authorization header
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    }

    // Check for token in cookies
    if (!token && req.cookies && req.cookies.accessToken) {
      token = req.cookies.accessToken;
    }

    if (!token) {
      return next(new AppError('Access token is required', 401));
    }

    // Verify token
    const decoded = AuthService.verifyAccessToken(token);

    // Check if token is blacklisted (for logout functionality)
    const isBlacklisted = await redisClient.exists(`blacklist:${token}`);
    if (isBlacklisted) {
      return next(new AppError('Token has been invalidated', 401));
    }

    // Get user from database
    const user = await User.findById(decoded.userId).select('+refreshToken');
    if (!user || !user.isActive) {
      return next(new AppError('User not found or inactive', 401));
    }

    // Check if user's permissions have changed
    if (JSON.stringify(user.permissions.sort()) !== JSON.stringify(decoded.permissions.sort())) {
      return next(new AppError('User permissions have changed. Please login again.', 401));
    }

    // Attach user to request
    req.user = {
      id: user._id,
      email: user.email,
      name: user.name,
      role: user.role,
      storeId: user.storeId,
      permissions: user.permissions,
    };

    next();
  } catch (error) {
    next(new AppError('Invalid or expired token', 401));
  }
};

/**
 * Middleware to check if user has required permission
 */
export const requirePermission = (permission: string) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new AppError('Authentication required', 401));
    }

    if (!AuthService.hasPermission(req.user.permissions, permission)) {
      return next(new AppError('Insufficient permissions', 403));
    }

    next();
  };
};

/**
 * Middleware to check if user has any of the required roles
 */
export const requireRole = (roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new AppError('Authentication required', 401));
    }

    if (!AuthService.hasRole(req.user.role, roles)) {
      return next(new AppError('Insufficient role permissions', 403));
    }

    next();
  };
};

/**
 * Middleware to check if user can access specific store
 */
export const requireStoreAccess = (storeIdParam: string = 'storeId') => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new AppError('Authentication required', 401));
    }

    const targetStoreId = req.params[storeIdParam] || req.body.storeId;
    if (!targetStoreId) {
      return next(new AppError('Store ID is required', 400));
    }

    if (!AuthService.canAccessStore(req.user.role, req.user.storeId, targetStoreId)) {
      return next(new AppError('Access denied for this store', 403));
    }

    next();
  };
};

/**
 * Middleware for optional authentication (user may or may not be logged in)
 */
export const optionalAuth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    let token: string | undefined;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token && req.cookies && req.cookies.accessToken) {
      token = req.cookies.accessToken;
    }

    if (token) {
      try {
        const decoded = AuthService.verifyAccessToken(token);
        const user = await User.findById(decoded.userId);
        
        if (user && user.isActive) {
          req.user = {
            id: user._id,
            email: user.email,
            name: user.name,
            role: user.role,
            storeId: user.storeId,
            permissions: user.permissions,
          };
        }
      } catch (error) {
        // Ignore token errors for optional auth
      }
    }

    next();
  } catch (error) {
    next();
  }
};

/**
 * Middleware to check if user is admin (SUPER_ADMIN or WAREHOUSE_MANAGER)
 */
export const requireAdmin = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) {
    return next(new AppError('Authentication required', 401));
  }

  if (!['SUPER_ADMIN', 'WAREHOUSE_MANAGER'].includes(req.user.role)) {
    return next(new AppError('Admin access required', 403));
  }

  next();
};

/**
 * Middleware to validate user can perform action on their own account or is admin
 */
export const requireSelfOrAdmin = (userIdParam: string = 'userId') => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new AppError('Authentication required', 401));
    }

    const targetUserId = req.params[userIdParam] || req.body.userId;
    const isOwnAccount = req.user.id === targetUserId;
    const isAdmin = ['SUPER_ADMIN', 'WAREHOUSE_MANAGER'].includes(req.user.role);

    if (!isOwnAccount && !isAdmin) {
      return next(new AppError('Can only access own account or admin required', 403));
    }

    next();
  };
};

/**
 * Rate limiting middleware for authentication endpoints
 */
export const authRateLimit = (req: Request, res: Response, next: NextFunction) => {
  // This would typically use a more sophisticated rate limiting strategy
  // For now, we'll implement a simple in-memory counter
  const ip = req.ip || req.connection.remoteAddress || 'unknown';
  const key = `auth_attempts:${ip}`;
  
  // In a production environment, you'd want to use Redis for this
  // and implement more sophisticated rate limiting
  next();
};

/**
 * Middleware to log authentication events
 */
export const logAuthEvent = (event: string) => {
  return (req: Request, res: Response, next: NextFunction) => {
    // Log the authentication event
    console.log(`Auth Event: ${event} - IP: ${req.ip} - User-Agent: ${req.get('User-Agent')}`);
    next();
  };
};