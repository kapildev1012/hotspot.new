import axios from 'axios';
import { ApiResponse, PaginatedResponse, User, UserRole } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

interface UserFilters {
  role?: UserRole;
  status?: 'ACTIVE' | 'INACTIVE';
  storeId?: string;
  warehouseId?: string;
  search?: string;
  page?: number;
  limit?: number;
}

interface CreateUserData {
  name: string;
  email: string;
  password: string;
  phone?: string;
  role: UserRole;
  storeId?: string;
  warehouseId?: string;
  permissions?: string[];
  isActive?: boolean;
}

interface UpdateUserData {
  name?: string;
  email?: string;
  password?: string;
  phone?: string;
  role?: UserRole;
  storeId?: string;
  warehouseId?: string;
  permissions?: string[];
  isActive?: boolean;
}

export const userService = {
  // Get users with filters
  async getUsers(filters: UserFilters = {}): Promise<PaginatedResponse<User>> {
    const params = new URLSearchParams();
    
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== '') {
        params.append(key, value.toString());
      }
    });

    const response = await axios.get(`${API_BASE_URL}/users?${params.toString()}`, {
      headers: {
        Authorization: `Bearer ${localStorage.getItem('token')}`,
      },
    });
    
    return response.data;
  },

  // Get user by ID
  async getUser(id: string): Promise<ApiResponse<User>> {
    const response = await axios.get(`${API_BASE_URL}/users/${id}`, {
      headers: {
        Authorization: `Bearer ${localStorage.getItem('token')}`,
      },
    });
    
    return response.data;
  },

  // Create new user
  async createUser(userData: CreateUserData): Promise<ApiResponse<User>> {
    const response = await axios.post(`${API_BASE_URL}/users`, userData, {
      headers: {
        Authorization: `Bearer ${localStorage.getItem('token')}`,
        'Content-Type': 'application/json',
      },
    });
    
    return response.data;
  },

  // Update user
  async updateUser(id: string, userData: UpdateUserData): Promise<ApiResponse<User>> {
    const response = await axios.patch(`${API_BASE_URL}/users/${id}`, userData, {
      headers: {
        Authorization: `Bearer ${localStorage.getItem('token')}`,
        'Content-Type': 'application/json',
      },
    });
    
    return response.data;
  },

  // Delete user
  async deleteUser(id: string): Promise<ApiResponse> {
    const response = await axios.delete(`${API_BASE_URL}/users/${id}`, {
      headers: {
        Authorization: `Bearer ${localStorage.getItem('token')}`,
      },
    });
    
    return response.data;
  },

  // Get current user profile
  async getProfile(): Promise<ApiResponse<User>> {
    const response = await axios.get(`${API_BASE_URL}/users/profile`, {
      headers: {
        Authorization: `Bearer ${localStorage.getItem('token')}`,
      },
    });
    
    return response.data;
  },

  // Update current user profile
  async updateProfile(userData: {
    name?: string;
    email?: string;
    phone?: string;
    currentPassword?: string;
    newPassword?: string;
  }): Promise<ApiResponse<User>> {
    const response = await axios.patch(`${API_BASE_URL}/users/profile`, userData, {
      headers: {
        Authorization: `Bearer ${localStorage.getItem('token')}`,
        'Content-Type': 'application/json',
      },
    });
    
    return response.data;
  },

  // Get user statistics
  async getUserStats(): Promise<ApiResponse<{
    total: number;
    active: number;
    inactive: number;
    byRole: Record<UserRole, number>;
    recentRegistrations: Array<{
      date: string;
      count: number;
    }>;
    topStores: Array<{
      storeId: string;
      userCount: number;
    }>;
  }>> {
    const response = await axios.get(`${API_BASE_URL}/users/stats`, {
      headers: {
        Authorization: `Bearer ${localStorage.getItem('token')}`,
      },
    });
    
    return response.data;
  },

  // Assign user to store
  async assignToStore(userId: string, storeId: string): Promise<ApiResponse<User>> {
    const response = await axios.patch(`${API_BASE_URL}/users/${userId}/assign-store`, 
      { storeId }, 
      {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json',
        },
      }
    );
    
    return response.data;
  },

  // Remove user from store
  async removeFromStore(userId: string): Promise<ApiResponse<User>> {
    const response = await axios.patch(`${API_BASE_URL}/users/${userId}/remove-store`, {}, {
      headers: {
        Authorization: `Bearer ${localStorage.getItem('token')}`,
      },
    });
    
    return response.data;
  },

  // Update user permissions
  async updatePermissions(userId: string, permissions: string[]): Promise<ApiResponse<User>> {
    const response = await axios.patch(`${API_BASE_URL}/users/${userId}/permissions`, 
      { permissions }, 
      {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json',
        },
      }
    );
    
    return response.data;
  },

  // Bulk operations
  async bulkUpdateUsers(userIds: string[], updates: UpdateUserData): Promise<ApiResponse> {
    const response = await axios.patch(`${API_BASE_URL}/users/bulk-update`, 
      { userIds, updates }, 
      {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json',
        },
      }
    );
    
    return response.data;
  },

  // Reset password
  async resetPassword(userId: string): Promise<ApiResponse<{ temporaryPassword: string }>> {
    const response = await axios.post(`${API_BASE_URL}/users/${userId}/reset-password`, {}, {
      headers: {
        Authorization: `Bearer ${localStorage.getItem('token')}`,
      },
    });
    
    return response.data;
  },
};