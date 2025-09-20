import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { AuditLog, Batch, Product } from '../models/index.js';
import { ImageUploadService } from '../services/imageUploadService.js';
import { asyncHandler } from '../utils/errors.js';

/**
 * Get all products with filtering, sorting, and pagination
 */
export const getProducts = asyncHandler(async (req: Request, res: Response) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;
  const search = req.query.search as string;
  const category = req.query.category as string;
  const isActive = req.query.isActive as string;
  const sortBy = req.query.sortBy as string || 'createdAt';
  const sortOrder = req.query.sortOrder as string || 'desc';
  const tags = req.query.tags as string;

  // Build filter
  const filter: any = {};

  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: 'i' } },
      { description: { $regex: search, $options: 'i' } },
      { sku: { $regex: search, $options: 'i' } },
      { barcode: { $regex: search, $options: 'i' } },
    ];
  }

  if (category) {
    filter.category = { $regex: category, $options: 'i' };
  }

  if (isActive !== undefined) {
    filter.isActive = isActive === 'true';
  }

  if (tags) {
    const tagArray = tags.split(',').map(tag => tag.trim());
    filter.tags = { $in: tagArray };
  }

  // Build sort
  const sort: any = {};
  sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

  const products = await Product.find(filter)
    .populate('createdBy', 'name')
    .populate('updatedBy', 'name')
    .sort(sort)
    .limit(limit * 1)
    .skip((page - 1) * limit);

  const total = await Product.countDocuments(filter);

  // Get categories for filters
  const categories = await Product.distinct('category', { isActive: true });
  const allTags = await Product.distinct('tags', { isActive: true });

  res.json({
    success: true,
    data: {
      products,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
      filters: {
        categories,
        tags: allTags,
      },
    },
  });
});

/**
 * Get product by ID with batches
 */
export const getProductById = asyncHandler(async (req: Request, res: Response) => {
  const { productId } = req.params;
  const includeBatches = req.query.includeBatches === 'true';

  if (!mongoose.Types.ObjectId.isValid(productId)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid product ID',
    });
  }

  const product = await Product.findById(productId)
    .populate('createdBy', 'name email')
    .populate('updatedBy', 'name email');

  if (!product) {
    return res.status(404).json({
      success: false,
      error: 'Product not found',
    });
  }

  let batches = [];
  if (includeBatches) {
    batches = await Batch.find({ productId, isActive: true })
      .sort({ expiryDate: 1, createdAt: -1 });
  }

  res.json({
    success: true,
    data: {
      product,
      batches,
    },
  });
});

/**
 * Create new product
 */
export const createProduct = asyncHandler(async (req: Request, res: Response) => {
  const {
    sku,
    name,
    description,
    category,
    variants,
    defaultUnit,
    alertThreshold,
    reorderQuantity,
    costPrice,
    sellingPrice,
    barcode,
    tags,
    uploadedImages,
  } = req.body;

  // Check if SKU already exists
  const existingProduct = await Product.findOne({ sku });
  if (existingProduct) {
    return res.status(400).json({
      success: false,
      error: 'Product with this SKU already exists',
    });
  }

  // Prepare images array
  const images = uploadedImages ? uploadedImages.map((img: any) => img.url) : [];

  // Create product
  const product = await Product.create({
    sku,
    name,
    description,
    category,
    images,
    variants: variants || [],
    defaultUnit,
    alertThreshold: alertThreshold || 10,
    reorderQuantity: reorderQuantity || 50,
    costPrice,
    sellingPrice,
    barcode,
    tags: tags || [],
    createdBy: req.user.id,
    updatedBy: req.user.id,
  });

  // Log activity
  await AuditLog.logActivity(
    req.user.id,
    req.user.name,
    'PRODUCT_CREATE',
    'Product',
    {
      method: req.method,
      endpoint: req.originalUrl,
      userAgent: req.get('User-Agent'),
      ipAddress: req.ip,
      metadata: { productId: product._id, sku: product.sku },
    },
    'SUCCESS',
    product._id
  );

  res.status(201).json({
    success: true,
    data: { product },
    message: 'Product created successfully',
  });
});

/**
 * Update product
 */
export const updateProduct = asyncHandler(async (req: Request, res: Response) => {
  const { productId } = req.params;
  const {
    name,
    description,
    category,
    variants,
    defaultUnit,
    alertThreshold,
    reorderQuantity,
    costPrice,
    sellingPrice,
    barcode,
    tags,
    uploadedImages,
    removeImages,
  } = req.body;

  if (!mongoose.Types.ObjectId.isValid(productId)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid product ID',
    });
  }

  const product = await Product.findById(productId);
  if (!product) {
    return res.status(404).json({
      success: false,
      error: 'Product not found',
    });
  }

  // Track changes for audit log
  const changes: Array<{ field: string; oldValue: any; newValue: any }> = [];

  // Update fields
  if (name && name !== product.name) {
    changes.push({ field: 'name', oldValue: product.name, newValue: name });
    product.name = name;
  }

  if (description !== undefined && description !== product.description) {
    changes.push({ field: 'description', oldValue: product.description, newValue: description });
    product.description = description;
  }

  if (category && category !== product.category) {
    changes.push({ field: 'category', oldValue: product.category, newValue: category });
    product.category = category;
  }

  if (variants && JSON.stringify(variants) !== JSON.stringify(product.variants)) {
    changes.push({ field: 'variants', oldValue: product.variants, newValue: variants });
    product.variants = variants;
  }

  if (defaultUnit && defaultUnit !== product.defaultUnit) {
    changes.push({ field: 'defaultUnit', oldValue: product.defaultUnit, newValue: defaultUnit });
    product.defaultUnit = defaultUnit;
  }

  if (alertThreshold !== undefined && alertThreshold !== product.alertThreshold) {
    changes.push({ field: 'alertThreshold', oldValue: product.alertThreshold, newValue: alertThreshold });
    product.alertThreshold = alertThreshold;
  }

  if (reorderQuantity !== undefined && reorderQuantity !== product.reorderQuantity) {
    changes.push({ field: 'reorderQuantity', oldValue: product.reorderQuantity, newValue: reorderQuantity });
    product.reorderQuantity = reorderQuantity;
  }

  if (costPrice !== undefined && costPrice !== product.costPrice) {
    changes.push({ field: 'costPrice', oldValue: product.costPrice, newValue: costPrice });
    product.costPrice = costPrice;
  }

  if (sellingPrice !== undefined && sellingPrice !== product.sellingPrice) {
    changes.push({ field: 'sellingPrice', oldValue: product.sellingPrice, newValue: sellingPrice });
    product.sellingPrice = sellingPrice;
  }

  if (barcode !== undefined && barcode !== product.barcode) {
    changes.push({ field: 'barcode', oldValue: product.barcode, newValue: barcode });
    product.barcode = barcode;
  }

  if (tags && JSON.stringify(tags) !== JSON.stringify(product.tags)) {
    changes.push({ field: 'tags', oldValue: product.tags, newValue: tags });
    product.tags = tags;
  }

  // Handle image updates
  let currentImages = [...product.images];

  // Remove specified images
  if (removeImages && Array.isArray(removeImages)) {
    const imagesToRemove = removeImages.filter(url => currentImages.includes(url));
    const publicIdsToDelete = imagesToRemove.map(url => ImageUploadService.extractPublicId(url));
    
    // Delete from Cloudinary
    if (publicIdsToDelete.length > 0) {
      try {
        await ImageUploadService.deleteMultipleImages(publicIdsToDelete);
      } catch (error) {
        console.error('Failed to delete images from Cloudinary:', error);
      }
    }

    currentImages = currentImages.filter(url => !imagesToRemove.includes(url));
  }

  // Add new images
  if (uploadedImages && Array.isArray(uploadedImages)) {
    const newImageUrls = uploadedImages.map((img: any) => img.url);
    currentImages = [...currentImages, ...newImageUrls];
  }

  if (JSON.stringify(currentImages) !== JSON.stringify(product.images)) {
    changes.push({ field: 'images', oldValue: product.images, newValue: currentImages });
    product.images = currentImages;
  }

  product.updatedBy = req.user.id;
  await product.save();

  // Log product update
  if (changes.length > 0) {
    await AuditLog.logActivity(
      req.user.id,
      req.user.name,
      'PRODUCT_UPDATE',
      'Product',
      {
        method: req.method,
        endpoint: req.originalUrl,
        userAgent: req.get('User-Agent'),
        ipAddress: req.ip,
        changes,
      },
      'SUCCESS',
      product._id
    );
  }

  res.json({
    success: true,
    data: { product },
    message: 'Product updated successfully',
  });
});

/**
 * Delete product (soft delete)
 */
export const deleteProduct = asyncHandler(async (req: Request, res: Response) => {
  const { productId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(productId)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid product ID',
    });
  }

  const product = await Product.findById(productId);
  if (!product) {
    return res.status(404).json({
      success: false,
      error: 'Product not found',
    });
  }

  // Check if product has active batches
  const activeBatches = await Batch.countDocuments({ 
    productId, 
    isActive: true, 
    remainingQuantity: { $gt: 0 } 
  });

  if (activeBatches > 0) {
    return res.status(400).json({
      success: false,
      error: 'Cannot delete product with active inventory batches',
    });
  }

  // Soft delete
  product.isActive = false;
  product.updatedBy = req.user.id;
  await product.save();

  // Log product deletion
  await AuditLog.logActivity(
    req.user.id,
    req.user.name,
    'PRODUCT_DELETE',
    'Product',
    {
      method: req.method,
      endpoint: req.originalUrl,
      userAgent: req.get('User-Agent'),
      ipAddress: req.ip,
      metadata: { productId: product._id, sku: product.sku },
    },
    'SUCCESS',
    product._id
  );

  res.json({
    success: true,
    message: 'Product deleted successfully',
  });
});

/**
 * Search products by barcode or QR code
 */
export const searchProductByCode = asyncHandler(async (req: Request, res: Response) => {
  const { code } = req.params;

  if (!code) {
    return res.status(400).json({
      success: false,
      error: 'Code parameter is required',
    });
  }

  const product = await Product.findOne({
    $or: [
      { barcode: code },
      { qrCode: code },
      { sku: code },
    ],
    isActive: true,
  }).populate('createdBy', 'name');

  if (!product) {
    return res.status(404).json({
      success: false,
      error: 'Product not found',
    });
  }

  res.json({
    success: true,
    data: { product },
  });
});

/**
 * Get product categories
 */
export const getProductCategories = asyncHandler(async (req: Request, res: Response) => {
  const categories = await Product.aggregate([
    { $match: { isActive: true } },
    { $group: { _id: '$category', count: { $sum: 1 } } },
    { $sort: { _id: 1 } },
    { $project: { category: '$_id', count: 1, _id: 0 } },
  ]);

  res.json({
    success: true,
    data: { categories },
  });
});

/**
 * Get product tags
 */
export const getProductTags = asyncHandler(async (req: Request, res: Response) => {
  const tags = await Product.aggregate([
    { $match: { isActive: true } },
    { $unwind: '$tags' },
    { $group: { _id: '$tags', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $project: { tag: '$_id', count: 1, _id: 0 } },
  ]);

  res.json({
    success: true,
    data: { tags },
  });
});

/**
 * Duplicate product
 */
export const duplicateProduct = asyncHandler(async (req: Request, res: Response) => {
  const { productId } = req.params;
  const { newSku, newName } = req.body;

  if (!mongoose.Types.ObjectId.isValid(productId)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid product ID',
    });
  }

  const originalProduct = await Product.findById(productId);
  if (!originalProduct) {
    return res.status(404).json({
      success: false,
      error: 'Product not found',
    });
  }

  // Check if new SKU already exists
  if (newSku) {
    const existingProduct = await Product.findOne({ sku: newSku });
    if (existingProduct) {
      return res.status(400).json({
        success: false,
        error: 'Product with this SKU already exists',
      });
    }
  }

  // Create duplicate
  const duplicateData = {
    ...originalProduct.toObject(),
    _id: undefined,
    sku: newSku || `${originalProduct.sku}_COPY`,
    name: newName || `${originalProduct.name} (Copy)`,
    createdBy: req.user.id,
    updatedBy: req.user.id,
    createdAt: undefined,
    updatedAt: undefined,
  };

  const duplicatedProduct = await Product.create(duplicateData);

  // Log activity
  await AuditLog.logActivity(
    req.user.id,
    req.user.name,
    'PRODUCT_DUPLICATE',
    'Product',
    {
      method: req.method,
      endpoint: req.originalUrl,
      userAgent: req.get('User-Agent'),
      ipAddress: req.ip,
      metadata: { 
        originalProductId: originalProduct._id, 
        duplicatedProductId: duplicatedProduct._id,
        newSku: duplicatedProduct.sku,
      },
    },
    'SUCCESS',
    duplicatedProduct._id
  );

  res.status(201).json({
    success: true,
    data: { product: duplicatedProduct },
    message: 'Product duplicated successfully',
  });
});