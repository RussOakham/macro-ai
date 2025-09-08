#!/bin/bash

# Deploy Staging Environment
# This script deploys the staging environment with minimal cost configuration

set -euo pipefail

echo "🚀 Deploying Staging Environment"
echo "================================="

# Configuration
ENVIRONMENT="staging"
STACK_NAME="MacroAiStagingStack"
AWS_REGION="${AWS_REGION:-us-east-1}"
export AWS_REGION
export AWS_DEFAULT_REGION="${AWS_REGION}"

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

# Install dependencies
echo "📦 Installing dependencies..."
cd "$(dirname "$0")/.."
pnpm install --frozen-lockfile
print_status "Dependencies installed"

# Bootstrap CDK (if needed)
echo "🔧 Bootstrapping CDK environment..."
BOOTSTRAP_OUTPUT=$(cdk bootstrap "aws://${AWS_ACCOUNT_ID:-$(aws sts get-caller-identity --query Account --output text)}/${AWS_REGION}" 2>&1)
BOOTSTRAP_EXIT_CODE=$?

if [ $BOOTSTRAP_EXIT_CODE -eq 0 ]; then
    print_status "CDK environment bootstrapped successfully"
elif echo "$BOOTSTRAP_OUTPUT" | grep -q "already bootstrapped"; then
    print_status "CDK environment already bootstrapped"
else
    print_warning "CDK bootstrap encountered issues: $BOOTSTRAP_OUTPUT"
    print_warning "Continuing with deployment..."
fi

# Synthesize the stack
echo "🔨 Synthesizing CloudFormation template..."
cdk synth "${STACK_NAME}" --context environment="${ENVIRONMENT}"
print_status "CloudFormation template synthesized"

# Deploy the stack
echo "🚀 Deploying ${STACK_NAME}..."
echo "This will create:"
echo "  - VPC with public/private subnets"
echo "  - ECS Fargate cluster and service"
echo "  - Application Load Balancer"
echo "  - Scheduled scaling (10 PM - 6 AM UTC)"
echo "  - Neon database integration"
echo "  - Upstash Redis integration"
echo ""

read -p "Do you want to proceed with the deployment? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Deployment cancelled."
    exit 0
fi

# Set environment variables for deployment
export CDK_DEPLOY_ENV="${ENVIRONMENT}"
export AWS_REGION="${AWS_REGION}"

# Deploy with CDK
cdk deploy "${STACK_NAME}" \
    --require-approval never \
    --context environment="${ENVIRONMENT}" \
    --outputs-file "cdk-outputs-${ENVIRONMENT}.json"

print_status "Staging environment deployed successfully!"

# Display outputs
echo ""
echo "📋 Deployment Outputs:"
if [ -f "cdk-outputs-${ENVIRONMENT}.json" ]; then
    cat "cdk-outputs-${ENVIRONMENT}.json" | jq . 2>/dev/null || cat "cdk-outputs-${ENVIRONMENT}.json"
else
    print_warning "Could not find outputs file. Check CDK deployment logs."
fi

echo ""
echo "🌐 Staging Environment URLs:"

# Parse API endpoint from CDK outputs
API_ENDPOINT=$(jq -r '.MacroAiStagingStack.ApiEndpoint // empty' "cdk-outputs-${ENVIRONMENT}.json" 2>/dev/null || echo "")

if [ -n "$API_ENDPOINT" ]; then
    echo "  - API: ${API_ENDPOINT}"
    echo "  - Health Check: ${API_ENDPOINT}/api/health"
else
    echo "  - API: [Could not parse from CDK outputs - check deployment]"
    echo "  - Health Check: [Could not parse from CDK outputs - check deployment]"
fi
echo ""

echo "⏰ Scheduled Scaling:"
echo "  - Shutdown: 10:00 PM UTC daily"
echo "  - Startup: 6:00 AM UTC daily"
echo "  - This saves ~$4-6/month in compute costs"
echo ""

echo "💰 Estimated Monthly Cost: $8-12"
echo "  - ECS Fargate: $4-6 (with scheduled scaling)"
echo "  - ALB: $2-3"
echo "  - CloudWatch: $1-2"
echo "  - Secrets Manager: $0.50"
echo ""

print_status "Staging deployment completed successfully!"
