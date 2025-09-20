import mongoose from 'mongoose';
import { AuditLog, Batch, Product, Store, Transaction, Warehouse } from '../models/index.js';
import { ITransactionItem, LocationType, TransactionStatus, TransactionType } from '../types/index.js';
import { AppError } from '../utils/errors.js';

export interface InventoryAdjustment {
  productId: string;
  batchId?: string;
  quantity: number;
  reason: string;
}

export interface InventoryTransfer {
  sourceType: LocationType;
  sourceId: string;
  destinationType: LocationType;
  destinationId: string;
  items: ITransactionItem[];
  userId: string;
  notes?: string;
}

export class InventoryService {
  /**
   * Update inventory atomically across warehouse and store
   */
  static async updateInventoryAtomic(
    sourceType: LocationType,
    sourceId: string,
    destinationType: LocationType,
    destinationId: string,
    items: ITransactionItem[],
    userId: string,
    transactionType: TransactionType,
    notes?: string
  ): Promise<any> {
    const session = await mongoose.startSession();
    
    try {
      return await session.withTransaction(async () => {
        // Get source and destination locations
        const sourceLocation = await this.getLocation(sourceType, sourceId, session);
        const destinationLocation = destinationType && destinationId 
          ? await this.getLocation(destinationType, destinationId, session)
          : null;

        // Validate inventory availability at source
        for (const item of items) {
          const availableQty = this.getAvailableQuantity(sourceLocation, item.productId);
          if (availableQty < item.quantity) {
            const product = await Product.findById(item.productId).session(session);
            throw new AppError(`Insufficient inventory for product ${product?.name || item.productId}. Available: ${availableQty}, Required: ${item.quantity}`, 400);
          }
        }

        // Update source inventory (reduce)
        for (const item of items) {
          this.adjustLocationInventory(sourceLocation, item.productId, -item.quantity);
        }

        // Update destination inventory (increase)
        if (destinationLocation) {
          for (const item of items) {
            this.adjustLocationInventory(destinationLocation, item.productId, item.quantity);
          }
        }

        // Save updated locations
        await sourceLocation.save({ session });
        if (destinationLocation) {
          await destinationLocation.save({ session });
        }

        // Create transaction record
        const transaction = await Transaction.create([{
          type: transactionType,
          source: {
            type: sourceType,
            id: sourceId,
            name: sourceLocation.name,
          },
          destination: destinationLocation ? {
            type: destinationType,
            id: destinationId,
            name: destinationLocation.name,
          } : undefined,
          items,
          totalAmount: items.reduce((sum, item) => sum + item.totalPrice, 0),
          status: TransactionStatus.COMPLETED,
          userId,
          notes,
          completedAt: new Date(),
        }], { session });

        // Update batch quantities if batch-specific
        for (const item of items) {
          if (item.batchId) {
            const batch = await Batch.findById(item.batchId).session(session);
            if (batch) {
              batch.remainingQuantity = Math.max(0, batch.remainingQuantity - item.quantity);
              await batch.save({ session });
            }
          }
        }

        return transaction[0];
      });
    } catch (error) {
      throw new AppError(`Inventory update failed: ${error}`, 500);
    } finally {
      await session.endSession();
    }
  }

  /**
   * Transfer inventory between locations
   */
  static async transferInventory(transferData: InventoryTransfer): Promise<any> {
    return this.updateInventoryAtomic(
      transferData.sourceType,
      transferData.sourceId,
      transferData.destinationType,
      transferData.destinationId,
      transferData.items,
      transferData.userId,
      TransactionType.TRANSFER_OUT, // Will create corresponding TRANSFER_IN
      transferData.notes
    );
  }

  /**
   * Process a sale transaction
   */
  static async processSale(
    storeId: string,
    items: ITransactionItem[],
    userId: string,
    customerInfo?: any,
    notes?: string
  ): Promise<any> {
    const session = await mongoose.startSession();
    
    try {
      return await session.withTransaction(async () => {
        // Get store and main warehouse
        const store = await Store.findById(storeId).session(session);
        if (!store) {
          throw new AppError('Store not found', 404);
        }

        const warehouse = await Warehouse.findById(store.warehouseId).session(session);
        if (!warehouse) {
          throw new AppError('Associated warehouse not found', 404);
        }

        // Validate inventory availability
        for (const item of items) {
          const storeInventory = this.getAvailableQuantity(store, item.productId);
          if (storeInventory < item.quantity) {
            const product = await Product.findById(item.productId).session(session);
            throw new AppError(`Insufficient inventory at store for product ${product?.name || item.productId}. Available: ${storeInventory}, Required: ${item.quantity}`, 400);
          }
        }

        // Update store inventory (reduce)
        for (const item of items) {
          this.adjustLocationInventory(store, item.productId, -item.quantity);
        }

        // Update warehouse inventory (reduce)
        for (const item of items) {
          this.adjustLocationInventory(warehouse, item.productId, -item.quantity);
        }

        // Save locations
        await store.save({ session });
        await warehouse.save({ session });

        // Create sale transaction
        const transaction = await Transaction.create([{
          type: TransactionType.SALE,
          source: {
            type: LocationType.STORE,
            id: storeId,
            name: store.name,
          },
          items,
          totalAmount: items.reduce((sum, item) => sum + item.totalPrice, 0),
          status: TransactionStatus.COMPLETED,
          userId,
          notes,
          metadata: {
            customerInfo,
          },
          completedAt: new Date(),
        }], { session });

        // Update batch quantities
        for (const item of items) {
          if (item.batchId) {
            const batch = await Batch.findById(item.batchId).session(session);
            if (batch) {
              batch.remainingQuantity = Math.max(0, batch.remainingQuantity - item.quantity);
              await batch.save({ session });
            }
          }
        }

        return transaction[0];
      });
    } catch (error) {
      throw new AppError(`Sale processing failed: ${error}`, 500);
    } finally {
      await session.endSession();
    }
  }

  /**
   * Process a purchase (receiving inventory)
   */
  static async processPurchase(
    warehouseId: string,
    items: ITransactionItem[],
    userId: string,
    supplierInfo?: any,
    notes?: string
  ): Promise<any> {
    const session = await mongoose.startSession();
    
    try {
      return await session.withTransaction(async () => {
        // Get warehouse
        const warehouse = await Warehouse.findById(warehouseId).session(session);
        if (!warehouse) {
          throw new AppError('Warehouse not found', 404);
        }

        // Update warehouse inventory (increase)
        for (const item of items) {
          this.adjustLocationInventory(warehouse, item.productId, item.quantity);
        }

        await warehouse.save({ session });

        // Create purchase transaction
        const transaction = await Transaction.create([{
          type: TransactionType.PURCHASE,
          destination: {
            type: LocationType.WAREHOUSE,
            id: warehouseId,
            name: warehouse.name,
          },
          items,
          totalAmount: items.reduce((sum, item) => sum + item.totalPrice, 0),
          status: TransactionStatus.COMPLETED,
          userId,
          notes,
          metadata: {
            supplierInfo,
          },
          completedAt: new Date(),
        }], { session });

        // Update or create batch quantities
        for (const item of items) {
          if (item.batchId) {
            const batch = await Batch.findById(item.batchId).session(session);
            if (batch) {
              batch.remainingQuantity += item.quantity;
              await batch.save({ session });
            }
          }
        }

        return transaction[0];
      });
    } catch (error) {
      throw new AppError(`Purchase processing failed: ${error}`, 500);
    } finally {
      await session.endSession();
    }
  }

  /**
   * Adjust inventory quantities
   */
  static async adjustInventory(
    locationType: LocationType,
    locationId: string,
    adjustments: InventoryAdjustment[],
    userId: string,
    notes?: string
  ): Promise<any> {
    const session = await mongoose.startSession();
    
    try {
      return await session.withTransaction(async () => {
        const location = await this.getLocation(locationType, locationId, session);

        // Apply adjustments
        for (const adjustment of adjustments) {
          this.adjustLocationInventory(location, adjustment.productId, adjustment.quantity);
        }

        await location.save({ session });

        // Create adjustment transaction
        const items = adjustments.map(adj => ({
          productId: adj.productId,
          batchId: adj.batchId,
          quantity: Math.abs(adj.quantity),
          unitPrice: 0,
          totalPrice: 0,
        }));

        const transaction = await Transaction.create([{
          type: TransactionType.ADJUSTMENT,
          source: {
            type: locationType,
            id: locationId,
            name: location.name,
          },
          items,
          totalAmount: 0,
          status: TransactionStatus.COMPLETED,
          userId,
          notes,
          metadata: {
            adjustmentReason: notes,
            adjustments: adjustments.map(adj => ({
              productId: adj.productId,
              adjustment: adj.quantity,
              reason: adj.reason,
            })),
          },
          completedAt: new Date(),
        }], { session });

        // Update batch quantities
        for (const adjustment of adjustments) {
          if (adjustment.batchId) {
            const batch = await Batch.findById(adjustment.batchId).session(session);
            if (batch) {
              batch.remainingQuantity = Math.max(0, batch.remainingQuantity + adjustment.quantity);
              await batch.save({ session });
            }
          }
        }

        return transaction[0];
      });
    } catch (error) {
      throw new AppError(`Inventory adjustment failed: ${error}`, 500);
    } finally {
      await session.endSession();
    }
  }

  /**
   * Get location (warehouse or store) by type and ID
   */
  private static async getLocation(locationType: LocationType, locationId: string, session?: any) {
    if (locationType === LocationType.WAREHOUSE) {
      const warehouse = await Warehouse.findById(locationId).session(session);
      if (!warehouse) {
        throw new AppError('Warehouse not found', 404);
      }
      return warehouse;
    } else {
      const store = await Store.findById(locationId).session(session);
      if (!store) {
        throw new AppError('Store not found', 404);
      }
      return store;
    }
  }

  /**
   * Get available quantity for a product at a location
   */
  private static getAvailableQuantity(location: any, productId: string): number {
    const inventoryItem = location.inventory.find((item: any) => 
      item.productId.toString() === productId
    );
    return inventoryItem ? (inventoryItem.quantity - inventoryItem.reserved) : 0;
  }

  /**
   * Adjust inventory at a location
   */
  private static adjustLocationInventory(location: any, productId: string, quantityChange: number) {
    const existingIndex = location.inventory.findIndex((item: any) => 
      item.productId.toString() === productId
    );

    if (existingIndex >= 0) {
      location.inventory[existingIndex].quantity += quantityChange;
      location.inventory[existingIndex].lastUpdated = new Date();
      
      // Ensure quantity doesn't go negative
      if (location.inventory[existingIndex].quantity < 0) {
        location.inventory[existingIndex].quantity = 0;
      }
    } else if (quantityChange > 0) {
      // Add new inventory item
      location.inventory.push({
        productId,
        quantity: quantityChange,
        reserved: 0,
        lastUpdated: new Date(),
      });
    }
  }

  /**
   * Reserve inventory for pending transactions
   */
  static async reserveInventory(
    locationType: LocationType,
    locationId: string,
    productId: string,
    quantity: number,
    userId: string
  ): Promise<void> {
    const session = await mongoose.startSession();
    
    try {
      await session.withTransaction(async () => {
        const location = await this.getLocation(locationType, locationId, session);
        
        const inventoryItem = location.inventory.find((item: any) => 
          item.productId.toString() === productId
        );

        if (!inventoryItem) {
          throw new AppError('Product not found in inventory', 404);
        }

        const availableQuantity = inventoryItem.quantity - inventoryItem.reserved;
        if (availableQuantity < quantity) {
          throw new AppError('Insufficient inventory to reserve', 400);
        }

        inventoryItem.reserved += quantity;
        inventoryItem.lastUpdated = new Date();

        await location.save({ session });

        // Log reservation
        await AuditLog.logActivity(
          userId,
          'System',
          'INVENTORY_RESERVE',
          locationType === LocationType.WAREHOUSE ? 'Warehouse' : 'Store',
          {
            metadata: {
              locationId,
              productId,
              quantity,
              reservedQuantity: inventoryItem.reserved,
            },
          },
          'SUCCESS',
          locationId
        );
      });
    } catch (error) {
      throw new AppError(`Inventory reservation failed: ${error}`, 500);
    } finally {
      await session.endSession();
    }
  }

  /**
   * Release reserved inventory
   */
  static async releaseReservedInventory(
    locationType: LocationType,
    locationId: string,
    productId: string,
    quantity: number,
    userId: string
  ): Promise<void> {
    const session = await mongoose.startSession();
    
    try {
      await session.withTransaction(async () => {
        const location = await this.getLocation(locationType, locationId, session);
        
        const inventoryItem = location.inventory.find((item: any) => 
          item.productId.toString() === productId
        );

        if (!inventoryItem) {
          throw new AppError('Product not found in inventory', 404);
        }

        inventoryItem.reserved = Math.max(0, inventoryItem.reserved - quantity);
        inventoryItem.lastUpdated = new Date();

        await location.save({ session });

        // Log release
        await AuditLog.logActivity(
          userId,
          'System',
          'INVENTORY_RELEASE',
          locationType === LocationType.WAREHOUSE ? 'Warehouse' : 'Store',
          {
            metadata: {
              locationId,
              productId,
              quantity,
              reservedQuantity: inventoryItem.reserved,
            },
          },
          'SUCCESS',
          locationId
        );
      });
    } catch (error) {
      throw new AppError(`Inventory release failed: ${error}`, 500);
    } finally {
      await session.endSession();
    }
  }
}