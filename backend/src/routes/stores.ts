import express from 'express';
import {
    createStore,
    deleteStore,
    getStoreById,
    getStoreInventory,
    getStoreLowStockProducts,
    getStores,
    getStoresByWarehouse,
    updateStore,
} from '../controllers/storeController.js';
import {
    authenticate,
    requireAdmin,
    requirePermission,
    requireStoreAccess,
} from '../middleware/auth.js';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Get all stores
router.get('/', requirePermission('stores:read'), getStores);

// Get stores by warehouse
router.get('/warehouse/:warehouseId', requirePermission('stores:read'), getStoresByWarehouse);

// Get store by ID
router.get('/:storeId', requirePermission('store:read'), requireStoreAccess(), getStoreById);

// Get store inventory
router.get('/:storeId/inventory', requirePermission('inventory:read'), requireStoreAccess(), getStoreInventory);

// Get low stock products for specific store or all stores
router.get('/:storeId/low-stock', requirePermission('inventory:read'), requireStoreAccess(), getStoreLowStockProducts);

// Create new store (Admin only)
router.post('/', requireAdmin, createStore);

// Update store
router.put('/:storeId', requirePermission('store:write'), requireStoreAccess(), updateStore);

// Delete store (Admin only)
router.delete('/:storeId', requireAdmin, deleteStore);

export default router;