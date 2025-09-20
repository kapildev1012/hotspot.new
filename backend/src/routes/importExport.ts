import { Router } from 'express';
import multer from 'multer';
import {
    exportInventory,
    exportProducts,
    getImportTemplates,
    importInventory,
    importProducts,
} from '../controllers/importExportController.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { UserRole } from '../types/index.js';

const router = Router();

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      'text/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ];
    
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only CSV and Excel files are allowed.'));
    }
  },
});

// Import routes
router.post(
  '/products/import',
  authenticate,
  requireRole([UserRole.SUPER_ADMIN, UserRole.WAREHOUSE_MANAGER]),
  upload.single('file'),
  importProducts
);

router.post(
  '/inventory/:storeId/import',
  authenticate,
  requireRole([
    UserRole.SUPER_ADMIN,
    UserRole.WAREHOUSE_MANAGER,
    UserRole.STORE_MANAGER,
  ]),
  upload.single('file'),
  importInventory
);

// Export routes
router.get(
  '/products/export',
  authenticate,
  requireRole([
    UserRole.SUPER_ADMIN,
    UserRole.WAREHOUSE_MANAGER,
    UserRole.STORE_MANAGER,
    UserRole.AUDITOR,
  ]),
  exportProducts
);

router.get(
  '/inventory/:storeId/export',
  authenticate,
  requireRole([
    UserRole.SUPER_ADMIN,
    UserRole.WAREHOUSE_MANAGER,
    UserRole.STORE_MANAGER,
    UserRole.AUDITOR,
  ]),
  exportInventory
);

// Template routes
router.get(
  '/templates',
  authenticate,
  requireRole([
    UserRole.SUPER_ADMIN,
    UserRole.WAREHOUSE_MANAGER,
    UserRole.STORE_MANAGER,
  ]),
  getImportTemplates
);

export default router;