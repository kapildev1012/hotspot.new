import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { AuditLog, Batch, Product } from '../models/index.js';
import { asyncHandler } from '../utils/errors.js';

/**
 * Get all batches with filtering and pagination
 */
export const getBatches = asyncHandler(async (req: Request, res: Response) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;
  const productId = req.query.productId as string;
  const expiryStatus = req.query.expiryStatus as string;
  const qualityStatus = req.query.qualityStatus as string;
  const sortBy = req.query.sortBy as string || 'expiryDate';
  const sortOrder = req.query.sortOrder as string || 'asc';

  // Build filter
  const filter: any = { isActive: true };

  if (productId) {
    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid product ID',
      });
    }
    filter.productId = productId;
  }

  if (qualityStatus) {
    filter.qualityStatus = qualityStatus;
  }

  // Handle expiry status filtering
  if (expiryStatus) {
    const now = new Date();
    switch (expiryStatus) {
      case 'EXPIRED':
        filter.expiryDate = { $lt: now };
        break;
      case 'EXPIRING_SOON':
        const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
        filter.expiryDate = { $gte: now, $lte: sevenDaysFromNow };
        break;
      case 'EXPIRING_MONTH':
        const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
        filter.expiryDate = { $gte: now, $lte: thirtyDaysFromNow };
        break;
      case 'GOOD':
        const goodDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
        filter.expiryDate = { $gt: goodDate };
        break;
    }
  }

  // Build sort
  const sort: any = {};
  sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

  const batches = await Batch.find(filter)
    .populate('productId', 'name sku category images')
    .populate('createdBy', 'name')
    .sort(sort)
    .limit(limit * 1)
    .skip((page - 1) * limit);

  const total = await Batch.countDocuments(filter);

  res.json({
    success: true,
    data: {
      batches,
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
 * Get batch by ID
 */
export const getBatchById = asyncHandler(async (req: Request, res: Response) => {
  const { batchId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(batchId)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid batch ID',
    });
  }

  const batch = await Batch.findById(batchId)
    .populate('productId', 'name sku category images')
    .populate('createdBy', 'name email');

  if (!batch) {
    return res.status(404).json({
      success: false,
      error: 'Batch not found',
    });
  }

  res.json({
    success: true,
    data: { batch },
  });
});

/**
 * Create new batch
 */
export const createBatch = asyncHandler(async (req: Request, res: Response) => {
  const {
    productId,
    batchNumber,
    manufactureDate,
    expiryDate,
    quantity,
    warehouseLocation,
    storeLocation,
    costPrice,
    sellingPrice,
    supplierInfo,
    qualityStatus,
    notes,
  } = req.body;

  // Validate product exists
  if (!mongoose.Types.ObjectId.isValid(productId)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid product ID',
    });
  }

  const product = await Product.findById(productId);
  if (!product || !product.isActive) {
    return res.status(404).json({
      success: false,
      error: 'Product not found or inactive',
    });
  }

  // Check if batch number already exists for this product
  const existingBatch = await Batch.findOne({ productId, batchNumber });
  if (existingBatch) {
    return res.status(400).json({
      success: false,
      error: 'Batch number already exists for this product',
    });
  }

  // Validate dates
  if (expiryDate && new Date(expiryDate) <= new Date(manufactureDate)) {
    return res.status(400).json({
      success: false,
      error: 'Expiry date must be after manufacture date',
    });
  }

  // Create batch
  const batch = await Batch.create({
    productId,
    batchNumber,
    manufactureDate,
    expiryDate,
    quantity,
    remainingQuantity: quantity,
    warehouseLocation,
    storeLocation,
    costPrice,
    sellingPrice: sellingPrice || product.sellingPrice,
    supplierInfo,
    qualityStatus: qualityStatus || 'GOOD',
    notes,
    createdBy: req.user.id,
  });

  // Log activity
  await AuditLog.logActivity(
    req.user.id,
    req.user.name,
    'BATCH_CREATE',
    'Batch',
    {
      method: req.method,
      endpoint: req.originalUrl,
      userAgent: req.get('User-Agent'),
      ipAddress: req.ip,
      metadata: { 
        batchId: batch._id, 
        batchNumber: batch.batchNumber,
        productId: batch.productId,
        quantity: batch.quantity,
      },
    },
    'SUCCESS',
    batch._id
  );

  // Populate product details
  await batch.populate('productId', 'name sku category');

  res.status(201).json({
    success: true,
    data: { batch },
    message: 'Batch created successfully',
  });
});

/**
 * Update batch
 */
export const updateBatch = asyncHandler(async (req: Request, res: Response) => {
  const { batchId } = req.params;
  const {
    manufactureDate,
    expiryDate,
    warehouseLocation,
    storeLocation,
    costPrice,
    sellingPrice,
    supplierInfo,
    qualityStatus,
    notes,
  } = req.body;

  if (!mongoose.Types.ObjectId.isValid(batchId)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid batch ID',
    });
  }

  const batch = await Batch.findById(batchId);
  if (!batch) {
    return res.status(404).json({
      success: false,
      error: 'Batch not found',
    });
  }

  // Track changes for audit log
  const changes: Array<{ field: string; oldValue: any; newValue: any }> = [];

  // Update fields
  if (manufactureDate && new Date(manufactureDate).getTime() !== batch.manufactureDate.getTime()) {
    changes.push({ field: 'manufactureDate', oldValue: batch.manufactureDate, newValue: new Date(manufactureDate) });
    batch.manufactureDate = new Date(manufactureDate);
  }

  if (expiryDate !== undefined) {
    const newExpiryDate = expiryDate ? new Date(expiryDate) : null;
    if ((!batch.expiryDate && newExpiryDate) || 
        (batch.expiryDate && !newExpiryDate) ||
        (batch.expiryDate && newExpiryDate && batch.expiryDate.getTime() !== newExpiryDate.getTime())) {
      changes.push({ field: 'expiryDate', oldValue: batch.expiryDate, newValue: newExpiryDate });
      batch.expiryDate = newExpiryDate;
    }
  }

  if (warehouseLocation !== undefined && warehouseLocation !== batch.warehouseLocation) {
    changes.push({ field: 'warehouseLocation', oldValue: batch.warehouseLocation, newValue: warehouseLocation });
    batch.warehouseLocation = warehouseLocation;
  }

  if (storeLocation !== undefined && storeLocation !== batch.storeLocation) {
    changes.push({ field: 'storeLocation', oldValue: batch.storeLocation, newValue: storeLocation });
    batch.storeLocation = storeLocation;
  }

  if (costPrice !== undefined && costPrice !== batch.costPrice) {
    changes.push({ field: 'costPrice', oldValue: batch.costPrice, newValue: costPrice });
    batch.costPrice = costPrice;
  }

  if (sellingPrice !== undefined && sellingPrice !== batch.sellingPrice) {
    changes.push({ field: 'sellingPrice', oldValue: batch.sellingPrice, newValue: sellingPrice });
    batch.sellingPrice = sellingPrice;
  }

  if (supplierInfo && JSON.stringify(supplierInfo) !== JSON.stringify(batch.supplierInfo)) {
    changes.push({ field: 'supplierInfo', oldValue: batch.supplierInfo, newValue: supplierInfo });
    batch.supplierInfo = supplierInfo;
  }

  if (qualityStatus && qualityStatus !== batch.qualityStatus) {
    changes.push({ field: 'qualityStatus', oldValue: batch.qualityStatus, newValue: qualityStatus });
    batch.qualityStatus = qualityStatus;
  }

  if (notes !== undefined && notes !== batch.notes) {
    changes.push({ field: 'notes', oldValue: batch.notes, newValue: notes });
    batch.notes = notes;
  }

  // Validate expiry date if changed
  if (batch.expiryDate && batch.expiryDate <= batch.manufactureDate) {
    return res.status(400).json({
      success: false,
      error: 'Expiry date must be after manufacture date',
    });
  }

  await batch.save();

  // Log batch update
  if (changes.length > 0) {
    await AuditLog.logActivity(
      req.user.id,
      req.user.name,
      'BATCH_UPDATE',
      'Batch',
      {
        method: req.method,
        endpoint: req.originalUrl,
        userAgent: req.get('User-Agent'),
        ipAddress: req.ip,
        changes,
      },
      'SUCCESS',
      batch._id
    );
  }

  res.json({
    success: true,
    data: { batch },
    message: 'Batch updated successfully',
  });
});

/**
 * Delete batch (soft delete)
 */
export const deleteBatch = asyncHandler(async (req: Request, res: Response) => {
  const { batchId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(batchId)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid batch ID',
    });
  }

  const batch = await Batch.findById(batchId);
  if (!batch) {
    return res.status(404).json({
      success: false,
      error: 'Batch not found',
    });
  }

  // Check if batch has remaining quantity
  if (batch.remainingQuantity > 0) {
    return res.status(400).json({
      success: false,
      error: 'Cannot delete batch with remaining inventory',
    });
  }

  // Soft delete
  batch.isActive = false;
  await batch.save();

  // Log batch deletion
  await AuditLog.logActivity(
    req.user.id,
    req.user.name,
    'BATCH_DELETE',
    'Batch',
    {
      method: req.method,
      endpoint: req.originalUrl,
      userAgent: req.get('User-Agent'),
      ipAddress: req.ip,
      metadata: { 
        batchId: batch._id, 
        batchNumber: batch.batchNumber,
        productId: batch.productId,
      },
    },
    'SUCCESS',
    batch._id
  );

  res.json({
    success: true,
    message: 'Batch deleted successfully',
  });
});

/**
 * Get expiring batches
 */
export const getExpiringBatches = asyncHandler(async (req: Request, res: Response) => {
  const days = parseInt(req.query.days as string) || 30;
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;

  const batches = await Batch.findExpiringBatches(days)
    .limit(limit * 1)
    .skip((page - 1) * limit);

  const total = await Batch.countDocuments({
    expiryDate: { 
      $lte: new Date(Date.now() + days * 24 * 60 * 60 * 1000),
      $gte: new Date()
    },
    isActive: true,
    qualityStatus: 'GOOD',
    remainingQuantity: { $gt: 0 },
  });

  res.json({
    success: true,
    data: {
      batches,
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
 * Get expired batches
 */
export const getExpiredBatches = asyncHandler(async (req: Request, res: Response) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;

  const batches = await Batch.findExpiredBatches()
    .limit(limit * 1)
    .skip((page - 1) * limit);

  const total = await Batch.countDocuments({
    expiryDate: { $lt: new Date() },
    isActive: true,
    remainingQuantity: { $gt: 0 },
  });

  res.json({
    success: true,
    data: {
      batches,
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
 * Adjust batch quantity
 */
export const adjustBatchQuantity = asyncHandler(async (req: Request, res: Response) => {
  const { batchId } = req.params;
  const { adjustment, reason } = req.body;

  if (!mongoose.Types.ObjectId.isValid(batchId)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid batch ID',
    });
  }

  if (!adjustment || adjustment === 0) {
    return res.status(400).json({
      success: false,
      error: 'Adjustment amount is required and must not be zero',
    });
  }

  const batch = await Batch.findById(batchId);
  if (!batch) {
    return res.status(404).json({
      success: false,
      error: 'Batch not found',
    });
  }

  const oldQuantity = batch.remainingQuantity;
  const newQuantity = Math.max(0, oldQuantity + adjustment);

  // Update batch quantity
  batch.remainingQuantity = newQuantity;
  await batch.save();

  // Log quantity adjustment
  await AuditLog.logActivity(
    req.user.id,
    req.user.name,
    'BATCH_QUANTITY_ADJUST',
    'Batch',
    {
      method: req.method,
      endpoint: req.originalUrl,
      userAgent: req.get('User-Agent'),
      ipAddress: req.ip,
      changes: [
        { field: 'remainingQuantity', oldValue: oldQuantity, newValue: newQuantity },
      ],
      metadata: { 
        batchId: batch._id,
        batchNumber: batch.batchNumber,
        adjustment,
        reason,
      },
    },
    'SUCCESS',
    batch._id
  );

  res.json({
    success: true,
    data: { 
      batch,
      adjustment: {
        oldQuantity,
        newQuantity,
        adjustment,
        reason,
      },
    },
    message: 'Batch quantity adjusted successfully',
  });
});