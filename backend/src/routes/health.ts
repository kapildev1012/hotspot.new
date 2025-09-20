import { Request, Response, Router } from 'express';
import mongoose from 'mongoose';
import redisClient from '../config/redis';

const router = Router();

interface HealthStatus {
  status: 'healthy' | 'unhealthy';
  timestamp: string;
  uptime: number;
  environment: string;
  version: string;
  services: {
    database: {
      status: 'connected' | 'disconnected' | 'error';
      responseTime?: number;
    };
    redis: {
      status: 'connected' | 'disconnected' | 'error';
      responseTime?: number;
    };
  };
  memory: {
    used: number;
    total: number;
    percentage: number;
  };
  cpu: {
    usage: number;
  };
}

// Health check endpoint
router.get('/', async (req: Request, res: Response) => {
  const startTime = Date.now();
  
  try {
    const healthStatus: HealthStatus = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
      version: process.env.npm_package_version || '1.0.0',
      services: {
        database: {
          status: 'disconnected',
          responseTime: 0,
        },
        redis: {
          status: 'disconnected',
          responseTime: 0,
        },
      },
      memory: {
        used: 0,
        total: 0,
        percentage: 0,
      },
      cpu: {
        usage: 0,
      },
    };

    // Check MongoDB connection
    try {
      const dbStart = Date.now();
      if (mongoose.connection.db) {
        await mongoose.connection.db.admin().ping();
        healthStatus.services.database.status = 'connected';
        healthStatus.services.database.responseTime = Date.now() - dbStart;
      } else {
        healthStatus.services.database.status = 'error';
        healthStatus.status = 'unhealthy';
      }
    } catch (error) {
      healthStatus.services.database.status = 'error';
      healthStatus.status = 'unhealthy';
    }

    // Check Redis connection
    try {
      if (redisClient) {
        const redisStart = Date.now();
        await redisClient.ping();
        healthStatus.services.redis.status = 'connected';
        healthStatus.services.redis.responseTime = Date.now() - redisStart;
      }
    } catch (error) {
      healthStatus.services.redis.status = 'error';
      // Redis is optional, so don't mark as unhealthy
    }

    // Memory usage
    const memUsage = process.memoryUsage();
    const totalMemory = require('os').totalmem();
    healthStatus.memory = {
      used: memUsage.heapUsed,
      total: totalMemory,
      percentage: (memUsage.heapUsed / totalMemory) * 100,
    };

    // CPU usage (simple approximation)
    const cpuUsage = process.cpuUsage();
    healthStatus.cpu = {
      usage: (cpuUsage.user + cpuUsage.system) / 1000000, // Convert to seconds
    };

    const responseTime = Date.now() - startTime;

    // Set status code based on health
    const statusCode = healthStatus.status === 'healthy' ? 200 : 503;

    res.status(statusCode).json({
      ...healthStatus,
      responseTime,
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: 'Health check failed',
      responseTime: Date.now() - startTime,
    });
  }
});

// Liveness probe - simple check that the app is running
router.get('/live', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'alive',
    timestamp: new Date().toISOString(),
  });
});

// Readiness probe - check if app is ready to serve traffic
router.get('/ready', async (req: Request, res: Response) => {
  try {
    // Check if database is accessible
    if (mongoose.connection.db) {
      await mongoose.connection.db.admin().ping();
    } else {
      throw new Error('Database connection not available');
    }
    
    res.status(200).json({
      status: 'ready',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(503).json({
      status: 'not ready',
      timestamp: new Date().toISOString(),
      error: 'Database not accessible',
    });
  }
});

export { router as healthRouter };
