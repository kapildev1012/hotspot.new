# SmartStock - Inventory Management System

A comprehensive full-stack inventory management system built with modern web technologies.

## Features

- **Multi-Role Authentication**: JWT-based authentication with 6 distinct roles (Super Admin, Warehouse Manager, Store Manager, Staff, Auditor, Viewer)
- **Real-time Updates**: Socket.IO integration for live inventory updates and notifications
- **Inventory Management**: Complete product, batch, and stock tracking across multiple stores and warehouses
- **Alert System**: Automated alerts for low stock, expiry warnings, and suspicious activities
- **Transaction Tracking**: Comprehensive audit trail for all inventory movements
- **Responsive UI**: Modern React interface with Tailwind CSS
- **Data Import/Export**: CSV and Excel support for bulk operations

## Tech Stack

### Backend
- **Runtime**: Node.js 22.11.0
- **Framework**: Express.js with TypeScript
- **Database**: MongoDB with Mongoose ODM
- **Authentication**: JWT with refresh tokens
- **Real-time**: Socket.IO
- **Caching**: Redis (optional)
- **File Upload**: Cloudinary integration
- **Validation**: Zod schemas
- **Testing**: Jest

### Frontend
- **Framework**: React 19+ with TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS v4
- **State Management**: React Query (TanStack Query)
- **Forms**: React Hook Form with Zod validation
- **UI Components**: Headless UI, Lucide React icons
- **Animations**: Framer Motion
- **Testing**: Vitest with React Testing Library

## Getting Started

### Prerequisites
- Node.js 20.19+ or 22.12+ (currently running 22.11.0 with warnings)
- MongoDB (local or Atlas)
- Redis (optional, for caching)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/kapildev1012/hotspot.new.git
   cd hotspot.new
   ```

2. **Backend Setup**
   ```bash
   cd backend
   npm install
   cp .env.example .env
   # Configure your environment variables
   npm run dev
   ```

3. **Frontend Setup**
   ```bash
   cd frontend
   npm install --legacy-peer-deps
   cp .env.example .env
   # Configure your environment variables
   npm run dev
   ```

### Environment Configuration

#### Backend (.env)
```
MONGO_URI=mongodb+srv://kapildev16june:kapildev16june@cluster0.sem9x.mongodb.net/smartstock
JWT_SECRET=greatstack
CLOUDINARY_CLOUD_NAME=dkdkibeel
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=greatstack123
```

#### Frontend (.env)
```
VITE_API_URL=http://localhost:3001/api
VITE_SOCKET_URL=http://localhost:3001
VITE_APP_NAME=SmartStock
VITE_APP_VERSION=1.0.0
```

## Docker Deployment

The application includes Docker configuration for easy deployment:

```bash
# Development
docker-compose -f docker-compose.dev.yml up

# Production
docker-compose up -d
```

## API Endpoints

- **Authentication**: `/api/auth/*`
- **Users**: `/api/users/*`
- **Products**: `/api/products/*`
- **Stores**: `/api/stores/*`
- **Warehouses**: `/api/warehouses/*`
- **Transactions**: `/api/transactions/*`
- **Alerts**: `/api/alerts/*`
- **Import/Export**: `/api/import-export/*`
- **Health Check**: `/api/health`

## User Roles & Permissions

1. **Super Admin**: Full system access
2. **Warehouse Manager**: Warehouse and inventory management
3. **Store Manager**: Store-specific management
4. **Staff**: Basic inventory operations
5. **Auditor**: Read-only access for auditing
6. **Viewer**: Limited read-only access

## Recent Fixes

- ✅ Fixed Mongoose duplicate index warnings
- ✅ Updated React Query configuration (cacheTime → gcTime)
- ✅ Corrected API endpoints (port 5000 → 3001)
- ✅ Fixed zodResolver imports in auth forms
- ✅ Updated Tailwind CSS v4 configuration
- ✅ Resolved Node.js version compatibility issues

## Development Status

- **Backend**: ✅ Fully functional with MongoDB Atlas connection
- **Frontend**: ✅ Running on port 5175 with Vite
- **Database**: ✅ Connected to MongoDB Atlas
- **Real-time**: ✅ Socket.IO configured
- **Authentication**: ✅ JWT implementation complete

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the MIT License.

## Support

For support and questions, please open an issue on GitHub.
