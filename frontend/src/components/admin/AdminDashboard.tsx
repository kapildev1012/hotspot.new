import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
    Activity,
    AlertTriangle,
    BarChart3,
    CheckCircle,
    Clock,
    PieChart,
    Store,
    TrendingUp,
    Users,
    Warehouse,
    Zap
} from 'lucide-react';
import React from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { alertsService } from '../../services/alerts';
import { userService } from '../../services/user';
import LoadingSpinner from '../ui/LoadingSpinner';

interface AdminDashboardProps {
  className?: string;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ className = '' }) => {
  const { user } = useAuth();

  // Fetch dashboard data
  const { data: userStats, isLoading: userStatsLoading } = useQuery({
    queryKey: ['admin', 'user-stats'],
    queryFn: userService.getUserStats,
  });

  const { data: alertStats, isLoading: alertStatsLoading } = useQuery({
    queryKey: ['admin', 'alert-stats'],
    queryFn: alertsService.getAlertStats,
  });

  const isLoading = userStatsLoading || alertStatsLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  const stats = [
    {
      title: 'Total Users',
      value: userStats?.data?.total || 0,
      change: '+12%',
      changeType: 'increase' as const,
      icon: Users,
      color: 'blue',
    },
    {
      title: 'Active Users',
      value: userStats?.data?.active || 0,
      change: '+5%',
      changeType: 'increase' as const,
      icon: CheckCircle,
      color: 'green',
    },
    {
      title: 'Active Alerts',
      value: alertStats?.data?.active || 0,
      change: '-8%',
      changeType: 'decrease' as const,
      icon: AlertTriangle,
      color: 'red',
    },
    {
      title: 'System Health',
      value: '98.5%',
      change: '+1.2%',
      changeType: 'increase' as const,
      icon: Activity,
      color: 'green',
    },
  ];

  const getStatColor = (color: string) => {
    switch (color) {
      case 'blue':
        return 'bg-blue-500';
      case 'green':
        return 'bg-green-500';
      case 'red':
        return 'bg-red-500';
      case 'yellow':
        return 'bg-yellow-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getChangeColor = (type: 'increase' | 'decrease') => {
    return type === 'increase' ? 'text-green-600' : 'text-red-600';
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Admin Dashboard</h1>
          <p className="mt-1 text-sm text-gray-500">
            Welcome back, {user?.name}. Here's what's happening in your system.
          </p>
        </div>
        <div className="mt-4 sm:mt-0 flex items-center space-x-3">
          <div className="flex items-center text-sm text-gray-500">
            <Zap className="h-4 w-4 mr-1 text-green-500" />
            System Online
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, index) => (
          <motion.div
            key={stat.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="bg-white rounded-lg shadow-sm border border-gray-200 p-6"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">{stat.title}</p>
                <p className="text-2xl font-semibold text-gray-900 mt-1">
                  {typeof stat.value === 'number' ? stat.value.toLocaleString() : stat.value}
                </p>
                <p className={`text-sm mt-1 ${getChangeColor(stat.changeType)}`}>
                  {stat.change} from last month
                </p>
              </div>
              <div className={`h-12 w-12 rounded-lg ${getStatColor(stat.color)} flex items-center justify-center`}>
                <stat.icon className="h-6 w-6 text-white" />
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* User Role Distribution */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-white rounded-lg shadow-sm border border-gray-200 p-6"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">User Distribution by Role</h3>
            <PieChart className="h-5 w-5 text-gray-400" />
          </div>
          <div className="space-y-4">
            {userStats?.data?.byRole && Object.entries(userStats.data.byRole).map(([role, count]) => (
              <div key={role} className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="h-3 w-3 bg-indigo-500 rounded-full"></div>
                  <span className="text-sm text-gray-600">
                    {role.replace('_', ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase())}
                  </span>
                </div>
                <span className="text-sm font-medium text-gray-900">{count}</span>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Alert Severity Distribution */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="bg-white rounded-lg shadow-sm border border-gray-200 p-6"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Alert Distribution by Severity</h3>
            <BarChart3 className="h-5 w-5 text-gray-400" />
          </div>
          <div className="space-y-4">
            {alertStats?.data?.bySeverity && Object.entries(alertStats.data.bySeverity).map(([severity, count]) => {
              const getSeverityColor = (sev: string) => {
                switch (sev.toUpperCase()) {
                  case 'CRITICAL': return 'bg-red-500';
                  case 'HIGH': return 'bg-orange-500';
                  case 'MEDIUM': return 'bg-yellow-500';
                  case 'LOW': return 'bg-blue-500';
                  default: return 'bg-gray-500';
                }
              };

              return (
                <div key={severity} className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className={`h-3 w-3 ${getSeverityColor(severity)} rounded-full`}></div>
                    <span className="text-sm text-gray-600">
                      {severity.charAt(0) + severity.slice(1).toLowerCase()}
                    </span>
                  </div>
                  <span className="text-sm font-medium text-gray-900">{count}</span>
                </div>
              );
            })}
          </div>
        </motion.div>
      </div>

      {/* Activity Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent User Registrations */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="bg-white rounded-lg shadow-sm border border-gray-200 p-6"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Recent User Activity</h3>
            <TrendingUp className="h-5 w-5 text-gray-400" />
          </div>
          <div className="space-y-3">
            {userStats?.data?.recentRegistrations?.slice(0, 5).map((item, index) => (
              <div key={index} className="flex items-center justify-between py-2">
                <span className="text-sm text-gray-600">
                  {new Date(item.date).toLocaleDateString()}
                </span>
                <span className="text-sm font-medium text-gray-900">
                  {item.count} new users
                </span>
              </div>
            ))}
            {(!userStats?.data?.recentRegistrations || userStats.data.recentRegistrations.length === 0) && (
              <p className="text-sm text-gray-500 text-center py-4">No recent activity</p>
            )}
          </div>
        </motion.div>

        {/* Top Stores by User Count */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="bg-white rounded-lg shadow-sm border border-gray-200 p-6"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Top Stores by Users</h3>
            <Store className="h-5 w-5 text-gray-400" />
          </div>
          <div className="space-y-3">
            {userStats?.data?.topStores?.slice(0, 5).map((store, index) => (
              <div key={store.storeId} className="flex items-center justify-between py-2">
                <div className="flex items-center space-x-3">
                  <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-1 rounded">
                    #{index + 1}
                  </span>
                  <span className="text-sm text-gray-900">
                    {store.storeId}
                  </span>
                </div>
                <span className="text-sm font-medium text-gray-600">
                  {store.userCount} users
                </span>
              </div>
            ))}
            {(!userStats?.data?.topStores || userStats.data.topStores.length === 0) && (
              <p className="text-sm text-gray-500 text-center py-4">No store data available</p>
            )}
          </div>
        </motion.div>
      </div>

      {/* System Status */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.8 }}
        className="bg-white rounded-lg shadow-sm border border-gray-200 p-6"
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">System Status</h3>
          <Activity className="h-5 w-5 text-gray-400" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="h-12 w-12 bg-green-100 rounded-lg flex items-center justify-center mx-auto mb-2">
              <CheckCircle className="h-6 w-6 text-green-600" />
            </div>
            <p className="text-sm font-medium text-gray-900">API Status</p>
            <p className="text-xs text-green-600">Operational</p>
          </div>
          <div className="text-center">
            <div className="h-12 w-12 bg-green-100 rounded-lg flex items-center justify-center mx-auto mb-2">
              <Warehouse className="h-6 w-6 text-green-600" />
            </div>
            <p className="text-sm font-medium text-gray-900">Database</p>
            <p className="text-xs text-green-600">Healthy</p>
          </div>
          <div className="text-center">
            <div className="h-12 w-12 bg-green-100 rounded-lg flex items-center justify-center mx-auto mb-2">
              <Zap className="h-6 w-6 text-green-600" />
            </div>
            <p className="text-sm font-medium text-gray-900">Real-time</p>
            <p className="text-xs text-green-600">Connected</p>
          </div>
          <div className="text-center">
            <div className="h-12 w-12 bg-yellow-100 rounded-lg flex items-center justify-center mx-auto mb-2">
              <Clock className="h-6 w-6 text-yellow-600" />
            </div>
            <p className="text-sm font-medium text-gray-900">Backup</p>
            <p className="text-xs text-yellow-600">2h ago</p>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default AdminDashboard;