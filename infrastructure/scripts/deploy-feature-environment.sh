#!/bin/bash

# Feature Environment Deployment Script
# This script deploys the feature environment to AWS ECS Fargate
# It uses the Neon feature branch and Upstash Redis configuration

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

# Environment variables
FEATURE_BRANCH_NAME="${FEATURE_BRANCH_NAME:-feature/main}"
ENV_NAME="${ENV_NAME:-feature}"
AWS_REGION="${AWS_REGION:-us-east-1}"

# Validate required environment variables
validate_environment() {
    log_info "Validating environment variables..."

    if [ -z "$AWS_PROFILE" ] && [ -z "$AWS_ACCESS_KEY_ID" ]; then
        log_error "AWS credentials not found. Set AWS_PROFILE or AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY"
        exit 1
    fi

    if [ -z "$RELATIONAL_DATABASE_URL" ]; then
        log_error "RELATIONAL_DATABASE_URL is required"
        exit 1
    fi

    if [ -z "$REDIS_URL" ]; then
        log_warning "REDIS_URL not set - Redis functionality will be disabled"
    fi

    log_success "Environment validation passed"
}

# Setup Neon database branch for feature
setup_neon_branch() {
    log_info "Setting up Neon database branch for feature environment..."

    # Extract feature branch name from environment or git
    if [ -n "$GITHUB_HEAD_REF" ]; then
        FEATURE_BRANCH_NAME="feature/${GITHUB_HEAD_REF}"
    elif [ -n "$FEATURE_BRANCH_NAME" ]; then
        # Use provided branch name
        FEATURE_BRANCH_NAME="$FEATURE_BRANCH_NAME"
    else
        # Try to get from git
        CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "main")
        FEATURE_BRANCH_NAME="feature/${CURRENT_BRANCH}"
    fi

    log_info "Using feature branch: $FEATURE_BRANCH_NAME"

    # Export for use in CDK
    export NEON_BRANCH_NAME="$FEATURE_BRANCH_NAME"
    export APP_ENV="feature"
}

# Verify AWS CLI and CDK
verify_aws_setup() {
    log_info "Verifying AWS CLI and CDK setup..."

    # Check AWS CLI
    if ! command -v aws &> /dev/null; then
        log_error "AWS CLI is not installed"
        exit 1
    fi

    # Check CDK
    if ! command -v cdk &> /dev/null; then
        log_error "AWS CDK is not installed"
        exit 1
    fi

    # Check AWS credentials
    if ! aws sts get-caller-identity &> /dev/null; then
        log_error "AWS credentials are not configured properly"
        exit 1
    fi

    log_success "AWS CLI and CDK verification passed"
}

# Deploy infrastructure
deploy_infrastructure() {
    log_info "Deploying infrastructure to AWS..."

    cd infrastructure

    # Install dependencies
    log_info "Installing dependencies..."
    pnpm install --frozen-lockfile

    # Build CDK project
    log_info "Building CDK project..."
    pnpm build

    # Deploy feature environment
    log_info "Deploying feature environment to ECS..."
    STACK_NAME="MacroAiFeature-${FEATURE_BRANCH_NAME//[^a-zA-Z0-9]/-}Stack"

    cdk deploy "$STACK_NAME" \
        --context environmentName="$ENV_NAME" \
        --context branchName="$FEATURE_BRANCH_NAME" \
        --context neonBranch="$NEON_BRANCH_NAME" \
        --context appEnv="feature" \
        --context scale="feature" \
        --require-approval never \
        --outputs-file cdk-outputs.json

    log_success "Infrastructure deployment completed"

    # Extract outputs
    if [ -f cdk-outputs.json ]; then
        API_URL=$(jq -r ".[\"$STACK_NAME\"].ApiUrl" cdk-outputs.json 2>/dev/null || echo "")
        ALB_DNS=$(jq -r ".[\"$STACK_NAME\"].LoadBalancerDnsName" cdk-outputs.json 2>/dev/null || echo "")

        if [ -n "$API_URL" ]; then
            log_success "API URL: $API_URL"
        fi

        if [ -n "$ALB_DNS" ]; then
            log_success "Load Balancer DNS: $ALB_DNS"
        fi
    fi
}

# Verify deployment
verify_deployment() {
    log_info "Verifying deployment..."

    # Wait for services to be healthy
    sleep 30

    # Check if the API is responding
    if [ -n "$API_URL" ]; then
        log_info "Testing API health endpoint..."
        if curl -f -s "$API_URL/health" > /dev/null 2>&1; then
            log_success "API health check passed"
        else
            log_warning "API health check failed - service may still be starting"
        fi
    fi

    log_success "Deployment verification completed"
}

# Main deployment function
main() {
    log_info "Starting feature environment deployment..."
    log_info "Feature Branch: $FEATURE_BRANCH_NAME"
    log_info "Environment: $ENV_NAME"
    log_info "AWS Region: $AWS_REGION"

    validate_environment
    setup_neon_branch
    verify_aws_setup
    deploy_infrastructure
    verify_deployment

    log_success "🎉 Feature environment deployment completed successfully!"
    log_info ""
    log_info "Next steps:"
    log_info "1. Test your feature branch deployment"
    log_info "2. Create a pull request to merge your changes"
    log_info "3. The PR will trigger automated deployment to preview environment"
    log_info "4. After approval, merge to staging and then production"
}

# Handle script interruption
trap 'log_error "Deployment interrupted by user"; exit 1' INT TERM

# Run main function
main "$@"
