import { motion } from 'framer-motion';
import { DollarSign, Edit, Eye, Package, Tag } from 'lucide-react';
import React from 'react';
import { Product } from '../../types/index.js';
import Button from '../ui/Button.js';

interface ProductCardProps {
  product: Product;
  onEdit: (product: Product) => void;
}

const ProductCard: React.FC<ProductCardProps> = ({ product, onEdit }) => {
  const getStatusColor = (isActive: boolean) => {
    return isActive 
      ? 'bg-green-100 text-green-800' 
      : 'bg-red-100 text-red-800';
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(price);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4 }}
      transition={{ duration: 0.2 }}
      className="bg-white rounded-lg shadow-md hover:shadow-lg transition-all duration-200 overflow-hidden"
    >
      {/* Product Image */}
      <div className="h-48 bg-gray-100 relative overflow-hidden">
        {product.imageUrl ? (
          <img
            src={product.imageUrl}
            alt={product.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Package className="h-16 w-16 text-gray-400" />
          </div>
        )}
        
        {/* Status Badge */}
        <div className="absolute top-2 right-2">
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(product.isActive)}`}>
            {product.isActive ? 'Active' : 'Inactive'}
          </span>
        </div>

        {/* Quick Actions */}
        <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <div className="flex space-x-1">
            <button className="p-1.5 bg-white rounded-full shadow-md hover:bg-gray-50">
              <Eye className="h-4 w-4 text-gray-600" />
            </button>
            <button 
              onClick={() => onEdit(product)}
              className="p-1.5 bg-white rounded-full shadow-md hover:bg-gray-50"
            >
              <Edit className="h-4 w-4 text-gray-600" />
            </button>
          </div>
        </div>
      </div>

      {/* Product Info */}
      <div className="p-4">
        <div className="flex items-start justify-between mb-2">
          <h3 className="text-lg font-semibold text-gray-900 truncate flex-1 mr-2">
            {product.name}
          </h3>
        </div>
        
        <p className="text-sm text-gray-600 mb-3 line-clamp-2">
          {product.description || 'No description available'}
        </p>

        <div className="space-y-2">
          {/* SKU and Category */}
          <div className="flex items-center text-sm text-gray-500">
            <Tag className="h-4 w-4 mr-1" />
            <span className="font-medium mr-2">SKU:</span>
            <span>{product.sku}</span>
          </div>

          <div className="flex items-center text-sm text-gray-500">
            <Package className="h-4 w-4 mr-1" />
            <span className="font-medium mr-2">Category:</span>
            <span>{product.category}</span>
          </div>

          {/* Price */}
          <div className="flex items-center justify-between">
            <div className="flex items-center text-sm">
              <DollarSign className="h-4 w-4 text-green-600 mr-1" />
              <span className="font-semibold text-lg text-green-600">
                {formatPrice(product.price)}
              </span>
            </div>
            <span className="text-xs text-gray-500">
              Cost: {formatPrice(product.cost)}
            </span>
          </div>

          {/* Unit and Alert Threshold */}
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>Unit: {product.unit}</span>
            <span>Alert: {product.alertThreshold}</span>
          </div>

          {/* Tags */}
          {product.tags && product.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {product.tags.slice(0, 3).map((tag, index) => (
                <span
                  key={index}
                  className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800"
                >
                  {tag}
                </span>
              ))}
              {product.tags.length > 3 && (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600">
                  +{product.tags.length - 3}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="mt-4 flex space-x-2">
          <Button
            size="sm"
            variant="outline"
            className="flex-1"
            leftIcon={<Eye className="h-4 w-4" />}
          >
            View
          </Button>
          <Button
            size="sm"
            className="flex-1"
            leftIcon={<Edit className="h-4 w-4" />}
            onClick={() => onEdit(product)}
          >
            Edit
          </Button>
        </div>
      </div>
    </motion.div>
  );
};

export default ProductCard;