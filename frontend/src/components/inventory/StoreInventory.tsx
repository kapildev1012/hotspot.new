import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
    AlertTriangle,
    Download,
    Filter,
    Package,
    Plus,
    Search,
    TrendingDown,
    Upload
} from 'lucide-react';
import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext.js';
import { storeService } from '../../services/stores.js';
import Button from '../ui/Button.js';
import Input from '../ui/Input.js';
import LoadingSpinner from '../ui/LoadingSpinner.js';
import InventoryItemCard from './InventoryItemCard.js';
import TransactionModal from './TransactionModal.js';

const StoreInventory: React.FC = () => {
  const { storeId } = useParams<{ storeId: string }>();
  const { user } = useAuth();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [lowStock, setLowStock] = useState(false);
  const [showTransactionModal, setShowTransactionModal] = useState(false);
  const [transactionType, setTransactionType] = useState<'sale' | 'purchase' | 'adjustment' | 'transfer'>('sale');

  // Use store from user context if no storeId in URL
  const effectiveStoreId = storeId || user?.storeId;

  const {
    data: storeData,
    isLoading: storeLoading,
    error: storeError,
  } = useQuery({
    queryKey: ['store', effectiveStoreId],
    queryFn: () => storeService.getStore(effectiveStoreId!, true),
    enabled: !!effectiveStoreId,
  });

  const {
    data: inventoryData,
    isLoading: inventoryLoading,
    error: inventoryError,
    refetch,
  } = useQuery({
    queryKey: ['store-inventory', effectiveStoreId, page, search, category, lowStock],
    queryFn: () =>
      storeService.getStoreInventory(effectiveStoreId!, {
        page,
        limit: 20,
        search: search || undefined,
        category: category || undefined,
        lowStock,
      }),
    enabled: !!effectiveStoreId,
  });

  const handleTransaction = (type: 'sale' | 'purchase' | 'adjustment' | 'transfer') => {
    setTransactionType(type);
    setShowTransactionModal(true);
  };

  const handleTransactionClose = () => {
    setShowTransactionModal(false);
    refetch();
  };

  if (!effectiveStoreId) {
    return (
      <div className="px-4 sm:px-6 lg:px-8">
        <div className="text-center py-12">
          <AlertTriangle className="mx-auto h-12 w-12 text-red-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">No Store Access</h3>
          <p className="mt-1 text-sm text-gray-500">
            You don't have access to any store or no store was specified.
          </p>
        </div>
      </div>
    );
  }

  if (storeError || inventoryError) {
    return (
      <div className="px-4 sm:px-6 lg:px-8">
        <div className="text-center py-12">
          <AlertTriangle className="mx-auto h-12 w-12 text-red-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">Error Loading Inventory</h3>
          <p className="mt-1 text-sm text-gray-500">
            There was an error loading the store inventory. Please try again.
          </p>
          <Button onClick={() => refetch()} className="mt-4">
            Retry
          </Button>
        </div>
      </div>
    );
  }

  if (storeLoading) {
    return (
      <div className="px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-center py-12">
          <LoadingSpinner size="lg" />
        </div>
      </div>
    );
  }

  const store = storeData?.data?.store;
  const inventory = inventoryData?.data?.inventory || [];
  const pagination = inventoryData?.data?.pagination;

  // Calculate summary stats
  const totalItems = inventory.length;
  const lowStockItems = inventory.filter(item => item.isLowStock).length;
  const outOfStockItems = inventory.filter(item => item.available <= 0).length;
  const totalValue = inventory.reduce((sum, item) => sum + (item.available * item.product.cost), 0);

  return (
    <div className="px-4 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="sm:flex sm:items-center sm:justify-between">
        <div className="sm:flex-auto">
          <h1 className="text-2xl font-semibold text-gray-900">
            {store?.name} Inventory
          </h1>
          <p className="mt-2 text-sm text-gray-700">
            Manage inventory levels, track stock movements, and perform transactions.
          </p>
        </div>
        <div className="mt-4 sm:mt-0 sm:ml-16 sm:flex-none">
          <div className="flex space-x-3">
            <Button
              variant="outline"
              leftIcon={<Download className="h-4 w-4" />}
            >
              Export
            </Button>
            <Button
              variant="outline"
              leftIcon={<Upload className="h-4 w-4" />}
            >
              Import
            </Button>
            <Button
              leftIcon={<Plus className="h-4 w-4" />}
              onClick={() => handleTransaction('purchase')}
            >
              New Transaction
            </Button>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <Package className="h-6 w-6 text-gray-400" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    Total Items
                  </dt>
                  <dd className="text-lg font-medium text-gray-900">
                    {totalItems}
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
                <TrendingDown className="h-6 w-6 text-yellow-400" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    Low Stock
                  </dt>
                  <dd className="text-lg font-medium text-yellow-600">
                    {lowStockItems}
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
                <AlertTriangle className="h-6 w-6 text-red-400" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    Out of Stock
                  </dt>
                  <dd className="text-lg font-medium text-red-600">
                    {outOfStockItems}
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
                <span className="text-green-600 text-lg">$</span>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    Total Value
                  </dt>
                  <dd className="text-lg font-medium text-green-600">
                    ${totalValue.toLocaleString()}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="mt-6 flex flex-wrap gap-3">
        <Button
          size="sm"
          onClick={() => handleTransaction('sale')}
          className="bg-green-600 hover:bg-green-700"
        >
          Record Sale
        </Button>
        <Button
          size="sm"
          onClick={() => handleTransaction('purchase')}
          className="bg-blue-600 hover:bg-blue-700"
        >
          Record Purchase
        </Button>
        <Button
          size="sm"
          onClick={() => handleTransaction('transfer')}
          className="bg-purple-600 hover:bg-purple-700"
        >
          Transfer Stock
        </Button>
        <Button
          size="sm"
          onClick={() => handleTransaction('adjustment')}
          className="bg-orange-600 hover:bg-orange-700"
        >
          Stock Adjustment
        </Button>
      </div>

      {/* Filters */}
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Input
          placeholder="Search products..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          leftIcon={<Search className="h-4 w-4" />}
        />
        
        <input
          type="text"
          placeholder="Filter by category..."
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="block w-full px-3 py-2.5 text-gray-900 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
        />

        <div className="flex items-center space-x-3">
          <input
            type="checkbox"
            checked={lowStock}
            onChange={(e) => setLowStock(e.target.checked)}
            className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
          />
          <label className="text-sm font-medium text-gray-700">
            Low Stock Only
          </label>
        </div>

        <Button
          variant="outline"
          leftIcon={<Filter className="h-4 w-4" />}
          onClick={() => {
            setSearch('');
            setCategory('');
            setLowStock(false);
          }}
        >
          Clear Filters
        </Button>
      </div>

      {/* Inventory List */}
      <div className="mt-8">
        {inventoryLoading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="bg-white rounded-lg shadow animate-pulse">
                <div className="p-6 space-y-3">
                  <div className="h-4 bg-gray-200 rounded w-3/4" />
                  <div className="h-3 bg-gray-200 rounded w-1/2" />
                  <div className="h-3 bg-gray-200 rounded w-1/4" />
                </div>
              </div>
            ))}
          </div>
        ) : inventory.length === 0 ? (
          <div className="text-center py-12">
            <Package className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No inventory items</h3>
            <p className="mt-1 text-sm text-gray-500">
              {search || category || lowStock
                ? 'No items match your current filters.'
                : 'This store has no inventory items yet.'}
            </p>
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
          >
            {inventory.map((item, index) => (
              <InventoryItemCard
                key={`${item.product._id}-${index}`}
                item={item}
                onTransaction={handleTransaction}
              />
            ))}
          </motion.div>
        )}
      </div>

      {/* Pagination */}
      {pagination && pagination.pages > 1 && (
        <div className="mt-8 flex items-center justify-between">
          <div className="text-sm text-gray-700">
            Showing {((page - 1) * 20) + 1} to{' '}
            {Math.min(page * 20, pagination.total)} of{' '}
            {pagination.total} results
          </div>
          <div className="flex space-x-2">
            <Button
              variant="outline"
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              disabled={page >= pagination.pages}
              onClick={() => setPage(page + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {/* Transaction Modal */}
      {showTransactionModal && (
        <TransactionModal
          type={transactionType}
          storeId={effectiveStoreId}
          onClose={handleTransactionClose}
        />
      )}
    </div>
  );
};

export default StoreInventory;