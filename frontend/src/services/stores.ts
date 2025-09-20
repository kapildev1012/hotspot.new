import {
    ApiResponse,
    PaginatedResponse,
    Store,
    StoreFormData
} from '../types/index.js';
import apiService from './api.js';

export const storeService = {
  async getStores(params?: {
    page?: number;
    limit?: number;
    search?: string;
    warehouseId?: string;
    storeType?: string;
    status?: string;
    isActive?: boolean;
  }): Promise<PaginatedResponse<Store>> {
    return apiService.get('/stores', params);
  },

  async getStore(id: string, includeInventory?: boolean): Promise<ApiResponse<{ 
    store: Store; 
    inventory?: Array<{ 
      product: any; 
      quantity: number; 
      reserved: number; 
      available: number; 
    }>;
  }>> {
    return apiService.get(`/stores/${id}`, { includeInventory });
  },

  async createStore(data: StoreFormData): Promise<ApiResponse<{ store: Store }>> {
    return apiService.post('/stores', data);
  },

  async updateStore(
    id: string, 
    data: Partial<StoreFormData>
  ): Promise<ApiResponse<{ store: Store }>> {
    return apiService.put(`/stores/${id}`, data);
  },

  async deleteStore(id: string): Promise<ApiResponse> {
    return apiService.delete(`/stores/${id}`);
  },

  async getStoreInventory(
    id: string,
    params?: {
      page?: number;
      limit?: number;
      search?: string;
      category?: string;
      lowStock?: boolean;
    }
  ): Promise<PaginatedResponse<{
    product: any;
    quantity: number;
    reserved: number;
    available: number;
    threshold: number;
    isLowStock: boolean;
  }>> {
    return apiService.get(`/stores/${id}/inventory`, params);
  },

  async getStoresByWarehouse(warehouseId: string): Promise<ApiResponse<{ stores: Store[] }>> {
    return apiService.get(`/stores/warehouse/${warehouseId}`);
  },

  async getLowStockProducts(
    storeId?: string,
    params?: { page?: number; limit?: number }
  ): Promise<PaginatedResponse<{
    store: Store;
    product: any;
    quantity: number;
    threshold: number;
  }>> {
    const url = storeId ? `/stores/${storeId}/low-stock` : '/stores/low-stock';
    return apiService.get(url, params);
  },
};