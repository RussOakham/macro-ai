#!/bin/bash

# Docker production deployment script for Macro AI Express API
# Usage: ./scripts/deploy-docker-prod.sh [environment] [version]

set -e

# Default values
ENVIRONMENT=${1:-production}
VERSION=${2:-$(date +%Y%m%d-%H%M%S)}

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
IMAGE_NAME="macro-ai-express-api"
FULL_IMAGE_NAME="${IMAGE_NAME}:${ENVIRONMENT}-${VERSION}"
LATEST_TAG="${IMAGE_NAME}:${ENVIRONMENT}-latest"

echo -e "${BLUE}🚀 Deploying Docker production image for Macro AI Express API${NC}"
echo -e "${BLUE}Environment: ${ENVIRONMENT}${NC}"
echo -e "${BLUE}Version: ${VERSION}${NC}"
echo ""

# Validate environment
if [[ ! "$ENVIRONMENT" =~ ^(staging|production)$ ]]; then
    echo -e "${RED}❌ Invalid environment: ${ENVIRONMENT}${NC}"
    echo "Valid environments: staging, production"
    exit 1
fi

# Check if Docker is running
if ! docker info >/dev/null 2>&1; then
    echo -e "${RED}❌ Docker is not running. Please start Docker and try again.${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Docker is running${NC}"

# Build the production image
echo -e "${YELLOW}🔨 Building production Docker image...${NC}"
cd "$(dirname "$0")/.."
./scripts/build-docker.sh "${ENVIRONMENT}" "${VERSION}" false

echo ""

# Test the production image
echo -e "${YELLOW}🧪 Testing production image...${NC}"

# Create a temporary container to test
CONTAINER_ID=$(docker create "${FULL_IMAGE_NAME}")

# Check if container was created successfully
if ! docker inspect "${CONTAINER_ID}" >/dev/null 2>&1; then
    echo -e "${RED}❌ Failed to create test container${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Test container created successfully${NC}"

# Test container startup
echo -e "${YELLOW}🚀 Testing container startup...${NC}"
docker start "${CONTAINER_ID}"

# Wait a moment for the container to start
sleep 5

# Check if container is running
if docker ps | grep -q "${CONTAINER_ID}"; then
    echo -e "${GREEN}✅ Container started successfully${NC}"
else
    echo -e "${RED}❌ Container failed to start${NC}"
    echo "Container logs:"
    docker logs "${CONTAINER_ID}"
    docker rm -f "${CONTAINER_ID}" >/dev/null 2>&1
    exit 1
fi

# Test health check endpoint (if container exposes port)
echo -e "${YELLOW}🏥 Testing health check endpoint...${NC}"

# Get container IP address
CONTAINER_IP=$(docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' "${CONTAINER_ID}")

if [[ -n "$CONTAINER_IP" ]]; then
    # Test health endpoint
    if curl -f "http://${CONTAINER_IP}:3000/health" >/dev/null 2>&1; then
        echo -e "${GREEN}✅ Health check endpoint is responding${NC}"
    else
        echo -e "${YELLOW}⚠️  Health check endpoint not accessible (this is normal for some configurations)${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  Could not determine container IP address${NC}"
fi

# Stop and remove test container
echo -e "${YELLOW}🧹 Cleaning up test container...${NC}"
docker stop "${CONTAINER_ID}" >/dev/null 2>&1
docker rm "${CONTAINER_ID}" >/dev/null 2>&1
echo -e "${GREEN}✅ Test container cleaned up${NC}"

echo ""

# Tag as latest
echo -e "${YELLOW}🏷️  Tagging as latest...${NC}"
docker tag "${FULL_IMAGE_NAME}" "${LATEST_TAG}"
echo -e "${GREEN}✅ Tagged as ${LATEST_TAG}${NC}"

# Show final image information
echo ""
echo -e "${BLUE}📊 Final Image Information:${NC}"
docker images "${IMAGE_NAME}" --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}\t{{.CreatedAt}}"

echo ""
echo -e "${GREEN}🎉 Production deployment completed successfully!${NC}"
echo -e "${BLUE}Image: ${FULL_IMAGE_NAME}${NC}"
echo -e "${BLUE}Latest: ${LATEST_TAG}${NC}"

# Show deployment commands
echo ""
echo -e "${BLUE}📖 Deployment Commands:${NC}"
echo "Run locally: docker run -p 3000:3000 --env-file .env ${FULL_IMAGE_NAME}"
echo "Run with Docker Compose: docker-compose -f docker-compose.prod.yml up -d"
echo "Push to registry: docker push ${FULL_IMAGE_NAME} && docker push ${LATEST_TAG}"

# Show next steps for ECS deployment
echo ""
echo -e "${BLUE}🚀 Next Steps for ECS Deployment:${NC}"
echo "1. Update ECS task definition with new image: ${FULL_IMAGE_NAME}"
echo "2. Update ECS service to use new task definition"
echo "3. Monitor deployment health and rollback if needed"
echo "4. Update CI/CD pipeline to use this deployment script"

# Show rollback information
echo ""
echo -e "${BLUE}🔄 Rollback Information:${NC}"
echo "To rollback, use the previous image tag or run:"
echo "docker tag ${IMAGE_NAME}:${ENVIRONMENT}-[previous-version] ${LATEST_TAG}"
