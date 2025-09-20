// Auth types
export interface User {
  _id: string;
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: UserRole;
  storeId?: string;
  warehouseId?: string;
  permissions: string[];
  isActive: boolean;
  lastLogin?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export enum UserRole {
  SUPER_ADMIN = 'SUPER_ADMIN',
  WAREHOUSE_MANAGER = 'WAREHOUSE_MANAGER',
  STORE_MANAGER = 'STORE_MANAGER',
  STAFF = 'STAFF',
  AUDITOR = 'AUDITOR',
  VIEWER = 'VIEWER',
}

export interface AuthResponse {
  success: boolean;
  data: {
    user: User;
    accessToken: string;
    refreshToken: string;
  };
  message: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  name: string;
  email: string;
  password: string;
  role: UserRole;
  storeId?: string;
  warehouseId?: string;
}

// Product types
export interface Product {
  _id: string;
  name: string;
  sku: string;
  category: string;
  description?: string;
  price: number;
  cost: number;
  unit: string;
  imageUrl?: string;
  imagePublicId?: string;
  specifications: Record<string, any>;
  alertThreshold: number;
  hasShelfLife: boolean;
  shelfLifeDays?: number;
  tags: string[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Store types
export interface Store {
  _id: string;
  name: string;
  code: string;
  address: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
  };
  contact: {
    phone: string;
    email: string;
    manager: string;
  };
  inventory: InventoryItem[];
  settings: StoreSettings;
  warehouseId: string;
  storeType: 'RETAIL' | 'WHOLESALE' | 'ONLINE';
  status: 'ACTIVE' | 'INACTIVE' | 'MAINTENANCE';
  operatingHours?: {
    open: string;
    close: string;
    timezone: string;
  };
  coordinates?: {
    lat: number;
    lng: number;
  };
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface InventoryItem {
  productId: string;
  quantity: number;
  reserved: number;
  lastUpdated: Date;
}

export interface StoreSettings {
  reorderThresholdOverrides: Map<string, number>;
  workingHours: {
    open: string;
    close: string;
    timezone: string;
  };
  autoReorder: boolean;
  lowStockThreshold: number;
}

// Warehouse types
export interface Warehouse {
  _id: string;
  name: string;
  code: string;
  type: 'MAIN' | 'DISTRIBUTION' | 'REGIONAL';
  address: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
  };
  contact: {
    phone: string;
    email: string;
    manager: string;
  };
  inventory: InventoryItem[];
  settings: WarehouseSettings;
  coordinates?: {
    lat: number;
    lng: number;
  };
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface WarehouseSettings {
  autoSync: boolean;
  syncInterval: number;
  defaultReorderThreshold: number;
  enableAlerts: boolean;
}

// Transaction types
export interface Transaction {
  _id: string;
  type: TransactionType;
  productId: string;
  quantity: number;
  fromLocation?: string;
  toLocation?: string;
  performedBy: string;
  metadata?: Record<string, any>;
  createdAt: Date;
}

export enum TransactionType {
  SALE = 'SALE',
  PURCHASE = 'PURCHASE',
  TRANSFER = 'TRANSFER',
  ADJUSTMENT = 'ADJUSTMENT',
  RETURN = 'RETURN',
}

// Alert types
export interface Alert {
  _id: string;
  type: AlertType;
  title: string;
  message: string;
  severity: AlertSeverity;
  status: 'ACTIVE' | 'RESOLVED' | 'ARCHIVED';
  storeId?: string;
  productId?: string;
  entityType?: string;
  entityId?: string;
  metadata?: Record<string, any>;
  isRead: boolean;
  readBy?: string[];
  resolvedBy?: string;
  resolvedAt?: Date;
  archivedBy?: string;
  archivedAt?: Date;
  expiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export enum AlertType {
  LOW_STOCK = 'LOW_STOCK',
  OUT_OF_STOCK = 'OUT_OF_STOCK',
  EXPIRY_WARNING = 'EXPIRY_WARNING',
  EXPIRED_PRODUCTS = 'EXPIRED_PRODUCTS',
  REORDER_SUGGESTION = 'REORDER_SUGGESTION',
  SUSPICIOUS_ACTIVITY = 'SUSPICIOUS_ACTIVITY',
  SYSTEM = 'SYSTEM',
  MAINTENANCE = 'MAINTENANCE',
}

export enum AlertSeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

// Batch types
export interface Batch {
  _id: string;
  productId: string;
  batchNumber: string;
  expiryDate?: Date;
  manufactureDate?: Date;
  quantity: number;
  cost: number;
  supplier?: string;
  location: string;
  status: BatchStatus;
  notes?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export enum BatchStatus {
  ACTIVE = 'ACTIVE',
  EXPIRED = 'EXPIRED',
  RECALLED = 'RECALLED',
  SOLD_OUT = 'SOLD_OUT',
}

// API Response types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T = any> {
  success: boolean;
  data: {
    [key: string]: T[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      pages: number;
    };
  };
}

// Dashboard types
export interface DashboardStats {
  totalProducts: number;
  totalStores: number;
  totalWarehouses: number;
  lowStockItems: number;
  totalRevenue: number;
  monthlyGrowth: number;
  recentTransactions: Transaction[];
  topProducts: Array<{
    product: Product;
    sales: number;
    revenue: number;
  }>;
  alerts: Alert[];
}

// Socket types
export interface SocketEvents {
  // Inventory updates
  'inventory:updated': {
    storeId: string;
    productId: string;
    quantity: number;
    type: 'increase' | 'decrease';
  };
  
  // Transaction events
  'transaction:created': Transaction;
  
  // Alert events
  'alert:created': Alert;
  'alert:updated': Alert;
  
  // User events
  'user:connected': { userId: string; timestamp: Date };
  'user:disconnected': { userId: string; timestamp: Date };
}

// Form types
export interface ProductFormData {
  name: string;
  sku: string;
  category: string;
  description?: string;
  price: number;
  cost: number;
  unit: string;
  specifications: Record<string, any>;
  alertThreshold: number;
  hasShelfLife: boolean;
  shelfLifeDays?: number;
  tags: string[];
  image?: File;
}

export interface StoreFormData {
  name: string;
  code: string;
  address: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
  };
  contact: {
    phone: string;
    email: string;
    manager: string;
  };
  warehouseId: string;
  storeType: 'RETAIL' | 'WHOLESALE' | 'ONLINE';
  coordinates?: {
    lat: number;
    lng: number;
  };
}

// Import/Export types
export interface ImportResult {
  success: boolean;
  processed: number;
  errors: Array<{
    row: number;
    error: string;
    data?: any;
  }>;
  created: any[];
  updated: any[];
}

export interface ExportOptions {
  format: 'csv' | 'xlsx';
  filters?: Record<string, any>;
  fields?: string[];
}