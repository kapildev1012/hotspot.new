import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { AuditLog, Product, Store, User, Warehouse } from '../models/index.js';
import { UserRole } from '../types/index.js';
import { asyncHandler } from '../utils/errors.js';

/**
 * Get all stores
 */
export const getStores = asyncHandler(async (req: Request, res: Response) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 10;
  const search = req.query.search as string;
  const warehouseId = req.query.warehouseId as string;
  const storeType = req.query.storeType as string;
  const status = req.query.status as string;
  const isActive = req.query.isActive as string;

  // Build filter
  const filter: any = {};
  
  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: 'i' } },
      { code: { $regex: search, $options: 'i' } },
      { 'address.city': { $regex: search, $options: 'i' } },
      { 'address.state': { $regex: search, $options: 'i' } },
    ];
  }
  
  if (warehouseId && mongoose.Types.ObjectId.isValid(warehouseId)) {
    filter.warehouseId = warehouseId;
  }
  
  if (storeType) {
    filter.storeType = storeType;
  }
  
  if (status) {
    filter.status = status;
  }
  
  if (isActive !== undefined) {
    filter.isActive = isActive === 'true';
  }

  // Apply store access control
  if (req.user.role === UserRole.STORE_MANAGER || req.user.role === UserRole.STORE_CLERK) {
    filter._id = req.user.storeId;
  }

  const stores = await Store.find(filter)
    .populate('warehouseId', 'name type')
    .sort({ createdAt: -1 })
    .limit(limit * 1)
    .skip((page - 1) * limit);

  const total = await Store.countDocuments(filter);

  res.json({
    success: true,
    data: {
      stores,
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
 * Get store by ID
 */
export const getStoreById = asyncHandler(async (req: Request, res: Response) => {
  const { storeId } = req.params;
  const includeInventory = req.query.includeInventory === 'true';

  if (!mongoose.Types.ObjectId.isValid(storeId)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid store ID',
    });
  }

  const store = await Store.findById(storeId)
    .populate('warehouseId', 'name type address contact');

  if (!store) {
    return res.status(404).json({
      success: false,
      error: 'Store not found',
    });
  }

  let inventoryDetails = [];
  if (includeInventory && store.inventory.length > 0) {
    const productIds = store.inventory.map(item => item.productId);
    const products = await Product.find({ _id: { $in: productIds } });
    
    inventoryDetails = store.inventory.map(item => {
      const product = products.find(p => p._id.toString() === item.productId.toString());
      return {
        product,
        quantity: item.quantity,
        reserved: item.reserved,
        available: item.quantity - item.reserved,
        lastUpdated: item.lastUpdated,
      };
    });
  }

  res.json({
    success: true,
    data: {
      store,
      inventory: inventoryDetails,
    },
  });
});

/**
 * Create new store
 */
export const createStore = asyncHandler(async (req: Request, res: Response) => {
  const {
    name,
    code,
    address,
    contact,
    warehouseId,
    storeType,
    operatingHours,
    coordinates,
    settings,
  } = req.body;

  // Validate warehouse exists
  if (!mongoose.Types.ObjectId.isValid(warehouseId)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid warehouse ID',
    });
  }

  const warehouse = await Warehouse.findById(warehouseId);
  if (!warehouse || !warehouse.isActive) {
    return res.status(404).json({
      success: false,
      error: 'Warehouse not found or inactive',
    });
  }

  // Check if store code already exists
  if (code) {
    const existingStore = await Store.findOne({ code });
    if (existingStore) {
      return res.status(400).json({
        success: false,
        error: 'Store with this code already exists',
      });
    }
  }

  // Create store
  const store = await Store.create({
    name,
    code,
    address,
    contact,
    inventory: [],
    settings: settings || {
      reorderThresholdOverrides: new Map(),
      workingHours: {
        open: '09:00',
        close: '18:00',
        timezone: 'UTC',
      },
      autoReorder: false,
      lowStockThreshold: 10,
    },
    warehouseId,
    storeType: storeType || 'RETAIL',
    operatingHours,
    coordinates,
  });

  // Log activity
  await AuditLog.logActivity(
    req.user.id,
    req.user.name,
    'STORE_CREATE',
    'Store',
    {
      method: req.method,
      endpoint: req.originalUrl,
      userAgent: req.get('User-Agent'),
      ipAddress: req.ip,
      metadata: { 
        storeId: store._id, 
        name: store.name, 
        code: store.code,
        warehouseId: store.warehouseId,
      },
    },
    'SUCCESS',
    store._id
  );

  // Populate warehouse details
  await store.populate('warehouseId', 'name type');

  res.status(201).json({
    success: true,
    data: { store },
    message: 'Store created successfully',
  });
});

/**
 * Update store
 */
export const updateStore = asyncHandler(async (req: Request, res: Response) => {
  const { storeId } = req.params;
  const {
    name,
    address,
    contact,
    storeType,
    status,
    operatingHours,
    coordinates,
    settings,
    isActive,
  } = req.body;

  if (!mongoose.Types.ObjectId.isValid(storeId)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid store ID',
    });
  }

  const store = await Store.findById(storeId);
  if (!store) {
    return res.status(404).json({
      success: false,
      error: 'Store not found',
    });
  }

  // Track changes for audit log
  const changes: Array<{ field: string; oldValue: any; newValue: any }> = [];

  if (name && name !== store.name) {
    changes.push({ field: 'name', oldValue: store.name, newValue: name });
    store.name = name;
  }

  if (address && JSON.stringify(address) !== JSON.stringify(store.address)) {
    changes.push({ field: 'address', oldValue: store.address, newValue: address });
    store.address = address;
  }

  if (contact && JSON.stringify(contact) !== JSON.stringify(store.contact)) {
    changes.push({ field: 'contact', oldValue: store.contact, newValue: contact });
    store.contact = contact;
  }

  if (storeType && storeType !== store.storeType) {
    changes.push({ field: 'storeType', oldValue: store.storeType, newValue: storeType });
    store.storeType = storeType;
  }

  if (status && status !== store.status) {
    changes.push({ field: 'status', oldValue: store.status, newValue: status });
    store.status = status;
  }

  if (operatingHours && JSON.stringify(operatingHours) !== JSON.stringify(store.operatingHours)) {
    changes.push({ field: 'operatingHours', oldValue: store.operatingHours, newValue: operatingHours });
    store.operatingHours = operatingHours;
  }

  if (coordinates && JSON.stringify(coordinates) !== JSON.stringify(store.coordinates)) {
    changes.push({ field: 'coordinates', oldValue: store.coordinates, newValue: coordinates });
    store.coordinates = coordinates;
  }

  if (settings && JSON.stringify(settings) !== JSON.stringify(store.settings)) {
    changes.push({ field: 'settings', oldValue: store.settings, newValue: settings });
    store.settings = settings;
  }

  if (isActive !== undefined && isActive !== store.isActive) {
    changes.push({ field: 'isActive', oldValue: store.isActive, newValue: isActive });
    store.isActive = isActive;
  }

  await store.save();

  // Log store update
  if (changes.length > 0) {
    await AuditLog.logActivity(
      req.user.id,
      req.user.name,
      'STORE_UPDATE',
      'Store',
      {
        method: req.method,
        endpoint: req.originalUrl,
        userAgent: req.get('User-Agent'),
        ipAddress: req.ip,
        changes,
      },
      'SUCCESS',
      store._id
    );
  }

  res.json({
    success: true,
    data: { store },
    message: 'Store updated successfully',
  });
});

/**
 * Delete store (soft delete)
 */
export const deleteStore = asyncHandler(async (req: Request, res: Response) => {
  const { storeId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(storeId)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid store ID',
    });
  }

  const store = await Store.findById(storeId);
  if (!store) {
    return res.status(404).json({
      success: false,
      error: 'Store not found',
    });
  }

  // Check if store has inventory
  const hasInventory = store.inventory.some(item => item.quantity > 0);
  if (hasInventory) {
    return res.status(400).json({
      success: false,
      error: 'Cannot delete store with remaining inventory',
    });
  }

  // Check if store has associated users
  const associatedUsers = await User.countDocuments({ storeId, isActive: true });
  if (associatedUsers > 0) {
    return res.status(400).json({
      success: false,
      error: 'Cannot delete store with associated active users',
    });
  }

  // Soft delete
  store.isActive = false;
  store.status = 'INACTIVE';
  await store.save();

  // Log store deletion
  await AuditLog.logActivity(
    req.user.id,
    req.user.name,
    'STORE_DELETE',
    'Store',
    {
      method: req.method,
      endpoint: req.originalUrl,
      userAgent: req.get('User-Agent'),
      ipAddress: req.ip,
      metadata: { 
        storeId: store._id, 
        name: store.name, 
        code: store.code,
      },
    },
    'SUCCESS',
    store._id
  );

  res.json({
    success: true,
    message: 'Store deleted successfully',
  });
});

/**
 * Get store inventory
 */
export const getStoreInventory = asyncHandler(async (req: Request, res: Response) => {
  const { storeId } = req.params;
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;
  const search = req.query.search as string;
  const category = req.query.category as string;
  const lowStock = req.query.lowStock === 'true';

  if (!mongoose.Types.ObjectId.isValid(storeId)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid store ID',
    });
  }

  const store = await Store.findById(storeId);
  if (!store) {
    return res.status(404).json({
      success: false,
      error: 'Store not found',
    });
  }

  // Build aggregation pipeline
  const pipeline: any[] = [
    { $match: { _id: mongoose.Types.ObjectId.createFromHexString(storeId) } },
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
    { $match: { 'product.isActive': true } },
  ];

  // Add filters
  if (search) {
    pipeline.push({
      $match: {
        $or: [
          { 'product.name': { $regex: search, $options: 'i' } },
          { 'product.sku': { $regex: search, $options: 'i' } },
          { 'product.category': { $regex: search, $options: 'i' } },
        ],
      },
    });
  }

  if (category) {
    pipeline.push({
      $match: { 'product.category': { $regex: category, $options: 'i' } },
    });
  }

  if (lowStock) {
    pipeline.push({
      $addFields: {
        threshold: {
          $ifNull: [
            { $toDouble: { $getField: { field: { $toString: '$product._id' }, input: '$settings.reorderThresholdOverrides' } } },
            '$product.alertThreshold',
          ],
        },
      },
    });
    pipeline.push({
      $match: {
        $expr: { $lte: ['$inventory.quantity', '$threshold'] },
      },
    });
  }

  // Add pagination
  const skip = (page - 1) * limit;
  pipeline.push(
    { $skip: skip },
    { $limit: limit },
    {
      $project: {
        product: 1,
        quantity: '$inventory.quantity',
        reserved: '$inventory.reserved',
        available: { $subtract: ['$inventory.quantity', '$inventory.reserved'] },
        lastUpdated: '$inventory.lastUpdated',
        threshold: {
          $ifNull: [
            { $toDouble: { $getField: { field: { $toString: '$product._id' }, input: '$settings.reorderThresholdOverrides' } } },
            '$product.alertThreshold',
          ],
        },
        isLowStock: {
          $lte: [
            '$inventory.quantity',
            {
              $ifNull: [
                { $toDouble: { $getField: { field: { $toString: '$product._id' }, input: '$settings.reorderThresholdOverrides' } } },
                '$product.alertThreshold',
              ],
            },
          ],
        },
      },
    }
  );

  const inventory = await Store.aggregate(pipeline);

  // Get total count for pagination
  const countPipeline = pipeline.slice(0, -3); // Remove skip, limit, and project
  countPipeline.push({ $count: 'total' });
  const countResult = await Store.aggregate(countPipeline);
  const total = countResult[0]?.total || 0;

  res.json({
    success: true,
    data: {
      inventory,
      store: {
        id: store._id,
        name: store.name,
        code: store.code,
        status: store.status,
      },
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
 * Get stores by warehouse
 */
export const getStoresByWarehouse = asyncHandler(async (req: Request, res: Response) => {
  const { warehouseId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(warehouseId)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid warehouse ID',
    });
  }

  const stores = await Store.findByWarehouse(warehouseId);

  res.json({
    success: true,
    data: { stores },
  });
});

/**
 * Get low stock products across stores
 */
export const getStoreLowStockProducts = asyncHandler(async (req: Request, res: Response) => {
  const { storeId } = req.params;
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;

  // Validate store access
  if (storeId && !mongoose.Types.ObjectId.isValid(storeId)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid store ID',
    });
  }

  const lowStockProducts = await Store.getLowStockProducts(storeId)
    .skip((page - 1) * limit)
    .limit(limit);

  const countPipeline = [
    { $match: storeId ? { _id: mongoose.Types.ObjectId.createFromHexString(storeId), isActive: true } : { isActive: true, status: 'ACTIVE' } },
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
    { $count: 'total' },
  ];

  const countResult = await Store.aggregate(countPipeline);
  const total = countResult[0]?.total || 0;

  res.json({
    success: true,
    data: {
      products: lowStockProducts,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    },
  });
});