#!/bin/bash

# Docker development environment setup script for Macro AI Express API
# Usage: ./scripts/setup-docker-dev.sh

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🐳 Setting up Docker development environment for Macro AI Express API${NC}"
echo ""

# Check if Docker is running
if ! docker info >/dev/null 2>&1; then
    echo -e "${RED}❌ Docker is not running. Please start Docker Desktop and try again.${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Docker is running${NC}"

# Detect Docker Compose command (v2 CLI or legacy binary)
COMPOSE_CMD=""
if docker compose version >/dev/null 2>&1; then
    COMPOSE_CMD="docker compose"
    echo -e "${GREEN}✅ Docker Compose v2 CLI detected${NC}"
elif command -v docker-compose &> /dev/null; then
    COMPOSE_CMD="docker-compose"
    echo -e "${GREEN}✅ Legacy Docker Compose binary detected${NC}"
else
    echo -e "${RED}❌ Docker Compose is not available. Please install Docker Compose and try again.${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Docker Compose is available (using: $COMPOSE_CMD)${NC}"

# Build the development image
echo -e "${YELLOW}🔨 Building development Docker image...${NC}"
cd "$(dirname "$0")/.."
./scripts/build-docker.sh development latest false

echo ""

# Create .env file for local development if it doesn't exist
if [[ ! -f .env ]]; then
    echo -e "${YELLOW}📝 Creating .env file for local development...${NC}"
    cat > .env << EOF
# Local Development Environment Variables
NODE_ENV=development
APP_ENV=development
SERVER_PORT=3000

# AWS Configuration
AWS_REGION=us-east-1
AWS_COGNITO_REGION=us-east-1

# Database Configuration (update these with your local values)
RELATIONAL_DATABASE_URL=postgresql://username:password@localhost:5432/macro_ai_dev
REDIS_URL=redis://localhost:6379

# API Keys (update these with your actual values)
API_KEY=your-api-key-here
COOKIE_ENCRYPTION_KEY=your-cookie-encryption-key-here

# Cognito Configuration (update these with your actual values)
AWS_COGNITO_USER_POOL_ID=your-user-pool-id
AWS_COGNITO_USER_POOL_CLIENT_ID=your-client-id
AWS_COGNITO_USER_POOL_SECRET_KEY=your-secret-key


# OpenAI Configuration (update these with your actual values)
OPENAI_API_KEY=your-openai-api-key
OPENAI_ORGANIZATION=your-openai-org-id
EOF
    echo -e "${GREEN}✅ Created .env file${NC}"
    echo -e "${YELLOW}⚠️  Please update the .env file with your actual configuration values${NC}"
else
    echo -e "${GREEN}✅ .env file already exists${NC}"
fi

echo ""

# Start the development services
echo -e "${YELLOW}🚀 Starting development services...${NC}"
$COMPOSE_CMD up -d

echo ""

# Wait for services to be ready
echo -e "${YELLOW}⏳ Waiting for services to be ready...${NC}"
sleep 10

# Check service health
echo -e "${YELLOW}🏥 Checking service health...${NC}"
if curl -f http://localhost:3001/health >/dev/null 2>&1; then
    echo -e "${GREEN}✅ Express API is healthy and running on http://localhost:3001${NC}"
else
    echo -e "${RED}❌ Express API health check failed${NC}"
    echo "Checking container logs..."
    $COMPOSE_CMD logs express-api
    exit 1
fi

echo ""
echo -e "${GREEN}🎉 Docker development environment setup complete!${NC}"
echo ""
echo -e "${BLUE}📖 Next Steps:${NC}"
echo "1. Update .env file with your actual configuration values"
echo "2. Access the API at: http://localhost:3001"
echo "3. View API documentation at: http://localhost:3001/api-docs"
echo "4. Check container logs: $COMPOSE_CMD logs -f express-api"
echo "5. Stop services: $COMPOSE_CMD down"
echo ""
echo -e "${BLUE}🔧 Useful Commands:${NC}"
echo "Restart services: $COMPOSE_CMD restart"
echo "Rebuild and restart: $COMPOSE_CMD up --build -d"
echo "View logs: $COMPOSE_CMD logs -f"
echo "Access container: $COMPOSE_CMD exec express-api sh"
echo "Stop all: $COMPOSE_CMD down"
