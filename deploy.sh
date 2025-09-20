#!/bin/bash

# SmartStock Deployment Script
# This script helps deploy the SmartStock application using Docker

set -e  # Exit on any error

echo "🚀 SmartStock Deployment Script"
echo "================================"

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Docker is installed
check_docker() {
    print_status "Checking Docker installation..."
    if ! command -v docker &> /dev/null; then
        print_error "Docker is not installed. Please install Docker first."
        exit 1
    fi
    
    if ! command -v docker-compose &> /dev/null; then
        print_error "Docker Compose is not installed. Please install Docker Compose first."
        exit 1
    fi
    
    print_success "Docker and Docker Compose are installed"
}

# Check if .env file exists
check_env_file() {
    print_status "Checking environment configuration..."
    if [ ! -f ".env" ]; then
        print_warning ".env file not found. Creating from .env.example..."
        cp .env.example .env
        print_warning "Please edit the .env file with your actual configuration values!"
        print_warning "Especially change the JWT secrets and database passwords!"
        read -p "Press enter to continue after editing .env file..."
    fi
    print_success "Environment file exists"
}

# Build and start services
deploy_production() {
    print_status "Building and starting production services..."
    
    # Pull latest images
    docker-compose pull
    
    # Build images
    docker-compose build --no-cache
    
    # Start services
    docker-compose up -d
    
    print_success "Production deployment completed!"
    print_status "Services are starting up. This may take a few minutes..."
    
    # Wait for services to be healthy
    print_status "Waiting for services to be healthy..."
    sleep 30
    
    # Check service status
    docker-compose ps
}

# Deploy development environment
deploy_development() {
    print_status "Starting development environment..."
    
    # Use development compose file
    docker-compose -f docker-compose.dev.yml up -d
    
    print_success "Development environment started!"
    print_status "Services available at:"
    print_status "  - Frontend: http://localhost:5173"
    print_status "  - Backend API: http://localhost:3001"
    print_status "  - MongoDB: localhost:27017"
    print_status "  - Redis: localhost:6379"
}

# Stop services
stop_services() {
    print_status "Stopping all services..."
    docker-compose down
    docker-compose -f docker-compose.dev.yml down 2>/dev/null || true
    print_success "All services stopped"
}

# Clean up Docker resources
cleanup() {
    print_status "Cleaning up Docker resources..."
    
    # Stop and remove containers
    docker-compose down -v --remove-orphans
    docker-compose -f docker-compose.dev.yml down -v --remove-orphans 2>/dev/null || true
    
    # Remove unused images
    docker image prune -f
    
    # Remove unused volumes
    docker volume prune -f
    
    print_success "Cleanup completed"
}

# Show logs
show_logs() {
    service=${1:-}
    if [ -z "$service" ]; then
        docker-compose logs -f
    else
        docker-compose logs -f "$service"
    fi
}

# Health check
health_check() {
    print_status "Checking service health..."
    
    # Check backend health
    if curl -f http://localhost:3001/api/health &>/dev/null; then
        print_success "Backend is healthy"
    else
        print_error "Backend is not responding"
    fi
    
    # Check frontend
    if curl -f http://localhost:3000 &>/dev/null; then
        print_success "Frontend is healthy"
    else
        print_error "Frontend is not responding"
    fi
    
    # Show container status
    docker-compose ps
}

# Backup database
backup_database() {
    print_status "Creating database backup..."
    
    # Create backup directory
    mkdir -p backups
    
    # Generate backup filename with timestamp
    backup_file="backups/smartstock_backup_$(date +%Y%m%d_%H%M%S).gz"
    
    # Create MongoDB dump
    docker-compose exec mongodb mongodump --authenticationDatabase admin \
        --username admin --password password123 \
        --db smartstock --gzip --archive=/tmp/backup.gz
    
    # Copy backup from container
    docker cp smartstock_mongodb:/tmp/backup.gz "$backup_file"
    
    print_success "Database backup created: $backup_file"
}

# Restore database
restore_database() {
    backup_file=$1
    
    if [ -z "$backup_file" ]; then
        print_error "Please specify backup file path"
        exit 1
    fi
    
    if [ ! -f "$backup_file" ]; then
        print_error "Backup file not found: $backup_file"
        exit 1
    fi
    
    print_status "Restoring database from: $backup_file"
    
    # Copy backup to container
    docker cp "$backup_file" smartstock_mongodb:/tmp/restore.gz
    
    # Restore database
    docker-compose exec mongodb mongorestore --authenticationDatabase admin \
        --username admin --password password123 \
        --drop --gzip --archive=/tmp/restore.gz
    
    print_success "Database restored successfully"
}

# Show help
show_help() {
    echo "SmartStock Deployment Script"
    echo ""
    echo "Usage: $0 [COMMAND]"
    echo ""
    echo "Commands:"
    echo "  prod, production     Deploy production environment"
    echo "  dev, development     Deploy development environment"
    echo "  stop                 Stop all services"
    echo "  restart              Restart all services"
    echo "  logs [SERVICE]       Show logs (optionally for specific service)"
    echo "  health               Check service health"
    echo "  cleanup              Clean up Docker resources"
    echo "  backup               Create database backup"
    echo "  restore [FILE]       Restore database from backup"
    echo "  help                 Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 prod              # Deploy production environment"
    echo "  $0 dev               # Start development environment"
    echo "  $0 logs backend      # Show backend logs"
    echo "  $0 backup            # Create database backup"
    echo "  $0 restore backup.gz # Restore from backup"
}

# Main script logic
main() {
    case "$1" in
        "prod"|"production")
            check_docker
            check_env_file
            deploy_production
            ;;
        "dev"|"development")
            check_docker
            deploy_development
            ;;
        "stop")
            stop_services
            ;;
        "restart")
            stop_services
            sleep 2
            deploy_production
            ;;
        "logs")
            show_logs "$2"
            ;;
        "health")
            health_check
            ;;
        "cleanup")
            cleanup
            ;;
        "backup")
            backup_database
            ;;
        "restore")
            restore_database "$2"
            ;;
        "help"|"-h"|"--help")
            show_help
            ;;
        "")
            print_error "No command specified"
            show_help
            exit 1
            ;;
        *)
            print_error "Unknown command: $1"
            show_help
            exit 1
            ;;
    esac
}

# Run main function with all arguments
main "$@"