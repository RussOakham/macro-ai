#!/bin/bash

# Docker Build with Environment Configuration Script
# This script generates environment files from Parameter Store and builds Docker images
# This replaces runtime Parameter Store access with build-time configuration injection

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Default values
ENVIRONMENT=${ENVIRONMENT:-"development"}
IMAGE_TAG=${IMAGE_TAG:-"latest"}
DOCKERFILE_PATH=${DOCKERFILE_PATH:-"Dockerfile"}
BUILD_CONTEXT=${BUILD_CONTEXT:-"."}
PUSH_TO_ECR=${PUSH_TO_ECR:-"false"}
ECR_REPOSITORY=${ECR_REPOSITORY:-""}
AWS_REGION=${AWS_REGION:-"us-east-1"}

# Show usage
show_usage() {
    cat << EOF
Usage: $0 [OPTIONS]

Build Docker image with environment configuration from Parameter Store

OPTIONS:
    -e, --environment ENV     Environment name (default: development)
    -t, --tag TAG            Docker image tag (default: latest)
    -f, --dockerfile FILE    Dockerfile path (default: Dockerfile)
    -c, --context PATH       Build context (default: .)
    -p, --push               Push to ECR after build
    -r, --repository REPO    ECR repository URI
    -a, --region REGION      AWS region (default: us-east-1)
    -h, --help               Show this help message

EXAMPLES:
    # Build development image
    $0 -e development

    # Build production image and push to ECR
    $0 -e production -p -r "123456789012.dkr.ecr.us-east-1.amazonaws.com/macro-ai-api"

    # Build with custom tag and context
    $0 -e staging -t v1.2.3 -c ./apps/express-api

    # Build with custom environment file
    ENVIRONMENT=production $0 -e production -t prod-latest
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
            IMAGE_TAG="$2"
            shift 2
            ;;
        -f|--dockerfile)
            DOCKERFILE_PATH="$2"
            shift 2
            ;;
        -c|--context)
            BUILD_CONTEXT="$2"
            shift 2
            ;;
        -p|--push)
            PUSH_TO_ECR="true"
            shift
            ;;
        -r|--repository)
            ECR_REPOSITORY="$2"
            PUSH_TO_ECR="true"
            shift 2
            ;;
        -a|--region)
            AWS_REGION="$2"
            shift 2
            ;;
        -h|--help)
            show_usage
            exit 0
            ;;
        *)
            log_error "Unknown option: $1"
            show_usage
            exit 1
            ;;
    esac
done

# Validate required parameters
validate_parameters() {
    log_info "Validating parameters..."
    
    if [[ "$PUSH_TO_ECR" == "true" && -z "$ECR_REPOSITORY" ]]; then
        log_error "ECR repository URI is required when pushing to ECR"
        exit 1
    fi
    
    if [[ ! -f "$DOCKERFILE_PATH" ]]; then
        log_error "Dockerfile not found: $DOCKERFILE_PATH"
        exit 1
    fi
    
    if [[ ! -d "$BUILD_CONTEXT" ]]; then
        log_error "Build context directory not found: $BUILD_CONTEXT"
        exit 1
    fi
    
    log_success "Parameter validation passed"
}

# Generate environment file
generate_environment_file() {
    log_info "Generating environment file for $ENVIRONMENT..."
    
    local env_file=".env.${ENVIRONMENT}"
    local script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    
    # Run the environment generation script
    if ! "$script_dir/generate-env-file.sh" \
        -e "$ENVIRONMENT" \
        -o "$env_file" \
        -r "$AWS_REGION"; then
        log_error "Failed to generate environment file"
        exit 1
    fi
    
    log_success "Environment file generated: $env_file"
    echo "$env_file"
}

# Build Docker image
build_docker_image() {
    local env_file="$1"
    local image_name="macro-ai-api:${ENVIRONMENT}-${IMAGE_TAG}"
    
    log_info "Building Docker image: $image_name"
    log_info "Using environment file: $env_file"
    log_info "Build context: $BUILD_CONTEXT"
    log_info "Dockerfile: $DOCKERFILE_PATH"
    
    # Build the Docker image with environment file
    if ! docker build \
        --build-arg ENV_FILE="$env_file" \
        --build-arg ENVIRONMENT="$ENVIRONMENT" \
        --build-arg PARAMETER_PREFIX="/macro-ai/$ENVIRONMENT" \
        --build-arg AWS_REGION="$AWS_REGION" \
        -f "$DOCKERFILE_PATH" \
        -t "$image_name" \
        "$BUILD_CONTEXT"; then
        log_error "Docker build failed"
        exit 1
    fi
    
    log_success "Docker image built successfully: $image_name"
    echo "$image_name"
}

# Tag for ECR (if pushing)
tag_for_ecr() {
    local local_image="$1"
    local ecr_image="$ECR_REPOSITORY:$ENVIRONMENT-$IMAGE_TAG"
    
    log_info "Tagging image for ECR: $ecr_image"
    
    if ! docker tag "$local_image" "$ecr_image"; then
        log_error "Failed to tag image for ECR"
        exit 1
    fi
    
    log_success "Image tagged for ECR: $ecr_image"
    echo "$ecr_image"
}

# Push to ECR
push_to_ecr() {
    local ecr_image="$1"
    
    log_info "Pushing image to ECR: $ecr_image"
    
    # Login to ECR
    log_info "Logging in to ECR..."
    if ! aws ecr get-login-password --region "$AWS_REGION" | \
        docker login --username AWS --password-stdin "$ECR_REPOSITORY"; then
        log_error "Failed to login to ECR"
        exit 1
    fi
    
    # Push the image
    if ! docker push "$ecr_image"; then
        log_error "Failed to push image to ECR"
        exit 1
    fi
    
    log_success "Image pushed to ECR successfully: $ecr_image"
}

# Cleanup temporary files
cleanup() {
    local env_file="$1"
    
    if [[ -f "$env_file" ]]; then
        log_info "Cleaning up temporary environment file: $env_file"
        rm -f "$env_file"
        log_success "Cleanup completed"
    fi
}

# Main execution
main() {
    log_info "Starting Docker build with environment configuration..."
    log_info "Environment: $ENVIRONMENT"
    log_info "Image Tag: $IMAGE_TAG"
    log_info "AWS Region: $AWS_REGION"
    log_info "Push to ECR: $PUSH_TO_ECR"
    
    # Validate parameters
    validate_parameters
    
    # Generate environment file
    local env_file
    env_file=$(generate_environment_file)
    
    # Build Docker image
    local local_image
    local_image=$(build_docker_image "$env_file")
    
    # Handle ECR operations
    if [[ "$PUSH_TO_ECR" == "true" ]]; then
        local ecr_image
        ecr_image=$(tag_for_ecr "$local_image")
        push_to_ecr "$ecr_image"
        
        log_success "Build and push completed successfully!"
        log_info "Local image: $local_image"
        log_info "ECR image: $ecr_image"
    else
        log_success "Build completed successfully!"
        log_info "Local image: $local_image"
        log_info "Use -p flag to push to ECR"
    fi
    
    # Cleanup
    cleanup "$env_file"
}

# Trap cleanup on exit
trap 'cleanup "$env_file" 2>/dev/null || true' EXIT

# Run main function
main "$@"
