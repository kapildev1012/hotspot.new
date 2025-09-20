import { AnimatePresence, motion } from 'framer-motion';
import {
    Bell,
    ChevronDown,
    Home,
    LogOut,
    Menu,
    Package,
    Settings,
    Store,
    TrendingUp,
    User,
    Users,
    Warehouse,
    X,
} from 'lucide-react';
import React, { useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext.js';
import { useSocket } from '../../contexts/SocketContext.js';
import { UserRole } from '../../types/index.js';

interface NavigationItem {
  name: string;
  href: string;
  icon: React.ReactNode;
  roles?: UserRole[];
  permissions?: string[];
}

const navigation: NavigationItem[] = [
  {
    name: 'Dashboard',
    href: '/dashboard',
    icon: <Home className="h-5 w-5" />,
  },
  {
    name: 'Products',
    href: '/products',
    icon: <Package className="h-5 w-5" />,
  },
  {
    name: 'Inventory',
    href: '/inventory',
    icon: <Store className="h-5 w-5" />,
  },
  {
    name: 'Stores',
    href: '/stores',
    icon: <Store className="h-5 w-5" />,
  },
  {
    name: 'Warehouses',
    href: '/warehouses',
    icon: <Warehouse className="h-5 w-5" />,
    roles: [UserRole.SUPER_ADMIN, UserRole.WAREHOUSE_MANAGER],
  },
  {
    name: 'Transactions',
    href: '/transactions',
    icon: <TrendingUp className="h-5 w-5" />,
  },
  {
    name: 'Alerts',
    href: '/alerts',
    icon: <Bell className="h-5 w-5" />,
  },
  {
    name: 'Users',
    href: '/users',
    icon: <Users className="h-5 w-5" />,
    roles: [UserRole.SUPER_ADMIN],
  },
  {
    name: 'Admin',
    href: '/admin',
    icon: <Settings className="h-5 w-5" />,
    roles: [UserRole.SUPER_ADMIN],
  },
];

const DashboardLayout: React.FC = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const { user, logout, hasRole } = useAuth();
  const { isConnected } = useSocket();
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const filteredNavigation = navigation.filter(item => {
    if (item.roles && item.roles.length > 0) {
      return hasRole(item.roles);
    }
    return true;
  });

  const isCurrentPath = (href: string) => {
    return location.pathname === href || location.pathname.startsWith(href + '/');
  };

  return (
    <div className="h-screen flex bg-gray-100">
      {/* Mobile sidebar */}
      <AnimatePresence>
        {sidebarOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 flex z-40 md:hidden"
            >
              <div
                className="fixed inset-0 bg-gray-600 bg-opacity-75"
                onClick={() => setSidebarOpen(false)}
              />
              
              <motion.div
                initial={{ x: -300 }}
                animate={{ x: 0 }}
                exit={{ x: -300 }}
                transition={{ duration: 0.3 }}
                className="relative flex-1 flex flex-col max-w-xs w-full bg-white"
              >
                <div className="absolute top-0 right-0 -mr-12 pt-2">
                  <button
                    className="ml-1 flex items-center justify-center h-10 w-10 rounded-full focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white"
                    onClick={() => setSidebarOpen(false)}
                  >
                    <X className="h-6 w-6 text-white" />
                  </button>
                </div>
                
                <SidebarContent
                  navigation={filteredNavigation}
                  isCurrentPath={isCurrentPath}
                  onNavigate={() => setSidebarOpen(false)}
                />
              </motion.div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Desktop sidebar */}
      <div className="hidden md:flex md:flex-shrink-0">
        <div className="flex flex-col w-64">
          <SidebarContent
            navigation={filteredNavigation}
            isCurrentPath={isCurrentPath}
          />
        </div>
      </div>

      {/* Main content */}
      <div className="flex flex-col w-0 flex-1 overflow-hidden">
        {/* Top navigation */}
        <div className="relative z-10 flex-shrink-0 flex h-16 bg-white shadow">
          <button
            className="px-4 border-r border-gray-200 text-gray-500 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-500 md:hidden"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-6 w-6" />
          </button>
          
          <div className="flex-1 px-4 flex justify-between">
            <div className="flex-1 flex items-center">
              <div className="flex items-center space-x-2">
                <div className={cn(
                  'h-2 w-2 rounded-full',
                  isConnected ? 'bg-green-400' : 'bg-red-400'
                )} />
                <span className="text-sm text-gray-500">
                  {isConnected ? 'Connected' : 'Disconnected'}
                </span>
              </div>
            </div>
            
            <div className="ml-4 flex items-center md:ml-6">
              {/* User menu */}
              <div className="ml-3 relative">
                <button
                  className="max-w-xs bg-white flex items-center text-sm rounded-full focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                >
                  <div className="flex items-center space-x-3 px-3 py-2">
                    <div className="h-8 w-8 bg-indigo-600 rounded-full flex items-center justify-center">
                      <User className="h-4 w-4 text-white" />
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-medium text-gray-900">
                        {user?.name}
                      </p>
                      <p className="text-xs text-gray-500">
                        {user?.role.replace('_', ' ').toLowerCase()}
                      </p>
                    </div>
                    <ChevronDown className="h-4 w-4 text-gray-400" />
                  </div>
                </button>

                <AnimatePresence>
                  {userMenuOpen && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ duration: 0.1 }}
                      className="origin-top-right absolute right-0 mt-2 w-48 rounded-md shadow-lg py-1 bg-white ring-1 ring-black ring-opacity-5 focus:outline-none"
                    >
                      <Link
                        to="/profile"
                        className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                        onClick={() => setUserMenuOpen(false)}
                      >
                        <Settings className="h-4 w-4 mr-3" />
                        Profile Settings
                      </Link>
                      <button
                        onClick={handleLogout}
                        className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                      >
                        <LogOut className="h-4 w-4 mr-3" />
                        Sign out
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
        </div>

        {/* Page content */}
        <main className="flex-1 relative overflow-y-auto focus:outline-none">
          <div className="py-6">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};

interface SidebarContentProps {
  navigation: NavigationItem[];
  isCurrentPath: (href: string) => boolean;
  onNavigate?: () => void;
}

const SidebarContent: React.FC<SidebarContentProps> = ({
  navigation,
  isCurrentPath,
  onNavigate,
}) => {
  return (
    <div className="flex flex-col h-full bg-white">
      {/* Logo */}
      <div className="flex items-center h-16 flex-shrink-0 px-4 bg-indigo-600">
        <div className="flex items-center space-x-3">
          <div className="h-8 w-8 bg-white rounded-lg flex items-center justify-center">
            <Package className="h-5 w-5 text-indigo-600" />
          </div>
          <h1 className="text-xl font-bold text-white">SmartStock</h1>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex-1 flex flex-col overflow-y-auto">
        <nav className="flex-1 px-2 py-4 space-y-1">
          {navigation
            .filter(item => {
              // Show item if no role restrictions or user has required role
              if (!item.roles || item.roles.length === 0) return true;
              return user && item.roles.includes(user.role);
            })
            .map((item) => {
            const current = isCurrentPath(item.href);
            return (
              <Link
                key={item.name}
                to={item.href}
                onClick={onNavigate}
                className={cn(
                  current
                    ? 'bg-indigo-100 text-indigo-900'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900',
                  'group flex items-center px-2 py-2 text-sm font-medium rounded-md transition-colors'
                )}
              >
                <span
                  className={cn(
                    current ? 'text-indigo-500' : 'text-gray-400 group-hover:text-gray-500',
                    'mr-3 flex-shrink-0'
                  )}
                >
                  {item.icon}
                </span>
                {item.name}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
};

function cn(...inputs: (string | undefined | null | boolean)[]): string {
  return inputs.filter(Boolean).join(' ');
}

export default DashboardLayout;