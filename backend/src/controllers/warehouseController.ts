import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { AuditLog, Product, Store, Warehouse } from '../models/index.js';
import { asyncHandler } from '../utils/errors.js';

/**
 * Get all warehouses
 */
export const getWarehouses = asyncHandler(async (req: Request, res: Response) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 10;
  const search = req.query.search as string;
  const type = req.query.type as string;
  const isActive = req.query.isActive as string;

  // Build filter
  const filter: any = {};
  
  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: 'i' } },
      { 'address.city': { $regex: search, $options: 'i' } },
      { 'address.state': { $regex: search, $options: 'i' } },
    ];
  }
  
  if (type) {
    filter.type = type;
  }
  
  if (isActive !== undefined) {
    filter.isActive = isActive === 'true';
  }

  const warehouses = await Warehouse.find(filter)
    .sort({ createdAt: -1 })
    .limit(limit * 1)
    .skip((page - 1) * limit);

  const total = await Warehouse.countDocuments(filter);

  res.json({
    success: true,
    data: {
      warehouses,
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
 * Get warehouse by ID
 */
export const getWarehouseById = asyncHandler(async (req: Request, res: Response) => {
  const { warehouseId } = req.params;
  const includeInventory = req.query.includeInventory === 'true';

  if (!mongoose.Types.ObjectId.isValid(warehouseId)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid warehouse ID',
    });
  }

  const warehouse = await Warehouse.findById(warehouseId);
  if (!warehouse) {
    return res.status(404).json({
      success: false,
      error: 'Warehouse not found',
    });
  }

  let inventoryDetails = [];
  if (includeInventory && warehouse.inventory.length > 0) {
    const productIds = warehouse.inventory.map(item => item.productId);
    const products = await Product.find({ _id: { $in: productIds } });
    
    inventoryDetails = warehouse.inventory.map(item => {
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
      warehouse,
      inventory: inventoryDetails,
    },
  });
});

/**
 * Create new warehouse
 */
export const createWarehouse = asyncHandler(async (req: Request, res: Response) => {
  const {
    name,
    type,
    address,
    contact,
    capacity,
    zones,
    settings,
  } = req.body;

  // Check if warehouse name already exists
  const existingWarehouse = await Warehouse.findOne({ name });
  if (existingWarehouse) {
    return res.status(400).json({
      success: false,
      error: 'Warehouse with this name already exists',
    });
  }

  // Create warehouse
  const warehouse = await Warehouse.create({
    name,
    type: type || 'SECONDARY',
    address,
    contact,
    inventory: [],
    capacity: capacity || {
      totalSpace: 1000,
      usedSpace: 0,
      unit: 'sqft',
    },
    zones: zones || [
      {
        zoneId: 'GENERAL',
        name: 'General Storage',
        capacity: 1000,
        usedCapacity: 0,
      },
    ],
    settings: settings || {
      defaultReceivingZone: 'GENERAL',
      autoAllocateZone: true,
      temperatureControlled: false,
    },
  });

  // Log activity
  await AuditLog.logActivity(
    req.user.id,
    req.user.name,
    'WAREHOUSE_CREATE',
    'Warehouse',
    {
      method: req.method,
      endpoint: req.originalUrl,
      userAgent: req.get('User-Agent'),
      ipAddress: req.ip,
      metadata: { warehouseId: warehouse._id, name: warehouse.name },
    },
    'SUCCESS',
    warehouse._id
  );

  res.status(201).json({
    success: true,
    data: { warehouse },
    message: 'Warehouse created successfully',
  });
});

/**
 * Update warehouse
 */
export const updateWarehouse = asyncHandler(async (req: Request, res: Response) => {
  const { warehouseId } = req.params;
  const {
    name,
    address,
    contact,
    capacity,
    zones,
    settings,
    isActive,
  } = req.body;

  if (!mongoose.Types.ObjectId.isValid(warehouseId)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid warehouse ID',
    });
  }

  const warehouse = await Warehouse.findById(warehouseId);
  if (!warehouse) {
    return res.status(404).json({
      success: false,
      error: 'Warehouse not found',
    });
  }

  // Track changes for audit log
  const changes: Array<{ field: string; oldValue: any; newValue: any }> = [];

  if (name && name !== warehouse.name) {
    // Check if new name already exists
    const existingWarehouse = await Warehouse.findOne({ name, _id: { $ne: warehouseId } });
    if (existingWarehouse) {
      return res.status(400).json({
        success: false,
        error: 'Warehouse with this name already exists',
      });
    }
    changes.push({ field: 'name', oldValue: warehouse.name, newValue: name });
    warehouse.name = name;
  }

  if (address && JSON.stringify(address) !== JSON.stringify(warehouse.address)) {
    changes.push({ field: 'address', oldValue: warehouse.address, newValue: address });
    warehouse.address = address;
  }

  if (contact && JSON.stringify(contact) !== JSON.stringify(warehouse.contact)) {
    changes.push({ field: 'contact', oldValue: warehouse.contact, newValue: contact });
    warehouse.contact = contact;
  }

  if (capacity && JSON.stringify(capacity) !== JSON.stringify(warehouse.capacity)) {
    changes.push({ field: 'capacity', oldValue: warehouse.capacity, newValue: capacity });
    warehouse.capacity = capacity;
  }

  if (zones && JSON.stringify(zones) !== JSON.stringify(warehouse.zones)) {
    changes.push({ field: 'zones', oldValue: warehouse.zones, newValue: zones });
    warehouse.zones = zones;
  }

  if (settings && JSON.stringify(settings) !== JSON.stringify(warehouse.settings)) {
    changes.push({ field: 'settings', oldValue: warehouse.settings, newValue: settings });
    warehouse.settings = settings;
  }

  if (isActive !== undefined && isActive !== warehouse.isActive) {
    changes.push({ field: 'isActive', oldValue: warehouse.isActive, newValue: isActive });
    warehouse.isActive = isActive;
  }

  await warehouse.save();

  // Log warehouse update
  if (changes.length > 0) {
    await AuditLog.logActivity(
      req.user.id,
      req.user.name,
      'WAREHOUSE_UPDATE',
      'Warehouse',
      {
        method: req.method,
        endpoint: req.originalUrl,
        userAgent: req.get('User-Agent'),
        ipAddress: req.ip,
        changes,
      },
      'SUCCESS',
      warehouse._id
    );
  }

  res.json({
    success: true,
    data: { warehouse },
    message: 'Warehouse updated successfully',
  });
});

/**
 * Delete warehouse (soft delete)
 */
export const deleteWarehouse = asyncHandler(async (req: Request, res: Response) => {
  const { warehouseId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(warehouseId)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid warehouse ID',
    });
  }

  const warehouse = await Warehouse.findById(warehouseId);
  if (!warehouse) {
    return res.status(404).json({
      success: false,
      error: 'Warehouse not found',
    });
  }

  // Check if it's the main warehouse
  if (warehouse.type === 'MAIN') {
    return res.status(400).json({
      success: false,
      error: 'Cannot delete the main warehouse',
    });
  }

  // Check if warehouse has associated stores
  const associatedStores = await Store.countDocuments({ warehouseId, isActive: true });
  if (associatedStores > 0) {
    return res.status(400).json({
      success: false,
      error: 'Cannot delete warehouse with associated active stores',
    });
  }

  // Check if warehouse has inventory
  const hasInventory = warehouse.inventory.some(item => item.quantity > 0);
  if (hasInventory) {
    return res.status(400).json({
      success: false,
      error: 'Cannot delete warehouse with remaining inventory',
    });
  }

  // Soft delete
  warehouse.isActive = false;
  await warehouse.save();

  // Log warehouse deletion
  await AuditLog.logActivity(
    req.user.id,
    req.user.name,
    'WAREHOUSE_DELETE',
    'Warehouse',
    {
      method: req.method,
      endpoint: req.originalUrl,
      userAgent: req.get('User-Agent'),
      ipAddress: req.ip,
      metadata: { warehouseId: warehouse._id, name: warehouse.name },
    },
    'SUCCESS',
    warehouse._id
  );

  res.json({
    success: true,
    message: 'Warehouse deleted successfully',
  });
});

/**
 * Get warehouse inventory
 */
export const getWarehouseInventory = asyncHandler(async (req: Request, res: Response) => {
  const { warehouseId } = req.params;
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;
  const search = req.query.search as string;
  const category = req.query.category as string;
  const lowStock = req.query.lowStock === 'true';

  if (!mongoose.Types.ObjectId.isValid(warehouseId)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid warehouse ID',
    });
  }

  const warehouse = await Warehouse.findById(warehouseId);
  if (!warehouse) {
    return res.status(404).json({
      success: false,
      error: 'Warehouse not found',
    });
  }

  // Build aggregation pipeline
  const pipeline: any[] = [
    { $match: { _id: mongoose.Types.ObjectId.createFromHexString(warehouseId) } },
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
      $match: {
        $expr: {
          $lte: ['$inventory.quantity', '$product.alertThreshold'],
        },
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
        isLowStock: {
          $lte: ['$inventory.quantity', '$product.alertThreshold'],
        },
      },
    }
  );

  const inventory = await Warehouse.aggregate(pipeline);

  // Get total count for pagination
  const countPipeline = pipeline.slice(0, -3); // Remove skip, limit, and project
  countPipeline.push({ $count: 'total' });
  const countResult = await Warehouse.aggregate(countPipeline);
  const total = countResult[0]?.total || 0;

  res.json({
    success: true,
    data: {
      inventory,
      warehouse: {
        id: warehouse._id,
        name: warehouse.name,
        type: warehouse.type,
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
 * Get low stock products across all warehouses
 */
export const getLowStockProducts = asyncHandler(async (req: Request, res: Response) => {
  const threshold = parseInt(req.query.threshold as string) || 10;
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;

  const lowStockProducts = await Warehouse.getLowStockProducts(threshold)
    .skip((page - 1) * limit)
    .limit(limit);

  const total = await Warehouse.aggregate([
    { $match: { isActive: true } },
    { $unwind: '$inventory' },
    { $match: { 'inventory.quantity': { $lte: threshold } } },
    { $count: 'total' },
  ]);

  res.json({
    success: true,
    data: {
      products: lowStockProducts,
      pagination: {
        page,
        limit,
        total: total[0]?.total || 0,
        pages: Math.ceil((total[0]?.total || 0) / limit),
      },
    },
  });
});

/**
 * Get main warehouse
 */
export const getMainWarehouse = asyncHandler(async (req: Request, res: Response) => {
  const mainWarehouse = await Warehouse.getMainWarehouse();
  
  if (!mainWarehouse) {
    return res.status(404).json({
      success: false,
      error: 'Main warehouse not found',
    });
  }

  res.json({
    success: true,
    data: { warehouse: mainWarehouse },
  });
});