import express from 'express';
import {
    acknowledgeAlert,
    bulkAcknowledgeAlerts,
    bulkResolveAlerts,
    createAlert,
    getActiveAlerts,
    getAlertById,
    getAlerts,
    getAlertStats,
    getCriticalAlerts,
    getUnacknowledgedAlerts,
    resolveAlert,
    runAlertChecks,
} from '../controllers/alertController.js';
import {
    authenticate,
    requireAdmin,
    requirePermission,
} from '../middleware/auth.js';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Get all alerts with filtering
router.get('/', requirePermission('alerts:read'), getAlerts);

// Get active alerts
router.get('/active', requirePermission('alerts:read'), getActiveAlerts);

// Get unacknowledged alerts
router.get('/unacknowledged', requirePermission('alerts:read'), getUnacknowledgedAlerts);

// Get critical alerts
router.get('/critical', requirePermission('alerts:read'), getCriticalAlerts);

// Get alert statistics
router.get('/stats', requirePermission('alerts:read'), getAlertStats);

// Get alert by ID
router.get('/:alertId', requirePermission('alerts:read'), getAlertById);

// Create manual alert
router.post('/', requirePermission('alerts:write'), createAlert);

// Run manual alert checks (Admin only)
router.post('/check', requireAdmin, runAlertChecks);

// Acknowledge alert
router.patch('/:alertId/acknowledge', requirePermission('alerts:write'), acknowledgeAlert);

// Resolve alert
router.patch('/:alertId/resolve', requirePermission('alerts:write'), resolveAlert);

// Bulk acknowledge alerts
router.patch('/bulk/acknowledge', requirePermission('alerts:write'), bulkAcknowledgeAlerts);

// Bulk resolve alerts
router.patch('/bulk/resolve', requirePermission('alerts:write'), bulkResolveAlerts);

export default router;