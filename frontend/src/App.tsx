import React from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';

// Import components
import AdminDashboard from './components/admin/AdminDashboard';
import UserManagement from './components/admin/UserManagement';
import AlertsCenter from './components/alerts/AlertsCenter';
import LoginForm from './components/auth/LoginForm';
import ProtectedRoute from './components/auth/ProtectedRoute';
import RegisterForm from './components/auth/RegisterForm';
import StoreInventory from './components/inventory/StoreInventory';
import DashboardLayout from './components/layout/DashboardLayout';
import ProductList from './components/products/ProductList';
import LoadingSpinner from './components/ui/LoadingSpinner';
import { UserRole } from './types';

// Placeholder components for now
const Dashboard = () => (
  <div className="px-4 sm:px-6 lg:px-8">
    <div className="sm:flex sm:items-center">
      <div className="sm:flex-auto">
        <h1 className="text-2xl font-semibold text-gray-900">Dashboard</h1>
        <p className="mt-2 text-sm text-gray-700">
          Welcome to SmartStock Inventory Management System
        </p>
      </div>
    </div>
    <div className="mt-8">
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="h-8 w-8 bg-indigo-500 rounded-md flex items-center justify-center">
                  <span className="text-white text-sm font-medium">📦</span>
                </div>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    Total Products
                  </dt>
                  <dd className="text-lg font-medium text-gray-900">
                    1,234
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>
        
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="h-8 w-8 bg-green-500 rounded-md flex items-center justify-center">
                  <span className="text-white text-sm font-medium">🏪</span>
                </div>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    Active Stores
                  </dt>
                  <dd className="text-lg font-medium text-gray-900">
                    12
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>
        
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="h-8 w-8 bg-red-500 rounded-md flex items-center justify-center">
                  <span className="text-white text-sm font-medium">⚠️</span>
                </div>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    Low Stock Items
                  </dt>
                  <dd className="text-lg font-medium text-gray-900">
                    23
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
);

const Products = () => <ProductList />;

const Inventory = () => <StoreInventory />;

const Alerts = () => <AlertsCenter />;

const Admin = () => {
  const { user } = useAuth();
  
  if (user?.role !== UserRole.SUPER_ADMIN) {
    return (
      <div className="px-4 sm:px-6 lg:px-8">
        <div className="text-center py-12">
          <h1 className="text-2xl font-semibold text-gray-900">Access Denied</h1>
          <p className="mt-2 text-sm text-gray-700">
            You don't have permission to access this area.
          </p>
        </div>
      </div>
    );
  }
  
  return <AdminDashboard />;
};

const Users = () => {
  const { user } = useAuth();
  
  if (user?.role !== UserRole.SUPER_ADMIN) {
    return (
      <div className="px-4 sm:px-6 lg:px-8">
        <div className="text-center py-12">
          <h1 className="text-2xl font-semibold text-gray-900">Access Denied</h1>
          <p className="mt-2 text-sm text-gray-700">
            You don't have permission to access this area.
          </p>
        </div>
      </div>
    );
  }
  
  return <UserManagement />;
};

const Stores = () => (
  <div className="px-4 sm:px-6 lg:px-8">
    <h1 className="text-2xl font-semibold text-gray-900">Stores</h1>
    <p className="mt-2 text-sm text-gray-700">Store management coming soon...</p>
  </div>
);

const Warehouses = () => (
  <div className="px-4 sm:px-6 lg:px-8">
    <h1 className="text-2xl font-semibold text-gray-900">Warehouses</h1>
    <p className="mt-2 text-sm text-gray-700">Warehouse management coming soon...</p>
  </div>
);

const Transactions = () => (
  <div className="px-4 sm:px-6 lg:px-8">
    <h1 className="text-2xl font-semibold text-gray-900">Transactions</h1>
    <p className="mt-2 text-sm text-gray-700">Transaction history coming soon...</p>
  </div>
);

const App: React.FC = () => {
  const { isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <Routes>
      {/* Public routes */}
      <Route path="/login" element={<LoginForm />} />
      <Route path="/register" element={<RegisterForm />} />
      
      {/* Protected routes */}
      <Route 
        path="/*" 
        element={
          <ProtectedRoute>
            <DashboardLayout />
          </ProtectedRoute>
        }
      >
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="products" element={<Products />} />
        <Route path="inventory" element={<Inventory />} />
        <Route path="stores" element={<Stores />} />
        <Route path="warehouses" element={<Warehouses />} />
        <Route path="transactions" element={<Transactions />} />
        <Route path="alerts" element={<Alerts />} />
        <Route path="admin" element={<Admin />} />
        <Route path="users" element={<Users />} />
      </Route>
      
      {/* Redirect root to dashboard */}
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
};

export default App;
