import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { Store } from '../models/index.js';
import { ImportExportService } from '../services/importExportService.js';
import { UserRole } from '../types/index.js';
import { asyncHandler } from '../utils/errors.js';

/**
 * Import products from CSV/Excel file
 */
export const importProducts = asyncHandler(async (req: Request, res: Response) => {
  if (!req.file) {
    return res.status(400).json({
      success: false,
      error: 'No file uploaded',
    });
  }

  const result = await ImportExportService.importProducts(
    req.file,
    req.user.id,
    req.user.name
  );

  const statusCode = result.success ? 200 : 400;

  res.status(statusCode).json({
    success: result.success,
    data: result,
    message: result.success 
      ? 'Products imported successfully' 
      : 'Import completed with errors',
  });
});

/**
 * Import inventory from CSV/Excel file
 */
export const importInventory = asyncHandler(async (req: Request, res: Response) => {
  const { storeId } = req.params;

  if (!req.file) {
    return res.status(400).json({
      success: false,
      error: 'No file uploaded',
    });
  }

  if (!mongoose.Types.ObjectId.isValid(storeId)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid store ID',
    });
  }

  // Check store access permissions
  if (req.user.role === UserRole.STORE_MANAGER || req.user.role === UserRole.STORE_CLERK) {
    if (req.user.storeId !== storeId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied to this store',
      });
    }
  }

  const result = await ImportExportService.importInventory(
    req.file,
    storeId,
    req.user.id,
    req.user.name
  );

  const statusCode = result.success ? 200 : 400;

  res.status(statusCode).json({
    success: result.success,
    data: result,
    message: result.success 
      ? 'Inventory imported successfully' 
      : 'Import completed with errors',
  });
});

/**
 * Export products to CSV/Excel
 */
export const exportProducts = asyncHandler(async (req: Request, res: Response) => {
  const { format = 'csv', category, isActive } = req.query;
  const fields = req.query.fields ? (req.query.fields as string).split(',') : undefined;

  // Build filters
  const filters: any = {};
  if (category) filters.category = { $regex: category, $options: 'i' };
  if (isActive !== undefined) filters.isActive = isActive === 'true';

  const buffer = await ImportExportService.exportProducts({
    format: format as 'csv' | 'xlsx',
    filters,
    fields,
  });

  const filename = `products_export_${new Date().toISOString().split('T')[0]}.${format}`;
  const contentType = format === 'xlsx' 
    ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    : 'text/csv';

  res.setHeader('Content-Type', contentType);
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(buffer);
});

/**
 * Export store inventory to CSV/Excel
 */
export const exportInventory = asyncHandler(async (req: Request, res: Response) => {
  const { storeId } = req.params;
  const { format = 'csv' } = req.query;
  const fields = req.query.fields ? (req.query.fields as string).split(',') : undefined;

  if (!mongoose.Types.ObjectId.isValid(storeId)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid store ID',
    });
  }

  // Check store access permissions
  if (req.user.role === UserRole.STORE_MANAGER || req.user.role === UserRole.STORE_CLERK) {
    if (req.user.storeId !== storeId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied to this store',
      });
    }
  }

  const store = await Store.findById(storeId);
  if (!store) {
    return res.status(404).json({
      success: false,
      error: 'Store not found',
    });
  }

  const buffer = await ImportExportService.exportInventory(storeId, {
    format: format as 'csv' | 'xlsx',
    fields,
  });

  const filename = `inventory_${store.code}_${new Date().toISOString().split('T')[0]}.${format}`;
  const contentType = format === 'xlsx' 
    ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    : 'text/csv';

  res.setHeader('Content-Type', contentType);
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(buffer);
});

/**
 * Get import templates
 */
export const getImportTemplates = asyncHandler(async (req: Request, res: Response) => {
  const { type, format = 'csv' } = req.query;

  let templateData: any[] = [];
  let filename = '';

  if (type === 'products') {
    templateData = [{
      name: 'Example Product',
      sku: 'PROD-001',
      category: 'Electronics',
      description: 'Sample product description',
      price: '99.99',
      cost: '50.00',
      unit: 'pcs',
      specifications: '{"color": "red", "size": "medium"}',
      alertThreshold: '10',
      hasShelfLife: 'false',
      shelfLifeDays: '0',
      tags: 'electronics, gadget',
      isActive: 'true',
    }];
    filename = `products_import_template.${format}`;
  } else if (type === 'inventory') {
    templateData = [{
      sku: 'PROD-001',
      quantity: '100',
    }];
    filename = `inventory_import_template.${format}`;
  } else {
    return res.status(400).json({
      success: false,
      error: 'Invalid template type. Use "products" or "inventory"',
    });
  }

  const buffer = ImportExportService['generateFile'](templateData, format as 'csv' | 'xlsx');
  const contentType = format === 'xlsx' 
    ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    : 'text/csv';

  res.setHeader('Content-Type', contentType);
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(buffer);
});