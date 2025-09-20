import {
    ApiResponse,
    PaginatedResponse,
    Transaction,
    TransactionType
} from '../types/index.js';
import apiService from './api.js';

export const transactionService = {
  async getTransactions(params?: {
    page?: number;
    limit?: number;
    type?: TransactionType;
    storeId?: string;
    productId?: string;
    dateFrom?: string;
    dateTo?: string;
  }): Promise<PaginatedResponse<Transaction>> {
    return apiService.get('/transactions', params);
  },

  async getTransaction(id: string): Promise<ApiResponse<{ transaction: Transaction }>> {
    return apiService.get(`/transactions/${id}`);
  },

  async createSale(data: {
    storeId: string;
    items: Array<{
      productId: string;
      quantity: number;
      price: number;
    }>;
    customerId?: string;
    notes?: string;
  }): Promise<ApiResponse<{ transaction: Transaction }>> {
    return apiService.post('/transactions/sale', data);
  },

  async createPurchase(data: {
    storeId: string;
    items: Array<{
      productId: string;
      quantity: number;
      cost: number;
      batchNumber?: string;
      expiryDate?: string;
    }>;
    supplierId?: string;
    notes?: string;
  }): Promise<ApiResponse<{ transaction: Transaction }>> {
    return apiService.post('/transactions/purchase', data);
  },

  async createTransfer(data: {
    fromStoreId: string;
    toStoreId: string;
    items: Array<{
      productId: string;
      quantity: number;
    }>;
    notes?: string;
  }): Promise<ApiResponse<{ transaction: Transaction }>> {
    return apiService.post('/transactions/transfer', data);
  },

  async createAdjustment(data: {
    storeId: string;
    items: Array<{
      productId: string;
      quantity: number;
      reason: string;
    }>;
    notes?: string;
  }): Promise<ApiResponse<{ transaction: Transaction }>> {
    return apiService.post('/transactions/adjustment', data);
  },

  async getStoreTransactions(
    storeId: string,
    params?: {
      page?: number;
      limit?: number;
      type?: TransactionType;
      dateFrom?: string;
      dateTo?: string;
    }
  ): Promise<PaginatedResponse<Transaction>> {
    return apiService.get(`/transactions/store/${storeId}`, params);
  },

  async getProductTransactions(
    productId: string,
    params?: {
      page?: number;
      limit?: number;
      storeId?: string;
      dateFrom?: string;
      dateTo?: string;
    }
  ): Promise<PaginatedResponse<Transaction>> {
    return apiService.get(`/transactions/product/${productId}`, params);
  },
};