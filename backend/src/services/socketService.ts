import { Server as HttpServer } from 'http';
import { Server } from 'socket.io';
import { config } from '../config/index.js';
import { User } from '../models/index.js';
import { AuthService } from './authService.js';

interface AuthenticatedSocket {
  id: string;
  userId: string;
  userRole: string;
  storeId?: string;
  join: (room: string) => void;
  leave: (room: string) => void;
  emit: (event: string, data: any) => void;
  to: (room: string) => any;
  broadcast: any;
}

export interface InventoryUpdateData {
  type: 'INVENTORY_UPDATE' | 'TRANSACTION_CREATED' | 'ALERT_CREATED' | 'BATCH_EXPIRING';
  locationId: string;
  locationType: 'WAREHOUSE' | 'STORE';
  productId?: string;
  data: any;
  timestamp: Date;
}

export class SocketService {
  private io: Server;
  private connectedUsers: Map<string, AuthenticatedSocket> = new Map();

  constructor(server: HttpServer) {
    this.io = new Server(server, {
      cors: {
        origin: [config.frontendUrl, 'http://localhost:3000'],
        methods: ['GET', 'POST'],
        credentials: true,
      },
      transports: ['websocket', 'polling'],
    });

    this.setupMiddleware();
    this.setupEventHandlers();
  }

  private setupMiddleware(): void {
    // Authentication middleware
    this.io.use(async (socket: any, next) => {
      try {
        const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.split(' ')[1];
        
        if (!token) {
          return next(new Error('Authentication token required'));
        }

        const decoded = AuthService.verifyAccessToken(token);
        const user = await User.findById(decoded.userId);

        if (!user || !user.isActive) {
          return next(new Error('User not found or inactive'));
        }

        socket.userId = user._id.toString();
        socket.userRole = user.role;
        socket.storeId = user.storeId?.toString();
        socket.userName = user.name;

        next();
      } catch (error) {
        next(new Error('Invalid authentication token'));
      }
    });
  }

  private setupEventHandlers(): void {
    this.io.on('connection', (socket: any) => {
      console.log(`User connected: ${socket.userName} (${socket.userId})`);
      
      // Store connected user
      this.connectedUsers.set(socket.userId, socket);

      // Join user-specific room
      socket.join(`user:${socket.userId}`);

      // Join role-based rooms
      socket.join(`role:${socket.userRole}`);

      // Join store-specific room if applicable
      if (socket.storeId) {
        socket.join(`store:${socket.storeId}`);
      }

      // Admins and warehouse managers join all rooms
      if (['SUPER_ADMIN', 'WAREHOUSE_MANAGER'].includes(socket.userRole)) {
        socket.join('admin');
        socket.join('warehouse');
      }

      // Handle custom events
      this.handleCustomEvents(socket);

      // Handle disconnection
      socket.on('disconnect', () => {
        console.log(`User disconnected: ${socket.userName} (${socket.userId})`);
        this.connectedUsers.delete(socket.userId);
      });

      // Send welcome message
      socket.emit('connected', {
        message: 'Connected to SmartStock real-time updates',
        userId: socket.userId,
        role: socket.userRole,
        timestamp: new Date(),
      });
    });
  }

  private handleCustomEvents(socket: any): void {
    // Join specific location room
    socket.on('join_location', (data: { locationType: string; locationId: string }) => {
      const roomName = `${data.locationType.toLowerCase()}:${data.locationId}`;
      socket.join(roomName);
      socket.emit('joined_location', { room: roomName });
    });

    // Leave specific location room
    socket.on('leave_location', (data: { locationType: string; locationId: string }) => {
      const roomName = `${data.locationType.toLowerCase()}:${data.locationId}`;
      socket.leave(roomName);
      socket.emit('left_location', { room: roomName });
    });

    // Request current inventory status
    socket.on('request_inventory_status', async (data: { locationType: string; locationId: string }) => {
      try {
        // This would fetch current inventory and send it back
        // Implementation depends on your specific needs
        socket.emit('inventory_status', {
          locationType: data.locationType,
          locationId: data.locationId,
          timestamp: new Date(),
        });
      } catch (error) {
        socket.emit('error', { message: 'Failed to fetch inventory status' });
      }
    });

    // Handle typing indicators for collaborative features
    socket.on('typing', (data: { room: string; message: string }) => {
      socket.to(data.room).emit('user_typing', {
        userId: socket.userId,
        userName: socket.userName,
        message: data.message,
      });
    });

    socket.on('stop_typing', (data: { room: string }) => {
      socket.to(data.room).emit('user_stop_typing', {
        userId: socket.userId,
        userName: socket.userName,
      });
    });
  }

  // Public methods for emitting events

  /**
   * Broadcast inventory update to relevant users
   */
  public broadcastInventoryUpdate(data: InventoryUpdateData): void {
    const roomName = `${data.locationType.toLowerCase()}:${data.locationId}`;
    
    // Emit to location-specific room
    this.io.to(roomName).emit('inventory_update', data);
    
    // Also emit to admin users
    this.io.to('admin').emit('inventory_update', data);
    
    console.log(`Broadcasted inventory update to ${roomName}:`, data.type);
  }

  /**
   * Broadcast transaction created event
   */
  public broadcastTransactionCreated(transactionData: any): void {
    const data: InventoryUpdateData = {
      type: 'TRANSACTION_CREATED',
      locationId: transactionData.source?.id || transactionData.destination?.id,
      locationType: transactionData.source?.type || transactionData.destination?.type,
      data: transactionData,
      timestamp: new Date(),
    };

    // Broadcast to source location
    if (transactionData.source) {
      const sourceRoom = `${transactionData.source.type.toLowerCase()}:${transactionData.source.id}`;
      this.io.to(sourceRoom).emit('transaction_created', data);
    }

    // Broadcast to destination location
    if (transactionData.destination) {
      const destRoom = `${transactionData.destination.type.toLowerCase()}:${transactionData.destination.id}`;
      this.io.to(destRoom).emit('transaction_created', data);
    }

    // Broadcast to admins
    this.io.to('admin').emit('transaction_created', data);
  }

  /**
   * Broadcast alert created event
   */
  public broadcastAlertCreated(alertData: any): void {
    const data = {
      type: 'ALERT_CREATED',
      alert: alertData,
      timestamp: new Date(),
    };

    // Broadcast to relevant location
    if (alertData.storeId) {
      this.io.to(`store:${alertData.storeId}`).emit('alert_created', data);
    }
    
    if (alertData.warehouseId) {
      this.io.to(`warehouse:${alertData.warehouseId}`).emit('alert_created', data);
    }

    // Broadcast to relevant roles based on alert type
    const roleMapping: Record<string, string[]> = {
      'LOW_STOCK': ['WAREHOUSE_MANAGER', 'STORE_MANAGER'],
      'EXPIRY': ['WAREHOUSE_MANAGER', 'STORE_MANAGER', 'STORE_CLERK'],
      'OVERSTOCK': ['WAREHOUSE_MANAGER'],
      'NEGATIVE_STOCK': ['SUPER_ADMIN', 'WAREHOUSE_MANAGER'],
      'REORDER_SUGGESTION': ['WAREHOUSE_MANAGER', 'STORE_MANAGER'],
      'SUSPICIOUS_ACTIVITY': ['SUPER_ADMIN', 'WAREHOUSE_MANAGER'],
    };

    const relevantRoles = roleMapping[alertData.type] || ['SUPER_ADMIN'];
    relevantRoles.forEach(role => {
      this.io.to(`role:${role}`).emit('alert_created', data);
    });

    console.log(`Broadcasted alert created: ${alertData.type}`);
  }

  /**
   * Broadcast batch expiring notification
   */
  public broadcastBatchExpiring(batchData: any): void {
    const data = {
      type: 'BATCH_EXPIRING',
      batch: batchData,
      timestamp: new Date(),
    };

    // Broadcast to all managers and clerks
    this.io.to('role:WAREHOUSE_MANAGER').emit('batch_expiring', data);
    this.io.to('role:STORE_MANAGER').emit('batch_expiring', data);
    this.io.to('role:STORE_CLERK').emit('batch_expiring', data);

    console.log(`Broadcasted batch expiring: ${batchData.batchNumber}`);
  }

  /**
   * Send notification to specific user
   */
  public sendNotificationToUser(userId: string, notification: any): void {
    this.io.to(`user:${userId}`).emit('notification', {
      ...notification,
      timestamp: new Date(),
    });
  }

  /**
   * Send notification to users with specific role
   */
  public sendNotificationToRole(role: string, notification: any): void {
    this.io.to(`role:${role}`).emit('notification', {
      ...notification,
      timestamp: new Date(),
    });
  }

  /**
   * Get connected users count
   */
  public getConnectedUsersCount(): number {
    return this.connectedUsers.size;
  }

  /**
   * Get connected users by role
   */
  public getConnectedUsersByRole(role: string): string[] {
    const users: string[] = [];
    this.connectedUsers.forEach((socket, userId) => {
      if (socket.userRole === role) {
        users.push(userId);
      }
    });
    return users;
  }

  /**
   * Check if user is connected
   */
  public isUserConnected(userId: string): boolean {
    return this.connectedUsers.has(userId);
  }

  /**
   * Disconnect user
   */
  public disconnectUser(userId: string, reason?: string): void {
    const socket = this.connectedUsers.get(userId);
    if (socket) {
      socket.emit('force_disconnect', { reason: reason || 'Disconnected by admin' });
      socket.disconnect(true);
      this.connectedUsers.delete(userId);
    }
  }

  /**
   * Broadcast system maintenance message
   */
  public broadcastMaintenanceMessage(message: string, scheduledTime?: Date): void {
    this.io.emit('maintenance_notification', {
      message,
      scheduledTime,
      timestamp: new Date(),
    });
  }

  /**
   * Get Socket.IO server instance
   */
  public getIO(): Server {
    return this.io;
  }
}

// Singleton instance
let socketService: SocketService | null = null;

export const initializeSocketService = (server: HttpServer): SocketService => {
  if (!socketService) {
    socketService = new SocketService(server);
  }
  return socketService;
};

export const getSocketService = (): SocketService => {
  if (!socketService) {
    throw new Error('Socket service not initialized');
  }
  return socketService;
};