// MongoDB initialization script
db = db.getSiblingDB('smartstock');

// Create collections with validation
db.createCollection('users');
db.createCollection('products');
db.createCollection('batches');
db.createCollection('warehouses');
db.createCollection('stores');
db.createCollection('transactions');
db.createCollection('alerts');
db.createCollection('auditlogs');

// Create indexes for better performance
db.users.createIndex({ email: 1 }, { unique: true });
db.users.createIndex({ role: 1, storeId: 1 });

db.products.createIndex({ sku: 1 }, { unique: true });
db.products.createIndex({ name: "text", description: "text", category: "text" });
db.products.createIndex({ barcode: 1 });
db.products.createIndex({ category: 1, isActive: 1 });

db.batches.createIndex({ productId: 1, batchNumber: 1 }, { unique: true });
db.batches.createIndex({ expiryDate: 1, isActive: 1 });

db.warehouses.createIndex({ name: 1 });
db.warehouses.createIndex({ type: 1, isActive: 1 });

db.stores.createIndex({ code: 1 }, { unique: true });
db.stores.createIndex({ warehouseId: 1 });

db.transactions.createIndex({ type: 1, status: 1 });
db.transactions.createIndex({ userId: 1, createdAt: -1 });

db.alerts.createIndex({ type: 1, priority: 1 });
db.alerts.createIndex({ resolved: 1, acknowledged: 1 });

db.auditlogs.createIndex({ actorUserId: 1, timestamp: -1 });
db.auditlogs.createIndex({ timestamp: -1 });

print('Database initialization completed successfully!');