import mongoose, { Document, Schema } from 'mongoose';
import { IInventoryItem, IStoreSettings } from '../types/index.js';

export interface IStore extends Document {
  _id: string;
  name: string;
  code: string; // Unique store code
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
  settings: IStoreSettings;
  warehouseId: string; // Reference to main warehouse
  storeType: 'RETAIL' | 'OUTLET' | 'FRANCHISE' | 'WHOLESALE';
  status: 'ACTIVE' | 'INACTIVE' | 'MAINTENANCE';
  operatingHours: {
    monday: { open: string; close: string; closed: boolean };
    tuesday: { open: string; close: string; closed: boolean };
    wednesday: { open: string; close: string; closed: boolean };
    thursday: { open: string; close: string; closed: boolean };
    friday: { open: string; close: string; closed: boolean };
    saturday: { open: string; close: string; closed: boolean };
    sunday: { open: string; close: string; closed: boolean };
  };
  coordinates?: {
    latitude: number;
    longitude: number;
  };
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const dayScheduleSchema = new Schema({
  open: {
    type: String,
    required: true,
    match: /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/,
  },
  close: {
    type: String,
    required: true,
    match: /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/,
  },
  closed: {
    type: Boolean,
    default: false,
  },
}, { _id: false });

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

const storeSchema = new Schema<IStore>(
  {
    name: {
      type: String,
      required: [true, 'Store name is required'],
      trim: true,
      maxlength: [100, 'Store name cannot exceed 100 characters'],
    },
    code: {
      type: String,
      required: [true, 'Store code is required'],
      unique: true,
      trim: true,
      uppercase: true,
      maxlength: [10, 'Store code cannot exceed 10 characters'],
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
    settings: {
      reorderThresholdOverrides: {
        type: Map,
        of: Number,
        default: {},
      },
      workingHours: {
        open: {
          type: String,
          default: '09:00',
          match: /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/,
        },
        close: {
          type: String,
          default: '18:00',
          match: /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/,
        },
        timezone: {
          type: String,
          default: 'UTC',
        },
      },
      autoReorder: {
        type: Boolean,
        default: false,
      },
      lowStockThreshold: {
        type: Number,
        default: 10,
        min: 0,
      },
    },
    warehouseId: {
      type: Schema.Types.ObjectId,
      ref: 'Warehouse',
      required: [true, 'Warehouse ID is required'],
    },
    storeType: {
      type: String,
      enum: ['RETAIL', 'OUTLET', 'FRANCHISE', 'WHOLESALE'],
      default: 'RETAIL',
      required: true,
    },
    status: {
      type: String,
      enum: ['ACTIVE', 'INACTIVE', 'MAINTENANCE'],
      default: 'ACTIVE',
    },
    operatingHours: {
      monday: dayScheduleSchema,
      tuesday: dayScheduleSchema,
      wednesday: dayScheduleSchema,
      thursday: dayScheduleSchema,
      friday: dayScheduleSchema,
      saturday: dayScheduleSchema,
      sunday: dayScheduleSchema,
    },
    coordinates: {
      latitude: {
        type: Number,
        min: -90,
        max: 90,
      },
      longitude: {
        type: Number,
        min: -180,
        max: 180,
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
// Note: code already has unique index from unique: true
storeSchema.index({ name: 1 });
storeSchema.index({ status: 1, isActive: 1 });
storeSchema.index({ warehouseId: 1 });
storeSchema.index({ 'inventory.productId': 1 });
storeSchema.index({ storeType: 1 });

// Virtual for warehouse details
storeSchema.virtual('warehouse', {
  ref: 'Warehouse',
  localField: 'warehouseId',
  foreignField: '_id',
  justOne: true,
});

// Virtual for manager user
storeSchema.virtual('managerUser', {
  ref: 'User',
  localField: '_id',
  foreignField: 'storeId',
  match: { role: 'STORE_MANAGER' },
});

// Virtual for total SKUs
storeSchema.virtual('totalSKUs').get(function(this: IStore) {
  return this.inventory.length;
});

// Virtual for available inventory
storeSchema.virtual('availableInventory').get(function(this: IStore) {
  return this.inventory.map(item => ({
    productId: item.productId,
    available: item.quantity - item.reserved,
    total: item.quantity,
    reserved: item.reserved,
  }));
});

// Methods
storeSchema.methods.updateInventory = function(productId: string, quantity: number, reserved: number = 0) {
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

storeSchema.methods.adjustInventory = function(productId: string, quantityChange: number, reservedChange: number = 0) {
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

storeSchema.methods.getProductInventory = function(productId: string) {
  return this.inventory.find(item => item.productId.toString() === productId);
};

storeSchema.methods.isOperatingNow = function() {
  const now = new Date();
  const dayName = now.toLocaleDateString('en-US', { weekday: 'lowercase' });
  const currentTime = now.toTimeString().slice(0, 5); // HH:MM format
  
  const daySchedule = this.operatingHours[dayName as keyof typeof this.operatingHours];
  if (!daySchedule || daySchedule.closed) return false;
  
  return currentTime >= daySchedule.open && currentTime <= daySchedule.close;
};

storeSchema.methods.getReorderThreshold = function(productId: string, defaultThreshold: number) {
  return this.settings.reorderThresholdOverrides.get(productId) || defaultThreshold;
};

// Static methods
storeSchema.statics.findByWarehouse = function(warehouseId: string) {
  return this.find({ warehouseId, isActive: true });
};

storeSchema.statics.getLowStockProducts = function(storeId?: string) {
  const match: any = { isActive: true, status: 'ACTIVE' };
  if (storeId) match._id = mongoose.Types.ObjectId.createFromHexString(storeId);
  
  return this.aggregate([
    { $match: match },
    { $unwind: '$inventory' },
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
      $addFields: {
        threshold: {
          $ifNull: [
            { $toDouble: { $arrayElemAt: [{ $objectToArray: '$settings.reorderThresholdOverrides' }, 0] } },
            '$product.alertThreshold',
          ],
        },
      },
    },
    { $match: { 'inventory.quantity': { $lte: { $toDouble: '$threshold' } } } },
    {
      $project: {
        storeId: '$_id',
        storeName: '$name',
        storeCode: '$code',
        productId: '$inventory.productId',
        productName: '$product.name',
        currentQuantity: '$inventory.quantity',
        reserved: '$inventory.reserved',
        available: { $subtract: ['$inventory.quantity', '$inventory.reserved'] },
        threshold: '$threshold',
      },
    },
  ]);
};

// Pre-save middleware
storeSchema.pre('save', function(next) {
  // Generate store code if not provided
  if (this.isNew && !this.code) {
    const cityCode = this.address.city.substring(0, 3).toUpperCase();
    const randomNum = Math.floor(Math.random() * 999).toString().padStart(3, '0');
    this.code = `${cityCode}${randomNum}`;
  }
  
  // Set default operating hours if not provided
  if (this.isNew && (!this.operatingHours || Object.keys(this.operatingHours).length === 0)) {
    const defaultHours = { open: '09:00', close: '18:00', closed: false };
    this.operatingHours = {
      monday: defaultHours,
      tuesday: defaultHours,
      wednesday: defaultHours,
      thursday: defaultHours,
      friday: defaultHours,
      saturday: { open: '10:00', close: '16:00', closed: false },
      sunday: { open: '12:00', close: '17:00', closed: false },
    };
  }
  
  next();
});

export default mongoose.model<IStore>('Store', storeSchema);