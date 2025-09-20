import { motion } from 'framer-motion';
import {
    AlertTriangle,
    ArrowUpDown,
    Minus,
    Package,
    Plus,
    ShoppingCart,
    TrendingDown
} from 'lucide-react';
import React from 'react';
import Button from '../ui/Button.js';

interface InventoryItemCardProps {
  item: {
    product: {
      _id: string;
      name: string;
      sku: string;
      category: string;
      unit: string;
      price: number;
      cost: number;
      imageUrl?: string;
    };
    quantity: number;
    reserved: number;
    available: number;
    threshold: number;
    isLowStock: boolean;
  };
  onTransaction: (type: 'sale' | 'purchase' | 'adjustment' | 'transfer') => void;
}

const InventoryItemCard: React.FC<InventoryItemCardProps> = ({ item, onTransaction }) => {
  const { product, quantity, reserved, available, threshold, isLowStock } = item;

  const getStatusColor = () => {
    if (available <= 0) return 'bg-red-100 text-red-800 border-red-200';
    if (isLowStock) return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    return 'bg-green-100 text-green-800 border-green-200';
  };

  const getStatusText = () => {
    if (available <= 0) return 'Out of Stock';
    if (isLowStock) return 'Low Stock';
    return 'In Stock';
  };

  const getStatusIcon = () => {
    if (available <= 0) return <AlertTriangle className="h-4 w-4" />;
    if (isLowStock) return <TrendingDown className="h-4 w-4" />;
    return <Package className="h-4 w-4" />;
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2 }}
      className="bg-white rounded-lg shadow-md hover:shadow-lg transition-all duration-200 overflow-hidden"
    >
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-semibold text-gray-900 truncate">
              {product.name}
            </h3>
            <p className="text-sm text-gray-500">
              SKU: {product.sku} • {product.category}
            </p>
          </div>
          <div className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusColor()}`}>
            {getStatusIcon()}
            <span className="ml-1">{getStatusText()}</span>
          </div>
        </div>
      </div>

      {/* Product Image */}
      {product.imageUrl && (
        <div className="h-32 bg-gray-100 overflow-hidden">
          <img
            src={product.imageUrl}
            alt={product.name}
            className="w-full h-full object-cover"
          />
        </div>
      )}

      {/* Inventory Details */}
      <div className="p-4 space-y-3">
        {/* Stock Levels */}
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-lg font-semibold text-gray-900">{quantity}</div>
            <div className="text-xs text-gray-500">Total</div>
          </div>
          <div>
            <div className="text-lg font-semibold text-orange-600">{reserved}</div>
            <div className="text-xs text-gray-500">Reserved</div>
          </div>
          <div>
            <div className="text-lg font-semibold text-green-600">{available}</div>
            <div className="text-xs text-gray-500">Available</div>
          </div>
        </div>

        {/* Stock Progress Bar */}
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-gray-500">
            <span>Stock Level</span>
            <span>{threshold} threshold</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all duration-300 ${
                isLowStock ? 'bg-yellow-500' : available <= 0 ? 'bg-red-500' : 'bg-green-500'
              }`}
              style={{
                width: `${Math.min(100, Math.max(0, (available / Math.max(threshold * 2, 1)) * 100))}%`,
              }}
            />
          </div>
        </div>

        {/* Pricing */}
        <div className="flex justify-between items-center text-sm">
          <div>
            <span className="text-gray-500">Price:</span>
            <span className="ml-1 font-medium text-green-600">
              {formatCurrency(product.price)}
            </span>
          </div>
          <div>
            <span className="text-gray-500">Cost:</span>
            <span className="ml-1 font-medium">
              {formatCurrency(product.cost)}
            </span>
          </div>
        </div>

        {/* Total Value */}
        <div className="text-center p-2 bg-gray-50 rounded">
          <div className="text-sm text-gray-500">Total Value</div>
          <div className="text-lg font-semibold text-gray-900">
            {formatCurrency(available * product.cost)}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 gap-2 pt-2">
          <Button
            size="sm"
            variant="outline"
            leftIcon={<ShoppingCart className="h-4 w-4" />}
            onClick={() => onTransaction('sale')}
            disabled={available <= 0}
            className="text-xs"
          >
            Sell
          </Button>
          <Button
            size="sm"
            variant="outline"
            leftIcon={<Plus className="h-4 w-4" />}
            onClick={() => onTransaction('purchase')}
            className="text-xs"
          >
            Restock
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Button
            size="sm"
            variant="outline"
            leftIcon={<ArrowUpDown className="h-4 w-4" />}
            onClick={() => onTransaction('transfer')}
            disabled={available <= 0}
            className="text-xs"
          >
            Transfer
          </Button>
          <Button
            size="sm"
            variant="outline"
            leftIcon={<Minus className="h-4 w-4" />}
            onClick={() => onTransaction('adjustment')}
            className="text-xs"
          >
            Adjust
          </Button>
        </div>

        {/* Low Stock Warning */}
        {isLowStock && available > 0 && (
          <div className="mt-3 p-2 bg-yellow-50 border border-yellow-200 rounded">
            <div className="flex items-center">
              <TrendingDown className="h-4 w-4 text-yellow-600 mr-2" />
              <span className="text-xs text-yellow-800">
                Stock is running low (below {threshold} {product.unit})
              </span>
            </div>
          </div>
        )}

        {/* Out of Stock Warning */}
        {available <= 0 && (
          <div className="mt-3 p-2 bg-red-50 border border-red-200 rounded">
            <div className="flex items-center">
              <AlertTriangle className="h-4 w-4 text-red-600 mr-2" />
              <span className="text-xs text-red-800">
                This item is out of stock
              </span>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default InventoryItemCard;