import axios from 'axios';
import { Alert, AlertSeverity, AlertType, ApiResponse, PaginatedResponse } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

interface AlertFilters {
  severity?: AlertSeverity;
  type?: AlertType;
  status?: 'ACTIVE' | 'RESOLVED' | 'ARCHIVED';
  storeId?: string;
  productId?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export const alertsService = {
  // Get alerts with filters
  async getAlerts(filters: AlertFilters = {}): Promise<PaginatedResponse<Alert>> {
    const params = new URLSearchParams();
    
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== '') {
        params.append(key, value.toString());
      }
    });

    const response = await axios.get(`${API_BASE_URL}/alerts?${params.toString()}`, {
      headers: {
        Authorization: `Bearer ${localStorage.getItem('token')}`,
      },
    });
    
    return response.data;
  },

  // Get alert by ID
  async getAlert(id: string): Promise<ApiResponse<Alert>> {
    const response = await axios.get(`${API_BASE_URL}/alerts/${id}`, {
      headers: {
        Authorization: `Bearer ${localStorage.getItem('token')}`,
      },
    });
    
    return response.data;
  },

  // Create manual alert
  async createAlert(alertData: {
    title: string;
    message: string;
    type: AlertType;
    severity: AlertSeverity;
    storeId?: string;
    productId?: string;
    metadata?: Record<string, any>;
  }): Promise<ApiResponse<Alert>> {
    const response = await axios.post(`${API_BASE_URL}/alerts`, alertData, {
      headers: {
        Authorization: `Bearer ${localStorage.getItem('token')}`,
        'Content-Type': 'application/json',
      },
    });
    
    return response.data;
  },

  // Resolve alert
  async resolveAlert(id: string): Promise<ApiResponse<Alert>> {
    const response = await axios.patch(`${API_BASE_URL}/alerts/${id}/resolve`, {}, {
      headers: {
        Authorization: `Bearer ${localStorage.getItem('token')}`,
      },
    });
    
    return response.data;
  },

  // Archive alert
  async archiveAlert(id: string): Promise<ApiResponse<Alert>> {
    const response = await axios.patch(`${API_BASE_URL}/alerts/${id}/archive`, {}, {
      headers: {
        Authorization: `Bearer ${localStorage.getItem('token')}`,
      },
    });
    
    return response.data;
  },

  // Delete alert (admin only)
  async deleteAlert(id: string): Promise<ApiResponse> {
    const response = await axios.delete(`${API_BASE_URL}/alerts/${id}`, {
      headers: {
        Authorization: `Bearer ${localStorage.getItem('token')}`,
      },
    });
    
    return response.data;
  },

  // Get alert statistics
  async getAlertStats(): Promise<ApiResponse<{
    total: number;
    active: number;
    resolved: number;
    archived: number;
    bySeverity: Record<AlertSeverity, number>;
    byType: Record<AlertType, number>;
    recentActivity: Array<{
      date: string;
      count: number;
    }>;
  }>> {
    const response = await axios.get(`${API_BASE_URL}/alerts/stats`, {
      headers: {
        Authorization: `Bearer ${localStorage.getItem('token')}`,
      },
    });
    
    return response.data;
  },

  // Mark multiple alerts as read
  async markAlertsAsRead(alertIds: string[]): Promise<ApiResponse> {
    const response = await axios.patch(`${API_BASE_URL}/alerts/mark-read`, 
      { alertIds }, 
      {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json',
        },
      }
    );
    
    return response.data;
  },

  // Get unread alerts count
  async getUnreadCount(): Promise<ApiResponse<{ count: number }>> {
    const response = await axios.get(`${API_BASE_URL}/alerts/unread-count`, {
      headers: {
        Authorization: `Bearer ${localStorage.getItem('token')}`,
      },
    });
    
    return response.data;
  },
};