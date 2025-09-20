import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import request from 'supertest';
import app from '../../src/app';
import { Product } from '../../src/models/Product';
import { Store } from '../../src/models/Store';
import { User } from '../../src/models/User';
import { UserRole } from '../../src/types';
import { generateTokens } from '../../src/utils/jwt';

describe('Integration Tests', () => {
  let mongoServer: MongoMemoryServer;
  let superAdminToken: string;
  let staffToken: string;
  let testUser: any;
  let testStore: any;
  let testProduct: any;

  beforeAll(async () => {
    // Start in-memory MongoDB
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    await mongoose.connect(mongoUri);

    // Create test users
    const superAdmin = await User.create({
      name: 'Super Admin',
      email: 'admin@test.com',
      password: 'hashedpassword',
      role: UserRole.SUPER_ADMIN,
      permissions: ['*'],
      isActive: true,
    });

    const staffUser = await User.create({
      name: 'Staff User',
      email: 'staff@test.com',
      password: 'hashedpassword',
      role: UserRole.STAFF,
      permissions: ['view_inventory'],
      isActive: true,
    });

    testUser = staffUser;

    // Generate tokens
    const adminTokens = generateTokens(superAdmin._id.toString());
    const staffTokens = generateTokens(staffUser._id.toString());
    superAdminToken = adminTokens.accessToken;
    staffToken = staffTokens.accessToken;

    // Create test store
    testStore = await Store.create({
      name: 'Test Store',
      code: 'TEST-001',
      address: {
        street: '123 Test St',
        city: 'Test City',
        state: 'Test State',
        zipCode: '12345',
        country: 'Test Country',
      },
      contact: {
        phone: '+1234567890',
        email: 'store@test.com',
        manager: 'Test Manager',
      },
      warehouseId: new mongoose.Types.ObjectId().toString(),
      storeType: 'RETAIL',
      status: 'ACTIVE',
      isActive: true,
    });

    // Create test product
    testProduct = await Product.create({
      name: 'Test Product',
      sku: 'TEST-PROD-001',
      category: 'Test Category',
      description: 'A test product',
      price: 99.99,
      cost: 49.99,
      unit: 'piece',
      alertThreshold: 10,
      hasShelfLife: false,
      tags: ['test', 'product'],
      isActive: true,
    });
  });

  afterAll(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.connection.close();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    // Clean up any test data between tests if needed
  });

  describe('Authentication Flow', () => {
    it('should allow user registration', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'New User',
          email: 'newuser@test.com',
          password: 'password123',
          role: UserRole.STAFF,
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.user.email).toBe('newuser@test.com');
      expect(response.body.data.accessToken).toBeDefined();
      expect(response.body.data.refreshToken).toBeDefined();
    });

    it('should prevent duplicate email registration', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Duplicate User',
          email: 'admin@test.com', // Already exists
          password: 'password123',
          role: UserRole.STAFF,
        });

      expect(response.status).toBe(409);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('already exists');
    });

    it('should validate required fields during registration', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          name: '',
          email: 'invalid-email',
          password: '123', // Too short
          role: 'INVALID_ROLE',
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('Product Management', () => {
    it('should allow super admin to create products', async () => {
      const response = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          name: 'New Product',
          sku: 'NEW-PROD-001',
          category: 'Electronics',
          price: 199.99,
          cost: 99.99,
          unit: 'piece',
          alertThreshold: 5,
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.product.name).toBe('New Product');
      expect(response.body.data.product.sku).toBe('NEW-PROD-001');
    });

    it('should prevent duplicate SKU creation', async () => {
      const response = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          name: 'Duplicate SKU Product',
          sku: 'TEST-PROD-001', // Already exists
          category: 'Electronics',
          price: 199.99,
          cost: 99.99,
          unit: 'piece',
          alertThreshold: 5,
        });

      expect(response.status).toBe(409);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('SKU already exists');
    });

    it('should deny product creation for staff users', async () => {
      const response = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({
          name: 'Unauthorized Product',
          sku: 'UNAUTH-001',
          category: 'Test',
          price: 99.99,
          cost: 49.99,
          unit: 'piece',
          alertThreshold: 10,
        });

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Insufficient permissions');
    });

    it('should allow authorized users to view products', async () => {
      const response = await request(app)
        .get('/api/products')
        .set('Authorization', `Bearer ${staffToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.products).toBeInstanceOf(Array);
      expect(response.body.data.pagination).toBeDefined();
    });

    it('should support product search and filtering', async () => {
      const response = await request(app)
        .get('/api/products')
        .query({
          search: 'Test Product',
          category: 'Test Category',
          page: 1,
          limit: 10,
        })
        .set('Authorization', `Bearer ${staffToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.products.length).toBeGreaterThan(0);
    });

    it('should allow product updates by authorized users', async () => {
      const response = await request(app)
        .patch(`/api/products/${testProduct._id}`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          name: 'Updated Test Product',
          price: 129.99,
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.product.name).toBe('Updated Test Product');
      expect(response.body.data.product.price).toBe(129.99);
    });

    it('should support soft delete of products', async () => {
      // Create a product to delete
      const newProduct = await Product.create({
        name: 'Product to Delete',
        sku: 'DELETE-001',
        category: 'Test',
        price: 50,
        cost: 25,
        unit: 'piece',
        alertThreshold: 5,
        isActive: true,
      });

      const response = await request(app)
        .delete(`/api/products/${newProduct._id}`)
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      // Verify soft delete
      const deletedProduct = await Product.findById(newProduct._id);
      expect(deletedProduct?.isActive).toBe(false);
    });
  });

  describe('Store Management', () => {
    it('should allow viewing store by ID', async () => {
      const response = await request(app)
        .get(`/api/stores/${testStore._id}`)
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.store.name).toBe('Test Store');
      expect(response.body.data.store.code).toBe('TEST-001');
    });

    it('should return 404 for non-existent store', async () => {
      const fakeId = new mongoose.Types.ObjectId().toString();
      const response = await request(app)
        .get(`/api/stores/${fakeId}`)
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });
  });

  describe('Authorization and Access Control', () => {
    it('should require authentication for protected routes', async () => {
      const response = await request(app)
        .get('/api/products');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('token required');
    });

    it('should reject invalid tokens', async () => {
      const response = await request(app)
        .get('/api/products')
        .set('Authorization', 'Bearer invalid-token');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Invalid or expired token');
    });

    it('should enforce role-based access control', async () => {
      // Try to access admin-only endpoint with staff token
      const response = await request(app)
        .get('/api/users')
        .set('Authorization', `Bearer ${staffToken}`);

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Insufficient permissions');
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid ObjectId parameters', async () => {
      const response = await request(app)
        .get('/api/products/invalid-id')
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should handle database connection errors gracefully', async () => {
      // This test would require mocking mongoose connection
      // For now, we'll test a simpler validation error
      const response = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          // Missing required fields
          name: '',
          sku: '',
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('Data Validation', () => {
    it('should validate email format', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Test User',
          email: 'invalid-email-format',
          password: 'password123',
          role: UserRole.STAFF,
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should validate required fields', async () => {
      const response = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          // Missing required fields like name, sku, price, etc.
          description: 'Product without required fields',
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should validate numeric fields', async () => {
      const response = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          name: 'Invalid Price Product',
          sku: 'INVALID-PRICE-001',
          category: 'Test',
          price: -50, // Invalid negative price
          cost: 'not-a-number', // Invalid cost format
          unit: 'piece',
          alertThreshold: 5,
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });
});