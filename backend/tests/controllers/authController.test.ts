import bcrypt from 'bcryptjs';
import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { authController } from '../../src/controllers/authController';
import { User } from '../../src/models/User';
import { generateTokens } from '../../src/utils/jwt';

// Mock dependencies
jest.mock('../../src/models/User');
jest.mock('../../src/utils/jwt');
jest.mock('bcryptjs');
jest.mock('jsonwebtoken');

const mockUser = User as jest.Mocked<typeof User>;
const mockGenerateTokens = generateTokens as jest.MockedFunction<typeof generateTokens>;
const mockBcrypt = bcrypt as jest.Mocked<typeof bcrypt>;
const mockJwt = jwt as jest.Mocked<typeof jwt>;

describe('AuthController', () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let jsonSpy: jest.SpyInstance;
  let statusSpy: jest.SpyInstance;

  beforeEach(() => {
    req = {};
    jsonSpy = jest.fn();
    statusSpy = jest.fn().mockReturnValue({ json: jsonSpy });
    res = {
      status: statusSpy,
      json: jsonSpy,
    };
    jest.clearAllMocks();
  });

  describe('register', () => {
    beforeEach(() => {
      req.body = {
        name: 'John Doe',
        email: 'john@example.com',
        password: 'password123',
        role: 'STAFF',
      };
    });

    it('should register a new user successfully', async () => {
      const mockNewUser = {
        _id: 'user123',
        name: 'John Doe',
        email: 'john@example.com',
        role: 'STAFF',
        save: jest.fn().mockResolvedValue(true),
      };

      mockUser.findOne.mockResolvedValue(null);
      mockBcrypt.hash.mockResolvedValue('hashedPassword');
      mockUser.mockImplementation(() => mockNewUser as any);
      mockGenerateTokens.mockReturnValue({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      });

      await authController.register(req as Request, res as Response);

      expect(mockUser.findOne).toHaveBeenCalledWith({ email: 'john@example.com' });
      expect(mockBcrypt.hash).toHaveBeenCalledWith('password123', 10);
      expect(mockNewUser.save).toHaveBeenCalled();
      expect(statusSpy).toHaveBeenCalledWith(201);
      expect(jsonSpy).toHaveBeenCalledWith({
        success: true,
        message: 'User registered successfully',
        data: {
          user: expect.objectContaining({
            id: 'user123',
            name: 'John Doe',
            email: 'john@example.com',
            role: 'STAFF',
          }),
          accessToken: 'access-token',
          refreshToken: 'refresh-token',
        },
      });
    });

    it('should return error if user already exists', async () => {
      mockUser.findOne.mockResolvedValue({ email: 'john@example.com' });

      await authController.register(req as Request, res as Response);

      expect(statusSpy).toHaveBeenCalledWith(409);
      expect(jsonSpy).toHaveBeenCalledWith({
        success: false,
        message: 'User already exists with this email',
      });
    });

    it('should return error for invalid input', async () => {
      req.body = {
        name: '',
        email: 'invalid-email',
        password: '123',
        role: 'INVALID_ROLE',
      };

      await authController.register(req as Request, res as Response);

      expect(statusSpy).toHaveBeenCalledWith(400);
      expect(jsonSpy).toHaveBeenCalledWith({
        success: false,
        message: expect.stringContaining('validation'),
      });
    });
  });

  describe('login', () => {
    beforeEach(() => {
      req.body = {
        email: 'john@example.com',
        password: 'password123',
      };
    });

    it('should login user successfully', async () => {
      const mockUser = {
        _id: 'user123',
        name: 'John Doe',
        email: 'john@example.com',
        password: 'hashedPassword',
        role: 'STAFF',
        isActive: true,
        lastLogin: new Date(),
        save: jest.fn().mockResolvedValue(true),
      };

      User.findOne.mockResolvedValue(mockUser);
      mockBcrypt.compare.mockResolvedValue(true);
      mockGenerateTokens.mockReturnValue({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      });

      await authController.login(req as Request, res as Response);

      expect(User.findOne).toHaveBeenCalledWith({ email: 'john@example.com' });
      expect(mockBcrypt.compare).toHaveBeenCalledWith('password123', 'hashedPassword');
      expect(mockUser.save).toHaveBeenCalled();
      expect(jsonSpy).toHaveBeenCalledWith({
        success: true,
        message: 'Login successful',
        data: {
          user: expect.objectContaining({
            id: 'user123',
            name: 'John Doe',
            email: 'john@example.com',
            role: 'STAFF',
          }),
          accessToken: 'access-token',
          refreshToken: 'refresh-token',
        },
      });
    });

    it('should return error for non-existent user', async () => {
      User.findOne.mockResolvedValue(null);

      await authController.login(req as Request, res as Response);

      expect(statusSpy).toHaveBeenCalledWith(401);
      expect(jsonSpy).toHaveBeenCalledWith({
        success: false,
        message: 'Invalid credentials',
      });
    });

    it('should return error for incorrect password', async () => {
      const mockUser = {
        email: 'john@example.com',
        password: 'hashedPassword',
        isActive: true,
      };

      User.findOne.mockResolvedValue(mockUser);
      mockBcrypt.compare.mockResolvedValue(false);

      await authController.login(req as Request, res as Response);

      expect(statusSpy).toHaveBeenCalledWith(401);
      expect(jsonSpy).toHaveBeenCalledWith({
        success: false,
        message: 'Invalid credentials',
      });
    });

    it('should return error for inactive user', async () => {
      const mockUser = {
        email: 'john@example.com',
        password: 'hashedPassword',
        isActive: false,
      };

      User.findOne.mockResolvedValue(mockUser);
      mockBcrypt.compare.mockResolvedValue(true);

      await authController.login(req as Request, res as Response);

      expect(statusSpy).toHaveBeenCalledWith(403);
      expect(jsonSpy).toHaveBeenCalledWith({
        success: false,
        message: 'Account is deactivated',
      });
    });
  });

  describe('refreshToken', () => {
    beforeEach(() => {
      req.body = {
        refreshToken: 'valid-refresh-token',
      };
    });

    it('should refresh token successfully', async () => {
      const mockDecoded = {
        userId: 'user123',
        tokenVersion: 1,
      };

      const mockUser = {
        _id: 'user123',
        name: 'John Doe',
        email: 'john@example.com',
        role: 'STAFF',
        tokenVersion: 1,
        isActive: true,
      };

      mockJwt.verify.mockReturnValue(mockDecoded);
      User.findById.mockResolvedValue(mockUser);
      mockGenerateTokens.mockReturnValue({
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
      });

      await authController.refreshToken(req as Request, res as Response);

      expect(mockJwt.verify).toHaveBeenCalledWith(
        'valid-refresh-token',
        process.env.JWT_REFRESH_SECRET
      );
      expect(User.findById).toHaveBeenCalledWith('user123');
      expect(jsonSpy).toHaveBeenCalledWith({
        success: true,
        message: 'Token refreshed successfully',
        data: {
          accessToken: 'new-access-token',
          refreshToken: 'new-refresh-token',
        },
      });
    });

    it('should return error for invalid refresh token', async () => {
      mockJwt.verify.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      await authController.refreshToken(req as Request, res as Response);

      expect(statusSpy).toHaveBeenCalledWith(401);
      expect(jsonSpy).toHaveBeenCalledWith({
        success: false,
        message: 'Invalid refresh token',
      });
    });

    it('should return error for token version mismatch', async () => {
      const mockDecoded = {
        userId: 'user123',
        tokenVersion: 1,
      };

      const mockUser = {
        _id: 'user123',
        tokenVersion: 2, // Different version
        isActive: true,
      };

      mockJwt.verify.mockReturnValue(mockDecoded);
      User.findById.mockResolvedValue(mockUser);

      await authController.refreshToken(req as Request, res as Response);

      expect(statusSpy).toHaveBeenCalledWith(401);
      expect(jsonSpy).toHaveBeenCalledWith({
        success: false,
        message: 'Invalid refresh token',
      });
    });
  });
});