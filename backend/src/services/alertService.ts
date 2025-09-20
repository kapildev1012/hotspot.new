import mongoose from 'mongoose';
import cron from 'node-cron';
import { Alert, AuditLog, Batch, Store, Warehouse } from '../models/index.js';
import { AlertPriority, AlertType } from '../types/index.js';
import { getSocketService } from './socketService.js';

export interface AlertCreationData {
  type: AlertType;
  priority: AlertPriority;
  title: string;
  message: string;
  productId?: string;
  storeId?: string;
  warehouseId?: string;
  batchId?: string;
  metadata?: Record<string, any>;
  scheduledFor?: Date;
  expiresAt?: Date;
}

export class AlertService {
  private static instance: AlertService;
  private cronJobs: Map<string, any> = new Map();

  constructor() {
    this.initializeCronJobs();
  }

  public static getInstance(): AlertService {
    if (!AlertService.instance) {
      AlertService.instance = new AlertService();
    }
    return AlertService.instance;
  }

  /**
   * Initialize all cron jobs for automated alerts
   */
  private initializeCronJobs(): void {
    // Check for low stock every hour
    this.cronJobs.set('lowStock', cron.schedule('0 * * * *', async () => {
      await this.checkLowStockAlerts();
    }, { scheduled: false }));

    // Check for expiring batches every 6 hours
    this.cronJobs.set('expiry', cron.schedule('0 */6 * * *', async () => {
      await this.checkExpiryAlerts();
    }, { scheduled: false }));

    // Check for overstock every day at 2 AM
    this.cronJobs.set('overstock', cron.schedule('0 2 * * *', async () => {
      await this.checkOverstockAlerts();
    }, { scheduled: false }));

    // Generate reorder suggestions every day at 3 AM
    this.cronJobs.set('reorder', cron.schedule('0 3 * * *', async () => {
      await this.generateReorderSuggestions();
    }, { scheduled: false }));

    // Clean up resolved alerts every week
    this.cronJobs.set('cleanup', cron.schedule('0 4 * * 0', async () => {
      await this.cleanupExpiredAlerts();
    }, { scheduled: false }));

    console.log('Alert service cron jobs initialized');
  }

  /**
   * Start all cron jobs
   */
  public startCronJobs(): void {
    this.cronJobs.forEach((job, name) => {
      job.start();
      console.log(`Started cron job: ${name}`);
    });
  }

  /**
   * Stop all cron jobs
   */
  public stopCronJobs(): void {
    this.cronJobs.forEach((job, name) => {
      job.stop();
      console.log(`Stopped cron job: ${name}`);
    });
  }

  /**
   * Create a new alert
   */
  public async createAlert(alertData: AlertCreationData): Promise<any> {
    try {
      // Check if similar alert already exists and is not resolved
      const existingAlert = await Alert.findOne({
        type: alertData.type,
        productId: alertData.productId,
        storeId: alertData.storeId,
        warehouseId: alertData.warehouseId,
        batchId: alertData.batchId,
        resolved: false,
        $or: [
          { expiresAt: null },
          { expiresAt: { $gt: new Date() } },
        ],
      });

      if (existingAlert) {
        // Update existing alert instead of creating duplicate
        existingAlert.message = alertData.message;
        existingAlert.metadata = { ...existingAlert.metadata, ...alertData.metadata };
        existingAlert.updatedAt = new Date();
        await existingAlert.save();
        return existingAlert;
      }

      // Create new alert
      const alert = await Alert.create(alertData);

      // Broadcast alert via Socket.IO
      const socketService = getSocketService();
      socketService.broadcastAlertCreated(alert);

      // Log alert creation
      await AuditLog.logActivity(
        'system',
        'Alert System',
        'ALERT_CREATE',
        'Alert',
        {
          metadata: {
            alertType: alertData.type,
            priority: alertData.priority,
            productId: alertData.productId,
            storeId: alertData.storeId,
            warehouseId: alertData.warehouseId,
          },
        },
        'SUCCESS',
        alert._id
      );

      return alert;
    } catch (error) {
      console.error('Failed to create alert:', error);
      throw error;
    }
  }

  /**
   * Check for low stock across all locations
   */
  private async checkLowStockAlerts(): Promise<void> {
    try {
      console.log('Checking low stock alerts...');

      // Check warehouse low stock
      const warehouseLowStock = await Warehouse.aggregate([
        { $match: { isActive: true } },
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
          $match: {
            $expr: { $lte: ['$inventory.quantity', '$product.alertThreshold'] },
          },
        },
      ]);

      for (const item of warehouseLowStock) {
        await this.createAlert({
          type: AlertType.LOW_STOCK,
          priority: item.inventory.quantity === 0 ? AlertPriority.CRITICAL : AlertPriority.HIGH,
          title: `Low Stock Alert - ${item.product.name}`,
          message: `Product ${item.product.name} (${item.product.sku}) is running low in ${item.name}. Current stock: ${item.inventory.quantity}, Threshold: ${item.product.alertThreshold}`,
          productId: item.product._id,
          warehouseId: item._id,
          metadata: {
            currentQuantity: item.inventory.quantity,
            threshold: item.product.alertThreshold,
            suggestedAction: 'Reorder stock or transfer from other locations',
          },
        });
      }

      // Check store low stock
      const storeLowStock = await Store.aggregate([
        { $match: { isActive: true, status: 'ACTIVE' } },
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
                { $toDouble: { $getField: { field: { $toString: '$product._id' }, input: '$settings.reorderThresholdOverrides' } } },
                '$product.alertThreshold',
              ],
            },
          },
        },
        {
          $match: {
            $expr: { $lte: ['$inventory.quantity', '$threshold'] },
          },
        },
      ]);

      for (const item of storeLowStock) {
        await this.createAlert({
          type: AlertType.LOW_STOCK,
          priority: item.inventory.quantity === 0 ? AlertPriority.CRITICAL : AlertPriority.HIGH,
          title: `Low Stock Alert - ${item.product.name}`,
          message: `Product ${item.product.name} (${item.product.sku}) is running low in store ${item.name}. Current stock: ${item.inventory.quantity}, Threshold: ${item.threshold}`,
          productId: item.product._id,
          storeId: item._id,
          metadata: {
            currentQuantity: item.inventory.quantity,
            threshold: item.threshold,
            suggestedAction: 'Transfer from warehouse or reorder',
          },
        });
      }

      console.log(`Low stock check completed. Found ${warehouseLowStock.length + storeLowStock.length} alerts.`);
    } catch (error) {
      console.error('Error checking low stock alerts:', error);
    }
  }

  /**
   * Check for expiring batches
   */
  private async checkExpiryAlerts(): Promise<void> {
    try {
      console.log('Checking expiry alerts...');

      // Find batches expiring in next 30 days
      const thirtyDaysFromNow = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      const sevenDaysFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      const now = new Date();

      const expiringBatches = await Batch.find({
        expiryDate: { $lte: thirtyDaysFromNow, $gte: now },
        isActive: true,
        remainingQuantity: { $gt: 0 },
        qualityStatus: 'GOOD',
      }).populate('productId', 'name sku');

      for (const batch of expiringBatches) {
        const daysUntilExpiry = Math.ceil((batch.expiryDate!.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        
        let priority: AlertPriority;
        let title: string;
        
        if (daysUntilExpiry <= 0) {
          priority = AlertPriority.CRITICAL;
          title = 'Batch Expired';
        } else if (daysUntilExpiry <= 7) {
          priority = AlertPriority.HIGH;
          title = 'Batch Expiring Soon';
        } else {
          priority = AlertPriority.MEDIUM;
          title = 'Batch Expiring This Month';
        }

        await this.createAlert({
          type: AlertType.EXPIRY,
          priority,
          title: `${title} - ${batch.productId.name}`,
          message: `Batch ${batch.batchNumber} of ${batch.productId.name} (${batch.productId.sku}) will expire in ${daysUntilExpiry} days. Remaining quantity: ${batch.remainingQuantity}`,
          productId: batch.productId._id,
          batchId: batch._id,
          metadata: {
            batchNumber: batch.batchNumber,
            expiryDate: batch.expiryDate,
            daysUntilExpiry,
            remainingQuantity: batch.remainingQuantity,
            suggestedAction: daysUntilExpiry <= 7 ? 'Move to clearance or donate' : 'Prioritize sales',
          },
        });

        // Broadcast batch expiring notification
        if (daysUntilExpiry <= 7) {
          const socketService = getSocketService();
          socketService.broadcastBatchExpiring(batch);
        }
      }

      console.log(`Expiry check completed. Found ${expiringBatches.length} expiring batches.`);
    } catch (error) {
      console.error('Error checking expiry alerts:', error);
    }
  }

  /**
   * Check for overstock situations
   */
  private async checkOverstockAlerts(): Promise<void> {
    try {
      console.log('Checking overstock alerts...');

      // Find products with inventory much higher than reorder quantity
      const overstockItems = await Warehouse.aggregate([
        { $match: { isActive: true } },
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
          $match: {
            $expr: {
              $gte: ['$inventory.quantity', { $multiply: ['$product.reorderQuantity', 3] }],
            },
          },
        },
      ]);

      for (const item of overstockItems) {
        const overstockRatio = item.inventory.quantity / item.product.reorderQuantity;
        
        await this.createAlert({
          type: AlertType.OVERSTOCK,
          priority: overstockRatio > 5 ? AlertPriority.HIGH : AlertPriority.MEDIUM,
          title: `Overstock Alert - ${item.product.name}`,
          message: `Product ${item.product.name} (${item.product.sku}) is overstocked in ${item.name}. Current stock: ${item.inventory.quantity}, Normal reorder quantity: ${item.product.reorderQuantity}`,
          productId: item.product._id,
          warehouseId: item._id,
          metadata: {
            currentQuantity: item.inventory.quantity,
            reorderQuantity: item.product.reorderQuantity,
            overstockRatio: Math.round(overstockRatio * 100) / 100,
            suggestedAction: 'Consider reducing orders or promotional sales',
          },
        });
      }

      console.log(`Overstock check completed. Found ${overstockItems.length} overstock alerts.`);
    } catch (error) {
      console.error('Error checking overstock alerts:', error);
    }
  }

  /**
   * Generate reorder suggestions based on consumption patterns
   */
  private async generateReorderSuggestions(): Promise<void> {
    try {
      console.log('Generating reorder suggestions...');

      // Calculate consumption rate for products over last 30 days
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      
      const consumptionData = await Warehouse.aggregate([
        { $match: { isActive: true, type: 'MAIN' } },
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
          $lookup: {
            from: 'transactions',
            let: { productId: '$inventory.productId' },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $in: ['$$productId', '$items.productId'] },
                      { $gte: ['$createdAt', thirtyDaysAgo] },
                      { $eq: ['$status', 'COMPLETED'] },
                      { $in: ['$type', ['SALE', 'TRANSFER_OUT']] },
                    ],
                  },
                },
              },
              { $unwind: '$items' },
              { $match: { $expr: { $eq: ['$items.productId', '$$productId'] } } },
              { $group: { _id: null, totalConsumption: { $sum: '$items.quantity' } } },
            ],
            as: 'consumption',
          },
        },
        {
          $addFields: {
            dailyConsumption: {
              $divide: [
                { $ifNull: [{ $arrayElemAt: ['$consumption.totalConsumption', 0] }, 0] },
                30,
              ],
            },
          },
        },
        {
          $match: {
            $and: [
              { $expr: { $lte: ['$inventory.quantity', { $multiply: ['$dailyConsumption', 14] }] } }, // Less than 14 days supply
              { dailyConsumption: { $gt: 0 } }, // Has consumption
            ],
          },
        },
      ]);

      for (const item of consumptionData) {
        const daysOfSupplyLeft = Math.floor(item.inventory.quantity / item.dailyConsumption);
        const suggestedQuantity = Math.ceil(item.dailyConsumption * 30); // 30 days supply
        
        await this.createAlert({
          type: AlertType.REORDER_SUGGESTION,
          priority: daysOfSupplyLeft <= 7 ? AlertPriority.HIGH : AlertPriority.MEDIUM,
          title: `Reorder Suggestion - ${item.product.name}`,
          message: `Based on consumption patterns, ${item.product.name} (${item.product.sku}) should be reordered. Current stock will last approximately ${daysOfSupplyLeft} days.`,
          productId: item.product._id,
          warehouseId: item._id,
          metadata: {
            currentQuantity: item.inventory.quantity,
            dailyConsumption: Math.round(item.dailyConsumption * 100) / 100,
            daysOfSupplyLeft,
            suggestedQuantity,
            suggestedAction: `Order ${suggestedQuantity} units`,
          },
        });
      }

      console.log(`Reorder suggestion check completed. Generated ${consumptionData.length} suggestions.`);
    } catch (error) {
      console.error('Error generating reorder suggestions:', error);
    }
  }

  /**
   * Clean up expired and resolved alerts
   */
  private async cleanupExpiredAlerts(): Promise<void> {
    try {
      console.log('Cleaning up expired alerts...');

      const result = await Alert.cleanupExpiredAlerts();
      console.log(`Cleaned up ${result.deletedCount} expired alerts`);
    } catch (error) {
      console.error('Error cleaning up expired alerts:', error);
    }
  }

  /**
   * Check for suspicious activity patterns
   */
  public async checkSuspiciousActivity(): Promise<void> {
    try {
      // Check for unusual inventory adjustments
      const suspiciousAdjustments = await AuditLog.aggregate([
        {
          $match: {
            action: 'INVENTORY_ADJUST',
            timestamp: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }, // Last 24 hours
          },
        },
        {
          $group: {
            _id: '$actorUserId',
            adjustmentCount: { $sum: 1 },
            totalAdjustments: { $sum: { $size: '$details.metadata.adjustments' } },
          },
        },
        {
          $match: {
            $or: [
              { adjustmentCount: { $gte: 10 } }, // More than 10 adjustment transactions
              { totalAdjustments: { $gte: 50 } }, // More than 50 individual adjustments
            ],
          },
        },
      ]);

      for (const suspicious of suspiciousAdjustments) {
        const user = await mongoose.model('User').findById(suspicious._id);
        if (user) {
          await this.createAlert({
            type: AlertType.SUSPICIOUS_ACTIVITY,
            priority: AlertPriority.HIGH,
            title: 'Suspicious Inventory Activity Detected',
            message: `User ${user.name} has made ${suspicious.adjustmentCount} inventory adjustments (${suspicious.totalAdjustments} individual items) in the last 24 hours, which is unusual.`,
            metadata: {
              userId: user._id,
              userName: user.name,
              adjustmentCount: suspicious.adjustmentCount,
              totalAdjustments: suspicious.totalAdjustments,
              suggestedAction: 'Review user activity and verify adjustments',
            },
          });
        }
      }

      console.log(`Suspicious activity check completed. Found ${suspiciousAdjustments.length} alerts.`);
    } catch (error) {
      console.error('Error checking suspicious activity:', error);
    }
  }

  /**
   * Manually trigger all alert checks
   */
  public async runAllChecks(): Promise<void> {
    console.log('Running all alert checks...');
    
    await Promise.all([
      this.checkLowStockAlerts(),
      this.checkExpiryAlerts(),
      this.checkOverstockAlerts(),
      this.generateReorderSuggestions(),
      this.checkSuspiciousActivity(),
    ]);
    
    console.log('All alert checks completed.');
  }
}

// Export singleton instance
export const alertService = AlertService.getInstance();