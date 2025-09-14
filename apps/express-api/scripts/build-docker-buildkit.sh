#!/bin/bash

# Build Docker image with BuildKit optimizations
# This script uses Docker Buildx for multi-platform builds and advanced caching

set -euo pipefail

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Default values
ENVIRONMENT="development"
TAG="latest"
PUSH=false
REGISTRY=""
PLATFORM="linux/amd64"
CACHE_FROM=""
CACHE_TO=""
TARGET="ecs-runner"

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"

# Image name
IMAGE_NAME="macro-ai-express-api"

# Help function
show_help() {
    cat << EOF
Usage: $0 [OPTIONS]

Build Docker image with BuildKit optimizations

OPTIONS:
    -e, --environment ENVIRONMENT   Environment (development, staging, production) [default: development]
    -t, --tag TAG                  Image tag [default: latest]
    -p, --push                     Push image to registry
    -r, --registry REGISTRY        Container registry URL
    --platform PLATFORM           Target platform(s) [default: linux/amd64]
    --multi-platform               Build for multiple platforms (linux/amd64,linux/arm64)
    --cache-from CACHE_FROM        Cache source (e.g., type=registry,ref=myregistry/cache:buildcache)
    --cache-to CACHE_TO            Cache destination (e.g., type=registry,ref=myregistry/cache:buildcache,mode=max)
    --target TARGET                Build target [default: runner]
    -h, --help                     Show this help message

EXAMPLES:
    # Basic build
    $0 -e production -t v1.0.0

    # Multi-platform build with registry caching
    $0 --multi-platform --cache-from type=registry,ref=myregistry/cache:buildcache --cache-to type=registry,ref=myregistry/cache:buildcache,mode=max

    # Build and push to ECR
    $0 -e production -t v1.0.0 -p -r 123456789.dkr.ecr.us-east-1.amazonaws.com

EOF
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -e|--environment)
            ENVIRONMENT="$2"
            shift 2
            ;;
        -t|--tag)
            TAG="$2"
            shift 2
            ;;
        -p|--push)
            PUSH=true
            shift
            ;;
        -r|--registry)
            REGISTRY="$2"
            shift 2
            ;;
        --platform)
            PLATFORM="$2"
            shift 2
            ;;
        --multi-platform)
            PLATFORM="linux/amd64,linux/arm64"
            shift
            ;;
        --cache-from)
            CACHE_FROM="$2"
            shift 2
            ;;
        --cache-to)
            CACHE_TO="$2"
            shift 2
            ;;
        --target)
            TARGET="$2"
            shift 2
            ;;
        -h|--help)
            show_help
            exit 0
            ;;
        *)
            echo "Unknown option $1"
            show_help
            exit 1
            ;;
    esac
done

# Validate environment
if [[ ! "$ENVIRONMENT" =~ ^(development|staging|production)$ ]]; then
    echo -e "${RED}❌ Invalid environment: $ENVIRONMENT${NC}"
    echo -e "${YELLOW}Valid environments: development, staging, production${NC}"
    exit 1
fi

# Set full image name with registry if provided
if [[ -n "$REGISTRY" ]]; then
    FULL_IMAGE_NAME="${REGISTRY}/${IMAGE_NAME}"
else
    FULL_IMAGE_NAME="$IMAGE_NAME"
fi

echo -e "${BLUE}🚀 Building Docker image with BuildKit optimizations${NC}"
echo -e "${BLUE}📋 Configuration:${NC}"
echo -e "   Environment: ${YELLOW}$ENVIRONMENT${NC}"
echo -e "   Tag: ${YELLOW}$TAG${NC}"
echo -e "   Platform(s): ${YELLOW}$PLATFORM${NC}"
echo -e "   Target: ${YELLOW}$TARGET${NC}"
echo -e "   Image: ${YELLOW}$FULL_IMAGE_NAME:$TAG${NC}"
echo -e "   Push: ${YELLOW}$PUSH${NC}"
echo ""

# Change to project root
cd "$PROJECT_ROOT"

# Enable BuildKit
export DOCKER_BUILDKIT=1
export BUILDKIT_PROGRESS=plain

# Check if buildx is available
if ! docker buildx version >/dev/null 2>&1; then
    echo -e "${RED}❌ Docker Buildx is not available${NC}"
    echo -e "${YELLOW}Please install Docker Buildx or update Docker to a newer version${NC}"
    exit 1
fi

# Create buildx builder if it doesn't exist
BUILDER_NAME="macro-ai-builder"
if ! docker buildx ls | grep -q "$BUILDER_NAME"; then
    echo -e "${BLUE}🔧 Creating buildx builder: $BUILDER_NAME${NC}"
    docker buildx create --name "$BUILDER_NAME" --use --bootstrap
else
    echo -e "${BLUE}🔧 Using existing buildx builder: $BUILDER_NAME${NC}"
    docker buildx use "$BUILDER_NAME"
fi

# Prepare build arguments
BUILD_ARGS=(
    "--file" "apps/express-api/Dockerfile.distroless"
    "--target" "$TARGET"
    "--platform" "$PLATFORM"
    "--tag" "${FULL_IMAGE_NAME}:${TAG}"
    "--tag" "${FULL_IMAGE_NAME}:${ENVIRONMENT}"
    "--build-arg" "BUILD_ENV=${ENVIRONMENT}"
    "--build-arg" "BUILD_VERSION=${TAG}"
    "--build-arg" "BUILD_DATE=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
)

# Add commit hash if in git repo
if git rev-parse --git-dir > /dev/null 2>&1; then
    COMMIT_SHA=$(git rev-parse --short HEAD)
    BUILD_ARGS+=("--build-arg" "BUILD_COMMIT=${COMMIT_SHA}")
fi

# Add cache arguments if provided
if [[ -n "$CACHE_FROM" ]]; then
    BUILD_ARGS+=("--cache-from" "$CACHE_FROM")
fi

if [[ -n "$CACHE_TO" ]]; then
    BUILD_ARGS+=("--cache-to" "$CACHE_TO")
fi

# Add push flag if requested
if [[ "$PUSH" == "true" ]]; then
    BUILD_ARGS+=("--push")
else
    BUILD_ARGS+=("--load")
fi

# Add context
BUILD_ARGS+=(".")

echo -e "${BLUE}🔨 Building Docker image...${NC}"
echo -e "${BLUE}Command: docker buildx build ${BUILD_ARGS[*]}${NC}"
echo ""

# Build the image
if docker buildx build "${BUILD_ARGS[@]}"; then
    echo ""
    echo -e "${GREEN}✅ Docker image built successfully${NC}"
    
    if [[ "$PUSH" != "true" ]]; then
        echo -e "${BLUE}📊 Image details:${NC}"
        docker images "${FULL_IMAGE_NAME}:${TAG}" 2>/dev/null || echo -e "${YELLOW}⚠️  Image not found locally (multi-platform build)${NC}"
    else
        echo -e "${GREEN}📤 Image pushed to registry${NC}"
    fi
else
    echo -e "${RED}❌ Docker build failed${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}🎉 Build completed successfully!${NC}"
echo -e "${BLUE}Image: ${YELLOW}${FULL_IMAGE_NAME}:${TAG}${NC}"

# Show next steps
echo ""
echo -e "${BLUE}📋 Next steps:${NC}"
if [[ "$PUSH" != "true" ]]; then
    echo -e "   Run locally: ${YELLOW}docker run -p 3040:3040 ${FULL_IMAGE_NAME}:${TAG}${NC}"
    echo -e "   Push to registry: ${YELLOW}$0 -e $ENVIRONMENT -t $TAG -p -r <registry-url>${NC}"
else
    echo -e "   Deploy to ECS: Update task definition with new image URI"
    echo -e "   Test deployment: Verify health checks and functionality"
fi

