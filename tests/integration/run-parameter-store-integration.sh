#!/bin/bash

# Parameter Store Configuration Integration Test Runner
# 
# This script runs integration tests to verify the Parameter Store configuration changes
# made to fix the PR environment startup issues.

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
TEST_FILE="parameter-store-config-integration.test.ts"

echo -e "${BLUE}🧪 Parameter Store Configuration Integration Tests${NC}"
echo "=================================================="
echo ""

# Check if we're in the right directory
if [[ ! -f "$SCRIPT_DIR/$TEST_FILE" ]]; then
    echo -e "${RED}❌ Error: Test file not found at $SCRIPT_DIR/$TEST_FILE${NC}"
    exit 1
fi

# Check AWS credentials
echo -e "${YELLOW}🔐 Checking AWS credentials...${NC}"
if ! aws sts get-caller-identity > /dev/null 2>&1; then
    echo -e "${RED}❌ Error: AWS credentials not configured or invalid${NC}"
    echo "Please configure AWS credentials using:"
    echo "  aws configure"
    echo "  or set AWS_PROFILE environment variable"
    exit 1
fi

AWS_IDENTITY=$(aws sts get-caller-identity --query 'Arn' --output text)
echo -e "${GREEN}✅ AWS credentials configured: $AWS_IDENTITY${NC}"
echo ""

# Check Parameter Store access
echo -e "${YELLOW}🔍 Checking Parameter Store access...${NC}"
if ! aws ssm describe-parameters --max-items 1 > /dev/null 2>&1; then
    echo -e "${RED}❌ Error: Cannot access AWS Parameter Store${NC}"
    echo "Please ensure your AWS credentials have SSM permissions"
    exit 1
fi

echo -e "${GREEN}✅ Parameter Store access confirmed${NC}"
echo ""

# Check if development parameters exist
echo -e "${YELLOW}📋 Checking development parameters...${NC}"
PARAM_COUNT=$(aws ssm get-parameters-by-path --path "/macro-ai/development/" --query 'Parameters | length(@)' --output text 2>/dev/null | head -1 || echo "0")

if [[ "$PARAM_COUNT" -eq 0 ]]; then
    echo -e "${RED}❌ Warning: No parameters found at /macro-ai/development/${NC}"
    echo "This test requires development parameters to be set up in Parameter Store"
    echo ""
    echo "To set up parameters, run:"
    echo "  cd $PROJECT_ROOT/infrastructure"
    echo "  ./scripts/organize-parameter-store.sh create-shared"
    echo ""
    read -p "Continue anyway? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
else
    echo -e "${GREEN}✅ Found $PARAM_COUNT parameters in development environment${NC}"
fi

echo ""

# Set up test environment
echo -e "${YELLOW}⚙️  Setting up test environment...${NC}"
cd "$SCRIPT_DIR"

# Install dependencies if needed
if [[ ! -d "node_modules" ]]; then
    echo "Installing dependencies..."
    pnpm install
fi

# Set environment variables for testing
export NODE_ENV=test
export AWS_REGION=us-east-1

echo -e "${GREEN}✅ Test environment ready${NC}"
echo ""

# Run the integration tests
echo -e "${BLUE}🚀 Running Parameter Store integration tests...${NC}"
echo ""

# Run with verbose output and proper timeout
if pnpm test:parameter-store; then
    echo ""
    echo -e "${GREEN}✅ All Parameter Store integration tests passed!${NC}"
    echo ""
    echo -e "${BLUE}📊 Test Summary:${NC}"
    echo "• Direct AWS Parameter Store access: ✅"
    echo "• Parameter Store Service integration: ✅"
    echo "• Enhanced Config Service integration: ✅"
    echo "• PR environment routing logic: ✅"
    echo "• End-to-end configuration loading: ✅"
    echo ""
    echo -e "${GREEN}🎉 The Parameter Store configuration changes are working correctly!${NC}"
    echo "PR environments like 'pr-52' should now start successfully."
else
    echo ""
    echo -e "${RED}❌ Some integration tests failed${NC}"
    echo ""
    echo -e "${YELLOW}🔧 Troubleshooting tips:${NC}"
    echo "1. Verify AWS credentials have proper SSM permissions"
    echo "2. Check that development parameters exist in Parameter Store:"
    echo "   aws ssm get-parameters-by-path --path '/macro-ai/development/'"
    echo "3. Ensure parameter names match the UPPER_CASE format (API_KEY, etc.)"
    echo "4. Check AWS region is set to us-east-1"
    echo ""
    exit 1
fi
