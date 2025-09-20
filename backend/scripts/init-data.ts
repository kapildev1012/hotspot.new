import mongoose from 'mongoose';
import { config } from '../src/config/index.js';
import { Store, User, Warehouse } from '../src/models/index.js';
import { AuthService } from '../src/services/authService.js';
import { UserRole } from '../src/types/index.js';

async function initializeDatabase() {
  try {
    // Connect to database
    await mongoose.connect(config.mongoUri);
    console.log('Connected to MongoDB');

    // Check if already initialized
    const existingAdmin = await User.findOne({ role: UserRole.SUPER_ADMIN });
    if (existingAdmin) {
      console.log('Database already initialized');
      process.exit(0);
    }

    // Create main warehouse
    const mainWarehouse = await Warehouse.create({
      name: 'Main Warehouse',
      type: 'MAIN',
      address: {
        street: '123 Warehouse Street',
        city: 'Industrial City',
        state: 'State',
        zipCode: '12345',
        country: 'United States',
      },
      contact: {
        phone: '+1-555-0100',
        email: 'warehouse@smartstock.com',
        manager: 'Warehouse Manager',
      },
      inventory: [],
      capacity: {
        totalSpace: 10000,
        usedSpace: 0,
        unit: 'sqft',
      },
      zones: [
        {
          zoneId: 'GENERAL',
          name: 'General Storage',
          capacity: 5000,
          usedCapacity: 0,
        },
        {
          zoneId: 'COLD',
          name: 'Cold Storage',
          capacity: 2000,
          usedCapacity: 0,
        },
        {
          zoneId: 'HAZMAT',
          name: 'Hazardous Materials',
          capacity: 1000,
          usedCapacity: 0,
        },
        {
          zoneId: 'RECEIVING',
          name: 'Receiving Area',
          capacity: 1000,
          usedCapacity: 0,
        },
        {
          zoneId: 'SHIPPING',
          name: 'Shipping Area',
          capacity: 1000,
          usedCapacity: 0,
        },
      ],
      settings: {
        defaultReceivingZone: 'RECEIVING',
        autoAllocateZone: true,
        temperatureControlled: true,
        temperatureRange: {
          min: 2,
          max: 8,
          unit: 'C',
        },
      },
    });

    console.log('Main warehouse created:', mainWarehouse.name);

    // Create sample store
    const sampleStore = await Store.create({
      name: 'Downtown Store',
      code: 'DT001',
      address: {
        street: '456 Main Street',
        city: 'Downtown',
        state: 'State',
        zipCode: '54321',
        country: 'United States',
      },
      contact: {
        phone: '+1-555-0200',
        email: 'downtown@smartstock.com',
        manager: 'Store Manager',
      },
      inventory: [],
      settings: {
        reorderThresholdOverrides: new Map(),
        workingHours: {
          open: '09:00',
          close: '21:00',
          timezone: 'America/New_York',
        },
        autoReorder: true,
        lowStockThreshold: 10,
      },
      warehouseId: mainWarehouse._id,
      storeType: 'RETAIL',
      status: 'ACTIVE',
      operatingHours: {
        monday: { open: '09:00', close: '21:00', closed: false },
        tuesday: { open: '09:00', close: '21:00', closed: false },
        wednesday: { open: '09:00', close: '21:00', closed: false },
        thursday: { open: '09:00', close: '21:00', closed: false },
        friday: { open: '09:00', close: '22:00', closed: false },
        saturday: { open: '10:00', close: '22:00', closed: false },
        sunday: { open: '11:00', close: '20:00', closed: false },
      },
    });

    console.log('Sample store created:', sampleStore.name);

    // Create super admin user
    const superAdmin = await User.create({
      name: 'Super Administrator',
      email: 'admin@smartstock.com',
      password: 'Admin123!@#',
      role: UserRole.SUPER_ADMIN,
      permissions: ['*'],
      isActive: true,
      emailVerified: true,
    });

    console.log('Super admin created:', superAdmin.email);

    // Create warehouse manager
    const warehouseManager = await User.create({
      name: 'Warehouse Manager',
      email: 'warehouse@smartstock.com',
      password: 'Warehouse123!',
      role: UserRole.WAREHOUSE_MANAGER,
      permissions: AuthService.getDefaultPermissions(UserRole.WAREHOUSE_MANAGER),
      isActive: true,
      emailVerified: true,
    });

    console.log('Warehouse manager created:', warehouseManager.email);

    // Create store manager
    const storeManager = await User.create({
      name: 'Store Manager',
      email: 'storemanager@smartstock.com',
      password: 'Store123!',
      role: UserRole.STORE_MANAGER,
      storeId: sampleStore._id,
      permissions: AuthService.getDefaultPermissions(UserRole.STORE_MANAGER),
      isActive: true,
      emailVerified: true,
    });

    console.log('Store manager created:', storeManager.email);

    // Create store clerk
    const storeClerk = await User.create({
      name: 'Store Clerk',
      email: 'clerk@smartstock.com',
      password: 'Clerk123!',
      role: UserRole.STORE_CLERK,
      storeId: sampleStore._id,
      permissions: AuthService.getDefaultPermissions(UserRole.STORE_CLERK),
      isActive: true,
      emailVerified: true,
    });

    console.log('Store clerk created:', storeClerk.email);

    console.log('\\n✅ Database initialization completed successfully!');
    console.log('\\n📋 Default Users Created:');
    console.log('👑 Super Admin: admin@smartstock.com / Admin123!@#');
    console.log('🏭 Warehouse Manager: warehouse@smartstock.com / Warehouse123!');
    console.log('🏪 Store Manager: storemanager@smartstock.com / Store123!');
    console.log('👤 Store Clerk: clerk@smartstock.com / Clerk123!');
    console.log('\\n🏢 Infrastructure:');
    console.log(`📦 Main Warehouse: ${mainWarehouse.name}`);
    console.log(`🏪 Sample Store: ${sampleStore.name} (${sampleStore.code})`);

    process.exit(0);
  } catch (error) {
    console.error('Database initialization failed:', error);
    process.exit(1);
  }
}

initializeDatabase();