import {
    ApiResponse,
    AuthResponse,
    LoginRequest,
    RegisterRequest,
    User
} from '../types/index.js';
import apiService from './api.js';

export const authService = {
  async login(credentials: LoginRequest): Promise<AuthResponse> {
    const response = await apiService.post<AuthResponse['data']>('/auth/login', credentials);
    return response as AuthResponse;
  },

  async register(userData: RegisterRequest): Promise<AuthResponse> {
    const response = await apiService.post<AuthResponse['data']>('/auth/register', userData);
    return response as AuthResponse;
  },

  async logout(): Promise<ApiResponse> {
    const refreshToken = localStorage.getItem('refreshToken');
    const response = await apiService.post('/auth/logout', { refreshToken });
    
    // Clear local storage
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    
    return response;
  },

  async refreshToken(): Promise<ApiResponse<{ accessToken: string }>> {
    const refreshToken = localStorage.getItem('refreshToken');
    return apiService.post('/auth/refresh', { refreshToken });
  },

  async getProfile(): Promise<ApiResponse<{ user: User }>> {
    return apiService.get('/auth/profile');
  },

  async updateProfile(userData: Partial<User>): Promise<ApiResponse<{ user: User }>> {
    return apiService.put('/auth/profile', userData);
  },

  async changePassword(data: { 
    currentPassword: string; 
    newPassword: string; 
  }): Promise<ApiResponse> {
    return apiService.post('/auth/change-password', data);
  },

  async forgotPassword(email: string): Promise<ApiResponse> {
    return apiService.post('/auth/forgot-password', { email });
  },

  async resetPassword(data: {
    token: string;
    password: string;
  }): Promise<ApiResponse> {
    return apiService.post('/auth/reset-password', data);
  },
};