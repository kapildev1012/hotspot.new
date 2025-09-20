import mongoose, { Document, Schema } from 'mongoose';

export interface IAuditLog extends Document {
  _id: string;
  actorUserId: string;
  actorName: string;
  action: string;
  resource: string;
  resourceId?: string;
  details: {
    method?: string;
    endpoint?: string;
    userAgent?: string;
    ipAddress?: string;
    changes?: {
      field: string;
      oldValue: any;
      newValue: any;
    }[];
    metadata?: Record<string, any>;
  };
  result: 'SUCCESS' | 'FAILURE' | 'PARTIAL';
  errorMessage?: string;
  sessionId?: string;
  timestamp: Date;
  createdAt: Date;
}

const auditLogSchema = new Schema<IAuditLog>(
  {
    actorUserId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Actor user ID is required'],
    },
    actorName: {
      type: String,
      required: [true, 'Actor name is required'],
      trim: true,
    },
    action: {
      type: String,
      required: [true, 'Action is required'],
      trim: true,
    },
    resource: {
      type: String,
      required: [true, 'Resource is required'],
      trim: true,
    },
    resourceId: {
      type: String,
      trim: true,
    },
    details: {
      method: {
        type: String,
        trim: true,
      },
      endpoint: {
        type: String,
        trim: true,
      },
      userAgent: {
        type: String,
        trim: true,
      },
      ipAddress: {
        type: String,
        trim: true,
      },
      changes: [{
        field: {
          type: String,
          required: true,
          trim: true,
        },
        oldValue: Schema.Types.Mixed,
        newValue: Schema.Types.Mixed,
      }],
      metadata: {
        type: Map,
        of: Schema.Types.Mixed,
      },
    },
    result: {
      type: String,
      enum: ['SUCCESS', 'FAILURE', 'PARTIAL'],
      required: [true, 'Result is required'],
    },
    errorMessage: {
      type: String,
      trim: true,
    },
    sessionId: {
      type: String,
      trim: true,
    },
    timestamp: {
      type: Date,
      required: [true, 'Timestamp is required'],
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes
auditLogSchema.index({ actorUserId: 1, timestamp: -1 });
auditLogSchema.index({ action: 1, timestamp: -1 });
auditLogSchema.index({ resource: 1, resourceId: 1, timestamp: -1 });
auditLogSchema.index({ timestamp: -1 });
auditLogSchema.index({ result: 1, timestamp: -1 });

// Virtual for actor details
auditLogSchema.virtual('actor', {
  ref: 'User',
  localField: 'actorUserId',
  foreignField: '_id',
  justOne: true,
});

// Virtual for formatted timestamp
auditLogSchema.virtual('formattedTimestamp').get(function(this: IAuditLog) {
  return this.timestamp.toISOString();
});

// Virtual for is recent (within last 24 hours)
auditLogSchema.virtual('isRecent').get(function(this: IAuditLog) {
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  return this.timestamp > oneDayAgo;
});

// Static methods
auditLogSchema.statics.logActivity = function(
  actorUserId: string,
  actorName: string,
  action: string,
  resource: string,
  details: any = {},
  result: 'SUCCESS' | 'FAILURE' | 'PARTIAL' = 'SUCCESS',
  resourceId?: string,
  errorMessage?: string
) {
  return this.create({
    actorUserId,
    actorName,
    action,
    resource,
    resourceId,
    details,
    result,
    errorMessage,
    timestamp: new Date(),
  });
};

auditLogSchema.statics.findByUser = function(userId: string, limit: number = 50) {
  return this.find({ actorUserId: userId })
    .sort({ timestamp: -1 })
    .limit(limit);
};

auditLogSchema.statics.findByResource = function(resource: string, resourceId?: string, limit: number = 50) {
  const query: any = { resource };
  if (resourceId) query.resourceId = resourceId;
  
  return this.find(query)
    .sort({ timestamp: -1 })
    .limit(limit);
};

auditLogSchema.statics.findByAction = function(action: string, limit: number = 50) {
  return this.find({ action })
    .sort({ timestamp: -1 })
    .limit(limit);
};

auditLogSchema.statics.findByTimeRange = function(startDate: Date, endDate: Date) {
  return this.find({
    timestamp: {
      $gte: startDate,
      $lte: endDate,
    },
  }).sort({ timestamp: -1 });
};

auditLogSchema.statics.getActivitySummary = function(startDate: Date, endDate: Date) {
  return this.aggregate([
    {
      $match: {
        timestamp: {
          $gte: startDate,
          $lte: endDate,
        },
      },
    },
    {
      $group: {
        _id: {
          action: '$action',
          resource: '$resource',
          result: '$result',
        },
        count: { $sum: 1 },
        uniqueUsers: { $addToSet: '$actorUserId' },
        lastActivity: { $max: '$timestamp' },
      },
    },
    {
      $project: {
        action: '$_id.action',
        resource: '$_id.resource',
        result: '$_id.result',
        count: 1,
        uniqueUserCount: { $size: '$uniqueUsers' },
        lastActivity: 1,
        _id: 0,
      },
    },
    {
      $sort: { count: -1 },
    },
  ]);
};

auditLogSchema.statics.getUserActivityStats = function(userId: string, days: number = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  return this.aggregate([
    {
      $match: {
        actorUserId: mongoose.Types.ObjectId.createFromHexString(userId),
        timestamp: { $gte: startDate },
      },
    },
    {
      $group: {
        _id: {
          $dateToString: {
            format: '%Y-%m-%d',
            date: '$timestamp',
          },
        },
        totalActions: { $sum: 1 },
        successfulActions: {
          $sum: { $cond: [{ $eq: ['$result', 'SUCCESS'] }, 1, 0] },
        },
        failedActions: {
          $sum: { $cond: [{ $eq: ['$result', 'FAILURE'] }, 1, 0] },
        },
        uniqueResources: { $addToSet: '$resource' },
      },
    },
    {
      $project: {
        date: '$_id',
        totalActions: 1,
        successfulActions: 1,
        failedActions: 1,
        uniqueResourceCount: { $size: '$uniqueResources' },
        successRate: {
          $round: [
            { $multiply: [{ $divide: ['$successfulActions', '$totalActions'] }, 100] },
            2,
          ],
        },
        _id: 0,
      },
    },
    {
      $sort: { date: 1 },
    },
  ]);
};

auditLogSchema.statics.getSecurityEvents = function(days: number = 7) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  const suspiciousActions = [
    'LOGIN_FAILED',
    'UNAUTHORIZED_ACCESS',
    'PERMISSION_DENIED',
    'BULK_DELETE',
    'ADMIN_PRIVILEGE_USED',
    'DATA_EXPORT',
  ];
  
  return this.find({
    timestamp: { $gte: startDate },
    $or: [
      { action: { $in: suspiciousActions } },
      { result: 'FAILURE' },
      { 'details.ipAddress': { $regex: /^(?!10\.|172\.16\.|192\.168\.)/ } }, // Non-private IPs
    ],
  }).sort({ timestamp: -1 });
};

// TTL index for automatic cleanup (keep logs for 1 year)
auditLogSchema.index({ timestamp: 1 }, { expireAfterSeconds: 365 * 24 * 60 * 60 });

export default mongoose.model<IAuditLog>('AuditLog', auditLogSchema);