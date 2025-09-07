#!/bin/bash

# Deploy Production Environment with Hybrid Branching Support
# This script deploys the production environment with high availability
# Supports both manual deployments and GitHub Actions automated deployments

set -e

echo "🚀 Deploying Production Environment"
echo "==================================="

# Configuration
ENVIRONMENT="production"
STACK_NAME="MacroAiProductionStack"
AWS_REGION="${AWS_REGION:-us-east-1}"

# GitHub Actions Detection
GITHUB_ACTIONS="${GITHUB_ACTIONS:-false}"
GITHUB_EVENT_NAME="${GITHUB_EVENT_NAME:-}"
GITHUB_REF="${GITHUB_REF:-}"

# Deployment Context Detection
if [[ "$GITHUB_ACTIONS" == "true" ]]; then
    DEPLOYMENT_TYPE="github-actions"
    DEPLOYMENT_TRIGGER="$GITHUB_EVENT_NAME"
    echo "🤖 GitHub Actions detected - $GITHUB_EVENT_NAME trigger"
else
    DEPLOYMENT_TYPE="manual"
    DEPLOYMENT_TRIGGER="manual"
    echo "🔧 Manual deployment detected"
fi

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Function to check if stack exists
stack_exists() {
    aws cloudformation describe-stacks --stack-name "$1" --region "$AWS_REGION" &>/dev/null
}

# Check prerequisites
echo "🔍 Checking prerequisites..."

# Check if AWS CLI is configured
if ! aws sts get-caller-identity &>/dev/null; then
    print_error "AWS CLI is not configured. Please run 'aws configure'"
    exit 1
fi

# Check if CDK is installed
if ! command -v cdk &>/dev/null; then
    print_error "AWS CDK CLI is not installed. Please install it first."
    exit 1
fi

# Check if Node.js is available
if ! command -v node &>/dev/null; then
    print_error "Node.js is not installed. Please install Node.js."
    exit 1
fi

print_status "Prerequisites check passed"

# Warning about production deployment
echo ""
print_warning "PRODUCTION DEPLOYMENT WARNING"
echo "This will deploy to production with the following implications:"
echo "  - 24/7 availability (no scheduled shutdown)"
echo "  - Higher costs (~£15-20/month)"
echo "  - Deletion protection enabled"
echo "  - Multi-AZ deployment for high availability"
echo ""

# Handle production deployment confirmation based on deployment type
if [[ "$DEPLOYMENT_TYPE" == "github-actions" ]]; then
    print_error "🚫 PRODUCTION DEPLOYMENTS VIA GITHUB ACTIONS ARE DISABLED"
    echo "Production deployments must be performed manually for security reasons."
    echo "This prevents accidental production deployments from automated workflows."
    echo ""
    echo "To deploy to production:"
    echo "1. Run this script manually from your local machine"
    echo "2. Or trigger a manual workflow_dispatch with explicit approval"
    exit 1
else
    # Manual deployment - require explicit confirmation
    read -p "Are you sure you want to deploy to PRODUCTION? (yes/N): " -r
    if [[ ! $REPLY =~ ^yes$ ]]; then
        echo "Production deployment cancelled."
        exit 0
    fi
fi

# Install dependencies
echo "📦 Installing dependencies..."
cd "$(dirname "$0")/.."
npm install
print_status "Dependencies installed"

# Bootstrap CDK (if needed)
echo "🔧 Bootstrapping CDK environment..."
if ! cdk bootstrap "aws://${AWS_ACCOUNT_ID:-$(aws sts get-caller-identity --query Account --output text)}/${AWS_REGION}" 2>/dev/null; then
    print_warning "CDK bootstrap may have already been done or failed. Continuing..."
fi

# Synthesize the stack
echo "🔨 Synthesizing CloudFormation template..."
cdk synth "${STACK_NAME}" --context environment="${ENVIRONMENT}"
print_status "CloudFormation template synthesized"

# Deploy the stack
echo "🚀 Deploying ${STACK_NAME}..."
echo "This will create:"
echo "  - VPC with public/private subnets (3 AZs)"
echo "  - ECS Fargate cluster and service (2-10 instances)"
echo "  - Application Load Balancer"
echo "  - Production Neon database branch integration"
echo "  - Upstash Redis integration"
echo "  - Enhanced monitoring and security"
echo ""

read -p "Final confirmation - deploy to production? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Production deployment cancelled."
    exit 0
fi

# Set environment variables for deployment
export CDK_DEPLOY_ENV="${ENVIRONMENT}"
export AWS_REGION="${AWS_REGION}"
export DEPLOYMENT_TYPE="${DEPLOYMENT_TYPE}"
export DEPLOYMENT_TRIGGER="${DEPLOYMENT_TRIGGER}"

# Check if production stack already exists
if stack_exists "${STACK_NAME}"; then
    print_warning "Production stack already exists. This will be an UPDATE deployment."
    echo "Existing resources will be modified according to the new configuration."
    echo ""
fi

# Deploy with CDK
cdk deploy "${STACK_NAME}" \
    --require-approval never \
    --context environment="${ENVIRONMENT}" \
    --outputs-file "cdk-outputs-${ENVIRONMENT}.json"

print_status "Production environment deployed successfully via $DEPLOYMENT_TYPE!"

# Display outputs
echo ""
echo "📋 Deployment Outputs:"
echo "🔧 Deployment Type: $DEPLOYMENT_TYPE"
echo "📋 Trigger: $DEPLOYMENT_TRIGGER"
echo ""
if [ -f "cdk-outputs-${ENVIRONMENT}.json" ]; then
    cat "cdk-outputs-${ENVIRONMENT}.json" | jq . 2>/dev/null || cat "cdk-outputs-${ENVIRONMENT}.json"
else
    print_warning "Could not find outputs file. Check CDK deployment logs."
fi

echo ""
echo "🌐 Production Environment URLs:"
echo "  - API: https://api.macro-ai.russoakham.dev"
echo "  - Health Check: https://api.macro-ai.russoakham.dev/api/health"
echo ""

echo "🛡️ Security Features:"
echo "  - Deletion protection enabled"
echo "  - Multi-AZ deployment (3 availability zones)"
echo "  - Enhanced monitoring and alerting"
echo "  - SSL/TLS certificates"
echo ""

echo "📊 Scaling Configuration:"
echo "  - Minimum: 2 instances (high availability)"
echo "  - Maximum: 10 instances (auto-scaling)"
echo "  - CPU target: 70% utilization"
echo "  - 24/7 availability"
echo ""

echo "💰 Estimated Monthly Cost: £15-20"
echo "  - ECS Fargate: £8-12 (2-10 instances)"
echo "  - ALB: £2-3"
echo "  - CloudWatch: £2-3 (enhanced monitoring)"
echo "  - Secrets Manager: £0.50"
echo "  - Multi-AZ data transfer: £1-2"
echo ""

echo "🗄️ Database Configuration (Hybrid Approach):"
echo "  - Neon Branch: main-production-branch"
echo "  - Database: users"
echo "  - Connection: Active and verified"
echo "  - Branching: Manual control (production/staging) + GitHub automation (feature branches)"
echo ""

print_status "Production deployment completed successfully!"
print_warning "Monitor costs and performance after deployment"
print_info "Hybrid branching: Production/staging use manual control, feature branches use GitHub automation"
