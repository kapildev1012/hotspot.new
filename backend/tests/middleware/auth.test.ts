import { NextFunction, Response } from 'express';
import jwt from 'jsonwebtoken';
import { authenticate, requireRole } from '../../src/middleware/auth';
import { User } from '../../src/models/User';
import { AuthenticatedRequest, UserRole } from '../../src/types';

// Mock dependencies
jest.mock('jsonwebtoken');
jest.mock('../../src/models/User');

const mockJwt = jwt as jest.Mocked<typeof jwt>;
const mockUser = User as jest.Mocked<typeof User>;

describe('Auth Middleware', () => {
  let req: Partial<AuthenticatedRequest>;
  let res: Partial<Response>;
  let next: NextFunction;
  let jsonSpy: jest.SpyInstance;
  let statusSpy: jest.SpyInstance;

  beforeEach(() => {
    req = {
      headers: {},
    };
    jsonSpy = jest.fn();
    statusSpy = jest.fn().mockReturnValue({ json: jsonSpy });
    res = {
      status: statusSpy,
      json: jsonSpy,
    };
    next = jest.fn();
    jest.clearAllMocks();
  });

  describe('authenticate', () => {
    it('should authenticate user with valid token', async () => {
      const mockUserData = {
        _id: 'user123',
        name: 'John Doe',
        email: 'john@example.com',
        role: UserRole.STAFF,
        isActive: true,
      };

      req.headers = {
        authorization: 'Bearer valid-token',
      };

      mockJwt.verify.mockReturnValue({ userId: 'user123' });
      mockUser.findById.mockResolvedValue(mockUserData);

      await authenticate(req as AuthenticatedRequest, res as Response, next);

      expect(mockJwt.verify).toHaveBeenCalledWith('valid-token', process.env.JWT_SECRET);
      expect(mockUser.findById).toHaveBeenCalledWith('user123');
      expect(req.user).toEqual({
        id: 'user123',
        name: 'John Doe',
        email: 'john@example.com',
        role: UserRole.STAFF,
        isActive: true,
        permissions: [],
      });
      expect(next).toHaveBeenCalled();
    });

    it('should return 401 if no token provided', async () => {
      req.headers = {};

      await authenticate(req as AuthenticatedRequest, res as Response, next);

      expect(statusSpy).toHaveBeenCalledWith(401);
      expect(jsonSpy).toHaveBeenCalledWith({
        success: false,
        message: 'Access token required',
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should return 401 if token is invalid', async () => {
      req.headers = {
        authorization: 'Bearer invalid-token',
      };

      mockJwt.verify.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      await authenticate(req as AuthenticatedRequest, res as Response, next);

      expect(statusSpy).toHaveBeenCalledWith(401);
      expect(jsonSpy).toHaveBeenCalledWith({
        success: false,
        message: 'Invalid or expired token',
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should return 401 if user not found', async () => {
      req.headers = {
        authorization: 'Bearer valid-token',
      };

      mockJwt.verify.mockReturnValue({ userId: 'user123' });
      mockUser.findById.mockResolvedValue(null);

      await authenticate(req as AuthenticatedRequest, res as Response, next);

      expect(statusSpy).toHaveBeenCalledWith(401);
      expect(jsonSpy).toHaveBeenCalledWith({
        success: false,
        message: 'User not found',
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should return 403 if user is inactive', async () => {
      const mockUserData = {
        _id: 'user123',
        name: 'John Doe',
        email: 'john@example.com',
        role: UserRole.STAFF,
        isActive: false,
      };

      req.headers = {
        authorization: 'Bearer valid-token',
      };

      mockJwt.verify.mockReturnValue({ userId: 'user123' });
      mockUser.findById.mockResolvedValue(mockUserData);

      await authenticate(req as AuthenticatedRequest, res as Response, next);

      expect(statusSpy).toHaveBeenCalledWith(403);
      expect(jsonSpy).toHaveBeenCalledWith({
        success: false,
        message: 'Account is deactivated',
      });
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('requireRole', () => {
    beforeEach(() => {
      req.user = {
        id: 'user123',
        name: 'John Doe',
        email: 'john@example.com',
        role: UserRole.STAFF,
        isActive: true,
        permissions: [],
      };
    });

    it('should allow access for users with required role', () => {
      const middleware = requireRole([UserRole.STAFF, UserRole.STORE_MANAGER]);

      middleware(req as AuthenticatedRequest, res as Response, next);

      expect(next).toHaveBeenCalled();
      expect(statusSpy).not.toHaveBeenCalled();
    });

    it('should allow access for super admin regardless of required roles', () => {
      req.user!.role = UserRole.SUPER_ADMIN;
      const middleware = requireRole([UserRole.WAREHOUSE_MANAGER]);

      middleware(req as AuthenticatedRequest, res as Response, next);

      expect(next).toHaveBeenCalled();
      expect(statusSpy).not.toHaveBeenCalled();
    });

    it('should deny access for users without required role', () => {
      const middleware = requireRole([UserRole.WAREHOUSE_MANAGER, UserRole.SUPER_ADMIN]);

      middleware(req as AuthenticatedRequest, res as Response, next);

      expect(statusSpy).toHaveBeenCalledWith(403);
      expect(jsonSpy).toHaveBeenCalledWith({
        success: false,
        message: 'Insufficient permissions',
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should return 401 if user is not authenticated', () => {
      req.user = undefined;
      const middleware = requireRole([UserRole.STAFF]);

      middleware(req as AuthenticatedRequest, res as Response, next);

      expect(statusSpy).toHaveBeenCalledWith(401);
      expect(jsonSpy).toHaveBeenCalledWith({
        success: false,
        message: 'Authentication required',
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should allow access for users with specific permission', () => {
      req.user!.permissions = ['manage_products', 'view_reports'];
      const middleware = requireRole([UserRole.WAREHOUSE_MANAGER], ['manage_products']);

      middleware(req as AuthenticatedRequest, res as Response, next);

      expect(next).toHaveBeenCalled();
      expect(statusSpy).not.toHaveBeenCalled();
    });

    it('should deny access for users without required permission', () => {
      req.user!.permissions = ['view_inventory'];
      const middleware = requireRole([UserRole.WAREHOUSE_MANAGER], ['manage_products']);

      middleware(req as AuthenticatedRequest, res as Response, next);

      expect(statusSpy).toHaveBeenCalledWith(403);
      expect(jsonSpy).toHaveBeenCalledWith({
        success: false,
        message: 'Insufficient permissions',
      });
      expect(next).not.toHaveBeenCalled();
    });
  });
});