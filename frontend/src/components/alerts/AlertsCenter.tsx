import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import {
    AlertTriangle,
    Archive,
    Bell,
    CheckCircle,
    Clock,
    RefreshCw,
    Search,
} from 'lucide-react';
import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { useSocket } from '../../contexts/SocketContext';
import { alertsService } from '../../services/alerts';
import type { Alert, AlertSeverity, AlertType } from '../../types';
import LoadingSpinner from '../ui/LoadingSpinner';

interface AlertsCenterProps {
  className?: string;
}

const AlertsCenter: React.FC<AlertsCenterProps> = ({ className = '' }) => {
  const [filter, setFilter] = useState<{
    severity?: AlertSeverity;
    type?: AlertType;
    status?: 'ACTIVE' | 'RESOLVED' | 'ARCHIVED';
  }>({});
  const [searchTerm, setSearchTerm] = useState('');
  const queryClient = useQueryClient();
  const { socket } = useSocket();

  // Fetch alerts
  const { data: alerts, isLoading, refetch } = useQuery({
    queryKey: ['alerts', filter, searchTerm],
    queryFn: () => alertsService.getAlerts({
      ...filter,
      search: searchTerm || undefined,
    }),
  });

  // Real-time alert updates
  React.useEffect(() => {
    if (!socket) return;

    const handleNewAlert = (alert: Alert) => {
      queryClient.setQueryData(['alerts', filter, searchTerm], (oldData: unknown) => {
        if (!oldData) return oldData;
        const data = oldData as { data: { alerts: Alert[] } };
        return {
          ...data,
          data: {
            ...data.data,
            alerts: [alert, ...data.data.alerts],
          },
        };
      });
    };

    const handleAlertUpdate = (updatedAlert: Alert) => {
      queryClient.setQueryData(['alerts', filter, searchTerm], (oldData: unknown) => {
        if (!oldData) return oldData;
        const data = oldData as { data: { alerts: Alert[] } };
        return {
          ...data,
          data: {
            ...data.data,
            alerts: data.data.alerts.map((alert: Alert) =>
              alert._id === updatedAlert._id ? updatedAlert : alert
            ),
          },
        };
      });
    };

    socket.on('alert:created', handleNewAlert);
    socket.on('alert:updated', handleAlertUpdate);

    return () => {
      socket.off('alert:created', handleNewAlert);
      socket.off('alert:updated', handleAlertUpdate);
    };
  }, [socket, queryClient, filter, searchTerm]);

  // Mutations
  const resolveAlertMutation = useMutation({
    mutationFn: alertsService.resolveAlert,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
      toast.success('Alert resolved successfully');
    },
    onError: () => {
      toast.error('Failed to resolve alert');
    },
  });

  const archiveAlertMutation = useMutation({
    mutationFn: alertsService.archiveAlert,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
      toast.success('Alert archived successfully');
    },
    onError: () => {
      toast.error('Failed to archive alert');
    },
  });

  const getSeverityColor = (severity: AlertSeverity) => {
    switch (severity) {
      case AlertSeverity.CRITICAL:
        return 'bg-red-100 text-red-800 border-red-200';
      case AlertSeverity.HIGH:
        return 'bg-orange-100 text-orange-800 border-orange-200';
      case AlertSeverity.MEDIUM:
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case AlertSeverity.LOW:
        return 'bg-blue-100 text-blue-800 border-blue-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getSeverityIcon = (severity: AlertSeverity) => {
    switch (severity) {
      case AlertSeverity.CRITICAL:
      case AlertSeverity.HIGH:
        return <AlertTriangle className="h-4 w-4" />;
      case AlertSeverity.MEDIUM:
        return <Clock className="h-4 w-4" />;
      case AlertSeverity.LOW:
        return <Bell className="h-4 w-4" />;
      default:
        return <Bell className="h-4 w-4" />;
    }
  };

  const getTypeColor = (type: AlertType) => {
    switch (type) {
      case AlertType.LOW_STOCK:
        return 'bg-red-50 text-red-700';
      case AlertType.OUT_OF_STOCK:
        return 'bg-red-50 text-red-700';
      case AlertType.EXPIRY_WARNING:
        return 'bg-orange-50 text-orange-700';
      case AlertType.EXPIRED_PRODUCTS:
        return 'bg-red-50 text-red-700';
      case AlertType.SYSTEM:
        return 'bg-blue-50 text-blue-700';
      default:
        return 'bg-gray-50 text-gray-700';
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Alerts Center</h1>
          <p className="mt-1 text-sm text-gray-500">
            Monitor and manage system alerts and notifications
          </p>
        </div>
        <div className="mt-4 sm:mt-0 flex items-center space-x-3">
          <button
            onClick={() => refetch()}
            className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </button>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="bg-white shadow rounded-lg p-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search alerts..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>

          {/* Severity Filter */}
          <select
            value={filter.severity || ''}
            onChange={(e) => setFilter({ ...filter, severity: e.target.value as AlertSeverity || undefined })}
            className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
          >
            <option value="">All Severities</option>
            <option value={AlertSeverity.CRITICAL}>Critical</option>
            <option value={AlertSeverity.HIGH}>High</option>
            <option value={AlertSeverity.MEDIUM}>Medium</option>
            <option value={AlertSeverity.LOW}>Low</option>
          </select>

          {/* Type Filter */}
          <select
            value={filter.type || ''}
            onChange={(e) => setFilter({ ...filter, type: e.target.value as AlertType || undefined })}
            className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
          >
            <option value="">All Types</option>
            <option value={AlertType.LOW_STOCK}>Low Stock</option>
            <option value={AlertType.OUT_OF_STOCK}>Out of Stock</option>
            <option value={AlertType.EXPIRY_WARNING}>Expiry Warning</option>
            <option value={AlertType.EXPIRED_PRODUCTS}>Expired Products</option>
            <option value={AlertType.SYSTEM}>System</option>
          </select>

          {/* Status Filter */}
          <select
            value={filter.status || ''}
            onChange={(e) => setFilter({ ...filter, status: (e.target.value as 'ACTIVE' | 'RESOLVED' | 'ARCHIVED') || undefined })}
            className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
          >
            <option value="">All Statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="RESOLVED">Resolved</option>
            <option value="ARCHIVED">Archived</option>
          </select>
        </div>
      </div>

      {/* Alerts List */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        {alerts?.data?.alerts?.length === 0 ? (
          <div className="text-center py-12">
            <Bell className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No alerts</h3>
            <p className="mt-1 text-sm text-gray-500">
              No alerts match your current filters.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            <AnimatePresence>
              {alerts?.data?.alerts?.map((alert: Alert) => (
                <motion.div
                  key={alert._id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="p-6 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-4 flex-1">
                      {/* Severity Icon */}
                      <div className={`flex-shrink-0 p-2 rounded-full border ${getSeverityColor(alert.severity)}`}>
                        {getSeverityIcon(alert.severity)}
                      </div>

                      {/* Alert Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2 mb-2">
                          <h3 className="text-sm font-medium text-gray-900 truncate">
                            {alert.title}
                          </h3>
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getTypeColor(alert.type)}`}>
                            {alert.type.replace('_', ' ').toLowerCase()}
                          </span>
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getSeverityColor(alert.severity)}`}>
                            {alert.severity.toLowerCase()}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 mb-2">
                          {alert.message}
                        </p>
                        <div className="flex items-center text-xs text-gray-500 space-x-4">
                          <span>
                            {new Date(alert.createdAt).toLocaleString()}
                          </span>
                          {alert.storeId && (
                            <span>Store: {alert.storeId}</span>
                          )}
                          {alert.productId && (
                            <span>Product: {alert.productId}</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    {alert.status === 'ACTIVE' && (
                      <div className="flex items-center space-x-2 ml-4">
                        <button
                          onClick={() => resolveAlertMutation.mutate(alert._id)}
                          disabled={resolveAlertMutation.isPending}
                          className="inline-flex items-center px-3 py-1 border border-transparent text-xs font-medium rounded text-green-700 bg-green-100 hover:bg-green-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50"
                        >
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Resolve
                        </button>
                        <button
                          onClick={() => archiveAlertMutation.mutate(alert._id)}
                          disabled={archiveAlertMutation.isPending}
                          className="inline-flex items-center px-3 py-1 border border-transparent text-xs font-medium rounded text-gray-700 bg-gray-100 hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 disabled:opacity-50"
                        >
                          <Archive className="h-3 w-3 mr-1" />
                          Archive
                        </button>
                      </div>
                    )}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
};

export default AlertsCenter;