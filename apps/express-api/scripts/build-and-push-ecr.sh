#!/bin/bash

# Build and Push Docker Image to ECR for ECS Deployment
# This script builds the Docker image using turbo prune and pushes it to ECR

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
DOCKERFILE_PATH="$PROJECT_ROOT/Dockerfile.express-api-turbo"
IMAGE_NAME="macro-ai-express-api"
TAG="${1:-latest}"
ENVIRONMENT="${2:-development}"

# ECR Configuration (will be set by CI/CD or user)
AWS_REGION="${AWS_REGION:-us-east-1}"
AWS_ACCOUNT_ID="${AWS_ACCOUNT_ID:-}"
ECR_REPOSITORY_NAME="${ECR_REPOSITORY_NAME:-macro-ai-${ENVIRONMENT}-express-api}"

echo -e "${BLUE}🚀 Building and Pushing Docker Image to ECR${NC}"
echo -e "${BLUE}============================================${NC}"
echo -e "Project Root: ${PROJECT_ROOT}"
echo -e "Dockerfile: ${DOCKERFILE_PATH}"
echo -e "Image Name: ${IMAGE_NAME}"
echo -e "Tag: ${TAG}"
echo -e "Environment: ${ENVIRONMENT}"
echo -e "AWS Region: ${AWS_REGION}"
echo -e "ECR Repository: ${ECR_REPOSITORY_NAME}"
echo ""

# Check prerequisites
check_prerequisites() {
    echo -e "${BLUE}🔍 Checking prerequisites...${NC}"
    
    # Check if Docker is running
    if ! docker info >/dev/null 2>&1; then
        echo -e "${RED}❌ Docker is not running. Please start Docker and try again.${NC}"
        exit 1
    fi
    
    # Check if turbo is available
    if ! command -v turbo >/dev/null 2>&1; then
        echo -e "${YELLOW}⚠️  Turbo not found. Installing turbo...${NC}"
        npm install -g turbo@^2
    fi
    
    # Check if AWS CLI is available
    if ! command -v aws >/dev/null 2>&1; then
        echo -e "${RED}❌ AWS CLI is not installed. Please install AWS CLI and configure it.${NC}"
        exit 1
    fi
    
    # Check if AWS credentials are configured
    if ! aws sts get-caller-identity >/dev/null 2>&1; then
        echo -e "${RED}❌ AWS credentials are not configured. Please run 'aws configure' or set up credentials.${NC}"
        exit 1
    fi
    
    # Get AWS account ID if not set
    if [ -z "$AWS_ACCOUNT_ID" ]; then
        echo -e "${BLUE}🔍 Getting AWS account ID...${NC}"
        AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
        echo -e "${GREEN}✅ AWS Account ID: ${AWS_ACCOUNT_ID}${NC}"
    fi
    
    echo -e "${GREEN}✅ Prerequisites check passed${NC}"
}

# Clean previous build artifacts
clean_build_artifacts() {
    echo -e "${BLUE}🧹 Cleaning previous build artifacts...${NC}"
    
    if [ -d "$PROJECT_ROOT/out" ]; then
        rm -rf "$PROJECT_ROOT/out"
        echo -e "${GREEN}✅ Cleaned out/ directory${NC}"
    fi
}

# Build Docker image using turbo prune
build_docker_image() {
    echo -e "${BLUE}🔨 Building Docker image using turbo prune...${NC}"
    
    cd "$PROJECT_ROOT"
    
    # Run turbo prune to create optimized build context
    echo -e "${BLUE}📦 Running turbo prune for @repo/express-api...${NC}"
    turbo prune @repo/express-api --docker
    
    if [ ! -d "out" ]; then
        echo -e "${RED}❌ turbo prune failed to create out/ directory${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}✅ Turbo prune completed successfully${NC}"
    echo -e "${BLUE}📁 Build context created in out/ directory${NC}"
    
    # Build Docker image
    echo -e "${BLUE}🐳 Building Docker image...${NC}"
    docker build \
        --file "$DOCKERFILE_PATH" \
        --target runner \
        --tag "${IMAGE_NAME}:${TAG}" \
        --tag "${IMAGE_NAME}:${ENVIRONMENT}" \
        .
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Docker image built successfully${NC}"
        echo -e "${BLUE}📊 Image details:${NC}"
        docker images "${IMAGE_NAME}:${TAG}"
    else
        echo -e "${RED}❌ Docker build failed${NC}"
        exit 1
    fi
}

# Create ECR repository if it doesn't exist
create_ecr_repository() {
    echo -e "${BLUE}🏗️  Creating ECR repository if it doesn't exist...${NC}"
    
    # Check if repository exists
    if aws ecr describe-repositories --repository-names "$ECR_REPOSITORY_NAME" --region "$AWS_REGION" >/dev/null 2>&1; then
        echo -e "${GREEN}✅ ECR repository '$ECR_REPOSITORY_NAME' already exists${NC}"
    else
        echo -e "${BLUE}📦 Creating ECR repository '$ECR_REPOSITORY_NAME'...${NC}"
        aws ecr create-repository \
            --repository-name "$ECR_REPOSITORY_NAME" \
            --region "$AWS_REGION" \
            --image-scanning-configuration scanOnPush=true \
            --encryption-configuration encryptionType=AES256
        
        if [ $? -eq 0 ]; then
            echo -e "${GREEN}✅ ECR repository created successfully${NC}"
        else
            echo -e "${RED}❌ Failed to create ECR repository${NC}"
            exit 1
        fi
    fi
}

# Get ECR login token
get_ecr_login() {
    echo -e "${BLUE}🔐 Getting ECR login token...${NC}"
    
    aws ecr get-login-password --region "$AWS_REGION" | \
    docker login --username AWS --password-stdin "${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ ECR login successful${NC}"
    else
        echo -e "${RED}❌ ECR login failed${NC}"
        exit 1
    fi
}

# Tag and push image to ECR
push_to_ecr() {
    echo -e "${BLUE}📤 Pushing image to ECR...${NC}"
    
    # Tag image for ECR
    ECR_IMAGE_URI="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${ECR_REPOSITORY_NAME}:${TAG}"
    ECR_IMAGE_URI_LATEST="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${ECR_REPOSITORY_NAME}:latest"
    
    echo -e "${BLUE}🏷️  Tagging image for ECR...${NC}"
    docker tag "${IMAGE_NAME}:${TAG}" "$ECR_IMAGE_URI"
    docker tag "${IMAGE_NAME}:${TAG}" "$ECR_IMAGE_URI_LATEST"
    
    # Push image to ECR
    echo -e "${BLUE}📤 Pushing image to ECR...${NC}"
    docker push "$ECR_IMAGE_URI"
    docker push "$ECR_IMAGE_URI_LATEST"
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Image pushed to ECR successfully${NC}"
        echo -e "${BLUE}📋 ECR Image URIs:${NC}"
        echo -e "  ${GREEN}Tagged:${NC} $ECR_IMAGE_URI"
        echo -e "  ${GREEN}Latest:${NC} $ECR_IMAGE_URI_LATEST"
    else
        echo -e "${RED}❌ Failed to push image to ECR${NC}"
        exit 1
    fi
}

# Clean up local images
cleanup_local_images() {
    echo -e "${BLUE}🧹 Cleaning up local images...${NC}"
    
    # Remove local tags
    docker rmi "${IMAGE_NAME}:${TAG}" "${IMAGE_NAME}:${ENVIRONMENT}" 2>/dev/null || true
    
    echo -e "${GREEN}✅ Local cleanup completed${NC}"
}

# Main execution
main() {
    echo -e "${BLUE}🚀 Starting ECR build and push process...${NC}"
    echo ""
    
    check_prerequisites
    echo ""
    
    clean_build_artifacts
    echo ""
    
    build_docker_image
    echo ""
    
    create_ecr_repository
    echo ""
    
    get_ecr_login
    echo ""
    
    push_to_ecr
    echo ""
    
    cleanup_local_images
    echo ""
    
    echo -e "${GREEN}🎉 ECR build and push completed successfully!${NC}"
    echo ""
    echo -e "${BLUE}📋 Summary:${NC}"
    echo -e "  ${GREEN}Image:${NC} ${ECR_REPOSITORY_NAME}:${TAG}"
    echo -e "  ${GREEN}ECR URI:${NC} ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${ECR_REPOSITORY_NAME}:${TAG}"
    echo -e "  ${GREEN}Environment:${NC} ${ENVIRONMENT}"
    echo ""
    echo -e "${BLUE}💡 Next steps:${NC}"
    echo -e "  1. Update your ECS task definition to use this image"
    echo -e "  2. Deploy the updated ECS service"
    echo -e "  3. Monitor the deployment in the AWS console"
}

# Run main function
main "$@"
