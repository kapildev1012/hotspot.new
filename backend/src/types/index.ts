export enum UserRole {
  SUPER_ADMIN = 'SUPER_ADMIN',
  WAREHOUSE_MANAGER = 'WAREHOUSE_MANAGER',
  STORE_MANAGER = 'STORE_MANAGER',
  STORE_CLERK = 'STORE_CLERK',
  AUDITOR = 'AUDITOR',
  VIEWER = 'VIEWER',
}

export enum TransactionType {
  SALE = 'SALE',
  PURCHASE = 'PURCHASE',
  TRANSFER_IN = 'TRANSFER_IN',
  TRANSFER_OUT = 'TRANSFER_OUT',
  ADJUSTMENT = 'ADJUSTMENT',
  RETURN = 'RETURN',
}

export enum TransactionStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
  FAILED = 'FAILED',
}

export enum AlertType {
  LOW_STOCK = 'LOW_STOCK',
  EXPIRY = 'EXPIRY',
  OVERSTOCK = 'OVERSTOCK',
  NEGATIVE_STOCK = 'NEGATIVE_STOCK',
  REORDER_SUGGESTION = 'REORDER_SUGGESTION',
  SUSPICIOUS_ACTIVITY = 'SUSPICIOUS_ACTIVITY',
}

export enum AlertPriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

export enum LocationType {
  WAREHOUSE = 'WAREHOUSE',
  STORE = 'STORE',
}

export interface IInventoryItem {
  productId: string;
  quantity: number;
  reserved: number;
  lastUpdated: Date;
}

export interface IProductVariant {
  variantId: string;
  name: string;
  attributes: Record<string, string>; // { color: 'red', size: 'L' }
  sku?: string;
  barcode?: string;
}

export interface ITransactionItem {
  productId: string;
  batchId?: string;
  variantId?: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface ILocation {
  type: LocationType;
  id: string;
  name: string;
}

export interface IStoreSettings {
  reorderThresholdOverrides: Record<string, number>; // productId -> threshold
  workingHours: {
    open: string; // "08:00"
    close: string; // "20:00"
    timezone: string;
  };
  autoReorder: boolean;
  lowStockThreshold: number; // default threshold
}