#!/bin/bash

# Macro AI Infrastructure Deployment Script
# This script builds the Lambda package and deploys the CDK infrastructure
#
# v1.0.0+ Features:
# - Resolves API Gateway deployment resource conflicts
# - Uses single explicit deployment path (no implicit deployOptions)
# - Includes comprehensive error handling and validation

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
ENVIRONMENT=${CDK_DEPLOY_ENV:-development}
SCALE=${CDK_DEPLOY_SCALE:-hobby}
AWS_REGION=${AWS_REGION:-us-east-1}
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$(dirname "$SCRIPT_DIR")")"
EXPRESS_API_DIR="$PROJECT_ROOT/apps/express-api"
EC2_DIST_DIR="$EXPRESS_API_DIR/dist"

# Generate stack name
ENV_CAPITALIZED="$(echo "$ENVIRONMENT" | awk '{print toupper(substr($0,1,1)) tolower(substr($0,2))}')"
STACK_NAME="MacroAi${ENV_CAPITALIZED}Stack"

echo -e "${BLUE}🚀 Macro AI Infrastructure Deployment${NC}"
echo -e "${BLUE}Environment: $ENVIRONMENT${NC}"
echo -e "${BLUE}Scale: $SCALE${NC}"
echo -e "${BLUE}Stack Name: $STACK_NAME${NC}"
echo -e "${BLUE}Region: $AWS_REGION${NC}"
echo ""

# Function to print status messages
print_status() {
    echo -e "${GREEN}✓${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

# Check prerequisites
echo -e "${BLUE}📋 Checking prerequisites...${NC}"

# Check if pnpm is installed
if ! command -v pnpm &> /dev/null; then
    print_error "pnpm is not installed. Please install it with: npm install -g pnpm"
    exit 1
fi

# Check if AWS CLI is installed
if ! command -v aws &> /dev/null; then
    print_error "AWS CLI is not installed. Please install it first."
    exit 1
fi

# Check if CDK is installed
if ! command -v cdk &> /dev/null; then
    print_error "AWS CDK is not installed. Please install it with: pnpm add -g aws-cdk"
    exit 1
fi

# Check if we're in the infrastructure directory
if [ ! -f "package.json" ] || [ ! -f "cdk.json" ]; then
    print_error "Please run this script from the infrastructure directory"
    exit 1
fi

# Check if Express API directory exists
if [ ! -d "$EXPRESS_API_DIR" ]; then
    print_error "Express API directory not found at $EXPRESS_API_DIR"
    exit 1
fi

print_status "Prerequisites check passed"

# Install infrastructure dependencies
echo -e "${BLUE}📦 Installing infrastructure dependencies...${NC}"
pnpm install --frozen-lockfile
print_status "Infrastructure dependencies installed"

# Note: Lambda build steps have been removed as part of EC2 migration
echo -e "${BLUE}⚠️  Lambda build steps removed - migrating to EC2 deployment${NC}"
cd "$EXPRESS_API_DIR"

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "Installing Express API dependencies..."
    pnpm install --frozen-lockfile
fi

# Build the Express API (standard build, not Lambda)
pnpm build

echo -e "${YELLOW}⚠️  Note: This deployment script needs to be updated for EC2 deployment${NC}"

print_status "Lambda package built successfully"

# Return to infrastructure directory
cd - > /dev/null

# Build infrastructure
echo -e "${BLUE}🔨 Building infrastructure...${NC}"
pnpm build
print_status "Infrastructure built successfully"

# Check if CDK is bootstrapped
echo -e "${BLUE}🔍 Checking CDK bootstrap status...${NC}"
if ! aws cloudformation describe-stacks --stack-name CDKToolkit --region "$AWS_REGION" &> /dev/null; then
    print_warning "CDK not bootstrapped in region $AWS_REGION"
    echo -e "${YELLOW}Running CDK bootstrap...${NC}"
    pnpm cdk bootstrap
    print_status "CDK bootstrap completed"
else
    print_status "CDK already bootstrapped"
fi

# Synthesize CloudFormation template
echo -e "${BLUE}📄 Synthesizing CloudFormation template...${NC}"
pnpm synth
print_status "CloudFormation template synthesized"

# Show diff if stack exists
echo -e "${BLUE}📊 Checking for changes...${NC}"
if aws cloudformation describe-stacks --stack-name "$STACK_NAME" --region "$AWS_REGION" &> /dev/null; then
    echo -e "${YELLOW}Showing differences from current deployment:${NC}"
    pnpm diff || true  # Don't fail if diff shows changes
else
    print_status "New deployment - no existing stack to compare"
fi

# Deploy the stack
echo -e "${BLUE}🚀 Deploying infrastructure...${NC}"
if ! pnpm cdk deploy "$STACK_NAME" --require-approval never; then
    print_error "Infrastructure deployment failed!"
    echo -e "${YELLOW}💡 Troubleshooting tips:${NC}"
    echo "1. Check AWS credentials: aws sts get-caller-identity"
    echo "2. Verify CDK bootstrap: aws cloudformation describe-stacks --stack-name CDKToolkit"
    echo "3. Check Express API build: ls -la $EC2_DIST_DIR/index.js"
    echo "4. Review deployment logs above for specific errors"
    echo "5. EC2 deployment conflicts: Check for existing Auto Scaling Groups or Load Balancers"
    echo "   - Verify EC2 instances can be launched in target subnets"
    echo "   - Check security group configurations and VPC settings"
    exit 1
fi

print_status "Infrastructure deployed successfully!"

# Get stack outputs
echo -e "${BLUE}📋 Stack Outputs:${NC}"
if ! aws cloudformation describe-stacks \
    --stack-name "$STACK_NAME" \
    --region "$AWS_REGION" \
    --query 'Stacks[0].Outputs[*].[OutputKey,OutputValue,Description]' \
    --output table; then
    print_warning "Could not retrieve stack outputs. Stack may still be updating."
    echo "You can check outputs later with:"
    echo "aws cloudformation describe-stacks --stack-name $STACK_NAME --region $AWS_REGION"
fi

echo ""
echo -e "${GREEN}🎉 Deployment completed successfully!${NC}"
echo ""
echo -e "${YELLOW}📝 Next Steps:${NC}"
echo "1. Update Parameter Store values with your actual secrets"
echo "2. Test the API endpoint shown in the outputs above"
echo "3. Configure your frontend to use the new API endpoint"
echo ""
echo -e "${BLUE}💡 Useful Commands:${NC}"
echo "• View logs: aws logs tail /aws/lambda/macro-ai-$ENVIRONMENT-api --follow"
echo "• Update parameters: aws ssm put-parameter --name '/macro-ai/$ENVIRONMENT/critical/openai-api-key' --value 'your-key' --type SecureString --overwrite"
echo "• Test API: curl \$(aws cloudformation describe-stacks --stack-name $STACK_NAME --query 'Stacks[0].Outputs[?OutputKey==\`ApiEndpoint\`].OutputValue' --output text)api/health"
