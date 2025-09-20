import express from 'express';
import {
    adjustBatchQuantity,
    createBatch,
    deleteBatch,
    getBatchById,
    getBatches,
    getExpiredBatches,
    getExpiringBatches,
    updateBatch,
} from '../controllers/batchController.js';
import {
    authenticate,
    requirePermission,
} from '../middleware/auth.js';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Get all batches with filtering and pagination
router.get('/', requirePermission('batches:read'), getBatches);

// Get expiring batches
router.get('/expiring', requirePermission('batches:read'), getExpiringBatches);

// Get expired batches
router.get('/expired', requirePermission('batches:read'), getExpiredBatches);

// Get batch by ID
router.get('/:batchId', requirePermission('batches:read'), getBatchById);

// Create new batch
router.post('/', requirePermission('batches:write'), createBatch);

// Update batch
router.put('/:batchId', requirePermission('batches:write'), updateBatch);

// Adjust batch quantity
router.patch('/:batchId/adjust', requirePermission('batches:write'), adjustBatchQuantity);

// Delete batch (soft delete)
router.delete('/:batchId', requirePermission('batches:write'), deleteBatch);

export default router;