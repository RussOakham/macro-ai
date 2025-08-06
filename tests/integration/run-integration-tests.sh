#!/bin/bash

# Integration Test Runner
# Runs comprehensive integration tests against deployed infrastructure

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
ENVIRONMENT=${TEST_ENVIRONMENT:-hobby}
AWS_REGION=${AWS_REGION:-us-east-1}
STACK_NAME="MacroAi$(echo $ENVIRONMENT | sed 's/.*/\u&/')Stack"
TIMEOUT=${TEST_TIMEOUT:-300} # 5 minutes default timeout

echo -e "${BLUE}🧪 Integration Test Runner${NC}"
echo -e "${BLUE}Environment: $ENVIRONMENT${NC}"
echo -e "${BLUE}Region: $AWS_REGION${NC}"
echo -e "${BLUE}Stack: $STACK_NAME${NC}"
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
echo -e "${BLUE}🔍 Checking prerequisites...${NC}"

# Check if AWS CLI is available
if ! command -v aws &> /dev/null; then
    print_error "AWS CLI is not installed or not in PATH"
    exit 1
fi

# Check AWS credentials
if ! aws sts get-caller-identity &> /dev/null; then
    print_error "AWS credentials not configured or invalid"
    exit 1
fi

# Check if Node.js and pnpm are available
if ! command -v node &> /dev/null; then
    print_error "Node.js is not installed or not in PATH"
    exit 1
fi

if ! command -v pnpm &> /dev/null; then
    print_error "pnpm is not installed or not in PATH"
    exit 1
fi

print_status "Prerequisites check passed"

# Get deployment information
echo -e "${BLUE}📋 Getting deployment information...${NC}"

# Get API Gateway endpoint
API_ENDPOINT=$(aws cloudformation describe-stacks \
    --stack-name "$STACK_NAME" \
    --region "$AWS_REGION" \
    --query 'Stacks[0].Outputs[?OutputKey==`ApiEndpoint`].OutputValue' \
    --output text 2>/dev/null || echo "")

if [ -z "$API_ENDPOINT" ] || [ "$API_ENDPOINT" == "None" ]; then
    print_error "Could not find API Gateway endpoint in stack outputs"
    print_error "Make sure the infrastructure is deployed: $STACK_NAME"
    exit 1
fi

# Get Lambda function name
LAMBDA_FUNCTION_NAME=$(aws cloudformation describe-stacks \
    --stack-name "$STACK_NAME" \
    --region "$AWS_REGION" \
    --query 'Stacks[0].Outputs[?OutputKey==`LambdaFunctionName`].OutputValue' \
    --output text 2>/dev/null || echo "")

print_status "API Endpoint: $API_ENDPOINT"
if [ -n "$LAMBDA_FUNCTION_NAME" ]; then
    print_status "Lambda Function: $LAMBDA_FUNCTION_NAME"
fi

# Set up test environment variables
echo -e "${BLUE}🔧 Setting up test environment...${NC}"

export TEST_API_ENDPOINT="$API_ENDPOINT"
export TEST_API_KEY="${TEST_API_KEY:-test-api-key-32-characters-long-dummy}"
export TEST_ENVIRONMENT="$ENVIRONMENT"
export TEST_TIMEOUT="$TIMEOUT"

# Optional test user credentials (for auth tests)
export TEST_USER_EMAIL="${TEST_USER_EMAIL:-test@example.com}"
export TEST_USER_PASSWORD="${TEST_USER_PASSWORD:-TestPassword123!}"
export TEST_USER_USERNAME="${TEST_USER_USERNAME:-testuser}"

print_status "Test environment configured"

# Create results directory
mkdir -p tests/integration/results

# Pre-flight check - verify API is accessible
echo -e "${BLUE}🚀 Running pre-flight check...${NC}"

HEALTH_CHECK=$(curl -s -w "%{http_code}" -o /tmp/health_check.json "${API_ENDPOINT}api/health" || echo "000")

if [ "$HEALTH_CHECK" == "200" ]; then
    print_status "API is accessible and responding"
    HEALTH_MESSAGE=$(jq -r '.message' /tmp/health_check.json 2>/dev/null || echo "No message")
    echo "  Response: $HEALTH_MESSAGE"
else
    print_error "API health check failed (HTTP $HEALTH_CHECK)"
    if [ -f /tmp/health_check.json ]; then
        echo "Response body:"
        cat /tmp/health_check.json
    fi
    print_warning "Continuing with tests - some may fail due to API issues"
fi

# Install test dependencies
echo -e "${BLUE}📦 Installing test dependencies...${NC}"
cd "$(dirname "$0")"
pnpm install --frozen-lockfile
print_status "Dependencies installed"

# Run integration tests
echo -e "${BLUE}🧪 Running integration tests...${NC}"
echo "Test configuration:"
echo "  API Endpoint: $TEST_API_ENDPOINT"
echo "  Environment: $TEST_ENVIRONMENT"
echo "  Timeout: ${TEST_TIMEOUT}s"
echo ""

# Run tests with timeout
timeout "$TIMEOUT" pnpm vitest run --config vitest.config.ts || TEST_EXIT_CODE=$?

# Check test results
if [ ${TEST_EXIT_CODE:-0} -eq 0 ]; then
    print_status "All integration tests passed!"
    
    # Generate test summary
    echo ""
    echo -e "${BLUE}📊 Test Summary${NC}"
    echo "=================================="
    
    if [ -f "tests/integration/results/integration-test-results.json" ]; then
        # Parse test results if available
        TOTAL_TESTS=$(jq '.numTotalTests // 0' tests/integration/results/integration-test-results.json 2>/dev/null || echo "Unknown")
        PASSED_TESTS=$(jq '.numPassedTests // 0' tests/integration/results/integration-test-results.json 2>/dev/null || echo "Unknown")
        FAILED_TESTS=$(jq '.numFailedTests // 0' tests/integration/results/integration-test-results.json 2>/dev/null || echo "Unknown")
        
        echo "  Total Tests: $TOTAL_TESTS"
        echo "  Passed: $PASSED_TESTS"
        echo "  Failed: $FAILED_TESTS"
    fi
    
    echo "  Environment: $ENVIRONMENT"
    echo "  API Endpoint: $API_ENDPOINT"
    echo ""
    
    echo -e "${GREEN}🎉 Integration testing completed successfully!${NC}"
    
elif [ ${TEST_EXIT_CODE:-0} -eq 124 ]; then
    print_error "Integration tests timed out after ${TIMEOUT} seconds"
    exit 1
else
    print_error "Integration tests failed with exit code: ${TEST_EXIT_CODE:-1}"
    
    # Show failed test summary if available
    if [ -f "tests/integration/results/integration-test-results.json" ]; then
        echo ""
        echo -e "${BLUE}📊 Failure Summary${NC}"
        echo "=================================="
        
        FAILED_TESTS=$(jq '.numFailedTests // 0' tests/integration/results/integration-test-results.json 2>/dev/null || echo "Unknown")
        echo "  Failed Tests: $FAILED_TESTS"
        
        # Show first few failures
        jq -r '.testResults[]?.assertionResults[]? | select(.status == "failed") | .title' tests/integration/results/integration-test-results.json 2>/dev/null | head -5 | while read -r test_name; do
            echo "  - $test_name"
        done
    fi
    
    exit 1
fi

# Cleanup
rm -f /tmp/health_check.json

echo ""
echo -e "${GREEN}✅ Integration test runner completed!${NC}"
