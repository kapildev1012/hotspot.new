import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import { Plus, Save, Search, Trash2, X } from 'lucide-react';
import React, { useState } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { z } from 'zod';
import { productService } from '../../services/products.js';
import { storeService } from '../../services/stores.js';
import { transactionService } from '../../services/transactions.js';
import Button from '../ui/Button.js';
import Input from '../ui/Input.js';
import Select from '../ui/Select.js';

const transactionItemSchema = z.object({
  productId: z.string().min(1, 'Product is required'),
  quantity: z.number().min(1, 'Quantity must be positive'),
  price: z.number().min(0, 'Price must be non-negative').optional(),
  cost: z.number().min(0, 'Cost must be non-negative').optional(),
  reason: z.string().optional(),
  batchNumber: z.string().optional(),
  expiryDate: z.string().optional(),
});

const saleSchema = z.object({
  items: z.array(transactionItemSchema).min(1, 'At least one item is required'),
  customerId: z.string().optional(),
  notes: z.string().optional(),
});

const purchaseSchema = z.object({
  items: z.array(transactionItemSchema).min(1, 'At least one item is required'),
  supplierId: z.string().optional(),
  notes: z.string().optional(),
});

const transferSchema = z.object({
  toStoreId: z.string().min(1, 'Destination store is required'),
  items: z.array(transactionItemSchema).min(1, 'At least one item is required'),
  notes: z.string().optional(),
});

const adjustmentSchema = z.object({
  items: z.array(transactionItemSchema).min(1, 'At least one item is required'),
  notes: z.string().optional(),
});

type TransactionFormData = z.infer<typeof saleSchema | typeof purchaseSchema | typeof transferSchema | typeof adjustmentSchema>;

interface TransactionModalProps {
  type: 'sale' | 'purchase' | 'transfer' | 'adjustment';
  storeId: string;
  onClose: () => void;
}

const TransactionModal: React.FC<TransactionModalProps> = ({ type, storeId, onClose }) => {
  const [productSearch, setProductSearch] = useState('');
  const queryClient = useQueryClient();

  const getSchema = () => {
    switch (type) {
      case 'sale': return saleSchema;
      case 'purchase': return purchaseSchema;
      case 'transfer': return transferSchema;
      case 'adjustment': return adjustmentSchema;
    }
  };

  const {
    control,
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isValid },
  } = useForm<TransactionFormData>({
    resolver: zodResolver(getSchema()),
    mode: 'onChange',
    defaultValues: {
      items: [{ productId: '', quantity: 1 }],
      notes: '',
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'items',
  });

  // Fetch products for search
  const { data: productsData } = useQuery({
    queryKey: ['products', productSearch],
    queryFn: () => productService.getProducts({ 
      search: productSearch,
      limit: 20,
      isActive: true 
    }),
    enabled: productSearch.length > 0,
  });

  // Fetch stores for transfer
  const { data: storesData } = useQuery({
    queryKey: ['stores'],
    queryFn: () => storeService.getStores({ isActive: true }),
    enabled: type === 'transfer',
  });

  // Mutation for creating transactions
  const createTransactionMutation = useMutation({
    mutationFn: async (data: TransactionFormData) => {
      const transactionData = {
        storeId,
        ...data,
      };

      switch (type) {
        case 'sale':
          return transactionService.createSale(transactionData as any);
        case 'purchase':
          return transactionService.createPurchase(transactionData as any);
        case 'transfer':
          return transactionService.createTransfer({
            fromStoreId: storeId,
            ...(transactionData as any),
          });
        case 'adjustment':
          return transactionService.createAdjustment(transactionData as any);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['store-inventory'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      toast.success(`${type.charAt(0).toUpperCase() + type.slice(1)} recorded successfully`);
      onClose();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || `Failed to record ${type}`);
    },
  });

  const onSubmit = (data: TransactionFormData) => {
    createTransactionMutation.mutate(data);
  };

  const getTitle = () => {
    switch (type) {
      case 'sale': return 'Record Sale';
      case 'purchase': return 'Record Purchase';
      case 'transfer': return 'Transfer Stock';
      case 'adjustment': return 'Stock Adjustment';
    }
  };

  const getButtonText = () => {
    switch (type) {
      case 'sale': return 'Record Sale';
      case 'purchase': return 'Record Purchase';
      case 'transfer': return 'Transfer Stock';
      case 'adjustment': return 'Adjust Stock';
    }
  };

  const getButtonColor = () => {
    switch (type) {
      case 'sale': return 'bg-green-600 hover:bg-green-700';
      case 'purchase': return 'bg-blue-600 hover:bg-blue-700';
      case 'transfer': return 'bg-purple-600 hover:bg-purple-700';
      case 'adjustment': return 'bg-orange-600 hover:bg-orange-700';
    }
  };

  const productOptions = productsData?.data?.products?.map(product => ({
    value: product._id,
    label: `${product.name} (${product.sku})`,
  })) || [];

  const storeOptions = storesData?.data?.stores?.filter(store => store._id !== storeId).map(store => ({
    value: store._id,
    label: `${store.name} (${store.code})`,
  })) || [];

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 overflow-y-auto">
        <div className="flex min-h-screen items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-gray-500 bg-opacity-75"
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="relative w-full max-w-4xl bg-white rounded-lg shadow-xl"
          >
            <form onSubmit={handleSubmit(onSubmit)}>
              {/* Header */}
              <div className="flex items-center justify-between p-6 border-b border-gray-200">
                <h3 className="text-lg font-medium text-gray-900">{getTitle()}</h3>
                <button
                  type="button"
                  onClick={onClose}
                  className="text-gray-400 hover:text-gray-500"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              {/* Content */}
              <div className="p-6 space-y-6 max-h-96 overflow-y-auto">
                {/* Transfer destination (only for transfers) */}
                {type === 'transfer' && (
                  <Select
                    label="Destination Store *"
                    {...register('toStoreId' as any)}
                    options={storeOptions}
                    error={errors.toStoreId?.message}
                    placeholder="Select destination store"
                  />
                )}

                {/* Items */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <label className="text-sm font-medium text-gray-700">
                      Items *
                    </label>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      leftIcon={<Plus className="h-4 w-4" />}
                      onClick={() => append({ productId: '', quantity: 1 })}
                    >
                      Add Item
                    </Button>
                  </div>

                  <div className="space-y-4">
                    {fields.map((field, index) => (
                      <div key={field.id} className="border border-gray-200 rounded-lg p-4">
                        <div className="flex items-start justify-between mb-4">
                          <h4 className="text-sm font-medium text-gray-900">
                            Item {index + 1}
                          </h4>
                          {fields.length > 1 && (
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              onClick={() => remove(index)}
                              className="text-red-600 hover:text-red-700"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {/* Product Selection */}
                          <div className="lg:col-span-2">
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Product *
                            </label>
                            <div className="relative">
                              <input
                                type="text"
                                placeholder="Search products..."
                                value={productSearch}
                                onChange={(e) => setProductSearch(e.target.value)}
                                className="block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                              />
                              <Search className="absolute right-3 top-2.5 h-4 w-4 text-gray-400" />
                            </div>
                            {productOptions.length > 0 && (
                              <div className="mt-1 max-h-32 overflow-y-auto border border-gray-200 rounded-md bg-white shadow-sm">
                                {productOptions.map((option) => (
                                  <button
                                    key={option.value}
                                    type="button"
                                    onClick={() => {
                                      setValue(`items.${index}.productId` as any, option.value);
                                      setProductSearch('');
                                    }}
                                    className="block w-full px-3 py-2 text-left text-sm hover:bg-gray-50"
                                  >
                                    {option.label}
                                  </button>
                                ))}
                              </div>
                            )}
                            <input
                              type="hidden"
                              {...register(`items.${index}.productId` as any)}
                            />
                          </div>

                          {/* Quantity */}
                          <Input
                            label="Quantity *"
                            type="number"
                            min="1"
                            {...register(`items.${index}.quantity` as any, { valueAsNumber: true })}
                            error={errors.items?.[index]?.quantity?.message}
                          />

                          {/* Price (for sales) */}
                          {type === 'sale' && (
                            <Input
                              label="Price"
                              type="number"
                              step="0.01"
                              {...register(`items.${index}.price` as any, { valueAsNumber: true })}
                              error={errors.items?.[index]?.price?.message}
                            />
                          )}

                          {/* Cost (for purchases) */}
                          {type === 'purchase' && (
                            <Input
                              label="Cost"
                              type="number"
                              step="0.01"
                              {...register(`items.${index}.cost` as any, { valueAsNumber: true })}
                              error={errors.items?.[index]?.cost?.message}
                            />
                          )}

                          {/* Reason (for adjustments) */}
                          {type === 'adjustment' && (
                            <Input
                              label="Reason"
                              {...register(`items.${index}.reason` as any)}
                              error={errors.items?.[index]?.reason?.message}
                              placeholder="Reason for adjustment"
                            />
                          )}

                          {/* Batch Number (for purchases) */}
                          {type === 'purchase' && (
                            <Input
                              label="Batch Number"
                              {...register(`items.${index}.batchNumber` as any)}
                              error={errors.items?.[index]?.batchNumber?.message}
                            />
                          )}

                          {/* Expiry Date (for purchases) */}
                          {type === 'purchase' && (
                            <Input
                              label="Expiry Date"
                              type="date"
                              {...register(`items.${index}.expiryDate` as any)}
                              error={errors.items?.[index]?.expiryDate?.message}
                            />
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Additional fields based on transaction type */}
                {(type === 'sale' || type === 'purchase') && (
                  <Input
                    label={type === 'sale' ? 'Customer ID' : 'Supplier ID'}
                    {...register(type === 'sale' ? 'customerId' : 'supplierId' as any)}
                    placeholder={`Enter ${type === 'sale' ? 'customer' : 'supplier'} ID`}
                  />
                )}

                {/* Notes */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Notes
                  </label>
                  <textarea
                    {...register('notes' as any)}
                    rows={3}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    placeholder="Add any additional notes..."
                  />
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-end space-x-3 p-6 border-t border-gray-200">
                <Button type="button" variant="outline" onClick={onClose}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  isLoading={createTransactionMutation.isPending}
                  disabled={!isValid || createTransactionMutation.isPending}
                  leftIcon={<Save className="h-4 w-4" />}
                  className={getButtonColor()}
                >
                  {createTransactionMutation.isPending ? 'Processing...' : getButtonText()}
                </Button>
              </div>
            </form>
          </motion.div>
        </div>
      </div>
    </AnimatePresence>
  );
};

export default TransactionModal;