import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import DashboardLayout from '../../../src/components/layout/DashboardLayout';
import { AuthProvider } from '../../../src/contexts/AuthContext';
import { SocketProvider } from '../../../src/contexts/SocketContext';
import { UserRole } from '../../../src/types';

// Mock the auth context
const mockUser = {
  _id: '1',
  id: '1',
  name: 'John Doe',
  email: 'john@example.com',
  role: UserRole.STAFF,
  permissions: ['view_inventory'],
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockAuthContext = {
  user: mockUser,
  isAuthenticated: true,
  isLoading: false,
  error: null,
  login: vi.fn(),
  logout: vi.fn(),
  updateUser: vi.fn(),
  clearError: vi.fn(),
  hasPermission: vi.fn(() => true),
  hasRole: vi.fn(() => true),
};

vi.mock('../../../src/contexts/AuthContext', () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
  useAuth: () => mockAuthContext,
}));

// Mock the socket context
const mockSocketContext = {
  socket: null,
  isConnected: true,
  emit: vi.fn(),
};

vi.mock('../../../src/contexts/SocketContext', () => ({
  SocketProvider: ({ children }: { children: React.ReactNode }) => children,
  useSocket: () => mockSocketContext,
}));

// Mock react-router-dom
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useLocation: () => ({ pathname: '/dashboard' }),
    useNavigate: () => vi.fn(),
    Outlet: () => <div data-testid=\"outlet\">Outlet Content</div>,
  };
});

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
      <BrowserRouter>
        <AuthProvider>
          <SocketProvider>
            {children}
          </SocketProvider>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
};

describe('DashboardLayout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders dashboard layout correctly', () => {
    render(
      <TestWrapper>
        <DashboardLayout />
      </TestWrapper>
    );

    expect(screen.getByText('SmartStock')).toBeInTheDocument();
    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByTestId('outlet')).toBeInTheDocument();
  });

  it('displays navigation items for staff user', () => {
    render(
      <TestWrapper>
        <DashboardLayout />
      </TestWrapper>
    );

    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Products')).toBeInTheDocument();
    expect(screen.getByText('Inventory')).toBeInTheDocument();
    expect(screen.getByText('Stores')).toBeInTheDocument();
    expect(screen.getByText('Transactions')).toBeInTheDocument();
    expect(screen.getByText('Alerts')).toBeInTheDocument();
  });

  it('hides admin navigation for non-admin users', () => {
    mockAuthContext.hasRole = vi.fn((roles) => {
      if (Array.isArray(roles)) {
        return roles.includes(UserRole.STAFF);
      }
      return roles === UserRole.STAFF;
    });

    render(
      <TestWrapper>
        <DashboardLayout />
      </TestWrapper>
    );

    expect(screen.queryByText('Users')).not.toBeInTheDocument();
    expect(screen.queryByText('Admin')).not.toBeInTheDocument();
  });

  it('shows admin navigation for super admin users', () => {
    const adminUser = {
      ...mockUser,
      role: UserRole.SUPER_ADMIN,
    };

    mockAuthContext.user = adminUser;
    mockAuthContext.hasRole = vi.fn(() => true);

    render(
      <TestWrapper>
        <DashboardLayout />
      </TestWrapper>
    );

    expect(screen.getByText('Users')).toBeInTheDocument();
    expect(screen.getByText('Admin')).toBeInTheDocument();
  });

  it('displays connection status', () => {
    render(
      <TestWrapper>
        <DashboardLayout />
      </TestWrapper>
    );

    expect(screen.getByText('Connected')).toBeInTheDocument();
  });

  it('displays disconnected status when socket is disconnected', () => {
    mockSocketContext.isConnected = false;

    render(
      <TestWrapper>
        <DashboardLayout />
      </TestWrapper>
    );

    expect(screen.getByText('Disconnected')).toBeInTheDocument();
  });

  it('displays user role correctly', () => {
    render(
      <TestWrapper>
        <DashboardLayout />
      </TestWrapper>
    );

    expect(screen.getByText('staff')).toBeInTheDocument();
  });

  it('handles user menu interactions', () => {
    render(
      <TestWrapper>
        <DashboardLayout />
      </TestWrapper>
    );

    const userMenuButton = screen.getByRole('button', { name: /user menu/i });
    expect(userMenuButton).toBeInTheDocument();
  });

  it('handles mobile sidebar toggle', () => {
    render(
      <TestWrapper>
        <DashboardLayout />
      </TestWrapper>
    );

    const mobileMenuButton = screen.getByRole('button', { name: /open sidebar/i });
    expect(mobileMenuButton).toBeInTheDocument();
  });

  it('renders warehouse navigation for warehouse managers', () => {
    const warehouseUser = {
      ...mockUser,
      role: UserRole.WAREHOUSE_MANAGER,
    };

    mockAuthContext.user = warehouseUser;
    mockAuthContext.hasRole = vi.fn((roles) => {
      if (Array.isArray(roles)) {
        return roles.includes(UserRole.WAREHOUSE_MANAGER) || roles.includes(UserRole.SUPER_ADMIN);
      }
      return roles === UserRole.WAREHOUSE_MANAGER || roles === UserRole.SUPER_ADMIN;
    });

    render(
      <TestWrapper>
        <DashboardLayout />
      </TestWrapper>
    );

    expect(screen.getByText('Warehouses')).toBeInTheDocument();
  });

  it('highlights current navigation item', () => {
    render(
      <TestWrapper>
        <DashboardLayout />
      </TestWrapper>
    );

    const dashboardLink = screen.getByRole('link', { name: /dashboard/i });
    expect(dashboardLink).toHaveClass('bg-indigo-100', 'text-indigo-900');
  });
});