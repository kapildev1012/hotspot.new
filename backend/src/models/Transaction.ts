import mongoose, { Document, Schema } from 'mongoose';
import { ILocation, ITransactionItem, TransactionStatus, TransactionType } from '../types/index.js';

export interface ITransaction extends Document {
  _id: string;
  type: TransactionType;
  source: ILocation;
  destination?: ILocation;
  items: ITransactionItem[];
  totalAmount: number;
  notes?: string;
  status: TransactionStatus;
  userId: string; // User who initiated the transaction
  approvedBy?: string; // For transfers requiring approval
  processedAt?: Date;
  completedAt?: Date;
  reference?: string; // External reference (PO number, invoice, etc.)
  metadata: {
    invoiceNumber?: string;
    customerInfo?: {
      name: string;
      contact?: string;
      address?: string;
    };
    supplierInfo?: {
      name: string;
      contact?: string;
      invoiceNumber?: string;
    };
    transferReason?: string;
    adjustmentReason?: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

const locationSchema = new Schema<ILocation>({
  type: {
    type: String,
    enum: ['WAREHOUSE', 'STORE'],
    required: true,
  },
  id: {
    type: Schema.Types.ObjectId,
    required: true,
    refPath: 'type', // Dynamic reference based on type
  },
  name: {
    type: String,
    required: true,
    trim: true,
  },
}, { _id: false });

const transactionItemSchema = new Schema<ITransactionItem>({
  productId: {
    type: Schema.Types.ObjectId,
    ref: 'Product',
    required: true,
  },
  batchId: {
    type: Schema.Types.ObjectId,
    ref: 'Batch',
  },
  variantId: {
    type: String,
    trim: true,
  },
  quantity: {
    type: Number,
    required: [true, 'Quantity is required'],
    min: [0.01, 'Quantity must be greater than 0'],
  },
  unitPrice: {
    type: Number,
    required: [true, 'Unit price is required'],
    min: [0, 'Unit price cannot be negative'],
  },
  totalPrice: {
    type: Number,
    required: [true, 'Total price is required'],
    min: [0, 'Total price cannot be negative'],
  },
}, { _id: false });

const transactionSchema = new Schema<ITransaction>(
  {
    type: {
      type: String,
      enum: Object.values(TransactionType),
      required: [true, 'Transaction type is required'],
    },
    source: {
      type: locationSchema,
      required: [true, 'Source location is required'],
    },
    destination: {
      type: locationSchema,
      required: function(this: ITransaction) {
        return [TransactionType.TRANSFER_IN, TransactionType.TRANSFER_OUT].includes(this.type);
      },
    },
    items: {
      type: [transactionItemSchema],
      required: [true, 'Transaction items are required'],
      validate: {
        validator: (items: ITransactionItem[]) => items.length > 0,
        message: 'At least one item is required',
      },
    },
    totalAmount: {
      type: Number,
      required: [true, 'Total amount is required'],
      min: [0, 'Total amount cannot be negative'],
    },
    notes: {
      type: String,
      trim: true,
      maxlength: [500, 'Notes cannot exceed 500 characters'],
    },
    status: {
      type: String,
      enum: Object.values(TransactionStatus),
      default: TransactionStatus.PENDING,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
    },
    approvedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    processedAt: {
      type: Date,
    },
    completedAt: {
      type: Date,
    },
    reference: {
      type: String,
      trim: true,
    },
    metadata: {
      invoiceNumber: {
        type: String,
        trim: true,
      },
      customerInfo: {
        name: {
          type: String,
          trim: true,
        },
        contact: {
          type: String,
          trim: true,
        },
        address: {
          type: String,
          trim: true,
        },
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
      transferReason: {
        type: String,
        trim: true,
      },
      adjustmentReason: {
        type: String,
        trim: true,
      },
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes
transactionSchema.index({ type: 1, status: 1 });
transactionSchema.index({ 'source.type': 1, 'source.id': 1 });
transactionSchema.index({ 'destination.type': 1, 'destination.id': 1 });
transactionSchema.index({ userId: 1, createdAt: -1 });
transactionSchema.index({ reference: 1 });
transactionSchema.index({ createdAt: -1 });
transactionSchema.index({ 'items.productId': 1 });

// Virtual for user details
transactionSchema.virtual('user', {
  ref: 'User',
  localField: 'userId',
  foreignField: '_id',
  justOne: true,
});

// Virtual for approver details
transactionSchema.virtual('approver', {
  ref: 'User',
  localField: 'approvedBy',
  foreignField: '_id',
  justOne: true,
});

// Virtual for transaction duration
transactionSchema.virtual('processingTime').get(function(this: ITransaction) {
  if (!this.processedAt) return null;
  return this.processedAt.getTime() - this.createdAt.getTime();
});

// Virtual for completion time
transactionSchema.virtual('completionTime').get(function(this: ITransaction) {
  if (!this.completedAt) return null;
  return this.completedAt.getTime() - this.createdAt.getTime();
});

// Pre-save middleware
transactionSchema.pre('save', function(next) {
  // Calculate total amount from items
  this.totalAmount = this.items.reduce((sum, item) => sum + item.totalPrice, 0);
  
  // Set processed/completed timestamps based on status
  if (this.status === TransactionStatus.PROCESSING && !this.processedAt) {
    this.processedAt = new Date();
  }
  
  if (this.status === TransactionStatus.COMPLETED && !this.completedAt) {
    this.completedAt = new Date();
  }
  
  // Generate reference if not provided
  if (this.isNew && !this.reference) {
    const typePrefix = this.type.substring(0, 3);
    const timestamp = Date.now().toString().slice(-6);
    this.reference = `${typePrefix}-${timestamp}`;
  }
  
  next();
});

// Pre-validate middleware
transactionSchema.pre('validate', function(next) {
  // Validate each item's total price
  this.items.forEach(item => {
    const calculatedTotal = item.quantity * item.unitPrice;
    if (Math.abs(item.totalPrice - calculatedTotal) > 0.01) {
      item.totalPrice = calculatedTotal;
    }
  });
  
  next();
});

// Static methods
transactionSchema.statics.findByLocation = function(locationType: string, locationId: string) {
  return this.find({
    $or: [
      { 'source.type': locationType, 'source.id': locationId },
      { 'destination.type': locationType, 'destination.id': locationId },
    ],
  }).sort({ createdAt: -1 });
};

transactionSchema.statics.findByProduct = function(productId: string) {
  return this.find({
    'items.productId': productId,
  }).sort({ createdAt: -1 });
};

transactionSchema.statics.getPendingTransfers = function() {
  return this.find({
    type: { $in: [TransactionType.TRANSFER_IN, TransactionType.TRANSFER_OUT] },
    status: TransactionStatus.PENDING,
  }).sort({ createdAt: 1 });
};

transactionSchema.statics.getTransactionSummary = function(startDate: Date, endDate: Date, locationType?: string, locationId?: string) {
  const match: any = {
    createdAt: { $gte: startDate, $lte: endDate },
    status: TransactionStatus.COMPLETED,
  };
  
  if (locationType && locationId) {
    match.$or = [
      { 'source.type': locationType, 'source.id': mongoose.Types.ObjectId.createFromHexString(locationId) },
      { 'destination.type': locationType, 'destination.id': mongoose.Types.ObjectId.createFromHexString(locationId) },
    ];
  }
  
  return this.aggregate([
    { $match: match },
    {
      $group: {
        _id: '$type',
        count: { $sum: 1 },
        totalAmount: { $sum: '$totalAmount' },
        avgAmount: { $avg: '$totalAmount' },
      },
    },
    {
      $project: {
        type: '$_id',
        count: 1,
        totalAmount: { $round: ['$totalAmount', 2] },
        avgAmount: { $round: ['$avgAmount', 2] },
        _id: 0,
      },
    },
  ]);
};

export default mongoose.model<ITransaction>('Transaction', transactionSchema);