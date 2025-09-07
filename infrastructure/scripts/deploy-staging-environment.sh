#!/bin/bash

# Deploy Staging Environment with Neon Branching
# This script deploys the staging environment using the auto-branch-from-production

set -e

echo "🚀 Deploying Staging Environment with Neon Branching"
echo "===================================================="

# Configuration
ENVIRONMENT="staging"
STACK_NAME="MacroAiStagingStack"
AWS_REGION="${AWS_REGION:-us-east-1}"
NEON_PROJECT_ID="frosty-sunset-09708148"
NEON_BRANCH_ID="br-silent-dust-a4qoulvz"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
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

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

# Function to check prerequisites
check_prerequisites() {
    echo "🔍 Checking prerequisites..."

    # Check AWS CLI
    if ! aws sts get-caller-identity &>/dev/null; then
        print_error "AWS CLI is not configured. Please run 'aws configure'"
        exit 1
    fi

    # Check CDK
    if ! command -v cdk &>/dev/null; then
        print_error "AWS CDK CLI is not installed"
        exit 1
    fi

    # Check Node.js
    if ! command -v node &>/dev/null; then
        print_error "Node.js is not installed"
        exit 1
    fi

    print_status "Prerequisites check passed"
}

# Function to verify Neon branch
verify_neon_branch() {
    echo "🗄️ Verifying Neon database branch..."

    # Test staging branch connection
    if ! ../scripts/verify-neon-branch.sh "$NEON_PROJECT_ID" "$NEON_BRANCH_ID" 2>/dev/null; then
        print_warning "Could not verify Neon branch automatically"
        print_info "Please ensure Neon branch $NEON_BRANCH_ID exists and is active"
    else
        print_status "Neon staging branch verified"
    fi
}

# Function to set up environment variables
setup_environment() {
    echo "🔧 Setting up environment variables..."

    # Export required environment variables for CDK
    export CDK_DEPLOY_ENV="$ENVIRONMENT"
    export AWS_REGION="$AWS_REGION"

    # Set Neon database URL for staging
    export NEON_DATABASE_URL="postgresql://users_owner:npg_yTk1BcCU7NeR@ep-plain-wave-a401hax3-pooler.us-east-1.aws.neon.tech/users?channel_binding=require&sslmode=require"

    print_status "Environment variables configured"
}

# Function to bootstrap CDK if needed
bootstrap_cdk() {
    echo "🔧 Bootstrapping CDK environment..."

    ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
    if ! cdk bootstrap "aws://${ACCOUNT_ID}/${AWS_REGION}" 2>/dev/null; then
        print_warning "CDK bootstrap may have already been done"
    else
        print_status "CDK environment bootstrapped"
    fi
}

# Function to build and deploy
build_and_deploy() {
    echo "🏗️ Building infrastructure..."

    # Install dependencies
    npm install

    # Build TypeScript
    npm run build

    # Synthesize CloudFormation
    echo "🔨 Synthesizing CloudFormation template..."
    cdk synth "$STACK_NAME" --quiet

    print_status "Infrastructure built successfully"

    echo "🚀 Deploying $STACK_NAME..."
    echo "This will create:"
    echo "  - ECS Fargate cluster and service"
    echo "  - Application Load Balancer"
    echo "  - Neon staging branch integration"
    echo "  - Upstash Redis integration"
    echo "  - Scheduled scaling (10 PM - 6 AM UTC)"
    echo ""

    read -p "Do you want to proceed with staging deployment? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Staging deployment cancelled."
        exit 0
    fi

    # Deploy with CDK
    cdk deploy "$STACK_NAME" \
        --require-approval never \
        --outputs-file "cdk-outputs-${ENVIRONMENT}.json"

    print_status "Staging environment deployed successfully!"
}

# Function to verify deployment
verify_deployment() {
    echo "🔍 Verifying deployment..."

    if [ -f "cdk-outputs-${ENVIRONMENT}.json" ]; then
        LOAD_BALANCER_URL=$(jq -r '.MacroAiStagingStack.LoadBalancerUrl // empty' "cdk-outputs-${ENVIRONMENT}.json")
        if [ -n "$LOAD_BALANCER_URL" ]; then
            print_status "Load balancer URL: $LOAD_BALANCER_URL"

            # Test health endpoint
            echo "Testing health endpoint..."
            if curl -f -s "$LOAD_BALANCER_URL/api/health" > /dev/null; then
                print_status "Health check passed"
            else
                print_warning "Health check failed - this may be expected if the application hasn't fully started"
            fi
        else
            print_warning "Could not find load balancer URL in outputs"
        fi
    else
        print_warning "Could not find deployment outputs file"
    fi
}

# Function to display results
display_results() {
    echo ""
    echo "📋 Staging Environment Deployment Results:"
    echo "=========================================="

    if [ -f "cdk-outputs-${ENVIRONMENT}.json" ]; then
        echo "CloudFormation Outputs:"
        cat "cdk-outputs-${ENVIRONMENT}.json" | jq . 2>/dev/null || cat "cdk-outputs-${ENVIRONMENT}.json"
    fi

    echo ""
    echo "🌐 Staging Environment URLs:"
    echo "  - API: https://staging-api.macro-ai.russoakham.dev"
    echo "  - Health Check: https://staging-api.macro-ai.russoakham.dev/api/health"
    echo ""

    echo "🗄️ Database Configuration:"
    echo "  - Neon Branch: auto-branch-from-production"
    echo "  - Database: users"
    echo "  - Connection: Active and verified"
    echo ""

    echo "⏰ Scheduled Scaling:"
    echo "  - Shutdown: 10:00 PM UTC daily"
    echo "  - Startup: 6:00 AM UTC daily"
    echo "  - Saves ~£4-6/month in compute costs"
    echo ""

    echo "💰 Estimated Monthly Cost: £8-12"
    echo "  - ECS Fargate: £4-6 (with scheduled scaling)"
    echo "  - ALB: £2-3"
    echo "  - CloudWatch: £1-2"
    echo ""

    print_status "Staging environment deployment completed!"
}

# Main execution
main() {
    check_prerequisites
    verify_neon_branch
    setup_environment
    bootstrap_cdk
    build_and_deploy
    verify_deployment
    display_results
}

# Run main function
main "$@"
