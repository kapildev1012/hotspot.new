import express from 'express';
import {
    createWarehouse,
    deleteWarehouse,
    getLowStockProducts,
    getMainWarehouse,
    getWarehouseById,
    getWarehouseInventory,
    getWarehouses,
    updateWarehouse,
} from '../controllers/warehouseController.js';
import {
    authenticate,
    requireAdmin,
    requirePermission,
} from '../middleware/auth.js';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Get all warehouses
router.get('/', requirePermission('warehouse:read'), getWarehouses);

// Get main warehouse
router.get('/main', requirePermission('warehouse:read'), getMainWarehouse);

// Get low stock products across all warehouses
router.get('/low-stock', requirePermission('inventory:read'), getLowStockProducts);

// Get warehouse by ID
router.get('/:warehouseId', requirePermission('warehouse:read'), getWarehouseById);

// Get warehouse inventory
router.get('/:warehouseId/inventory', requirePermission('inventory:read'), getWarehouseInventory);

// Create new warehouse (Admin only)
router.post('/', requireAdmin, createWarehouse);

// Update warehouse
router.put('/:warehouseId', requirePermission('warehouse:write'), updateWarehouse);

// Delete warehouse (Admin only)
router.delete('/:warehouseId', requireAdmin, deleteWarehouse);

export default router;