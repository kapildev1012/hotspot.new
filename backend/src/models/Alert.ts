import mongoose, { Document, Schema } from 'mongoose';
import { AlertPriority, AlertType } from '../types/index.js';

export interface IAlert extends Document {
  _id: string;
  type: AlertType;
  priority: AlertPriority;
  title: string;
  message: string;
  productId?: string;
  storeId?: string;
  warehouseId?: string;
  batchId?: string;
  metadata: {
    currentQuantity?: number;
    threshold?: number;
    expiryDate?: Date;
    daysUntilExpiry?: number;
    suggestedAction?: string;
    affectedLocations?: string[];
  };
  resolved: boolean;
  resolvedBy?: string;
  resolvedAt?: Date;
  resolutionNotes?: string;
  acknowledged: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: Date;
  scheduledFor?: Date; // For scheduled alerts
  expiresAt?: Date; // Auto-expire alerts
  notificationsSent: {
    email: boolean;
    sms: boolean;
    push: boolean;
    inApp: boolean;
  };
  createdAt: Date;
  updatedAt: Date;
}

const alertSchema = new Schema<IAlert>(
  {
    type: {
      type: String,
      enum: Object.values(AlertType),
      required: [true, 'Alert type is required'],
    },
    priority: {
      type: String,
      enum: Object.values(AlertPriority),
      required: [true, 'Alert priority is required'],
    },
    title: {
      type: String,
      required: [true, 'Alert title is required'],
      trim: true,
      maxlength: [200, 'Title cannot exceed 200 characters'],
    },
    message: {
      type: String,
      required: [true, 'Alert message is required'],
      trim: true,
      maxlength: [1000, 'Message cannot exceed 1000 characters'],
    },
    productId: {
      type: Schema.Types.ObjectId,
      ref: 'Product',
    },
    storeId: {
      type: Schema.Types.ObjectId,
      ref: 'Store',
    },
    warehouseId: {
      type: Schema.Types.ObjectId,
      ref: 'Warehouse',
    },
    batchId: {
      type: Schema.Types.ObjectId,
      ref: 'Batch',
    },
    metadata: {
      currentQuantity: {
        type: Number,
        min: 0,
      },
      threshold: {
        type: Number,
        min: 0,
      },
      expiryDate: {
        type: Date,
      },
      daysUntilExpiry: {
        type: Number,
      },
      suggestedAction: {
        type: String,
        trim: true,
      },
      affectedLocations: [{
        type: String,
        trim: true,
      }],
    },
    resolved: {
      type: Boolean,
      default: false,
    },
    resolvedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    resolvedAt: {
      type: Date,
    },
    resolutionNotes: {
      type: String,
      trim: true,
      maxlength: [500, 'Resolution notes cannot exceed 500 characters'],
    },
    acknowledged: {
      type: Boolean,
      default: false,
    },
    acknowledgedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    acknowledgedAt: {
      type: Date,
    },
    scheduledFor: {
      type: Date,
    },
    expiresAt: {
      type: Date,
    },
    notificationsSent: {
      email: {
        type: Boolean,
        default: false,
      },
      sms: {
        type: Boolean,
        default: false,
      },
      push: {
        type: Boolean,
        default: false,
      },
      inApp: {
        type: Boolean,
        default: true,
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
alertSchema.index({ type: 1, priority: 1 });
alertSchema.index({ resolved: 1, acknowledged: 1 });
alertSchema.index({ createdAt: -1 });
alertSchema.index({ scheduledFor: 1 });
alertSchema.index({ expiresAt: 1 });

// Virtual for product details
alertSchema.virtual('product', {
  ref: 'Product',
  localField: 'productId',
  foreignField: '_id',
  justOne: true,
});

// Virtual for store details
alertSchema.virtual('store', {
  ref: 'Store',
  localField: 'storeId',
  foreignField: '_id',
  justOne: true,
});

// Virtual for warehouse details
alertSchema.virtual('warehouse', {
  ref: 'Warehouse',
  localField: 'warehouseId',
  foreignField: '_id',
  justOne: true,
});

// Virtual for batch details
alertSchema.virtual('batch', {
  ref: 'Batch',
  localField: 'batchId',
  foreignField: '_id',
  justOne: true,
});

// Virtual for resolver details
alertSchema.virtual('resolver', {
  ref: 'User',
  localField: 'resolvedBy',
  foreignField: '_id',
  justOne: true,
});

// Virtual for acknowledger details
alertSchema.virtual('acknowledger', {
  ref: 'User',
  localField: 'acknowledgedBy',
  foreignField: '_id',
  justOne: true,
});

// Virtual for alert age
alertSchema.virtual('ageInHours').get(function(this: IAlert) {
  return Math.floor((new Date().getTime() - this.createdAt.getTime()) / (1000 * 60 * 60));
});

// Virtual for resolution time
alertSchema.virtual('resolutionTimeInHours').get(function(this: IAlert) {
  if (!this.resolvedAt) return null;
  return Math.floor((this.resolvedAt.getTime() - this.createdAt.getTime()) / (1000 * 60 * 60));
});

// Virtual for is expired
alertSchema.virtual('isExpired').get(function(this: IAlert) {
  return this.expiresAt ? new Date() > this.expiresAt : false;
});

// Virtual for urgency score (for sorting)
alertSchema.virtual('urgencyScore').get(function(this: IAlert) {
  const priorityScores = {
    [AlertPriority.LOW]: 1,
    [AlertPriority.MEDIUM]: 2,
    [AlertPriority.HIGH]: 3,
    [AlertPriority.CRITICAL]: 4,
  };
  
  const typeMultipliers = {
    [AlertType.NEGATIVE_STOCK]: 2,
    [AlertType.EXPIRY]: 1.8,
    [AlertType.LOW_STOCK]: 1.5,
    [AlertType.SUSPICIOUS_ACTIVITY]: 1.7,
    [AlertType.OVERSTOCK]: 1.2,
    [AlertType.REORDER_SUGGESTION]: 1,
  };
  
  const baseScore = priorityScores[this.priority] || 1;
  const typeMultiplier = typeMultipliers[this.type] || 1;
  const ageMultiplier = Math.min(this.ageInHours / 24 + 1, 2); // Age factor up to 2x
  
  return baseScore * typeMultiplier * ageMultiplier;
});

// Methods
alertSchema.methods.markResolved = function(userId: string, notes?: string) {
  this.resolved = true;
  this.resolvedBy = userId;
  this.resolvedAt = new Date();
  if (notes) this.resolutionNotes = notes;
  return this.save();
};

alertSchema.methods.markAcknowledged = function(userId: string) {
  this.acknowledged = true;
  this.acknowledgedBy = userId;
  this.acknowledgedAt = new Date();
  return this.save();
};

alertSchema.methods.updateNotificationStatus = function(type: keyof IAlert['notificationsSent'], sent: boolean = true) {
  this.notificationsSent[type] = sent;
  return this.save();
};

// Pre-save middleware
alertSchema.pre('save', function(next) {
  // Auto-acknowledge when resolved
  if (this.resolved && !this.acknowledged) {
    this.acknowledged = true;
    this.acknowledgedBy = this.resolvedBy;
    this.acknowledgedAt = this.resolvedAt;
  }
  
  // Set default expiry for certain alert types
  if (this.isNew && !this.expiresAt) {
    const defaultExpiryHours = {
      [AlertType.EXPIRY]: 168, // 7 days
      [AlertType.LOW_STOCK]: 72, // 3 days
      [AlertType.OVERSTOCK]: 168, // 7 days
      [AlertType.REORDER_SUGGESTION]: 240, // 10 days
      [AlertType.NEGATIVE_STOCK]: 24, // 1 day
      [AlertType.SUSPICIOUS_ACTIVITY]: 48, // 2 days
    };
    
    const expiryHours = defaultExpiryHours[this.type];
    if (expiryHours) {
      this.expiresAt = new Date(Date.now() + expiryHours * 60 * 60 * 1000);
    }
  }
  
  next();
});

// Static methods
alertSchema.statics.getActiveAlerts = function(filters: any = {}) {
  return this.find({
    resolved: false,
    $or: [
      { expiresAt: null },
      { expiresAt: { $gt: new Date() } },
    ],
    ...filters,
  }).sort({ priority: -1, createdAt: -1 });
};

alertSchema.statics.getUnacknowledgedAlerts = function() {
  return this.find({
    acknowledged: false,
    resolved: false,
    $or: [
      { expiresAt: null },
      { expiresAt: { $gt: new Date() } },
    ],
  }).sort({ priority: -1, createdAt: -1 });
};

alertSchema.statics.getCriticalAlerts = function() {
  return this.find({
    priority: AlertPriority.CRITICAL,
    resolved: false,
    $or: [
      { expiresAt: null },
      { expiresAt: { $gt: new Date() } },
    ],
  }).sort({ createdAt: -1 });
};

alertSchema.statics.getAlertsByLocation = function(locationType: 'store' | 'warehouse', locationId: string) {
  const field = locationType === 'store' ? 'storeId' : 'warehouseId';
  return this.find({
    [field]: locationId,
    resolved: false,
    $or: [
      { expiresAt: null },
      { expiresAt: { $gt: new Date() } },
    ],
  }).sort({ priority: -1, createdAt: -1 });
};

alertSchema.statics.getAlertsByProduct = function(productId: string) {
  return this.find({
    productId,
    resolved: false,
    $or: [
      { expiresAt: null },
      { expiresAt: { $gt: new Date() } },
    ],
  }).sort({ priority: -1, createdAt: -1 });
};

alertSchema.statics.getAlertStats = function(startDate?: Date, endDate?: Date) {
  const match: any = {};
  if (startDate && endDate) {
    match.createdAt = { $gte: startDate, $lte: endDate };
  }
  
  return this.aggregate([
    { $match: match },
    {
      $group: {
        _id: {
          type: '$type',
          priority: '$priority',
        },
        count: { $sum: 1 },
        resolved: { $sum: { $cond: ['$resolved', 1, 0] } },
        avgResolutionTime: {
          $avg: {
            $cond: [
              '$resolved',
              { $subtract: ['$resolvedAt', '$createdAt'] },
              null,
            ],
          },
        },
      },
    },
    {
      $project: {
        type: '$_id.type',
        priority: '$_id.priority',
        count: 1,
        resolved: 1,
        pending: { $subtract: ['$count', '$resolved'] },
        resolutionRate: {
          $round: [{ $multiply: [{ $divide: ['$resolved', '$count'] }, 100] }, 2],
        },
        avgResolutionTimeHours: {
          $round: [{ $divide: ['$avgResolutionTime', 1000 * 60 * 60] }, 2],
        },
        _id: 0,
      },
    },
    { $sort: { type: 1, priority: -1 } },
  ]);
};

// Clean up expired alerts
alertSchema.statics.cleanupExpiredAlerts = function() {
  return this.deleteMany({
    expiresAt: { $lt: new Date() },
    resolved: true,
  });
};

export default mongoose.model<IAlert>('Alert', alertSchema);