#!/bin/bash

# Comprehensive Testing Suite Runner for Task 3.1
# This script runs all the testing components created for the comprehensive testing suite

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Macro AI Comprehensive Testing Suite${NC}"
echo -e "${BLUE}  Task 3.1: Testing and Validation${NC}"
echo -e "${BLUE}========================================${NC}"
echo

# Function to print section headers
print_section() {
    echo -e "${YELLOW}$1${NC}"
    echo "----------------------------------------"
}

# Function to print test results
print_result() {
    if [ $1 -eq 0 ]; then
        echo -e "${GREEN}✓ $2${NC}"
    else
        echo -e "${RED}✗ $2${NC}"
        EXIT_CODE=1
    fi
}

# Initialize exit code
EXIT_CODE=0

# Change to project root
cd "$PROJECT_ROOT"

print_section "Phase 1: Unit Tests for Configuration"
echo "Running unit tests for environment configuration system..."

# Run unit tests for env-config.ts
if pnpm --filter @repo/express-api test src/config/env-config.test.ts; then
    print_result 0 "Environment configuration unit tests"
else
    print_result 1 "Environment configuration unit tests"
fi

# Run existing unit tests for simple-config.ts
if pnpm --filter @repo/express-api test src/config/simple-config.test.ts; then
    print_result 0 "Simple configuration unit tests"
else
    print_result 1 "Simple configuration unit tests"
fi

echo

print_section "Phase 2: Integration Tests"
echo "Running integration tests for configuration loading..."

# Run containerized configuration integration tests
if pnpm --filter @repo/express-api test ../../tests/integration/containerized-config-integration.test.ts; then
    print_result 0 "Containerized configuration integration tests"
else
    print_result 1 "Containerized configuration integration tests"
else
fi

# Run existing configuration loading integration tests
if pnpm --filter @repo/express-api test ../../tests/integration/config-loading-integration.test.ts; then
    print_result 0 "Configuration loading integration tests"
else
    print_result 1 "Configuration loading integration tests"
fi

echo

print_section "Phase 3: End-to-End Tests"
echo "Running end-to-end tests for deployment workflow..."

# Run deployment workflow end-to-end tests
if pnpm --filter @repo/express-api test ../../tests/integration/deployment-workflow-e2e.test.ts; then
    print_result 0 "Deployment workflow end-to-end tests"
else
    print_result 1 "Deployment workflow end-to-end tests"
fi

# Run existing CDK pre-deployment validation tests
if pnpm --filter @repo/express-api test ../../tests/integration/cdk-pre-deployment-validation.test.ts; then
    print_result 0 "CDK pre-deployment validation tests"
else
    print_result 1 "CDK pre-deployment validation tests"
fi

echo

print_section "Phase 4: Additional Integration Tests"
echo "Running additional integration tests..."

# Run existing database integration tests
if pnpm --filter @repo/express-api test ../../tests/integration/database-integration.test.ts; then
    print_result 0 "Database integration tests"
else
    print_result 1 "Database integration tests"
fi

# Run existing authentication integration tests
if pnpm --filter @repo/express-api test ../../tests/integration/auth-integration.test.ts; then
    print_result 0 "Authentication integration tests"
else
    print_result 1 "Authentication integration tests"
fi

echo

print_section "Phase 5: Test Coverage Report"
echo "Generating test coverage report..."

# Generate coverage report
if pnpm --filter @repo/express-api test:coverage; then
    print_result 0 "Test coverage report generation"
    echo -e "${BLUE}Coverage report available in apps/express-api/coverage/ directory${NC}"
else
    print_result 1 "Test coverage report generation"
fi

echo

print_section "Phase 6: Test Summary"
echo "Running all tests in sequence for final validation..."

# Run all tests in sequence
if pnpm --filter @repo/express-api test; then
    print_result 0 "All tests passed"
else
    print_result 1 "Some tests failed"
fi

echo

# Final summary
if [ $EXIT_CODE -eq 0 ]; then
    echo -e "${GREEN}========================================${NC}"
    echo -e "${GREEN}  All Tests Passed Successfully! 🎉${NC}"
    echo -e "${GREEN}========================================${NC}"
    echo
    echo -e "${GREEN}Task 3.1: Comprehensive Testing Suite - COMPLETED${NC}"
    echo
    echo "Testing coverage includes:"
    echo "✓ Unit tests for configuration system"
    echo "✓ Integration tests for containerized environments"
    echo "✓ End-to-end tests for deployment workflow"
    echo "✓ Configuration loading in different environments"
    echo "✓ Environment variable injection and validation"
    echo "✓ Health check functionality testing"
    echo "✓ Cross-environment compatibility testing"
    echo "✓ Error handling and validation testing"
else
    echo -e "${RED}========================================${NC}"
    echo -e "${RED}  Some Tests Failed ❌${NC}"
    echo -e "${RED}========================================${NC}"
    echo
    echo -e "${RED}Please review the failed tests above and fix any issues.${NC}"
    echo -e "${RED}Task 3.1: Comprehensive Testing Suite - INCOMPLETE${NC}"
fi

echo
echo -e "${BLUE}Test execution completed.${NC}"
echo -e "${BLUE}Check the output above for detailed results.${NC}"

exit $EXIT_CODE
