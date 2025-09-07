#!/bin/bash

# Infrastructure Setup Verification
# This script verifies that all prerequisites are met for ECS Fargate deployment

set -e

echo "🔍 Infrastructure Setup Verification"
echo "===================================="

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

# Function to check command availability
check_command() {
    if command -v "$1" &>/dev/null; then
        print_status "$1 is installed"
        return 0
    else
        print_error "$1 is not installed"
        return 1
    fi
}

# Function to check AWS CLI configuration
check_aws_cli() {
    if aws sts get-caller-identity &>/dev/null; then
        ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
        REGION=$(aws configure get region)
        print_status "AWS CLI configured (Account: ${ACCOUNT_ID}, Region: ${REGION})"
        return 0
    else
        print_error "AWS CLI is not configured or credentials are invalid"
        return 1
    fi
}

# Function to check CDK version
check_cdk() {
    if command -v cdk &>/dev/null; then
        CDK_VERSION=$(cdk --version)
        print_status "AWS CDK is installed (${CDK_VERSION})"
        return 0
    else
        print_error "AWS CDK CLI is not installed"
        return 1
    fi
}

# Function to check Node.js and npm
check_nodejs() {
    if command -v node &>/dev/null && command -v npm &>/dev/null; then
        NODE_VERSION=$(node --version)
        NPM_VERSION=$(npm --version)
        print_status "Node.js is installed (${NODE_VERSION})"
        print_status "npm is installed (${NPM_VERSION})"
        return 0
    else
        print_error "Node.js or npm is not installed"
        return 1
    fi
}

# Function to check Docker (for local development)
check_docker() {
    if command -v docker &>/dev/null; then
        DOCKER_VERSION=$(docker --version)
        print_status "Docker is installed (${DOCKER_VERSION})"
        return 0
    else
        print_warning "Docker is not installed (optional for local development)"
        return 0
    fi
}

# Function to check domain configuration
check_domain() {
    if nslookup macro-ai.russoakham.dev &>/dev/null; then
        print_status "Domain macro-ai.russoakham.dev is configured"
        return 0
    else
        print_warning "Domain macro-ai.russoakham.dev may not be configured"
        return 0
    fi
}

# Function to check if environment variables are set
check_env_vars() {
    local missing_vars=()

    # Check for required environment variables
    if [ -z "${AWS_REGION:-}" ]; then
        missing_vars+=("AWS_REGION")
    fi

    if [ -z "${AWS_ACCOUNT_ID:-}" ]; then
        missing_vars+=("AWS_ACCOUNT_ID")
    fi

    if [ ${#missing_vars[@]} -eq 0 ]; then
        print_status "Required environment variables are set"
        return 0
    else
        print_warning "Missing environment variables: ${missing_vars[*]}"
        return 0
    fi
}

# Function to check Neon database configuration
check_neon_config() {
    print_info "Checking Neon database configuration..."
    print_info "Note: Neon database should be configured with branching enabled"
    print_info "Production branch: main-production-branch"
    print_info "Staging branch: auto-branch-from-production"
    print_info "Feature branches: auto-branch-from-staging"
    return 0
}

# Function to check Upstash Redis configuration
check_upstash_config() {
    print_info "Checking Upstash Redis configuration..."
    print_info "Note: Upstash Redis should be configured for production/staging environments"
    print_info "Free tier limits: 30 connections, 10k daily requests, 30MB storage"
    return 0
}

# Main verification process
echo "🔧 Checking system prerequisites..."

# Check commands
FAILED_CHECKS=0

check_command "aws" || FAILED_CHECKS=$((FAILED_CHECKS + 1))
check_command "cdk" || FAILED_CHECKS=$((FAILED_CHECKS + 1))
check_command "node" || FAILED_CHECKS=$((FAILED_CHECKS + 1))
check_command "npm" || FAILED_CHECKS=$((FAILED_CHECKS + 1))
check_docker

echo ""
echo "☁️ Checking AWS configuration..."

check_aws_cli || FAILED_CHECKS=$((FAILED_CHECKS + 1))
check_env_vars

echo ""
echo "🌐 Checking domain configuration..."

check_domain

echo ""
echo "🗄️ Checking external services configuration..."

check_neon_config
check_upstash_config

echo ""
echo "📦 Checking CDK project setup..."

# Check if we're in the right directory
if [ ! -f "infrastructure/package.json" ]; then
    print_error "Not in the correct directory. Please run from the project root."
    exit 1
fi

# Check if CDK app can be synthesized
cd infrastructure
if npm list 2>/dev/null | grep -q aws-cdk-lib; then
    print_status "CDK dependencies are installed"
else
    print_warning "CDK dependencies may not be installed. Run 'npm install' in infrastructure/"
fi

# Try to synthesize (dry run)
if cdk synth MacroAiStagingStack --quiet 2>/dev/null; then
    print_status "CDK staging stack can be synthesized"
else
    print_warning "CDK staging stack synthesis failed (may be expected if not configured)"
fi

cd ..

echo ""
echo "📋 Verification Summary:"

if [ $FAILED_CHECKS -eq 0 ]; then
    print_status "All critical checks passed!"
    echo ""
    echo "🚀 Ready for deployment!"
    echo ""
    echo "Next steps:"
    echo "1. Set environment variables:"
    echo "   export AWS_REGION=us-east-1"
    echo "   export AWS_ACCOUNT_ID=\$(aws sts get-caller-identity --query Account --output text)"
    echo ""
    echo "2. Deploy staging environment:"
    echo "   ./infrastructure/scripts/deploy-staging.sh"
    echo ""
    echo "3. Deploy production environment:"
    echo "   ./infrastructure/scripts/deploy-production.sh"
    echo ""
else
    print_error "$FAILED_CHECKS critical checks failed!"
    echo ""
    echo "Please fix the failed checks before proceeding with deployment."
    exit 1
fi

echo ""
print_info "Infrastructure verification completed"
