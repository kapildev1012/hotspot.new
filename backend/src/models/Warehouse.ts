import mongoose, { Document, Schema } from 'mongoose';
import { IInventoryItem } from '../types/index.js';

export interface IWarehouse extends Document {
  _id: string;
  name: string;
  type: 'MAIN' | 'SECONDARY';
  address: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
  };
  contact: {
    phone?: string;
    email?: string;
    manager?: string;
  };
  inventory: IInventoryItem[];
  capacity: {
    totalSpace: number; // in cubic meters or square feet
    usedSpace: number;
    unit: string; // 'm3', 'sqft', etc.
  };
  zones: [{
    zoneId: string;
    name: string;
    capacity: number;
    usedCapacity: number;
  }];
  settings: {
    defaultReceivingZone: string;
    autoAllocateZone: boolean;
    temperatureControlled: boolean;
    temperatureRange?: {
      min: number;
      max: number;
      unit: 'C' | 'F';
    };
  };
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const inventoryItemSchema = new Schema<IInventoryItem>({
  productId: {
    type: Schema.Types.ObjectId,
    ref: 'Product',
    required: true,
  },
  quantity: {
    type: Number,
    required: true,
    min: 0,
    default: 0,
  },
  reserved: {
    type: Number,
    required: true,
    min: 0,
    default: 0,
  },
  lastUpdated: {
    type: Date,
    default: Date.now,
  },
}, { _id: false });

const warehouseSchema = new Schema<IWarehouse>(
  {
    name: {
      type: String,
      required: [true, 'Warehouse name is required'],
      trim: true,
      maxlength: [100, 'Warehouse name cannot exceed 100 characters'],
    },
    type: {
      type: String,
      enum: ['MAIN', 'SECONDARY'],
      default: 'MAIN',
      required: true,
    },
    address: {
      street: {
        type: String,
        required: [true, 'Street address is required'],
        trim: true,
      },
      city: {
        type: String,
        required: [true, 'City is required'],
        trim: true,
      },
      state: {
        type: String,
        required: [true, 'State is required'],
        trim: true,
      },
      zipCode: {
        type: String,
        required: [true, 'Zip code is required'],
        trim: true,
      },
      country: {
        type: String,
        required: [true, 'Country is required'],
        trim: true,
        default: 'United States',
      },
    },
    contact: {
      phone: {
        type: String,
        trim: true,
      },
      email: {
        type: String,
        trim: true,
        lowercase: true,
        match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please provide a valid email'],
      },
      manager: {
        type: String,
        trim: true,
      },
    },
    inventory: [inventoryItemSchema],
    capacity: {
      totalSpace: {
        type: Number,
        required: true,
        min: 0,
      },
      usedSpace: {
        type: Number,
        default: 0,
        min: 0,
      },
      unit: {
        type: String,
        required: true,
        enum: ['m3', 'sqft', 'sqm'],
        default: 'sqft',
      },
    },
    zones: [{
      zoneId: {
        type: String,
        required: true,
      },
      name: {
        type: String,
        required: true,
        trim: true,
      },
      capacity: {
        type: Number,
        required: true,
        min: 0,
      },
      usedCapacity: {
        type: Number,
        default: 0,
        min: 0,
      },
    }],
    settings: {
      defaultReceivingZone: {
        type: String,
        default: 'GENERAL',
      },
      autoAllocateZone: {
        type: Boolean,
        default: true,
      },
      temperatureControlled: {
        type: Boolean,
        default: false,
      },
      temperatureRange: {
        min: Number,
        max: Number,
        unit: {
          type: String,
          enum: ['C', 'F'],
          default: 'C',
        },
      },
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes
warehouseSchema.index({ name: 1 });
warehouseSchema.index({ type: 1, isActive: 1 });
warehouseSchema.index({ 'inventory.productId': 1 });

// Virtual for available inventory (quantity - reserved)
warehouseSchema.virtual('availableInventory').get(function(this: IWarehouse) {
  return this.inventory.map(item => ({
    productId: item.productId,
    available: item.quantity - item.reserved,
    total: item.quantity,
    reserved: item.reserved,
  }));
});

// Virtual for capacity utilization
warehouseSchema.virtual('capacityUtilization').get(function(this: IWarehouse) {
  if (this.capacity.totalSpace === 0) return 0;
  return (this.capacity.usedSpace / this.capacity.totalSpace) * 100;
});

// Virtual for total SKUs
warehouseSchema.virtual('totalSKUs').get(function(this: IWarehouse) {
  return this.inventory.length;
});

// Methods
warehouseSchema.methods.updateInventory = function(productId: string, quantity: number, reserved: number = 0) {
  const existingIndex = this.inventory.findIndex(item => item.productId.toString() === productId);
  
  if (existingIndex >= 0) {
    this.inventory[existingIndex].quantity = quantity;
    this.inventory[existingIndex].reserved = reserved;
    this.inventory[existingIndex].lastUpdated = new Date();
  } else {
    this.inventory.push({
      productId,
      quantity,
      reserved,
      lastUpdated: new Date(),
    });
  }
};

warehouseSchema.methods.adjustInventory = function(productId: string, quantityChange: number, reservedChange: number = 0) {
  const existingIndex = this.inventory.findIndex(item => item.productId.toString() === productId);
  
  if (existingIndex >= 0) {
    this.inventory[existingIndex].quantity += quantityChange;
    this.inventory[existingIndex].reserved += reservedChange;
    this.inventory[existingIndex].lastUpdated = new Date();
    
    // Ensure quantities don't go negative
    if (this.inventory[existingIndex].quantity < 0) {
      this.inventory[existingIndex].quantity = 0;
    }
    if (this.inventory[existingIndex].reserved < 0) {
      this.inventory[existingIndex].reserved = 0;
    }
  } else if (quantityChange > 0) {
    this.inventory.push({
      productId,
      quantity: Math.max(0, quantityChange),
      reserved: Math.max(0, reservedChange),
      lastUpdated: new Date(),
    });
  }
};

warehouseSchema.methods.getProductInventory = function(productId: string) {
  return this.inventory.find(item => item.productId.toString() === productId);
};

// Static methods
warehouseSchema.statics.getMainWarehouse = function() {
  return this.findOne({ type: 'MAIN', isActive: true });
};

warehouseSchema.statics.getLowStockProducts = function(threshold: number = 10) {
  return this.aggregate([
    { $match: { isActive: true } },
    { $unwind: '$inventory' },
    { $match: { 'inventory.quantity': { $lte: threshold } } },
    {
      $lookup: {
        from: 'products',
        localField: 'inventory.productId',
        foreignField: '_id',
        as: 'product',
      },
    },
    { $unwind: '$product' },
    {
      $project: {
        warehouseName: '$name',
        productId: '$inventory.productId',
        productName: '$product.name',
        currentQuantity: '$inventory.quantity',
        reserved: '$inventory.reserved',
        available: { $subtract: ['$inventory.quantity', '$inventory.reserved'] },
      },
    },
  ]);
};

export default mongoose.model<IWarehouse>('Warehouse', warehouseSchema);