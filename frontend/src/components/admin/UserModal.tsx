import { zodResolver } from '@hookform/resolvers/zod';
import { AnimatePresence, motion } from 'framer-motion';
import { Shield, User, X } from 'lucide-react';
import React from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import type { UserRole, User as UserType } from '../../types';
import Button from '../ui/Button';
import Input from '../ui/Input';

const userSchema = z.object({
  name: z.string().min(1, 'Name is required').min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters').optional(),
  phone: z.string().optional(),
  role: z.nativeEnum(UserRole),
  storeId: z.string().optional(),
  warehouseId: z.string().optional(),
  permissions: z.array(z.string()).optional(),
  isActive: z.boolean().default(true),
});

type UserFormData = z.infer<typeof userSchema>;

interface UserModalProps {
  isOpen: boolean;
  onClose: () => void;
  user?: UserType | null;
  onSubmit: (data: UserFormData) => void;
  isLoading?: boolean;
}

const UserModal: React.FC<UserModalProps> = ({
  isOpen,
  onClose,
  user,
  onSubmit,
  isLoading = false,
}) => {
  const isEditing = !!user;

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    watch,
  } = useForm<UserFormData>({
    resolver: zodResolver(
      isEditing 
        ? userSchema.omit({ password: true }).extend({ 
            password: z.string().optional() 
          })
        : userSchema
    ),
    defaultValues: user ? {
      name: user.name,
      email: user.email,
      phone: user.phone || '',
      role: user.role,
      storeId: user.storeId || '',
      warehouseId: user.warehouseId || '',
      permissions: user.permissions || [],
      isActive: user.isActive,
    } : {
      name: '',
      email: '',
      password: '',
      phone: '',
      role: UserRole.STAFF,
      storeId: '',
      warehouseId: '',
      permissions: [],
      isActive: true,
    },
  });

  const selectedRole = watch('role');

  React.useEffect(() => {
    if (isOpen && user) {
      reset({
        name: user.name,
        email: user.email,
        phone: user.phone || '',
        role: user.role,
        storeId: user.storeId || '',
        warehouseId: user.warehouseId || '',
        permissions: user.permissions || [],
        isActive: user.isActive,
      });
    } else if (isOpen && !user) {
      reset({
        name: '',
        email: '',
        password: '',
        phone: '',
        role: UserRole.STAFF,
        storeId: '',
        warehouseId: '',
        permissions: [],
        isActive: true,
      });
    }
  }, [isOpen, user, reset]);

  const handleFormSubmit = (data: UserFormData) => {
    // Remove empty optional fields
    const cleanData = { ...data };
    if (!cleanData.phone) delete cleanData.phone;
    if (!cleanData.storeId) delete cleanData.storeId;
    if (!cleanData.warehouseId) delete cleanData.warehouseId;
    if (isEditing && !cleanData.password) delete cleanData.password;

    onSubmit(cleanData);
  };

  const getRolePermissions = (role: UserRole): string[] => {
    switch (role) {
      case UserRole.SUPER_ADMIN:
        return [
          'manage_users',
          'manage_stores', 
          'manage_warehouses',
          'manage_products',
          'manage_inventory',
          'view_reports',
          'system_settings',
        ];
      case UserRole.WAREHOUSE_MANAGER:
        return [
          'manage_warehouses',
          'manage_products',
          'manage_inventory',
          'view_reports',
        ];
      case UserRole.STORE_MANAGER:
        return [
          'manage_store_inventory',
          'manage_store_products',
          'view_store_reports',
        ];
      case UserRole.STAFF:
        return [
          'view_inventory',
          'create_transactions',
        ];
      default:
        return [];
    }
  };

  const availablePermissions = [
    { id: 'manage_users', label: 'Manage Users' },
    { id: 'manage_stores', label: 'Manage Stores' },
    { id: 'manage_warehouses', label: 'Manage Warehouses' },
    { id: 'manage_products', label: 'Manage Products' },
    { id: 'manage_inventory', label: 'Manage Inventory' },
    { id: 'manage_store_inventory', label: 'Manage Store Inventory' },
    { id: 'manage_store_products', label: 'Manage Store Products' },
    { id: 'view_reports', label: 'View Reports' },
    { id: 'view_store_reports', label: 'View Store Reports' },
    { id: 'view_inventory', label: 'View Inventory' },
    { id: 'create_transactions', label: 'Create Transactions' },
    { id: 'system_settings', label: 'System Settings' },
  ];

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200">
            <div className="flex items-center space-x-3">
              <div className="h-10 w-10 bg-indigo-100 rounded-lg flex items-center justify-center">
                <User className="h-5 w-5 text-indigo-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  {isEditing ? 'Edit User' : 'Create New User'}
                </h2>
                <p className="text-sm text-gray-500">
                  {isEditing ? 'Update user information and permissions' : 'Add a new user to the system'}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit(handleFormSubmit)} className="p-6 space-y-6">
            {/* Basic Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-gray-900">Basic Information</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="Full Name *"
                  {...register('name')}
                  error={errors.name?.message}
                  placeholder="Enter full name"
                />

                <Input
                  label="Email Address *"
                  type="email"
                  {...register('email')}
                  error={errors.email?.message}
                  placeholder="user@example.com"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {!isEditing && (
                  <Input
                    label="Password *"
                    type="password"
                    {...register('password')}
                    error={errors.password?.message}
                    placeholder="Enter password"
                  />
                )}

                <Input
                  label="Phone Number"
                  type="tel"
                  {...register('phone')}
                  error={errors.phone?.message}
                  placeholder="+1 (555) 123-4567"
                />
              </div>
            </div>

            {/* Role and Access */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-gray-900">Role and Access</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Role *
                  </label>
                  <select
                    {...register('role')}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  >
                    <option value={UserRole.STAFF}>Staff</option>
                    <option value={UserRole.STORE_MANAGER}>Store Manager</option>
                    <option value={UserRole.WAREHOUSE_MANAGER}>Warehouse Manager</option>
                    <option value={UserRole.SUPER_ADMIN}>Super Admin</option>
                  </select>
                  {errors.role && (
                    <p className="mt-1 text-sm text-red-600">{errors.role.message}</p>
                  )}
                </div>

                <div className="flex items-center">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      {...register('isActive')}
                      className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="ml-2 text-sm text-gray-700">Active User</span>
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="Store ID"
                  {...register('storeId')}
                  error={errors.storeId?.message}
                  placeholder="Optional: Assign to store"
                />

                <Input
                  label="Warehouse ID"
                  {...register('warehouseId')}
                  error={errors.warehouseId?.message}
                  placeholder="Optional: Assign to warehouse"
                />
              </div>
            </div>

            {/* Permissions */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-gray-900">Permissions</h3>
              <p className="text-sm text-gray-500">
                Role-based permissions are automatically assigned. These are the default permissions for {selectedRole?.replace('_', ' ').toLowerCase()}:
              </p>
              
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {getRolePermissions(selectedRole).map((permission) => {
                  const permissionInfo = availablePermissions.find(p => p.id === permission);
                  return (
                    <div key={permission} className="flex items-center space-x-2 bg-gray-50 p-2 rounded">
                      <Shield className="h-4 w-4 text-green-600" />
                      <span className="text-sm text-gray-700">
                        {permissionInfo?.label || permission}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end space-x-4 pt-6 border-t border-gray-200">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                isLoading={isLoading}
                loadingText={isEditing ? 'Updating...' : 'Creating...'}
              >
                {isEditing ? 'Update User' : 'Create User'}
              </Button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default UserModal;