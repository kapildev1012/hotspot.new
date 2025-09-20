import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ProductList from '../../../src/components/products/ProductList';
import { productService } from '../../../src/services/products';

// Mock the product service
vi.mock('../../../src/services/products', () => ({
  productService: {
    getProducts: vi.fn(),
    createProduct: vi.fn(),
    updateProduct: vi.fn(),
    deleteProduct: vi.fn(),
    exportProducts: vi.fn(),
    importProducts: vi.fn(),
  },
}));

// Mock react-hot-toast
vi.mock('react-hot-toast', () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
    loading: vi.fn(),
  },
}));

const MockedProductService = productService as any;

const TestWrapper = ({ children }: { children: React.ReactNode }) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
};

const mockProducts = [
  {
    _id: '1',
    name: 'Test Product 1',
    sku: 'TEST-001',
    category: 'Electronics',
    description: 'A test product',
    price: 99.99,
    cost: 49.99,
    unit: 'piece',
    imageUrl: 'https://example.com/image1.jpg',
    alertThreshold: 10,
    hasShelfLife: false,
    tags: ['test', 'electronics'],
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    _id: '2',
    name: 'Test Product 2',
    sku: 'TEST-002',
    category: 'Home & Garden',
    description: 'Another test product',
    price: 149.99,
    cost: 74.99,
    unit: 'piece',
    imageUrl: 'https://example.com/image2.jpg',
    alertThreshold: 5,
    hasShelfLife: true,
    shelfLifeDays: 365,
    tags: ['test', 'home'],
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

const mockProductsResponse = {
  success: true,
  data: {
    products: mockProducts,
    pagination: {
      page: 1,
      limit: 12,
      total: 2,
      pages: 1,
    },
  },
};

describe('ProductList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    MockedProductService.getProducts.mockResolvedValue(mockProductsResponse);
  });

  it('renders product list correctly', async () => {
    render(
      <TestWrapper>
        <ProductList />
      </TestWrapper>
    );

    expect(screen.getByText(/product catalog/i)).toBeInTheDocument();
    expect(screen.getByText(/manage your product inventory/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /add product/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /export/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /import/i })).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Test Product 1')).toBeInTheDocument();
      expect(screen.getByText('Test Product 2')).toBeInTheDocument();
    });
  });

  it('displays loading state initially', () => {
    MockedProductService.getProducts.mockImplementation(
      () => new Promise((resolve) => setTimeout(resolve, 1000))
    );

    render(
      <TestWrapper>
        <ProductList />
      </TestWrapper>
    );

    expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
  });

  it('filters products by search term', async () => {
    render(
      <TestWrapper>
        <ProductList />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('Test Product 1')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(/search products/i);
    fireEvent.change(searchInput, { target: { value: 'Electronics' } });

    await waitFor(() => {
      expect(MockedProductService.getProducts).toHaveBeenCalledWith(
        expect.objectContaining({
          search: 'Electronics',
        })
      );
    });
  });

  it('filters products by category', async () => {
    render(
      <TestWrapper>
        <ProductList />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('Test Product 1')).toBeInTheDocument();
    });

    const categorySelect = screen.getByDisplayValue(/all categories/i);
    fireEvent.change(categorySelect, { target: { value: 'Electronics' } });

    await waitFor(() => {
      expect(MockedProductService.getProducts).toHaveBeenCalledWith(
        expect.objectContaining({
          category: 'Electronics',
        })
      );
    });
  });

  it('opens add product modal when clicking add button', async () => {
    render(
      <TestWrapper>
        <ProductList />
      </TestWrapper>
    );

    const addButton = screen.getByRole('button', { name: /add product/i });
    fireEvent.click(addButton);

    await waitFor(() => {
      expect(screen.getByText(/create new product/i)).toBeInTheDocument();
    });
  });

  it('opens edit modal when clicking edit button on product card', async () => {
    render(
      <TestWrapper>
        <ProductList />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('Test Product 1')).toBeInTheDocument();
    });

    const editButtons = screen.getAllByRole('button', { name: /edit/i });
    fireEvent.click(editButtons[0]);

    await waitFor(() => {
      expect(screen.getByText(/edit product/i)).toBeInTheDocument();
    });
  });

  it('handles pagination correctly', async () => {
    const mockPaginatedResponse = {
      ...mockProductsResponse,
      data: {
        ...mockProductsResponse.data,
        pagination: {
          page: 1,
          limit: 12,
          total: 25,
          pages: 3,
        },
      },
    };

    MockedProductService.getProducts.mockResolvedValue(mockPaginatedResponse);

    render(
      <TestWrapper>
        <ProductList />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText(/page 1 of 3/i)).toBeInTheDocument();
    });

    const nextButton = screen.getByRole('button', { name: /next/i });
    fireEvent.click(nextButton);

    await waitFor(() => {
      expect(MockedProductService.getProducts).toHaveBeenCalledWith(
        expect.objectContaining({
          page: 2,
        })
      );
    });
  });

  it('displays empty state when no products found', async () => {
    MockedProductService.getProducts.mockResolvedValue({
      success: true,
      data: {
        products: [],
        pagination: {
          page: 1,
          limit: 12,
          total: 0,
          pages: 0,
        },
      },
    });

    render(
      <TestWrapper>
        <ProductList />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText(/no products found/i)).toBeInTheDocument();
      expect(screen.getByText(/start by adding your first product/i)).toBeInTheDocument();
    });
  });

  it('handles export functionality', async () => {
    MockedProductService.exportProducts.mockResolvedValue({
      success: true,
      data: { downloadUrl: 'https://example.com/export.csv' },
    });

    render(
      <TestWrapper>
        <ProductList />
      </TestWrapper>
    );

    const exportButton = screen.getByRole('button', { name: /export/i });
    fireEvent.click(exportButton);

    await waitFor(() => {
      expect(MockedProductService.exportProducts).toHaveBeenCalledWith({
        format: 'csv',
        filters: expect.any(Object),
      });
    });
  });

  it('handles import functionality', async () => {
    render(
      <TestWrapper>
        <ProductList />
      </TestWrapper>
    );

    const importButton = screen.getByRole('button', { name: /import/i });
    fireEvent.click(importButton);

    // Check if file input is triggered or import modal opens
    const fileInput = screen.getByLabelText(/upload file/i);
    expect(fileInput).toBeInTheDocument();
  });

  it('displays product details correctly', async () => {
    render(
      <TestWrapper>
        <ProductList />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('Test Product 1')).toBeInTheDocument();
      expect(screen.getByText('TEST-001')).toBeInTheDocument();
      expect(screen.getByText('Electronics')).toBeInTheDocument();
      expect(screen.getByText('$99.99')).toBeInTheDocument();
    });
  });

  it('handles error state gracefully', async () => {
    MockedProductService.getProducts.mockRejectedValue(new Error('API Error'));

    render(
      <TestWrapper>
        <ProductList />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText(/failed to load products/i)).toBeInTheDocument();
    });
  });
});