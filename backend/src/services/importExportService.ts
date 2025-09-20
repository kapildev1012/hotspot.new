import csv from 'csv-parser';
import mongoose from 'mongoose';
import { Readable } from 'stream';
import * as XLSX from 'xlsx';
import { AuditLog, Product, Store, Transaction } from '../models/index.js';
import { TransactionType } from '../types/index.js';

interface ImportResult {
  success: boolean;
  processed: number;
  errors: Array<{ row: number; error: string; data?: any }>;
  created: any[];
  updated: any[];
}

interface ExportOptions {
  format: 'csv' | 'xlsx';
  filters?: any;
  fields?: string[];
}

export class ImportExportService {
  /**
   * Import products from CSV/Excel file
   */
  static async importProducts(
    file: Express.Multer.File,
    userId: string,
    userName: string
  ): Promise<ImportResult> {
    const result: ImportResult = {
      success: true,
      processed: 0,
      errors: [],
      created: [],
      updated: [],
    };

    try {
      const data = await this.parseFile(file);
      
      for (let i = 0; i < data.length; i++) {
        const row = data[i];
        const rowNumber = i + 1;

        try {
          // Validate required fields
          if (!row.name || !row.sku || !row.category) {
            result.errors.push({
              row: rowNumber,
              error: 'Missing required fields: name, sku, or category',
              data: row,
            });
            continue;
          }

          // Check if product exists
          const existingProduct = await Product.findOne({ sku: row.sku });
          
          const productData = {
            name: row.name,
            sku: row.sku,
            category: row.category,
            description: row.description || '',
            price: parseFloat(row.price) || 0,
            cost: parseFloat(row.cost) || 0,
            unit: row.unit || 'pcs',
            specifications: row.specifications ? JSON.parse(row.specifications) : {},
            alertThreshold: parseInt(row.alertThreshold) || 10,
            hasShelfLife: row.hasShelfLife === 'true',
            shelfLifeDays: parseInt(row.shelfLifeDays) || 0,
            tags: row.tags ? row.tags.split(',').map((tag: string) => tag.trim()) : [],
            isActive: row.isActive !== 'false',
          };

          if (existingProduct) {
            // Update existing product
            Object.assign(existingProduct, productData);
            await existingProduct.save();
            result.updated.push(existingProduct);
          } else {
            // Create new product
            const newProduct = await Product.create(productData);
            result.created.push(newProduct);
          }

          result.processed++;
        } catch (error) {
          result.errors.push({
            row: rowNumber,
            error: error instanceof Error ? error.message : 'Unknown error',
            data: row,
          });
        }
      }

      // Log import activity
      await AuditLog.logActivity(
        userId,
        userName,
        'PRODUCTS_IMPORT',
        'System',
        {
          totalRows: data.length,
          processed: result.processed,
          created: result.created.length,
          updated: result.updated.length,
          errors: result.errors.length,
        },
        result.errors.length === 0 ? 'SUCCESS' : 'PARTIAL_FAILURE'
      );

      if (result.errors.length > 0) {
        result.success = false;
      }

    } catch (error) {
      result.success = false;
      result.errors.push({
        row: 0,
        error: error instanceof Error ? error.message : 'File parsing failed',
      });
    }

    return result;
  }

  /**
   * Import inventory from CSV/Excel file
   */
  static async importInventory(
    file: Express.Multer.File,
    storeId: string,
    userId: string,
    userName: string
  ): Promise<ImportResult> {
    const result: ImportResult = {
      success: true,
      processed: 0,
      errors: [],
      created: [],
      updated: [],
    };

    const session = await mongoose.startSession();

    try {
      await session.withTransaction(async () => {
        const data = await this.parseFile(file);
        
        const store = await Store.findById(storeId).session(session);
        if (!store) {
          throw new Error('Store not found');
        }

        for (let i = 0; i < data.length; i++) {
          const row = data[i];
          const rowNumber = i + 1;

          try {
            // Validate required fields
            if (!row.sku || !row.quantity) {
              result.errors.push({
                row: rowNumber,
                error: 'Missing required fields: sku or quantity',
                data: row,
              });
              continue;
            }

            // Find product by SKU
            const product = await Product.findOne({ sku: row.sku }).session(session);
            if (!product) {
              result.errors.push({
                row: rowNumber,
                error: `Product with SKU ${row.sku} not found`,
                data: row,
              });
              continue;
            }

            const quantity = parseInt(row.quantity);
            if (isNaN(quantity) || quantity < 0) {
              result.errors.push({
                row: rowNumber,
                error: 'Invalid quantity value',
                data: row,
              });
              continue;
            }

            // Update store inventory
            const inventoryIndex = store.inventory.findIndex(
              item => item.productId.toString() === product._id.toString()
            );

            if (inventoryIndex >= 0) {
              // Update existing inventory
              const oldQuantity = store.inventory[inventoryIndex].quantity;
              store.inventory[inventoryIndex].quantity = quantity;
              store.inventory[inventoryIndex].lastUpdated = new Date();
              
              result.updated.push({
                product: product.name,
                sku: product.sku,
                oldQuantity,
                newQuantity: quantity,
              });
            } else {
              // Add new inventory item
              store.inventory.push({
                productId: product._id,
                quantity,
                reserved: 0,
                lastUpdated: new Date(),
              });
              
              result.created.push({
                product: product.name,
                sku: product.sku,
                quantity,
              });
            }

            // Create transaction record
            await Transaction.create([{
              type: TransactionType.ADJUSTMENT,
              productId: product._id,
              quantity,
              fromLocation: null,
              toLocation: storeId,
              performedBy: userId,
              metadata: {
                reason: 'Inventory Import',
                importBatch: new Date().toISOString(),
              },
            }], { session });

            result.processed++;
          } catch (error) {
            result.errors.push({
              row: rowNumber,
              error: error instanceof Error ? error.message : 'Unknown error',
              data: row,
            });
          }
        }

        await store.save({ session });
      });

      // Log import activity
      await AuditLog.logActivity(
        userId,
        userName,
        'INVENTORY_IMPORT',
        'Store',
        {
          storeId,
          totalRows: data.length,
          processed: result.processed,
          created: result.created.length,
          updated: result.updated.length,
          errors: result.errors.length,
        },
        result.errors.length === 0 ? 'SUCCESS' : 'PARTIAL_FAILURE',
        storeId
      );

      if (result.errors.length > 0) {
        result.success = false;
      }

    } catch (error) {
      result.success = false;
      result.errors.push({
        row: 0,
        error: error instanceof Error ? error.message : 'Transaction failed',
      });
    } finally {
      await session.endSession();
    }

    return result;
  }

  /**
   * Export products to CSV/Excel
   */
  static async exportProducts(options: ExportOptions): Promise<Buffer> {
    const { format = 'csv', filters = {}, fields } = options;

    const products = await Product.find(filters).lean();

    const exportData = products.map(product => ({
      name: product.name,
      sku: product.sku,
      category: product.category,
      description: product.description,
      price: product.price,
      cost: product.cost,
      unit: product.unit,
      specifications: JSON.stringify(product.specifications),
      alertThreshold: product.alertThreshold,
      hasShelfLife: product.hasShelfLife,
      shelfLifeDays: product.shelfLifeDays,
      tags: product.tags.join(', '),
      isActive: product.isActive,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
    }));

    return this.generateFile(exportData, format, fields);
  }

  /**
   * Export inventory to CSV/Excel
   */
  static async exportInventory(storeId: string, options: ExportOptions): Promise<Buffer> {
    const { format = 'csv', fields } = options;

    const store = await Store.findById(storeId)
      .populate('inventory.productId')
      .lean();

    if (!store) {
      throw new Error('Store not found');
    }

    const exportData = store.inventory.map((item: any) => ({
      storeName: store.name,
      storeCode: store.code,
      productName: item.productId.name,
      sku: item.productId.sku,
      category: item.productId.category,
      quantity: item.quantity,
      reserved: item.reserved,
      available: item.quantity - item.reserved,
      unit: item.productId.unit,
      price: item.productId.price,
      cost: item.productId.cost,
      totalValue: (item.quantity * item.productId.cost).toFixed(2),
      lastUpdated: item.lastUpdated,
    }));

    return this.generateFile(exportData, format, fields);
  }

  /**
   * Parse uploaded file (CSV or Excel)
   */
  private static async parseFile(file: Express.Multer.File): Promise<any[]> {
    const extension = file.originalname.toLowerCase().split('.').pop();
    
    if (extension === 'csv') {
      return this.parseCSV(file.buffer);
    } else if (['xlsx', 'xls'].includes(extension || '')) {
      return this.parseExcel(file.buffer);
    } else {
      throw new Error('Unsupported file format');
    }
  }

  /**
   * Parse CSV data
   */
  private static async parseCSV(buffer: Buffer): Promise<any[]> {
    return new Promise((resolve, reject) => {
      const results: any[] = [];
      const stream = Readable.from(buffer);

      stream
        .pipe(csv())
        .on('data', (data) => results.push(data))
        .on('end', () => resolve(results))
        .on('error', reject);
    });
  }

  /**
   * Parse Excel data
   */
  private static parseExcel(buffer: Buffer): any[] {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    
    return XLSX.utils.sheet_to_json(sheet, { defval: '' });
  }

  /**
   * Generate file buffer (CSV or Excel)
   */
  private static generateFile(data: any[], format: 'csv' | 'xlsx', fields?: string[]): Buffer {
    let filteredData = data;
    
    if (fields && fields.length > 0) {
      filteredData = data.map(item => {
        const filtered: any = {};
        fields.forEach(field => {
          if (item.hasOwnProperty(field)) {
            filtered[field] = item[field];
          }
        });
        return filtered;
      });
    }

    if (format === 'csv') {
      return this.generateCSV(filteredData);
    } else {
      return this.generateExcel(filteredData);
    }
  }

  /**
   * Generate CSV buffer
   */
  private static generateCSV(data: any[]): Buffer {
    if (data.length === 0) {
      return Buffer.from('');
    }

    const headers = Object.keys(data[0]);
    const csvRows = [headers.join(',')];

    for (const row of data) {
      const values = headers.map(header => {
        const value = row[header];
        const stringValue = value !== null && value !== undefined ? String(value) : '';
        // Escape quotes and wrap in quotes if contains comma or quote
        if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
          return `"${stringValue.replace(/"/g, '""')}"`;
        }
        return stringValue;
      });
      csvRows.push(values.join(','));
    }

    return Buffer.from(csvRows.join('\n'), 'utf-8');
  }

  /**
   * Generate Excel buffer
   */
  private static generateExcel(data: any[]): Buffer {
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Export');
    
    return Buffer.from(XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }));
  }
}