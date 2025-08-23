#!/bin/bash

# Turbo-powered Docker build script for Macro AI Express API
# Usage: ./scripts/build-docker-turbo.sh [environment] [version] [push]

set -e

# Default values
ENVIRONMENT=${1:-development}
VERSION=${2:-latest}
PUSH=${3:-false}

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
IMAGE_NAME="macro-ai-express-api"
REGISTRY=""
FULL_IMAGE_NAME="${REGISTRY}${IMAGE_NAME}:${VERSION}"
FULL_IMAGE_NAME_ENV="${REGISTRY}${IMAGE_NAME}:${ENVIRONMENT}-${VERSION}"

echo -e "${BLUE}🐳 Building Docker image for Macro AI Express API (with Turbo)${NC}"
echo -e "${BLUE}Environment: ${ENVIRONMENT}${NC}"
echo -e "${BLUE}Version: ${VERSION}${NC}"
echo -e "${BLUE}Push: ${PUSH}${NC}"
echo ""

# Validate environment
if [[ ! "$ENVIRONMENT" =~ ^(development|staging|production|preview)$ ]]; then
    echo -e "${RED}❌ Invalid environment: ${ENVIRONMENT}${NC}"
    echo "Valid environments: development, staging, production, preview"
    exit 1
fi

# Navigate to repository root
cd "$(dirname "$0")/../../.."

# Clean up any existing out directory
if [[ -d "out" ]]; then
    echo -e "${YELLOW}🧹 Cleaning up existing out directory...${NC}"
    rm -rf out
fi

# Use Turbo to prune the workspace
echo -e "${YELLOW}🌳 Pruning workspace with Turbo...${NC}"
npx turbo prune --scope=@repo/express-api --docker

if [[ ! -d "out" ]]; then
    echo -e "${RED}❌ Turbo prune failed - out directory not created${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Workspace pruned successfully${NC}"

# Build with appropriate target based on environment
if [[ "$ENVIRONMENT" == "production" || "$ENVIRONMENT" == "staging" ]]; then
    TARGET="runner"
else
    TARGET="app-builder"
fi

# Build the image
echo -e "${YELLOW}🔨 Building Docker image...${NC}"
echo "Building: ${FULL_IMAGE_NAME_ENV}"

docker build \
    --target ${TARGET} \
    --tag ${FULL_IMAGE_NAME_ENV} \
    --tag ${FULL_IMAGE_NAME} \
    --file Dockerfile.express-api-turbo \
    --build-arg BUILD_ENV=${ENVIRONMENT} \
    --build-arg BUILD_VERSION=${VERSION} \
    --build-arg BUILD_DATE=$(date -u +'%Y-%m-%dT%H:%M:%SZ') \
    --build-arg BUILD_COMMIT=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown") \
    .

echo -e "${GREEN}✅ Docker image built successfully!${NC}"
echo ""

# Clean up out directory
echo -e "${YELLOW}🧹 Cleaning up out directory...${NC}"
rm -rf out

# Show image info
echo -e "${BLUE}📊 Image Information:${NC}"
docker images ${IMAGE_NAME} --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}\t{{.CreatedAt}}"
echo ""

# Test the image if it's a production build
if [[ "$TARGET" == "production" ]]; then
    echo -e "${YELLOW}🧪 Testing production image...${NC}"
    
    # Create a temporary container to test
    CONTAINER_ID=$(docker create ${FULL_IMAGE_NAME_ENV})
    
    # Check if container was created successfully
    if docker inspect ${CONTAINER_ID} >/dev/null 2>&1; then
        echo -e "${GREEN}✅ Production image test passed${NC}"
        
        # Clean up test container
        docker rm ${CONTAINER_ID} >/dev/null 2>&1
    else
        echo -e "${RED}❌ Production image test failed${NC}"
        exit 1
    fi
fi

# Push to registry if requested
if [[ "$PUSH" == "true" ]]; then
    if [[ -z "$REGISTRY" ]]; then
        echo -e "${YELLOW}⚠️  No registry configured, skipping push${NC}"
    else
        echo -e "${YELLOW}📤 Pushing image to registry...${NC}"
        docker push ${FULL_IMAGE_NAME_ENV}
        docker push ${FULL_IMAGE_NAME}
        echo -e "${GREEN}✅ Images pushed successfully!${NC}"
    fi
fi

echo ""
echo -e "${GREEN}🎉 Turbo Docker build completed successfully!${NC}"
echo -e "${BLUE}Image: ${FULL_IMAGE_NAME_ENV}${NC}"
echo -e "${BLUE}Latest: ${FULL_IMAGE_NAME}${NC}"

# Show usage examples
echo ""
echo -e "${BLUE}📖 Usage Examples:${NC}"
echo "Run locally: docker run -p 3000:3000 ${FULL_IMAGE_NAME_ENV}"
echo "Run with env file: docker run -p 3000:3000 --env-file .env ${FULL_IMAGE_NAME_ENV}"
echo "Run with Docker Compose: docker-compose up"
echo "Run production: docker-compose -f docker-compose.prod.yml up"
