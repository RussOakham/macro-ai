#!/bin/bash
set -e

# Build Docker image with environment variable injection for ECS deployment
# This script is designed to be run during CDK deployment
# 
# Note: The application now automatically determines the parameter store prefix from APP_ENV:
# - pr-* environments → /macro-ai/development/
# - development → /macro-ai/development/
# - staging → /macro-ai/staging/
# - production → /macro-ai/production/

echo "[INFO] Building Docker image with environment variable injection..."

# Default values
IMAGE_TAG="${IMAGE_TAG:-latest}"
ECR_REGISTRY="${ECR_REGISTRY}"
REPOSITORY_NAME="${REPOSITORY_NAME:-macro-ai-express-api}"
APP_ENV="${APP_ENV:-development}"
AWS_REGION="${AWS_REGION:-us-east-1}"

# Validate required environment variables
if [ -z "$ECR_REGISTRY" ]; then
    echo "[ERROR] ECR_REGISTRY environment variable is required"
    exit 1
fi

if [ -z "$APP_ENV" ]; then
    echo "[ERROR] APP_ENV environment variable is required"
    exit 1
fi

echo "[INFO] Docker image: $ECR_REGISTRY/$REPOSITORY_NAME:$IMAGE_TAG"
echo "[INFO] App Environment: $APP_ENV (parameter store prefix will be determined automatically)"

# Step 1: Generate environment file from Parameter Store
echo "[INFO] Step 1: Generating environment file..."
ENV_FILE="/tmp/.env.docker"
export ENV_FILE="$ENV_FILE"
export APP_ENV="$APP_ENV"
export AWS_REGION="$AWS_REGION"

# Get the script directory for reliable path resolution
SCRIPT_DIR="$(dirname "${BASH_SOURCE[0]}")"

# Run the environment generation script
"$SCRIPT_DIR/generate-env-from-parameter-store.sh"

# Step 2: Build Docker image with environment file
echo "[INFO] Step 2: Building Docker image..."

# Build the image from the repo root (for Turborepo context)
cd ../..

# Build with build args for environment injection
docker build \
    --build-arg ENV_FILE="$ENV_FILE" \
    --tag "$ECR_REGISTRY/$REPOSITORY_NAME:$IMAGE_TAG" \
    --file apps/express-api/Dockerfile.distroless \
    --target ecs-runner \
    .

echo "[INFO] Docker image built successfully: $ECR_REGISTRY/$REPOSITORY_NAME:$IMAGE_TAG"

# Step 3: Push to ECR
echo "[INFO] Step 3: Pushing to ECR..."

# Authenticate Docker to ECR
aws ecr get-login-password --region "$AWS_REGION" \
    | docker login --username AWS --password-stdin "$ECR_REGISTRY"

# Push the image
docker push "$ECR_REGISTRY/$REPOSITORY_NAME:$IMAGE_TAG"

echo "[INFO] Docker image pushed successfully to ECR"

# Cleanup
rm -f "$ENV_FILE"
echo "[INFO] Build complete!"
