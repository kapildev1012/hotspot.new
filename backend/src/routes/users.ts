import express from 'express';
import {
    createUser,
    deleteUser,
    getUserActivity,
    getUserById,
    getUserPermissions,
    getUsers,
    resetUserPassword,
    updateUser,
    updateUserPermissions,
} from '../controllers/userController.js';
import {
    authenticate,
    requireAdmin,
    requirePermission,
    requireSelfOrAdmin,
} from '../middleware/auth.js';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Get all users (Admin only)
router.get('/', requirePermission('users:read'), getUsers);

// Create new user (Admin only)
router.post('/', requireAdmin, createUser);

// Get user by ID (Admin or self)
router.get('/:userId', requireSelfOrAdmin(), getUserById);

// Update user (Admin or self with restrictions)
router.put('/:userId', requireSelfOrAdmin(), updateUser);

// Delete user (Admin only)
router.delete('/:userId', requireAdmin, deleteUser);

// Get user permissions (Admin or self)
router.get('/:userId/permissions', requireSelfOrAdmin(), getUserPermissions);

// Update user permissions (Admin only)
router.put('/:userId/permissions', requireAdmin, updateUserPermissions);

// Get user activity/audit logs (Admin or self)
router.get('/:userId/activity', requireSelfOrAdmin(), getUserActivity);

// Reset user password (Admin only)
router.put('/:userId/reset-password', requireAdmin, resetUserPassword);

export default router;