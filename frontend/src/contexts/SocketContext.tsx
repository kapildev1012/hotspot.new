import React, { createContext, ReactNode, useContext, useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import { io, Socket } from 'socket.io-client';
import { SocketEvents } from '../types/index.js';
import { useAuth } from './AuthContext.js';

interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
  joinRoom: (room: string) => void;
  leaveRoom: (room: string) => void;
  emit: <K extends keyof SocketEvents>(event: K, data: SocketEvents[K]) => void;
}

const SocketContext = createContext<SocketContextType | undefined>(undefined);

export const useSocket = (): SocketContextType => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};

interface SocketProviderProps {
  children: ReactNode;
}

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3001';

export const SocketProvider: React.FC<SocketProviderProps> = ({ children }) => {
  const { user, isAuthenticated } = useAuth();
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = React.useState(false);

  useEffect(() => {
    if (isAuthenticated && user) {
      // Initialize socket connection
      socketRef.current = io(SOCKET_URL, {
        auth: {
          token: localStorage.getItem('accessToken'),
          userId: user.id,
        },
        autoConnect: true,
      });

      const socket = socketRef.current;

      // Connection event handlers
      socket.on('connect', () => {
        console.log('Socket connected:', socket.id);
        setIsConnected(true);
      });

      socket.on('disconnect', () => {
        console.log('Socket disconnected');
        setIsConnected(false);
      });

      socket.on('connect_error', (error) => {
        console.error('Socket connection error:', error);
        setIsConnected(false);
      });

      // Authentication events
      socket.on('authenticated', (data) => {
        console.log('Socket authenticated:', data);
        // Join user-specific room
        socket.emit('join-room', `user:${user.id}`);
        
        // Join role-specific room
        socket.emit('join-room', `role:${user.role}`);
        
        // Join store/warehouse specific rooms
        if (user.storeId) {
          socket.emit('join-room', `store:${user.storeId}`);
        }
        if (user.warehouseId) {
          socket.emit('join-room', `warehouse:${user.warehouseId}`);
        }
      });

      socket.on('auth-error', (error) => {
        console.error('Socket auth error:', error);
        toast.error('Real-time connection failed');
      });

      // Business logic event handlers
      socket.on('inventory:updated', (data) => {
        toast.success(`Inventory updated: ${data.productId}`, {
          position: 'bottom-right',
          duration: 3000,
        });
      });

      socket.on('transaction:created', (transaction) => {
        toast.success(`New ${transaction.type.toLowerCase()} transaction recorded`, {
          position: 'bottom-right',
          duration: 3000,
        });
      });

      socket.on('alert:created', (alert) => {
        let toastFn = toast.success;
        
        switch (alert.severity) {
          case 'HIGH':
          case 'CRITICAL':
            toastFn = toast.error;
            break;
          case 'MEDIUM':
            toastFn = toast.error;
            break;
          default:
            toastFn = toast.success;
        }
        
        toastFn(alert.title, {
          position: 'top-right',
          duration: 5000,
        });
      });

      socket.on('user:connected', (data) => {
        console.log('User connected:', data);
      });

      socket.on('user:disconnected', (data) => {
        console.log('User disconnected:', data);
      });

      return () => {
        if (socketRef.current) {
          socketRef.current.disconnect();
          socketRef.current = null;
          setIsConnected(false);
        }
      };
    } else {
      // Disconnect socket if not authenticated
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
        setIsConnected(false);
      }
    }
  }, [isAuthenticated, user]);

  const joinRoom = (room: string): void => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('join-room', room);
    }
  };

  const leaveRoom = (room: string): void => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('leave-room', room);
    }
  };

  const emit = <K extends keyof SocketEvents>(
    event: K,
    data: SocketEvents[K]
  ): void => {
    if (socketRef.current?.connected) {
      socketRef.current.emit(event as string, data);
    }
  };

  const value: SocketContextType = {
    socket: socketRef.current,
    isConnected,
    joinRoom,
    leaveRoom,
    emit,
  };

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
};