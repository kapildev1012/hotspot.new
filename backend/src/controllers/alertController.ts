import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { Alert, AuditLog } from '../models/index.js';
import { alertService } from '../services/alertService.js';
import { AlertPriority, AlertType } from '../types/index.js';
import { asyncHandler } from '../utils/errors.js';

/**
 * Get all alerts with filtering and pagination
 */
export const getAlerts = asyncHandler(async (req: Request, res: Response) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;
  const type = req.query.type as string;
  const priority = req.query.priority as string;
  const resolved = req.query.resolved as string;
  const acknowledged = req.query.acknowledged as string;
  const storeId = req.query.storeId as string;
  const warehouseId = req.query.warehouseId as string;
  const productId = req.query.productId as string;

  // Build filter
  const filter: any = {};

  if (type && Object.values(AlertType).includes(type as AlertType)) {
    filter.type = type;
  }

  if (priority && Object.values(AlertPriority).includes(priority as AlertPriority)) {
    filter.priority = priority;
  }

  if (resolved !== undefined) {
    filter.resolved = resolved === 'true';
  }

  if (acknowledged !== undefined) {
    filter.acknowledged = acknowledged === 'true';
  }

  if (storeId && mongoose.Types.ObjectId.isValid(storeId)) {
    filter.storeId = storeId;
  }

  if (warehouseId && mongoose.Types.ObjectId.isValid(warehouseId)) {
    filter.warehouseId = warehouseId;
  }

  if (productId && mongoose.Types.ObjectId.isValid(productId)) {
    filter.productId = productId;
  }

  // Apply user access restrictions
  if (req.user.role === 'STORE_MANAGER' || req.user.role === 'STORE_CLERK') {
    filter.storeId = req.user.storeId;
  }

  // Only show non-expired alerts by default
  if (req.query.includeExpired !== 'true') {
    filter.$or = [
      { expiresAt: null },
      { expiresAt: { $gt: new Date() } },
    ];
  }

  const alerts = await Alert.find(filter)
    .populate('productId', 'name sku images')
    .populate('storeId', 'name code')
    .populate('warehouseId', 'name type')
    .populate('batchId', 'batchNumber expiryDate')
    .populate('resolvedBy', 'name')
    .populate('acknowledgedBy', 'name')
    .sort({ priority: -1, createdAt: -1 })
    .limit(limit * 1)
    .skip((page - 1) * limit);

  const total = await Alert.countDocuments(filter);

  res.json({
    success: true,
    data: {
      alerts,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    },
  });
});

/**
 * Get alert by ID
 */
export const getAlertById = asyncHandler(async (req: Request, res: Response) => {
  const { alertId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(alertId)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid alert ID',
    });
  }

  const alert = await Alert.findById(alertId)
    .populate('productId', 'name sku images category')
    .populate('storeId', 'name code address')
    .populate('warehouseId', 'name type address')
    .populate('batchId', 'batchNumber manufactureDate expiryDate')
    .populate('resolvedBy', 'name email')
    .populate('acknowledgedBy', 'name email');

  if (!alert) {
    return res.status(404).json({
      success: false,
      error: 'Alert not found',
    });
  }

  res.json({
    success: true,
    data: { alert },
  });
});

/**
 * Get active alerts (not resolved and not expired)
 */
export const getActiveAlerts = asyncHandler(async (req: Request, res: Response) => {
  const storeId = req.query.storeId as string;
  const warehouseId = req.query.warehouseId as string;

  const filters: any = {};
  
  if (storeId && mongoose.Types.ObjectId.isValid(storeId)) {
    filters.storeId = storeId;
  }
  
  if (warehouseId && mongoose.Types.ObjectId.isValid(warehouseId)) {
    filters.warehouseId = warehouseId;
  }

  // Apply user access restrictions
  if (req.user.role === 'STORE_MANAGER' || req.user.role === 'STORE_CLERK') {
    filters.storeId = req.user.storeId;
  }

  const activeAlerts = await Alert.getActiveAlerts(filters)
    .populate('productId', 'name sku')
    .populate('storeId', 'name code')
    .populate('warehouseId', 'name type');

  res.json({
    success: true,
    data: { alerts: activeAlerts },
  });
});

/**
 * Get unacknowledged alerts
 */
export const getUnacknowledgedAlerts = asyncHandler(async (req: Request, res: Response) => {
  const unacknowledgedAlerts = await Alert.getUnacknowledgedAlerts()
    .populate('productId', 'name sku')
    .populate('storeId', 'name code')
    .populate('warehouseId', 'name type');

  res.json({
    success: true,
    data: { alerts: unacknowledgedAlerts },
  });
});

/**
 * Get critical alerts
 */
export const getCriticalAlerts = asyncHandler(async (req: Request, res: Response) => {
  const criticalAlerts = await Alert.getCriticalAlerts()
    .populate('productId', 'name sku')
    .populate('storeId', 'name code')
    .populate('warehouseId', 'name type');

  res.json({
    success: true,
    data: { alerts: criticalAlerts },
  });
});

/**
 * Mark alert as acknowledged
 */
export const acknowledgeAlert = asyncHandler(async (req: Request, res: Response) => {
  const { alertId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(alertId)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid alert ID',
    });
  }

  const alert = await Alert.findById(alertId);
  if (!alert) {
    return res.status(404).json({
      success: false,
      error: 'Alert not found',
    });
  }

  if (alert.acknowledged) {
    return res.status(400).json({
      success: false,
      error: 'Alert is already acknowledged',
    });
  }

  await alert.markAcknowledged(req.user.id);

  // Log acknowledgment
  await AuditLog.logActivity(
    req.user.id,
    req.user.name,
    'ALERT_ACKNOWLEDGE',
    'Alert',
    {
      method: req.method,
      endpoint: req.originalUrl,
      userAgent: req.get('User-Agent'),
      ipAddress: req.ip,
      metadata: {
        alertId: alert._id,
        alertType: alert.type,
        priority: alert.priority,
      },
    },
    'SUCCESS',
    alert._id
  );

  res.json({
    success: true,
    data: { alert },
    message: 'Alert acknowledged successfully',
  });
});

/**
 * Resolve alert
 */
export const resolveAlert = asyncHandler(async (req: Request, res: Response) => {
  const { alertId } = req.params;
  const { notes } = req.body;

  if (!mongoose.Types.ObjectId.isValid(alertId)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid alert ID',
    });
  }

  const alert = await Alert.findById(alertId);
  if (!alert) {
    return res.status(404).json({
      success: false,
      error: 'Alert not found',
    });
  }

  if (alert.resolved) {
    return res.status(400).json({
      success: false,
      error: 'Alert is already resolved',
    });
  }

  await alert.markResolved(req.user.id, notes);

  // Log resolution
  await AuditLog.logActivity(
    req.user.id,
    req.user.name,
    'ALERT_RESOLVE',
    'Alert',
    {
      method: req.method,
      endpoint: req.originalUrl,
      userAgent: req.get('User-Agent'),
      ipAddress: req.ip,
      metadata: {
        alertId: alert._id,
        alertType: alert.type,
        priority: alert.priority,
        resolutionNotes: notes,
      },
    },
    'SUCCESS',
    alert._id
  );

  res.json({
    success: true,
    data: { alert },
    message: 'Alert resolved successfully',
  });
});

/**
 * Create manual alert
 */
export const createAlert = asyncHandler(async (req: Request, res: Response) => {
  const {
    type,
    priority,
    title,
    message,
    productId,
    storeId,
    warehouseId,
    batchId,
    metadata,
    scheduledFor,
    expiresAt,
  } = req.body;

  if (!type || !Object.values(AlertType).includes(type)) {
    return res.status(400).json({
      success: false,
      error: 'Valid alert type is required',
    });
  }

  if (!priority || !Object.values(AlertPriority).includes(priority)) {
    return res.status(400).json({
      success: false,
      error: 'Valid alert priority is required',
    });
  }

  if (!title || !message) {
    return res.status(400).json({
      success: false,
      error: 'Title and message are required',
    });
  }

  const alert = await alertService.createAlert({
    type,
    priority,
    title,
    message,
    productId,
    storeId,
    warehouseId,
    batchId,
    metadata,
    scheduledFor: scheduledFor ? new Date(scheduledFor) : undefined,
    expiresAt: expiresAt ? new Date(expiresAt) : undefined,
  });

  // Log manual alert creation
  await AuditLog.logActivity(
    req.user.id,
    req.user.name,
    'ALERT_CREATE_MANUAL',
    'Alert',
    {
      method: req.method,
      endpoint: req.originalUrl,
      userAgent: req.get('User-Agent'),
      ipAddress: req.ip,
      metadata: {
        alertId: alert._id,
        alertType: type,
        priority,
      },
    },
    'SUCCESS',
    alert._id
  );

  res.status(201).json({
    success: true,
    data: { alert },
    message: 'Alert created successfully',
  });
});

/**
 * Get alert statistics
 */
export const getAlertStats = asyncHandler(async (req: Request, res: Response) => {
  const startDate = req.query.startDate ? new Date(req.query.startDate as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const endDate = req.query.endDate ? new Date(req.query.endDate as string) : new Date();

  const stats = await Alert.getAlertStats(startDate, endDate);

  // Get current active alerts count
  const activeAlertsCount = await Alert.countDocuments({
    resolved: false,
    $or: [
      { expiresAt: null },
      { expiresAt: { $gt: new Date() } },
    ],
  });

  // Get critical alerts count
  const criticalAlertsCount = await Alert.countDocuments({
    priority: AlertPriority.CRITICAL,
    resolved: false,
    $or: [
      { expiresAt: null },
      { expiresAt: { $gt: new Date() } },
    ],
  });

  // Get unacknowledged alerts count
  const unacknowledgedCount = await Alert.countDocuments({
    acknowledged: false,
    resolved: false,
    $or: [
      { expiresAt: null },
      { expiresAt: { $gt: new Date() } },
    ],
  });

  res.json({
    success: true,
    data: {
      stats,
      summary: {
        activeAlerts: activeAlertsCount,
        criticalAlerts: criticalAlertsCount,
        unacknowledged: unacknowledgedCount,
        dateRange: { startDate, endDate },
      },
    },
  });
});

/**
 * Run manual alert checks
 */
export const runAlertChecks = asyncHandler(async (req: Request, res: Response) => {
  const { checkType } = req.body;

  if (checkType) {
    switch (checkType) {
      case 'lowStock':
        await (alertService as any).checkLowStockAlerts();
        break;
      case 'expiry':
        await (alertService as any).checkExpiryAlerts();
        break;
      case 'overstock':
        await (alertService as any).checkOverstockAlerts();
        break;
      case 'reorder':
        await (alertService as any).generateReorderSuggestions();
        break;
      case 'suspicious':
        await alertService.checkSuspiciousActivity();
        break;
      default:
        return res.status(400).json({
          success: false,
          error: 'Invalid check type',
        });
    }
  } else {
    await alertService.runAllChecks();
  }

  // Log manual alert check
  await AuditLog.logActivity(
    req.user.id,
    req.user.name,
    'ALERT_CHECK_MANUAL',
    'Alert',
    {
      method: req.method,
      endpoint: req.originalUrl,
      userAgent: req.get('User-Agent'),
      ipAddress: req.ip,
      metadata: { checkType: checkType || 'all' },
    },
    'SUCCESS'
  );

  res.json({
    success: true,
    message: `Alert check ${checkType || 'all'} completed successfully`,
  });
});

/**
 * Bulk acknowledge alerts
 */
export const bulkAcknowledgeAlerts = asyncHandler(async (req: Request, res: Response) => {
  const { alertIds } = req.body;

  if (!alertIds || !Array.isArray(alertIds)) {
    return res.status(400).json({
      success: false,
      error: 'Alert IDs array is required',
    });
  }

  const validIds = alertIds.filter(id => mongoose.Types.ObjectId.isValid(id));
  if (validIds.length !== alertIds.length) {
    return res.status(400).json({
      success: false,
      error: 'All alert IDs must be valid',
    });
  }

  const result = await Alert.updateMany(
    {
      _id: { $in: validIds },
      acknowledged: false,
    },
    {
      $set: {
        acknowledged: true,
        acknowledgedBy: req.user.id,
        acknowledgedAt: new Date(),
      },
    }
  );

  // Log bulk acknowledgment
  await AuditLog.logActivity(
    req.user.id,
    req.user.name,
    'ALERT_BULK_ACKNOWLEDGE',
    'Alert',
    {
      method: req.method,
      endpoint: req.originalUrl,
      userAgent: req.get('User-Agent'),
      ipAddress: req.ip,
      metadata: {
        alertIds: validIds,
        acknowledgedCount: result.modifiedCount,
      },
    },
    'SUCCESS'
  );

  res.json({
    success: true,
    message: `${result.modifiedCount} alerts acknowledged successfully`,
    data: { acknowledgedCount: result.modifiedCount },
  });
});

/**
 * Bulk resolve alerts
 */
export const bulkResolveAlerts = asyncHandler(async (req: Request, res: Response) => {
  const { alertIds, notes } = req.body;

  if (!alertIds || !Array.isArray(alertIds)) {
    return res.status(400).json({
      success: false,
      error: 'Alert IDs array is required',
    });
  }

  const validIds = alertIds.filter(id => mongoose.Types.ObjectId.isValid(id));
  if (validIds.length !== alertIds.length) {
    return res.status(400).json({
      success: false,
      error: 'All alert IDs must be valid',
    });
  }

  const result = await Alert.updateMany(
    {
      _id: { $in: validIds },
      resolved: false,
    },
    {
      $set: {
        resolved: true,
        resolvedBy: req.user.id,
        resolvedAt: new Date(),
        resolutionNotes: notes,
        acknowledged: true,
        acknowledgedBy: req.user.id,
        acknowledgedAt: new Date(),
      },
    }
  );

  // Log bulk resolution
  await AuditLog.logActivity(
    req.user.id,
    req.user.name,
    'ALERT_BULK_RESOLVE',
    'Alert',
    {
      method: req.method,
      endpoint: req.originalUrl,
      userAgent: req.get('User-Agent'),
      ipAddress: req.ip,
      metadata: {
        alertIds: validIds,
        resolvedCount: result.modifiedCount,
        resolutionNotes: notes,
      },
    },
    'SUCCESS'
  );

  res.json({
    success: true,
    message: `${result.modifiedCount} alerts resolved successfully`,
    data: { resolvedCount: result.modifiedCount },
  });
});