import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { AuditLog, Transaction } from '../models/index.js';
import { InventoryService } from '../services/inventoryService.js';
import { LocationType, TransactionStatus, TransactionType } from '../types/index.js';
import { asyncHandler } from '../utils/errors.js';

/**
 * Get all transactions with filtering and pagination
 */
export const getTransactions = asyncHandler(async (req: Request, res: Response) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;
  const type = req.query.type as string;
  const status = req.query.status as string;
  const storeId = req.query.storeId as string;
  const warehouseId = req.query.warehouseId as string;
  const startDate = req.query.startDate as string;
  const endDate = req.query.endDate as string;
  const userId = req.query.userId as string;

  // Build filter
  const filter: any = {};

  if (type && Object.values(TransactionType).includes(type as TransactionType)) {
    filter.type = type;
  }

  if (status && Object.values(TransactionStatus).includes(status as TransactionStatus)) {
    filter.status = status;
  }

  if (storeId && mongoose.Types.ObjectId.isValid(storeId)) {
    filter.$or = [
      { 'source.type': LocationType.STORE, 'source.id': storeId },
      { 'destination.type': LocationType.STORE, 'destination.id': storeId },
    ];
  }

  if (warehouseId && mongoose.Types.ObjectId.isValid(warehouseId)) {
    filter.$or = [
      { 'source.type': LocationType.WAREHOUSE, 'source.id': warehouseId },
      { 'destination.type': LocationType.WAREHOUSE, 'destination.id': warehouseId },
    ];
  }

  if (userId && mongoose.Types.ObjectId.isValid(userId)) {
    filter.userId = userId;
  }

  if (startDate || endDate) {
    filter.createdAt = {};
    if (startDate) filter.createdAt.$gte = new Date(startDate);
    if (endDate) filter.createdAt.$lte = new Date(endDate);
  }

  // Apply user access restrictions
  if (req.user.role === 'STORE_MANAGER' || req.user.role === 'STORE_CLERK') {
    filter.$or = [
      { 'source.type': LocationType.STORE, 'source.id': req.user.storeId },
      { 'destination.type': LocationType.STORE, 'destination.id': req.user.storeId },
    ];
  }

  const transactions = await Transaction.find(filter)
    .populate('userId', 'name email')
    .populate('approvedBy', 'name email')
    .populate('items.productId', 'name sku images')
    .sort({ createdAt: -1 })
    .limit(limit * 1)
    .skip((page - 1) * limit);

  const total = await Transaction.countDocuments(filter);

  res.json({
    success: true,
    data: {
      transactions,
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
 * Get transaction by ID
 */
export const getTransactionById = asyncHandler(async (req: Request, res: Response) => {
  const { transactionId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(transactionId)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid transaction ID',
    });
  }

  const transaction = await Transaction.findById(transactionId)
    .populate('userId', 'name email role')
    .populate('approvedBy', 'name email role')
    .populate('items.productId', 'name sku images category')
    .populate('items.batchId', 'batchNumber expiryDate');

  if (!transaction) {
    return res.status(404).json({
      success: false,
      error: 'Transaction not found',
    });
  }

  res.json({
    success: true,
    data: { transaction },
  });
});

/**
 * Process a sale transaction
 */
export const processSale = asyncHandler(async (req: Request, res: Response) => {
  const {
    storeId,
    items,
    customerInfo,
    notes,
  } = req.body;

  if (!storeId || !mongoose.Types.ObjectId.isValid(storeId)) {
    return res.status(400).json({
      success: false,
      error: 'Valid store ID is required',
    });
  }

  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({
      success: false,
      error: 'Items array is required and cannot be empty',
    });
  }

  // Validate items structure
  for (const item of items) {
    if (!item.productId || !item.quantity || item.quantity <= 0 || !item.unitPrice) {
      return res.status(400).json({
        success: false,
        error: 'Each item must have productId, quantity > 0, and unitPrice',
      });
    }
    item.totalPrice = item.quantity * item.unitPrice;
  }

  try {
    const transaction = await InventoryService.processSale(
      storeId,
      items,
      req.user.id,
      customerInfo,
      notes
    );

    // Log successful sale
    await AuditLog.logActivity(
      req.user.id,
      req.user.name,
      'SALE_PROCESS',
      'Transaction',
      {
        method: req.method,
        endpoint: req.originalUrl,
        userAgent: req.get('User-Agent'),
        ipAddress: req.ip,
        metadata: {
          transactionId: transaction._id,
          storeId,
          totalAmount: transaction.totalAmount,
          itemCount: items.length,
        },
      },
      'SUCCESS',
      transaction._id
    );

    res.status(201).json({
      success: true,
      data: { transaction },
      message: 'Sale processed successfully',
    });
  } catch (error) {
    // Log failed sale
    await AuditLog.logActivity(
      req.user.id,
      req.user.name,
      'SALE_PROCESS',
      'Transaction',
      {
        method: req.method,
        endpoint: req.originalUrl,
        userAgent: req.get('User-Agent'),
        ipAddress: req.ip,
        metadata: { storeId, error: (error as Error).message },
      },
      'FAILURE'
    );

    throw error;
  }
});

/**
 * Process a purchase transaction
 */
export const processPurchase = asyncHandler(async (req: Request, res: Response) => {
  const {
    warehouseId,
    items,
    supplierInfo,
    notes,
  } = req.body;

  if (!warehouseId || !mongoose.Types.ObjectId.isValid(warehouseId)) {
    return res.status(400).json({
      success: false,
      error: 'Valid warehouse ID is required',
    });
  }

  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({
      success: false,
      error: 'Items array is required and cannot be empty',
    });
  }

  // Validate items structure
  for (const item of items) {
    if (!item.productId || !item.quantity || item.quantity <= 0 || !item.unitPrice) {
      return res.status(400).json({
        success: false,
        error: 'Each item must have productId, quantity > 0, and unitPrice',
      });
    }
    item.totalPrice = item.quantity * item.unitPrice;
  }

  try {
    const transaction = await InventoryService.processPurchase(
      warehouseId,
      items,
      req.user.id,
      supplierInfo,
      notes
    );

    // Log successful purchase
    await AuditLog.logActivity(
      req.user.id,
      req.user.name,
      'PURCHASE_PROCESS',
      'Transaction',
      {
        method: req.method,
        endpoint: req.originalUrl,
        userAgent: req.get('User-Agent'),
        ipAddress: req.ip,
        metadata: {
          transactionId: transaction._id,
          warehouseId,
          totalAmount: transaction.totalAmount,
          itemCount: items.length,
        },
      },
      'SUCCESS',
      transaction._id
    );

    res.status(201).json({
      success: true,
      data: { transaction },
      message: 'Purchase processed successfully',
    });
  } catch (error) {
    // Log failed purchase
    await AuditLog.logActivity(
      req.user.id,
      req.user.name,
      'PURCHASE_PROCESS',
      'Transaction',
      {
        method: req.method,
        endpoint: req.originalUrl,
        userAgent: req.get('User-Agent'),
        ipAddress: req.ip,
        metadata: { warehouseId, error: (error as Error).message },
      },
      'FAILURE'
    );

    throw error;
  }
});

/**
 * Create inventory transfer
 */
export const createTransfer = asyncHandler(async (req: Request, res: Response) => {
  const {
    sourceType,
    sourceId,
    destinationType,
    destinationId,
    items,
    notes,
  } = req.body;

  // Validate source and destination
  if (!sourceType || !Object.values(LocationType).includes(sourceType)) {
    return res.status(400).json({
      success: false,
      error: 'Valid source type is required',
    });
  }

  if (!destinationType || !Object.values(LocationType).includes(destinationType)) {
    return res.status(400).json({
      success: false,
      error: 'Valid destination type is required',
    });
  }

  if (!sourceId || !mongoose.Types.ObjectId.isValid(sourceId)) {
    return res.status(400).json({
      success: false,
      error: 'Valid source ID is required',
    });
  }

  if (!destinationId || !mongoose.Types.ObjectId.isValid(destinationId)) {
    return res.status(400).json({
      success: false,
      error: 'Valid destination ID is required',
    });
  }

  if (sourceId === destinationId) {
    return res.status(400).json({
      success: false,
      error: 'Source and destination cannot be the same',
    });
  }

  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({
      success: false,
      error: 'Items array is required and cannot be empty',
    });
  }

  // Validate items structure
  for (const item of items) {
    if (!item.productId || !item.quantity || item.quantity <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Each item must have productId and quantity > 0',
      });
    }
    item.unitPrice = item.unitPrice || 0;
    item.totalPrice = item.quantity * item.unitPrice;
  }

  try {
    const transaction = await InventoryService.transferInventory({
      sourceType,
      sourceId,
      destinationType,
      destinationId,
      items,
      userId: req.user.id,
      notes,
    });

    // Log successful transfer
    await AuditLog.logActivity(
      req.user.id,
      req.user.name,
      'TRANSFER_CREATE',
      'Transaction',
      {
        method: req.method,
        endpoint: req.originalUrl,
        userAgent: req.get('User-Agent'),
        ipAddress: req.ip,
        metadata: {
          transactionId: transaction._id,
          sourceType,
          sourceId,
          destinationType,
          destinationId,
          itemCount: items.length,
        },
      },
      'SUCCESS',
      transaction._id
    );

    res.status(201).json({
      success: true,
      data: { transaction },
      message: 'Transfer created successfully',
    });
  } catch (error) {
    // Log failed transfer
    await AuditLog.logActivity(
      req.user.id,
      req.user.name,
      'TRANSFER_CREATE',
      'Transaction',
      {
        method: req.method,
        endpoint: req.originalUrl,
        userAgent: req.get('User-Agent'),
        ipAddress: req.ip,
        metadata: { sourceId, destinationId, error: (error as Error).message },
      },
      'FAILURE'
    );

    throw error;
  }
});

/**
 * Process inventory adjustment
 */
export const processAdjustment = asyncHandler(async (req: Request, res: Response) => {
  const {
    locationType,
    locationId,
    adjustments,
    notes,
  } = req.body;

  if (!locationType || !Object.values(LocationType).includes(locationType)) {
    return res.status(400).json({
      success: false,
      error: 'Valid location type is required',
    });
  }

  if (!locationId || !mongoose.Types.ObjectId.isValid(locationId)) {
    return res.status(400).json({
      success: false,
      error: 'Valid location ID is required',
    });
  }

  if (!adjustments || !Array.isArray(adjustments) || adjustments.length === 0) {
    return res.status(400).json({
      success: false,
      error: 'Adjustments array is required and cannot be empty',
    });
  }

  // Validate adjustments structure
  for (const adjustment of adjustments) {
    if (!adjustment.productId || !adjustment.quantity || adjustment.quantity === 0) {
      return res.status(400).json({
        success: false,
        error: 'Each adjustment must have productId and non-zero quantity',
      });
    }
    if (!adjustment.reason) {
      return res.status(400).json({
        success: false,
        error: 'Each adjustment must have a reason',
      });
    }
  }

  try {
    const transaction = await InventoryService.adjustInventory(
      locationType,
      locationId,
      adjustments,
      req.user.id,
      notes
    );

    // Log successful adjustment
    await AuditLog.logActivity(
      req.user.id,
      req.user.name,
      'INVENTORY_ADJUST',
      'Transaction',
      {
        method: req.method,
        endpoint: req.originalUrl,
        userAgent: req.get('User-Agent'),
        ipAddress: req.ip,
        metadata: {
          transactionId: transaction._id,
          locationType,
          locationId,
          adjustmentCount: adjustments.length,
          adjustments: adjustments.map(adj => ({
            productId: adj.productId,
            quantity: adj.quantity,
            reason: adj.reason,
          })),
        },
      },
      'SUCCESS',
      transaction._id
    );

    res.status(201).json({
      success: true,
      data: { transaction },
      message: 'Inventory adjustment processed successfully',
    });
  } catch (error) {
    // Log failed adjustment
    await AuditLog.logActivity(
      req.user.id,
      req.user.name,
      'INVENTORY_ADJUST',
      'Transaction',
      {
        method: req.method,
        endpoint: req.originalUrl,
        userAgent: req.get('User-Agent'),
        ipAddress: req.ip,
        metadata: { locationId, error: (error as Error).message },
      },
      'FAILURE'
    );

    throw error;
  }
});

/**
 * Get pending transfers
 */
export const getPendingTransfers = asyncHandler(async (req: Request, res: Response) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;

  const pendingTransfers = await Transaction.getPendingTransfers()
    .populate('userId', 'name email')
    .populate('items.productId', 'name sku images')
    .limit(limit * 1)
    .skip((page - 1) * limit);

  const total = await Transaction.countDocuments({
    type: { $in: [TransactionType.TRANSFER_IN, TransactionType.TRANSFER_OUT] },
    status: TransactionStatus.PENDING,
  });

  res.json({
    success: true,
    data: {
      transfers: pendingTransfers,
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
 * Approve or reject transfer
 */
export const approveTransfer = asyncHandler(async (req: Request, res: Response) => {
  const { transactionId } = req.params;
  const { approved, notes } = req.body;

  if (!mongoose.Types.ObjectId.isValid(transactionId)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid transaction ID',
    });
  }

  const transaction = await Transaction.findById(transactionId);
  if (!transaction) {
    return res.status(404).json({
      success: false,
      error: 'Transaction not found',
    });
  }

  if (transaction.status !== TransactionStatus.PENDING) {
    return res.status(400).json({
      success: false,
      error: 'Only pending transactions can be approved or rejected',
    });
  }

  if (![TransactionType.TRANSFER_IN, TransactionType.TRANSFER_OUT].includes(transaction.type)) {
    return res.status(400).json({
      success: false,
      error: 'Only transfer transactions require approval',
    });
  }

  // Update transaction
  transaction.status = approved ? TransactionStatus.COMPLETED : TransactionStatus.CANCELLED;
  transaction.approvedBy = req.user.id;
  transaction.notes = notes || transaction.notes;
  
  if (approved) {
    transaction.completedAt = new Date();
  }

  await transaction.save();

  // Log approval/rejection
  await AuditLog.logActivity(
    req.user.id,
    req.user.name,
    approved ? 'TRANSFER_APPROVE' : 'TRANSFER_REJECT',
    'Transaction',
    {
      method: req.method,
      endpoint: req.originalUrl,
      userAgent: req.get('User-Agent'),
      ipAddress: req.ip,
      metadata: {
        transactionId: transaction._id,
        originalStatus: TransactionStatus.PENDING,
        newStatus: transaction.status,
        notes,
      },
    },
    'SUCCESS',
    transaction._id
  );

  res.json({
    success: true,
    data: { transaction },
    message: `Transfer ${approved ? 'approved' : 'rejected'} successfully`,
  });
});

/**
 * Get transaction summary/analytics
 */
export const getTransactionSummary = asyncHandler(async (req: Request, res: Response) => {
  const startDate = req.query.startDate ? new Date(req.query.startDate as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const endDate = req.query.endDate ? new Date(req.query.endDate as string) : new Date();
  const locationType = req.query.locationType as string;
  const locationId = req.query.locationId as string;

  const summary = await Transaction.getTransactionSummary(
    startDate,
    endDate,
    locationType,
    locationId
  );

  // Get additional metrics
  const totalTransactions = await Transaction.countDocuments({
    createdAt: { $gte: startDate, $lte: endDate },
    status: TransactionStatus.COMPLETED,
  });

  const pendingTransactions = await Transaction.countDocuments({
    createdAt: { $gte: startDate, $lte: endDate },
    status: TransactionStatus.PENDING,
  });

  res.json({
    success: true,
    data: {
      summary,
      metrics: {
        totalTransactions,
        pendingTransactions,
        dateRange: { startDate, endDate },
      },
    },
  });
});

/**
 * Get transactions by product
 */
export const getTransactionsByProduct = asyncHandler(async (req: Request, res: Response) => {
  const { productId } = req.params;
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;

  if (!mongoose.Types.ObjectId.isValid(productId)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid product ID',
    });
  }

  const transactions = await Transaction.findByProduct(productId)
    .populate('userId', 'name email')
    .populate('approvedBy', 'name email')
    .limit(limit * 1)
    .skip((page - 1) * limit);

  const total = await Transaction.countDocuments({
    'items.productId': productId,
  });

  res.json({
    success: true,
    data: {
      transactions,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    },
  });
});