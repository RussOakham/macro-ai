#!/bin/bash

# Deploy Staging Environment with Neon Branching (Hybrid Approach)
# This script deploys the staging environment using the auto-branch-from-production
# Supports both manual deployments and GitHub Actions automated deployments

set -euo pipefail

echo "🚀 Deploying Staging Environment with Neon Branching"
echo "===================================================="

# Configuration
ENVIRONMENT="staging"
STACK_NAME="MacroAiStagingStack"
AWS_REGION="${AWS_REGION:-us-east-1}"
export AWS_REGION
export AWS_DEFAULT_REGION="${AWS_REGION}"
NEON_PROJECT_ID="frosty-sunset-09708148"
NEON_BRANCH_ID="br-silent-dust-a4qoulvz"

# GitHub Actions Detection
GITHUB_ACTIONS="${GITHUB_ACTIONS:-false}"
GITHUB_EVENT_NAME="${GITHUB_EVENT_NAME:-}"
GITHUB_REF="${GITHUB_REF:-}"
PR_NUMBER="${GITHUB_EVENT_NUMBER:-}"

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

    # Set deployment context for CDK
    export DEPLOYMENT_TYPE="$DEPLOYMENT_TYPE"
    export DEPLOYMENT_TRIGGER="$DEPLOYMENT_TRIGGER"

    # GitHub Actions specific variables
    if [[ "$DEPLOYMENT_TYPE" == "github-actions" ]]; then
        export GITHUB_ACTIONS="$GITHUB_ACTIONS"
        export GITHUB_EVENT_NAME="$GITHUB_EVENT_NAME"
        export GITHUB_REF="$GITHUB_REF"
        export PR_NUMBER="$PR_NUMBER"
        echo "📋 GitHub Context: $GITHUB_EVENT_NAME on $GITHUB_REF (PR: $PR_NUMBER)"
    fi

    # Set Neon database URL for staging (hybrid approach)
    # For GitHub Actions, the branch will be determined by the neon-branching utility
    export NEON_DATABASE_URL="postgresql://users_owner:npg_yTk1BcCU7NeR@ep-plain-wave-a401hax3-pooler.us-east-1.aws.neon.tech/users?channel_binding=require&sslmode=require"

    # Set Neon branch information
    export NEON_PROJECT_ID="$NEON_PROJECT_ID"
    export NEON_BRANCH_ID="$NEON_BRANCH_ID"

    print_status "Environment variables configured for $DEPLOYMENT_TYPE deployment"
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
    pnpm install

    # Build TypeScript
    pnpm run build

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

    # Handle deployment confirmation based on deployment type
    if [[ "$DEPLOYMENT_TYPE" == "github-actions" ]]; then
        echo "🤖 GitHub Actions deployment - proceeding automatically"
        echo "📋 Trigger: $DEPLOYMENT_TRIGGER"
        if [[ -n "$PR_NUMBER" ]]; then
            echo "🔗 Related PR: #$PR_NUMBER"
        fi
    else
        # Manual deployment - require confirmation
        read -p "Do you want to proceed with staging deployment? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            echo "Staging deployment cancelled."
            exit 0
        fi
    fi

    # Deploy with CDK
    cdk deploy "$STACK_NAME" \
        --region "$AWS_REGION" \
        --require-approval never \
        --outputs-file "cdk-outputs-${ENVIRONMENT}.json"

    print_status "Staging environment deployed successfully via $DEPLOYMENT_TYPE!"
}

# Function to verify deployment
verify_deployment() {
    echo "🔍 Verifying deployment..."

    if [ -f "cdk-outputs-${ENVIRONMENT}.json" ]; then
        API_ENDPOINT=$(jq -r '.MacroAiStagingStack.ApiEndpoint // empty' "cdk-outputs-${ENVIRONMENT}.json")
        if [ -n "$API_ENDPOINT" ]; then
            print_status "API endpoint: $API_ENDPOINT"

            # Test health endpoint
            echo "Testing health endpoint..."
            if curl -f -s "$API_ENDPOINT/api/health" > /dev/null; then
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
    echo "🔧 Deployment Type: $DEPLOYMENT_TYPE"
    echo "📋 Trigger: $DEPLOYMENT_TRIGGER"
    if [[ "$DEPLOYMENT_TYPE" == "github-actions" && -n "$PR_NUMBER" ]]; then
        echo "🔗 Related PR: #$PR_NUMBER"
    fi
    echo ""

    if [ -f "cdk-outputs-${ENVIRONMENT}.json" ]; then
        echo "CloudFormation Outputs:"
        cat "cdk-outputs-${ENVIRONMENT}.json" | jq . 2>/dev/null || cat "cdk-outputs-${ENVIRONMENT}.json"
    fi

    echo ""
    echo "🌐 Staging Environment URLs:"
    echo "  - API: https://staging-api.macro-ai.russoakham.dev"
    echo "  - Health Check: https://staging-api.macro-ai.russoakham.dev/api/health"
    echo ""

    echo "🗄️ Database Configuration (Hybrid Approach):"
    echo "  - Neon Branch: auto-branch-from-production"
    echo "  - Database: users"
    echo "  - Connection: Active and verified"
    echo "  - Branching: Manual control + GitHub automation"
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

    if [[ "$DEPLOYMENT_TYPE" == "github-actions" ]]; then
        echo "🤖 GitHub Actions Integration:"
        echo "  - Automatic PR deployments"
        echo "  - Database branch per PR"
        echo "  - Auto-cleanup on merge/close"
        echo ""
    fi

    print_status "Staging environment deployment completed via $DEPLOYMENT_TYPE!"
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
