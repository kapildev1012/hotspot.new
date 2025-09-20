import express from 'express';
import {
    createProduct,
    deleteProduct,
    duplicateProduct,
    getProductById,
    getProductCategories,
    getProducts,
    getProductTags,
    searchProductByCode,
    updateProduct,
} from '../controllers/productController.js';
import {
    authenticate,
    requirePermission
} from '../middleware/auth.js';
import {
    handleUploadError,
    processImageUploads,
    uploadMultipleImages,
} from '../middleware/upload.js';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Get all products with filtering and pagination
router.get('/', requirePermission('products:read'), getProducts);

// Get product categories for filters
router.get('/categories', requirePermission('products:read'), getProductCategories);

// Get product tags for filters
router.get('/tags', requirePermission('products:read'), getProductTags);

// Search product by barcode/QR code
router.get('/search/:code', requirePermission('products:read'), searchProductByCode);

// Get product by ID
router.get('/:productId', requirePermission('products:read'), getProductById);

// Create new product with image upload
router.post('/', 
  requirePermission('products:write'),
  uploadMultipleImages('images', 10),
  handleUploadError,
  processImageUploads('smartstock/products'),
  createProduct
);

// Update product with image upload
router.put('/:productId', 
  requirePermission('products:write'),
  uploadMultipleImages('images', 10),
  handleUploadError,
  processImageUploads('smartstock/products'),
  updateProduct
);

// Delete product (soft delete)
router.delete('/:productId', requirePermission('products:write'), deleteProduct);

// Duplicate product
router.post('/:productId/duplicate', requirePermission('products:write'), duplicateProduct);

export default router;