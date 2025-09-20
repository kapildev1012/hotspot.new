import {
    ApiResponse,
    PaginatedResponse,
    Product,
    ProductFormData
} from '../types/index.js';
import apiService from './api.js';

export const productService = {
  async getProducts(params?: {
    page?: number;
    limit?: number;
    search?: string;
    category?: string;
    isActive?: boolean;
  }): Promise<PaginatedResponse<Product>> {
    return apiService.get('/products', params);
  },

  async getProduct(id: string): Promise<ApiResponse<{ product: Product }>> {
    return apiService.get(`/products/${id}`);
  },

  async createProduct(data: ProductFormData): Promise<ApiResponse<{ product: Product }>> {
    if (data.image) {
      const formData = new FormData();
      Object.entries(data).forEach(([key, value]) => {
        if (key === 'image' && value instanceof File) {
          formData.append('image', value);
        } else if (key === 'specifications' || key === 'tags') {
          formData.append(key, JSON.stringify(value));
        } else {
          formData.append(key, String(value));
        }
      });
      return apiService.uploadFile('/products', formData);
    } else {
      const { image, ...productData } = data;
      return apiService.post('/products', productData);
    }
  },

  async updateProduct(
    id: string, 
    data: Partial<ProductFormData>
  ): Promise<ApiResponse<{ product: Product }>> {
    if (data.image) {
      const formData = new FormData();
      Object.entries(data).forEach(([key, value]) => {
        if (key === 'image' && value instanceof File) {
          formData.append('image', value);
        } else if (key === 'specifications' || key === 'tags') {
          formData.append(key, JSON.stringify(value));
        } else if (value !== undefined) {
          formData.append(key, String(value));
        }
      });
      return apiService.uploadFile(`/products/${id}`, formData);
    } else {
      const { image, ...productData } = data;
      return apiService.put(`/products/${id}`, productData);
    }
  },

  async deleteProduct(id: string): Promise<ApiResponse> {
    return apiService.delete(`/products/${id}`);
  },

  async getProductCategories(): Promise<ApiResponse<{ categories: string[] }>> {
    return apiService.get('/products/categories');
  },

  async searchProducts(query: string): Promise<ApiResponse<{ products: Product[] }>> {
    return apiService.get('/products/search', { q: query });
  },

  async updateProductImage(
    id: string, 
    image: File
  ): Promise<ApiResponse<{ product: Product }>> {
    const formData = new FormData();
    formData.append('image', image);
    return apiService.uploadFile(`/products/${id}/image`, formData);
  },

  async removeProductImage(id: string): Promise<ApiResponse<{ product: Product }>> {
    return apiService.delete(`/products/${id}/image`);
  },
};