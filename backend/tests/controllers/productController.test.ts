import { Response } from 'express';
import { productController } from '../../src/controllers/productController';
import { Product } from '../../src/models/Product';
import { AuthenticatedRequest } from '../../src/types';
import { deleteImage, uploadImage } from '../../src/utils/cloudinary';

// Mock dependencies
jest.mock('../../src/models/Product');
jest.mock('../../src/utils/cloudinary');

const mockProduct = Product as jest.Mocked<typeof Product>;
const mockUploadImage = uploadImage as jest.MockedFunction<typeof uploadImage>;
const mockDeleteImage = deleteImage as jest.MockedFunction<typeof deleteImage>;

describe('ProductController', () => {
  let req: Partial<AuthenticatedRequest>;
  let res: Partial<Response>;
  let jsonSpy: jest.SpyInstance;
  let statusSpy: jest.SpyInstance;

  beforeEach(() => {
    req = {
      user: {
        id: 'user123',
        role: 'WAREHOUSE_MANAGER',
      },
    };
    jsonSpy = jest.fn();
    statusSpy = jest.fn().mockReturnValue({ json: jsonSpy });
    res = {
      status: statusSpy,
      json: jsonSpy,
    };
    jest.clearAllMocks();
  });

  describe('createProduct', () => {
    beforeEach(() => {
      req.body = {
        name: 'Test Product',
        sku: 'TEST-001',
        category: 'Electronics',
        price: 99.99,
        cost: 49.99,
        unit: 'piece',
        alertThreshold: 10,
      };
    });

    it('should create a product successfully', async () => {
      const mockNewProduct = {
        _id: 'product123',
        name: 'Test Product',
        sku: 'TEST-001',
        category: 'Electronics',
        price: 99.99,
        cost: 49.99,
        unit: 'piece',
        alertThreshold: 10,
        save: jest.fn().mockResolvedValue(true),
      };

      mockProduct.findOne.mockResolvedValue(null);
      mockProduct.mockImplementation(() => mockNewProduct as any);

      await productController.createProduct(req as AuthenticatedRequest, res as Response);

      expect(mockProduct.findOne).toHaveBeenCalledWith({ sku: 'TEST-001' });
      expect(mockNewProduct.save).toHaveBeenCalled();
      expect(statusSpy).toHaveBeenCalledWith(201);
      expect(jsonSpy).toHaveBeenCalledWith({
        success: true,
        message: 'Product created successfully',
        data: { product: mockNewProduct },
      });
    });

    it('should return error if SKU already exists', async () => {
      mockProduct.findOne.mockResolvedValue({ sku: 'TEST-001' });

      await productController.createProduct(req as AuthenticatedRequest, res as Response);

      expect(statusSpy).toHaveBeenCalledWith(409);
      expect(jsonSpy).toHaveBeenCalledWith({
        success: false,
        message: 'Product with this SKU already exists',
      });
    });

    it('should create product with image upload', async () => {
      req.file = {
        buffer: Buffer.from('fake-image'),
        mimetype: 'image/jpeg',
        originalname: 'test.jpg',
      } as Express.Multer.File;

      const mockNewProduct = {
        _id: 'product123',
        name: 'Test Product',
        sku: 'TEST-001',
        imageUrl: 'https://cloudinary.com/image.jpg',
        imagePublicId: 'image123',
        save: jest.fn().mockResolvedValue(true),
      };

      mockProduct.findOne.mockResolvedValue(null);
      mockProduct.mockImplementation(() => mockNewProduct as any);
      mockUploadImage.mockResolvedValue({
        url: 'https://cloudinary.com/image.jpg',
        publicId: 'image123',
      });

      await productController.createProduct(req as AuthenticatedRequest, res as Response);

      expect(mockUploadImage).toHaveBeenCalledWith(
        req.file.buffer,
        'products',
        'TEST-001'
      );
      expect(mockNewProduct.save).toHaveBeenCalled();
      expect(statusSpy).toHaveBeenCalledWith(201);
    });

    it('should return validation error for missing required fields', async () => {
      req.body = {
        name: '',
        sku: '',
        price: -1,
      };

      await productController.createProduct(req as AuthenticatedRequest, res as Response);

      expect(statusSpy).toHaveBeenCalledWith(400);
      expect(jsonSpy).toHaveBeenCalledWith({
        success: false,
        message: expect.stringContaining('validation'),
      });
    });
  });

  describe('getProducts', () => {
    it('should get products with pagination', async () => {
      const mockProducts = [
        {
          _id: 'product1',
          name: 'Product 1',
          sku: 'PROD-001',
          category: 'Category 1',
        },
        {
          _id: 'product2',
          name: 'Product 2',
          sku: 'PROD-002',
          category: 'Category 2',
        },
      ];

      const mockQuery = {
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        sort: jest.fn().mockResolvedValue(mockProducts),
      };

      mockProduct.find.mockReturnValue(mockQuery as any);
      mockProduct.countDocuments.mockResolvedValue(25);

      req.query = {
        page: '2',
        limit: '10',
        category: 'Category 1',
      };

      await productController.getProducts(req as AuthenticatedRequest, res as Response);

      expect(mockProduct.find).toHaveBeenCalledWith({
        isActive: true,
        category: { $regex: 'Category 1', $options: 'i' },
      });
      expect(mockQuery.skip).toHaveBeenCalledWith(10);
      expect(mockQuery.limit).toHaveBeenCalledWith(10);
      expect(jsonSpy).toHaveBeenCalledWith({
        success: true,
        data: {
          products: mockProducts,
          pagination: {
            page: 2,
            limit: 10,
            total: 25,
            pages: 3,
          },
        },
      });
    });

    it('should search products by name or SKU', async () => {
      const mockQuery = {
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        sort: jest.fn().mockResolvedValue([]),
      };

      mockProduct.find.mockReturnValue(mockQuery as any);
      mockProduct.countDocuments.mockResolvedValue(0);

      req.query = {
        search: 'test product',
      };

      await productController.getProducts(req as AuthenticatedRequest, res as Response);

      expect(mockProduct.find).toHaveBeenCalledWith({
        isActive: true,
        $or: [
          { name: { $regex: 'test product', $options: 'i' } },
          { sku: { $regex: 'test product', $options: 'i' } },
        ],
      });
    });
  });

  describe('updateProduct', () => {
    beforeEach(() => {
      req.params = { id: 'product123' };
      req.body = {
        name: 'Updated Product',
        price: 199.99,
      };
    });

    it('should update product successfully', async () => {
      const mockProduct = {
        _id: 'product123',
        name: 'Old Product',
        price: 99.99,
        imageUrl: null,
        imagePublicId: null,
        save: jest.fn().mockResolvedValue(true),
      };

      Product.findById.mockResolvedValue(mockProduct);

      await productController.updateProduct(req as AuthenticatedRequest, res as Response);

      expect(Product.findById).toHaveBeenCalledWith('product123');
      expect(mockProduct.name).toBe('Updated Product');
      expect(mockProduct.price).toBe(199.99);
      expect(mockProduct.save).toHaveBeenCalled();
      expect(jsonSpy).toHaveBeenCalledWith({
        success: true,
        message: 'Product updated successfully',
        data: { product: mockProduct },
      });
    });

    it('should update product with new image', async () => {
      const mockProduct = {
        _id: 'product123',
        name: 'Old Product',
        imageUrl: 'old-image-url',
        imagePublicId: 'old-image-id',
        save: jest.fn().mockResolvedValue(true),
      };

      req.file = {
        buffer: Buffer.from('new-image'),
        mimetype: 'image/jpeg',
        originalname: 'new-test.jpg',
      } as Express.Multer.File;

      Product.findById.mockResolvedValue(mockProduct);
      mockUploadImage.mockResolvedValue({
        url: 'new-image-url',
        publicId: 'new-image-id',
      });
      mockDeleteImage.mockResolvedValue(true);

      await productController.updateProduct(req as AuthenticatedRequest, res as Response);

      expect(mockDeleteImage).toHaveBeenCalledWith('old-image-id');
      expect(mockUploadImage).toHaveBeenCalled();
      expect(mockProduct.imageUrl).toBe('new-image-url');
      expect(mockProduct.imagePublicId).toBe('new-image-id');
    });

    it('should return error if product not found', async () => {
      Product.findById.mockResolvedValue(null);

      await productController.updateProduct(req as AuthenticatedRequest, res as Response);

      expect(statusSpy).toHaveBeenCalledWith(404);
      expect(jsonSpy).toHaveBeenCalledWith({
        success: false,
        message: 'Product not found',
      });
    });
  });

  describe('deleteProduct', () => {
    beforeEach(() => {
      req.params = { id: 'product123' };
    });

    it('should soft delete product successfully', async () => {
      const mockProduct = {
        _id: 'product123',
        name: 'Test Product',
        isActive: true,
        save: jest.fn().mockResolvedValue(true),
      };

      Product.findById.mockResolvedValue(mockProduct);

      await productController.deleteProduct(req as AuthenticatedRequest, res as Response);

      expect(Product.findById).toHaveBeenCalledWith('product123');
      expect(mockProduct.isActive).toBe(false);
      expect(mockProduct.save).toHaveBeenCalled();
      expect(jsonSpy).toHaveBeenCalledWith({
        success: true,
        message: 'Product deleted successfully',
      });
    });

    it('should return error if product not found', async () => {
      Product.findById.mockResolvedValue(null);

      await productController.deleteProduct(req as AuthenticatedRequest, res as Response);

      expect(statusSpy).toHaveBeenCalledWith(404);
      expect(jsonSpy).toHaveBeenCalledWith({
        success: false,
        message: 'Product not found',
      });
    });
  });
});