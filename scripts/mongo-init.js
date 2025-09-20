// MongoDB initialization script
db = db.getSiblingDB('smartstock');

// Create application user
db.createUser({
    user: 'smartstock_user',
    pwd: 'smartstock_password',
    roles: [{
        role: 'readWrite',
        db: 'smartstock'
    }]
});

// Create indexes for better performance
db.users.createIndex({ email: 1 }, { unique: true });
db.users.createIndex({ role: 1 });
db.users.createIndex({ isActive: 1 });

db.products.createIndex({ sku: 1 }, { unique: true });
db.products.createIndex({ name: 1 });
db.products.createIndex({ category: 1 });
db.products.createIndex({ isActive: 1 });
db.products.createIndex({ name: "text", description: "text" });

db.stores.createIndex({ code: 1 }, { unique: true });
db.stores.createIndex({ warehouseId: 1 });
db.stores.createIndex({ status: 1 });
db.stores.createIndex({ isActive: 1 });

db.warehouses.createIndex({ code: 1 }, { unique: true });
db.warehouses.createIndex({ type: 1 });
db.warehouses.createIndex({ isActive: 1 });

db.transactions.createIndex({ type: 1 });
db.transactions.createIndex({ productId: 1 });
db.transactions.createIndex({ performedBy: 1 });
db.transactions.createIndex({ createdAt: -1 });
db.transactions.createIndex({ fromLocation: 1 });
db.transactions.createIndex({ toLocation: 1 });

db.alerts.createIndex({ type: 1 });
db.alerts.createIndex({ severity: 1 });
db.alerts.createIndex({ status: 1 });
db.alerts.createIndex({ storeId: 1 });
db.alerts.createIndex({ productId: 1 });
db.alerts.createIndex({ createdAt: -1 });
db.alerts.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });

db.batches.createIndex({ productId: 1 });
db.batches.createIndex({ batchNumber: 1 });
db.batches.createIndex({ expiryDate: 1 });
db.batches.createIndex({ status: 1 });
db.batches.createIndex({ location: 1 });

db.auditlogs.createIndex({ userId: 1 });
db.auditlogs.createIndex({ action: 1 });
db.auditlogs.createIndex({ resource: 1 });
db.auditlogs.createIndex({ timestamp: -1 });

print('MongoDB initialization completed successfully!');