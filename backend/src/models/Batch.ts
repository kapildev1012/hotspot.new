import mongoose, { Document, Schema } from 'mongoose';

export interface IBatch extends Document {
  _id: string;
  productId: string;
  batchNumber: string;
  manufactureDate: Date;
  expiryDate?: Date;
  quantity: number;
  remainingQuantity: number;
  warehouseLocation?: string; // shelf/rack location
  storeLocation?: string; // for store-specific batches
  costPrice: number;
  sellingPrice?: number;
  supplierInfo?: {
    name: string;
    contact?: string;
    invoiceNumber?: string;
  };
  qualityStatus: 'GOOD' | 'DAMAGED' | 'EXPIRED' | 'RECALLED';
  notes?: string;
  isActive: boolean;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

const batchSchema = new Schema<IBatch>(
  {
    productId: {
      type: Schema.Types.ObjectId,
      ref: 'Product',
      required: [true, 'Product ID is required'],
    },
    batchNumber: {
      type: String,
      required: [true, 'Batch number is required'],
      trim: true,
      uppercase: true,
    },
    manufactureDate: {
      type: Date,
      required: [true, 'Manufacture date is required'],
    },
    expiryDate: {
      type: Date,
      validate: {
        validator: function(this: IBatch, value: Date) {
          return !value || value > this.manufactureDate;
        },
        message: 'Expiry date must be after manufacture date',
      },
    },
    quantity: {
      type: Number,
      required: [true, 'Quantity is required'],
      min: [0, 'Quantity cannot be negative'],
    },
    remainingQuantity: {
      type: Number,
      required: [true, 'Remaining quantity is required'],
      min: [0, 'Remaining quantity cannot be negative'],
      validate: {
        validator: function(this: IBatch, value: number) {
          return value <= this.quantity;
        },
        message: 'Remaining quantity cannot exceed initial quantity',
      },
    },
    warehouseLocation: {
      type: String,
      trim: true,
    },
    storeLocation: {
      type: String,
      trim: true,
    },
    costPrice: {
      type: Number,
      required: [true, 'Cost price is required'],
      min: [0, 'Cost price cannot be negative'],
    },
    sellingPrice: {
      type: Number,
      min: [0, 'Selling price cannot be negative'],
    },
    supplierInfo: {
      name: {
        type: String,
        trim: true,
      },
      contact: {
        type: String,
        trim: true,
      },
      invoiceNumber: {
        type: String,
        trim: true,
      },
    },
    qualityStatus: {
      type: String,
      enum: ['GOOD', 'DAMAGED', 'EXPIRED', 'RECALLED'],
      default: 'GOOD',
    },
    notes: {
      type: String,
      trim: true,
      maxlength: [500, 'Notes cannot exceed 500 characters'],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Compound indexes
batchSchema.index({ productId: 1, batchNumber: 1 }, { unique: true });
batchSchema.index({ productId: 1, expiryDate: 1 });
batchSchema.index({ expiryDate: 1, isActive: 1 });
batchSchema.index({ qualityStatus: 1, isActive: 1 });

// Virtual for product details
batchSchema.virtual('product', {
  ref: 'Product',
  localField: 'productId',
  foreignField: '_id',
  justOne: true,
});

// Virtual for days until expiry
batchSchema.virtual('daysUntilExpiry').get(function(this: IBatch) {
  if (!this.expiryDate) return null;
  const diffTime = this.expiryDate.getTime() - new Date().getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
});

// Virtual for expiry status
batchSchema.virtual('expiryStatus').get(function(this: IBatch) {
  if (!this.expiryDate) return 'NO_EXPIRY';
  
  const daysUntilExpiry = this.daysUntilExpiry;
  if (daysUntilExpiry < 0) return 'EXPIRED';
  if (daysUntilExpiry <= 7) return 'EXPIRING_SOON';
  if (daysUntilExpiry <= 30) return 'EXPIRING_MONTH';
  return 'GOOD';
});

// Virtual for utilization percentage
batchSchema.virtual('utilizationPercentage').get(function(this: IBatch) {
  if (this.quantity === 0) return 0;
  return ((this.quantity - this.remainingQuantity) / this.quantity) * 100;
});

// Pre-save middleware
batchSchema.pre('save', function(next) {
  // Set initial remaining quantity if not provided
  if (this.isNew && !this.remainingQuantity) {
    this.remainingQuantity = this.quantity;
  }
  
  // Auto-update quality status based on expiry
  if (this.expiryDate && this.expiryDate < new Date() && this.qualityStatus === 'GOOD') {
    this.qualityStatus = 'EXPIRED';
  }
  
  next();
});

// Static methods
batchSchema.statics.findExpiringBatches = function(days: number = 30) {
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + days);
  
  return this.find({
    expiryDate: { $lte: futureDate, $gte: new Date() },
    isActive: true,
    qualityStatus: 'GOOD',
    remainingQuantity: { $gt: 0 },
  }).populate('product');
};

batchSchema.statics.findExpiredBatches = function() {
  return this.find({
    expiryDate: { $lt: new Date() },
    isActive: true,
    remainingQuantity: { $gt: 0 },
  }).populate('product');
};

batchSchema.statics.findLowStockBatches = function(threshold: number = 10) {
  return this.find({
    remainingQuantity: { $lte: threshold, $gt: 0 },
    isActive: true,
    qualityStatus: 'GOOD',
  }).populate('product');
};

export default mongoose.model<IBatch>('Batch', batchSchema);