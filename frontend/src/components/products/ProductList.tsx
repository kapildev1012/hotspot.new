import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Download, Filter, Plus, Search, Upload } from 'lucide-react';
import React, { useState } from 'react';
import { productService } from '../../services/products.js';
import { Product } from '../../types/index.js';
import Button from '../ui/Button.js';
import Input from '../ui/Input.js';
import ProductCard from './ProductCard.js';
import ProductModal from './ProductModal.js';

const ProductList: React.FC = () => {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [isActive, setIsActive] = useState<boolean | undefined>(undefined);
  const [showModal, setShowModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  const {
    data: productsData,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['products', page, search, category, isActive],
    queryFn: () =>
      productService.getProducts({
        page,
        limit: 12,
        search: search || undefined,
        category: category || undefined,
        isActive,
      }),
  });

  const {
    data: categoriesData,
  } = useQuery({
    queryKey: ['product-categories'],
    queryFn: () => productService.getProductCategories(),
  });

  const handleCreateProduct = () => {
    setSelectedProduct(null);
    setShowModal(true);
  };

  const handleEditProduct = (product: Product) => {
    setSelectedProduct(product);
    setShowModal(true);
  };

  const handleModalClose = () => {
    setShowModal(false);
    setSelectedProduct(null);
    refetch();
  };

  const handleExport = () => {
    // Implement export functionality
    console.log('Export products');
  };

  const handleImport = () => {
    // Implement import functionality
    console.log('Import products');
  };

  if (error) {
    return (
      <div className="px-4 sm:px-6 lg:px-8">
        <div className="text-center py-12">
          <div className="text-red-500 mb-4">
            <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 15.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">Error loading products</h3>
          <p className="text-gray-500 mb-4">There was an error loading the products. Please try again.</p>
          <Button onClick={() => refetch()}>Retry</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="sm:flex sm:items-center sm:justify-between">
        <div className="sm:flex-auto">
          <h1 className="text-2xl font-semibold text-gray-900">Products</h1>
          <p className="mt-2 text-sm text-gray-700">
            Manage your product catalog, inventory, and pricing.
          </p>
        </div>
        <div className="mt-4 sm:mt-0 sm:ml-16 sm:flex-none space-x-3 flex">
          <Button
            variant="outline"
            leftIcon={<Upload className="h-4 w-4" />}
            onClick={handleImport}
          >
            Import
          </Button>
          <Button
            variant="outline"
            leftIcon={<Download className="h-4 w-4" />}
            onClick={handleExport}
          >
            Export
          </Button>
          <Button
            leftIcon={<Plus className="h-4 w-4" />}
            onClick={handleCreateProduct}
          >
            Add Product
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Input
          placeholder="Search products..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          leftIcon={<Search className="h-4 w-4" />}
        />
        
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="block w-full px-3 py-2.5 text-gray-900 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
        >
          <option value="">All Categories</option>
          {categoriesData?.data?.categories?.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>

        <select
          value={isActive === undefined ? '' : isActive.toString()}
          onChange={(e) => 
            setIsActive(e.target.value === '' ? undefined : e.target.value === 'true')
          }
          className="block w-full px-3 py-2.5 text-gray-900 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
        >
          <option value="">All Status</option>
          <option value="true">Active</option>
          <option value="false">Inactive</option>
        </select>

        <Button
          variant="outline"
          leftIcon={<Filter className="h-4 w-4" />}
          onClick={() => {
            setSearch('');
            setCategory('');
            setIsActive(undefined);
          }}
        >
          Clear Filters
        </Button>
      </div>

      {/* Product Grid */}
      <div className="mt-8">
        {isLoading ? (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, index) => (
              <div key={index} className="bg-white rounded-lg shadow animate-pulse">
                <div className="h-48 bg-gray-200 rounded-t-lg" />
                <div className="p-4 space-y-3">
                  <div className="h-4 bg-gray-200 rounded w-3/4" />
                  <div className="h-3 bg-gray-200 rounded w-1/2" />
                  <div className="h-3 bg-gray-200 rounded w-1/4" />
                </div>
              </div>
            ))}
          </div>
        ) : productsData?.data?.products?.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-gray-400 mb-4">
              <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No products found</h3>
            <p className="text-gray-500 mb-4">
              {search || category || isActive !== undefined
                ? 'No products match your current filters.'
                : 'Get started by creating your first product.'}
            </p>
            <Button onClick={handleCreateProduct}>Create Product</Button>
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
          >
            {productsData?.data?.products?.map((product) => (
              <ProductCard
                key={product._id}
                product={product}
                onEdit={handleEditProduct}
              />
            ))}
          </motion.div>
        )}
      </div>

      {/* Pagination */}
      {productsData?.data?.pagination && productsData.data.pagination.pages > 1 && (
        <div className="mt-8 flex items-center justify-between">
          <div className="text-sm text-gray-700">
            Showing {((page - 1) * 12) + 1} to{' '}
            {Math.min(page * 12, productsData.data.pagination.total)} of{' '}
            {productsData.data.pagination.total} results
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
              disabled={page >= productsData.data.pagination.pages}
              onClick={() => setPage(page + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {/* Product Modal */}
      {showModal && (
        <ProductModal
          product={selectedProduct}
          onClose={handleModalClose}
        />
      )}
    </div>
  );
};

export default ProductList;