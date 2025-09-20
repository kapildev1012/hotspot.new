import compression from 'compression';
import cors from 'cors';
import express, { Application, Request, Response } from 'express';
import 'express-async-errors';
import helmet from 'helmet';
import { createServer } from 'http';
import morgan from 'morgan';

import connectDB from './config/database.js';
import { config } from './config/index.js';
import redisClient from './config/redis.js';
import {
    compressionOptions,
    corsOptions,
    helmetOptions,
    morganFormat,
    rateLimiter,
    requestId,
    requestTimeout
} from './middleware/common.js';
import { alertService } from './services/alertService.js';
import { initializeSocketService } from './services/socketService.js';
import { errorHandler } from './utils/errors.js';

// Import routes
import alertRoutes from './routes/alerts.js';
import authRoutes from './routes/auth.js';
import batchRoutes from './routes/batches.js';
import { healthRouter } from './routes/health.js';
import importExportRoutes from './routes/importExport.js';
import productRoutes from './routes/products.js';
import storeRoutes from './routes/stores.js';
import transactionRoutes from './routes/transactions.js';
import userRoutes from './routes/users.js';
import warehouseRoutes from './routes/warehouses.js';
// import reportRoutes from './routes/reports.js';

class App {
  public app: Application;
  public server: any;

  constructor() {
    this.app = express();
    this.server = createServer(this.app);
    this.initializeDatabase();
    this.initializeMiddlewares();
    this.initializeRoutes();
    this.initializeSocketIO();
    this.initializeErrorHandling();
  }

  private async initializeDatabase(): Promise<void> {
    await connectDB();
    await redisClient.connect();
  }

  private initializeMiddlewares(): void {
    // Request ID
    this.app.use(requestId);
    
    // Security
    this.app.use(helmet(helmetOptions));
    this.app.use(cors(corsOptions));
    
    // Rate limiting
    this.app.use('/api/', rateLimiter);
    
    // Request timeout
    this.app.use(requestTimeout(30000));
    
    // Compression
    this.app.use(compression(compressionOptions));
    
    // Logging
    this.app.use(morgan(morganFormat));
    
    // Body parsing
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));
    
    // Static files
    this.app.use('/uploads', express.static('uploads'));
  }

  private initializeRoutes(): void {
    // Health check routes
    this.app.use('/api/health', healthRouter);
    
    // API routes
    this.app.use('/api/alerts', alertRoutes);
    this.app.use('/api/auth', authRoutes);
    this.app.use('/api/users', userRoutes);
    this.app.use('/api/products', productRoutes);
    this.app.use('/api/batches', batchRoutes);
    this.app.use('/api/warehouses', warehouseRoutes);
    this.app.use('/api/stores', storeRoutes);
    this.app.use('/api/transactions', transactionRoutes);
    this.app.use('/api/import-export', importExportRoutes);
    // this.app.use('/api/reports', reportRoutes);
    
    // Catch all
    this.app.all('*', (req: Request, res: Response) => {
      res.status(404).json({
        success: false,
        error: `Route ${req.originalUrl} not found`,
      });
    });
  }

  private initializeSocketIO(): void {
    // Initialize Socket.IO service
    initializeSocketService(this.server);
    console.log('Socket.IO initialized');
    
    // Start alert service cron jobs
    alertService.startCronJobs();
    console.log('Alert service started');
  }

  private initializeErrorHandling(): void {
    this.app.use(errorHandler);
  }

  public listen(): void {
    this.server.listen(config.port, () => {
      console.log(`Server running on port ${config.port} in ${config.nodeEnv} mode`);
    });
  }
}

export default App;