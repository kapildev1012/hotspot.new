import express from 'express';
import {
    approveTransfer,
    createTransfer,
    getPendingTransfers,
    getTransactionById,
    getTransactionSummary,
    getTransactions,
    getTransactionsByProduct,
    processAdjustment,
    processPurchase,
    processSale,
} from '../controllers/transactionController.js';
import {
    authenticate,
    requirePermission
} from '../middleware/auth.js';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Get all transactions with filtering
router.get('/', requirePermission('transactions:read'), getTransactions);

// Get pending transfers requiring approval
router.get('/pending-transfers', requirePermission('transfers:approve'), getPendingTransfers);

// Get transaction summary/analytics
router.get('/summary', requirePermission('reports:read'), getTransactionSummary);

// Get transaction by ID
router.get('/:transactionId', requirePermission('transactions:read'), getTransactionById);

// Get transactions by product
router.get('/product/:productId', requirePermission('transactions:read'), getTransactionsByProduct);

// Process sale transaction
router.post('/sale', requirePermission('transactions:write'), processSale);

// Process purchase transaction
router.post('/purchase', requirePermission('transactions:write'), processPurchase);

// Create transfer between locations
router.post('/transfer', requirePermission('transfers:create'), createTransfer);

// Process inventory adjustment
router.post('/adjustment', requirePermission('inventory:write'), processAdjustment);

// Approve or reject transfer
router.patch('/:transactionId/approve', requirePermission('transfers:approve'), approveTransfer);

export default router;