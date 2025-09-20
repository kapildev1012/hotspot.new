import { config } from 'dotenv';

// Load test environment variables
config({ path: '.env.test' });

// Set default test environment variables
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing-only';
process.env.JWT_REFRESH_SECRET = 'test-jwt-refresh-secret-key-for-testing-only';
process.env.JWT_EXPIRES_IN = '15m';
process.env.JWT_REFRESH_EXPIRES_IN = '7d';
process.env.CLOUDINARY_CLOUD_NAME = 'test-cloud';
process.env.CLOUDINARY_API_KEY = 'test-api-key';
process.env.CLOUDINARY_API_SECRET = 'test-api-secret';

// Mock external services
jest.mock('../src/utils/cloudinary', () => ({
  uploadImage: jest.fn().mockResolvedValue({
    url: 'https://test-cloudinary.com/image.jpg',
    publicId: 'test-image-id'
  }),
  deleteImage: jest.fn().mockResolvedValue(true),
}));

// Mock Redis client
jest.mock('../src/config/redis', () => ({
  redisClient: {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    exists: jest.fn(),
    expire: jest.fn(),
    flushall: jest.fn(),
    quit: jest.fn(),
  },
}));

// Mock Socket.IO
jest.mock('socket.io', () => {
  const mockEmit = jest.fn();
  const mockTo = jest.fn(() => ({ emit: mockEmit }));
  const mockIn = jest.fn(() => ({ emit: mockEmit }));
  
  return {
    Server: jest.fn().mockImplementation(() => ({
      emit: mockEmit,
      to: mockTo,
      in: mockIn,
      on: jest.fn(),
      use: jest.fn(),
    })),
  };
});

// Mock node-cron
jest.mock('node-cron', () => ({
  schedule: jest.fn(),
  destroy: jest.fn(),
  getTasks: jest.fn(() => new Map()),
}));

// Console override for cleaner test output
const originalError = console.error;
beforeAll(() => {
  console.error = (...args: any[]) => {
    if (
      typeof args[0] === 'string' &&
      args[0].includes('Warning') &&
      (args[0].includes('ExperimentalWarning') || args[0].includes('punycode'))
    ) {
      return;
    }
    originalError.call(console, ...args);
  };
});

afterAll(() => {
  console.error = originalError;
});