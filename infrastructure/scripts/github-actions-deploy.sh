#!/bin/bash

# GitHub Actions EC2 Deployment Script
# This script is designed to be used in GitHub Actions workflows
# for deploying applications to EC2 instances

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1" >&2
}

# Error handling
error_exit() {
    log_error "$1"
    exit 1
}

# Configuration from environment variables
PR_NUMBER="${PR_NUMBER:-}"
ARTIFACT_URL="${ARTIFACT_URL:-}"
VERSION="${VERSION:-}"
BRANCH_NAME="${BRANCH_NAME:-}"
ENVIRONMENT="${ENVIRONMENT:-development}"
AWS_REGION="${AWS_REGION:-us-east-1}"

# Infrastructure configuration
VPC_ID="${VPC_ID:-}"
SUBNET_IDS="${SUBNET_IDS:-}"
SECURITY_GROUP_ID="${SECURITY_GROUP_ID:-}"
LAUNCH_TEMPLATE_ID="${LAUNCH_TEMPLATE_ID:-}"
TARGET_GROUP_ARN="${TARGET_GROUP_ARN:-}"
PARAMETER_STORE_PREFIX="${PARAMETER_STORE_PREFIX:-}"
ARTIFACT_BUCKET="${ARTIFACT_BUCKET:-}"

# Deployment options
INSTANCE_COUNT="${INSTANCE_COUNT:-1}"
TIMEOUT_MINUTES="${TIMEOUT_MINUTES:-15}"
HEALTH_CHECK_RETRIES="${HEALTH_CHECK_RETRIES:-10}"

# Validate required environment variables
validate_environment() {
    log_info "Validating environment configuration..."

    local required_vars=(
        "PR_NUMBER"
        "ARTIFACT_URL"
        "VERSION"
        "AWS_REGION"
        "VPC_ID"
        "SUBNET_IDS"
        "SECURITY_GROUP_ID"
        "LAUNCH_TEMPLATE_ID"
        "TARGET_GROUP_ARN"
        "PARAMETER_STORE_PREFIX"
        "ARTIFACT_BUCKET"
    )

    local missing_vars=()
    for var in "${required_vars[@]}"; do
        if [[ -z "${!var}" ]]; then
            missing_vars+=("$var")
        fi
    done

    if [[ ${#missing_vars[@]} -gt 0 ]]; then
        log_error "Missing required environment variables:"
        printf '%s\n' "${missing_vars[@]}"
        error_exit "Please set all required environment variables"
    fi

    log_success "Environment validation completed"
}

# Setup AWS CLI and dependencies
setup_dependencies() {
    log_info "Setting up dependencies..."

    # Install AWS CLI if not present
    if ! command -v aws &> /dev/null; then
        log_info "Installing AWS CLI..."
        curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
        unzip awscliv2.zip
        sudo ./aws/install
        rm -rf aws awscliv2.zip
    fi

    # Verify AWS credentials
    if ! aws sts get-caller-identity &> /dev/null; then
        error_exit "AWS credentials not configured or invalid"
    fi

    # Install Node.js and pnpm if needed for the deployment script
    if ! command -v node &> /dev/null; then
        log_info "Installing Node.js..."
        curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
        sudo dnf install -y nodejs
    fi

    if ! command -v pnpm &> /dev/null; then
        log_info "Installing pnpm..."
        npm install -g pnpm
    fi

    log_success "Dependencies setup completed"
}

# Build and upload application artifact
build_and_upload_artifact() {
    log_info "Building and uploading application artifact..."

    local build_dir="build-$(date +%s)"
    local artifact_name="macro-ai-express-api-${VERSION}.tar.gz"
    local artifact_key="artifacts/${PR_NUMBER}/${artifact_name}"

    # Create build directory
    mkdir -p "$build_dir"
    cd "$build_dir"

    # Clone or copy the application code
    # In a real GitHub Actions workflow, the code would already be checked out
    if [[ -n "${GITHUB_WORKSPACE:-}" ]]; then
        cp -r "${GITHUB_WORKSPACE}/apps/express-api" ./
    else
        log_warning "GITHUB_WORKSPACE not set, assuming local development"
        cp -r "../apps/express-api" ./
    fi

    cd express-api

    # Install dependencies and build
    log_info "Installing dependencies..."
    pnpm install --frozen-lockfile

    log_info "Building application..."
    pnpm build

    # Create deployment package
    log_info "Creating deployment package..."
    tar -czf "../${artifact_name}" \
        --exclude=node_modules \
        --exclude=.git \
        --exclude=.env* \
        --exclude=*.log \
        .

    # Upload to S3
    log_info "Uploading artifact to S3..."
    aws s3 cp "../${artifact_name}" "s3://${ARTIFACT_BUCKET}/${artifact_key}"

    # Set output for GitHub Actions
    if [[ -n "${GITHUB_OUTPUT:-}" ]]; then
        echo "artifact-url=s3://${ARTIFACT_BUCKET}/${artifact_key}" >> "$GITHUB_OUTPUT"
        echo "artifact-key=${artifact_key}" >> "$GITHUB_OUTPUT"
    fi

    # Update ARTIFACT_URL for deployment
    export ARTIFACT_URL="s3://${ARTIFACT_BUCKET}/${artifact_key}"

    cd ../..
    rm -rf "$build_dir"

    log_success "Artifact build and upload completed"
}

# Deploy to EC2 using the TypeScript utility
deploy_to_ec2() {
    log_info "Deploying to EC2 instances..."

    # Set environment variables for the deployment script
    export AWS_REGION
    export VPC_ID
    export SUBNET_IDS
    export SECURITY_GROUP_ID
    export LAUNCH_TEMPLATE_ID
    export TARGET_GROUP_ARN
    export PARAMETER_STORE_PREFIX
    export ARTIFACT_BUCKET
    export ENVIRONMENT

    # Navigate to infrastructure directory
    local script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    local infra_dir="$(dirname "$script_dir")"
    cd "$infra_dir"

    # Install dependencies if needed
    if [[ ! -d "node_modules" ]]; then
        log_info "Installing infrastructure dependencies..."
        pnpm install
    fi

    # Run the deployment
    log_info "Executing EC2 deployment..."
    pnpm tsx scripts/deploy-ec2.ts deploy \
        --pr "$PR_NUMBER" \
        --artifact "$ARTIFACT_URL" \
        --version "$VERSION" \
        --branch "$BRANCH_NAME" \
        --instances "$INSTANCE_COUNT"

    log_success "EC2 deployment completed"
}

# Wait for deployment to be healthy
wait_for_healthy_deployment() {
    log_info "Waiting for deployment to be healthy..."

    local max_attempts=$((TIMEOUT_MINUTES * 2)) # Check every 30 seconds
    local attempt=1

    while [[ $attempt -le $max_attempts ]]; do
        log_info "Health check attempt $attempt/$max_attempts..."

        # Check deployment status
        local status_output
        if status_output=$(pnpm tsx scripts/deploy-ec2.ts status --pr "$PR_NUMBER" 2>&1); then
            if echo "$status_output" | grep -q "Status: SUCCESS"; then
                log_success "Deployment is healthy!"
                return 0
            elif echo "$status_output" | grep -q "Status: FAILED"; then
                log_error "Deployment failed!"
                echo "$status_output"
                return 1
            fi
        fi

        log_info "Deployment still in progress, waiting 30 seconds..."
        sleep 30
        ((attempt++))
    done

    log_error "Timeout waiting for deployment to be healthy"
    return 1
}

# Set GitHub Actions outputs
set_github_outputs() {
    if [[ -n "${GITHUB_OUTPUT:-}" ]]; then
        log_info "Setting GitHub Actions outputs..."

        # Get deployment status
        local status_output
        status_output=$(pnpm tsx scripts/deploy-ec2.ts status --pr "$PR_NUMBER" 2>&1 || true)

        # Extract information and set outputs
        echo "pr-number=${PR_NUMBER}" >> "$GITHUB_OUTPUT"
        echo "version=${VERSION}" >> "$GITHUB_OUTPUT"
        echo "environment=${ENVIRONMENT}" >> "$GITHUB_OUTPUT"
        echo "deployment-status=success" >> "$GITHUB_OUTPUT"

        # Try to extract health check URL (this would need to be implemented in the status command)
        # For now, we'll construct it based on the ALB
        if [[ -n "${ALB_DNS_NAME:-}" ]]; then
            echo "health-check-url=http://${ALB_DNS_NAME}/api/health" >> "$GITHUB_OUTPUT"
        fi

        log_success "GitHub Actions outputs set"
    fi
}

# Cleanup on failure
cleanup_on_failure() {
    log_warning "Deployment failed, cleaning up..."

    # Only cleanup if we have the necessary information
    if [[ -n "$PR_NUMBER" ]]; then
        pnpm tsx scripts/deploy-ec2.ts cleanup --pr "$PR_NUMBER" --force || true
    fi

    log_info "Cleanup completed"
}

# Main deployment function
main() {
    log_info "Starting GitHub Actions EC2 deployment"
    log_info "PR: $PR_NUMBER, Version: $VERSION, Environment: $ENVIRONMENT"

    # Trap errors for cleanup
    trap cleanup_on_failure ERR

    # Execute deployment steps
    validate_environment
    setup_dependencies
    build_and_upload_artifact
    deploy_to_ec2
    wait_for_healthy_deployment
    set_github_outputs

    log_success "GitHub Actions EC2 deployment completed successfully!"
}

# Show help
show_help() {
    cat << EOF
GitHub Actions EC2 Deployment Script

This script deploys applications to EC2 instances in the Macro AI infrastructure.
It's designed to be used in GitHub Actions workflows.

Required Environment Variables:
  PR_NUMBER              - Pull request number
  ARTIFACT_URL           - S3 URL for application artifact (or will be built)
  VERSION                - Deployment version
  AWS_REGION             - AWS region
  VPC_ID                 - VPC ID for deployment
  SUBNET_IDS             - Comma-separated subnet IDs
  SECURITY_GROUP_ID      - Security group ID
  LAUNCH_TEMPLATE_ID     - EC2 launch template ID
  TARGET_GROUP_ARN       - ALB target group ARN
  PARAMETER_STORE_PREFIX - Parameter Store prefix
  ARTIFACT_BUCKET        - S3 bucket for artifacts

Optional Environment Variables:
  BRANCH_NAME            - Git branch name
  ENVIRONMENT            - Environment name (default: development)
  INSTANCE_COUNT         - Number of instances (default: 1)
  TIMEOUT_MINUTES        - Deployment timeout (default: 15)

Usage:
  ./github-actions-deploy.sh [command]

Commands:
  deploy    - Deploy application (default)
  status    - Check deployment status
  cleanup   - Clean up deployment
  help      - Show this help

Examples:
  # Deploy in GitHub Actions
  ./github-actions-deploy.sh deploy

  # Check status
  ./github-actions-deploy.sh status

  # Cleanup
  ./github-actions-deploy.sh cleanup
EOF
}

# Command handling
case "${1:-deploy}" in
    deploy)
        main
        ;;
    status)
        validate_environment
        pnpm tsx scripts/deploy-ec2.ts status --pr "$PR_NUMBER"
        ;;
    cleanup)
        validate_environment
        pnpm tsx scripts/deploy-ec2.ts cleanup --pr "$PR_NUMBER" --force
        ;;
    help|--help|-h)
        show_help
        ;;
    *)
        log_error "Unknown command: $1"
        show_help
        exit 1
        ;;
esac
