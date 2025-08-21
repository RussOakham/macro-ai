#!/bin/bash

# Configuration System Integration Test Runner
# Runs comprehensive tests for the new simplified configuration system

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
TEST_ENVIRONMENT=${TEST_ENVIRONMENT:-development}
AWS_REGION=${AWS_REGION:-us-east-1}
TIMEOUT=${TEST_TIMEOUT:-300} # 5 minutes default timeout

# Test categories
declare -a TEST_CATEGORIES=(
    "bootstrap"
    "config-loading"
    "parameter-store-e2e"
    "cdk-validation"
)

# Function to print status messages
print_status() {
    echo -e "${GREEN}✓${NC} $1"
}

print_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_header() {
    echo -e "${CYAN}$1${NC}"
}

# Function to show usage
show_usage() {
    cat << EOF
Configuration System Integration Test Runner

USAGE:
    $0 [OPTIONS] [TEST_CATEGORY]

OPTIONS:
    -h, --help              Show this help message
    -e, --environment ENV   Set test environment (default: development)
    -r, --region REGION     Set AWS region (default: us-east-1)
    -t, --timeout SECONDS   Set test timeout (default: 300)
    -v, --verbose           Enable verbose output
    --skip-prerequisites    Skip prerequisite checks
    --dry-run              Show what would be tested without running

TEST_CATEGORIES:
    bootstrap              Test bootstrap script functionality
    config-loading         Test configuration loading system
    parameter-store-e2e    Test end-to-end Parameter Store integration
    cdk-validation         Test CDK pre-deployment validation
    all                    Run all configuration system tests (default)

EXAMPLES:
    # Run all configuration system tests
    $0

    # Run only bootstrap script tests
    $0 bootstrap

    # Run tests for staging environment
    $0 --environment staging

    # Run with verbose output
    $0 --verbose all

ENVIRONMENT VARIABLES:
    TEST_ENVIRONMENT       Test environment (development, staging, production)
    AWS_REGION            AWS region for testing
    TEST_TIMEOUT          Test timeout in seconds
    AWS_ACCESS_KEY_ID     AWS access key (required)
    AWS_SECRET_ACCESS_KEY AWS secret key (required)

EOF
}

# Function to validate prerequisites
validate_prerequisites() {
    print_header "🔍 Validating Prerequisites"
    
    # Check if we're in the right directory
    if [[ ! -f "${PROJECT_ROOT}/package.json" ]]; then
        print_error "Not in project root directory. Please run from tests/integration/"
        exit 1
    fi
    
    # Check Node.js
    if ! command -v node &> /dev/null; then
        print_error "Node.js is not installed"
        exit 1
    fi
    print_status "Node.js: $(node --version)"
    
    # Check pnpm
    if ! command -v pnpm &> /dev/null; then
        print_error "pnpm is not installed"
        exit 1
    fi
    print_status "pnpm: $(pnpm --version)"
    
    # Check AWS CLI
    if ! command -v aws &> /dev/null; then
        print_error "AWS CLI is not installed"
        exit 1
    fi
    print_status "AWS CLI: $(aws --version)"
    
    # Check AWS credentials
    if ! aws sts get-caller-identity &> /dev/null; then
        print_error "AWS credentials not configured"
        print_info "Please run 'aws configure' or set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY"
        exit 1
    fi
    
    local aws_identity
    aws_identity=$(aws sts get-caller-identity --query 'Account' --output text)
    print_status "AWS Account: ${aws_identity}"
    
    # Check if integration test dependencies are installed
    if [[ ! -d "${SCRIPT_DIR}/node_modules" ]]; then
        print_info "Installing integration test dependencies..."
        cd "${SCRIPT_DIR}"
        pnpm install
    fi
    
    print_status "Prerequisites validated"
}

# Function to run a specific test category
run_test_category() {
    local category="$1"
    local verbose="$2"
    
    print_header "🧪 Running ${category} tests"
    
    cd "${SCRIPT_DIR}"
    
    local test_command="pnpm test:${category}"
    
    if [[ "${verbose}" == "true" ]]; then
        test_command="${test_command} --reporter=verbose"
    fi
    
    print_info "Command: ${test_command}"
    
    if eval "${test_command}"; then
        print_status "${category} tests passed"
        return 0
    else
        print_error "${category} tests failed"
        return 1
    fi
}

# Function to run all configuration system tests
run_all_tests() {
    local verbose="$1"
    local failed_tests=()
    local passed_tests=()
    
    print_header "🚀 Running All Configuration System Tests"
    print_info "Environment: ${TEST_ENVIRONMENT}"
    print_info "Region: ${AWS_REGION}"
    print_info "Timeout: ${TIMEOUT}s"
    echo ""
    
    for category in "${TEST_CATEGORIES[@]}"; do
        if run_test_category "${category}" "${verbose}"; then
            passed_tests+=("${category}")
        else
            failed_tests+=("${category}")
        fi
        echo ""
    done
    
    # Print summary
    print_header "📊 Test Summary"
    echo ""
    
    if [[ ${#passed_tests[@]} -gt 0 ]]; then
        print_status "Passed tests (${#passed_tests[@]}):"
        for test in "${passed_tests[@]}"; do
            echo "  ✓ ${test}"
        done
        echo ""
    fi
    
    if [[ ${#failed_tests[@]} -gt 0 ]]; then
        print_error "Failed tests (${#failed_tests[@]}):"
        for test in "${failed_tests[@]}"; do
            echo "  ✗ ${test}"
        done
        echo ""
        
        print_error "Some tests failed. Please check the output above for details."
        return 1
    else
        print_status "All configuration system tests passed! 🎉"
        return 0
    fi
}

# Parse command line arguments
VERBOSE=false
SKIP_PREREQUISITES=false
DRY_RUN=false
TEST_CATEGORY="all"

while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--help)
            show_usage
            exit 0
            ;;
        -e|--environment)
            TEST_ENVIRONMENT="$2"
            shift 2
            ;;
        -r|--region)
            AWS_REGION="$2"
            shift 2
            ;;
        -t|--timeout)
            TIMEOUT="$2"
            shift 2
            ;;
        -v|--verbose)
            VERBOSE=true
            shift
            ;;
        --skip-prerequisites)
            SKIP_PREREQUISITES=true
            shift
            ;;
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        bootstrap|config-loading|parameter-store-e2e|cdk-validation|all)
            TEST_CATEGORY="$1"
            shift
            ;;
        *)
            print_error "Unknown option: $1"
            show_usage
            exit 1
            ;;
    esac
done

# Export environment variables
export TEST_ENVIRONMENT
export AWS_REGION
export TEST_TIMEOUT="${TIMEOUT}"

# Main execution
print_header "🔧 Configuration System Integration Test Runner"
echo ""

if [[ "${DRY_RUN}" == "true" ]]; then
    print_info "DRY RUN MODE - Showing what would be tested"
    print_info "Test Category: ${TEST_CATEGORY}"
    print_info "Environment: ${TEST_ENVIRONMENT}"
    print_info "Region: ${AWS_REGION}"
    print_info "Timeout: ${TIMEOUT}s"
    print_info "Verbose: ${VERBOSE}"
    exit 0
fi

# Validate prerequisites unless skipped
if [[ "${SKIP_PREREQUISITES}" != "true" ]]; then
    validate_prerequisites
    echo ""
fi

# Run tests based on category
case "${TEST_CATEGORY}" in
    all)
        run_all_tests "${VERBOSE}"
        ;;
    bootstrap|config-loading|parameter-store-e2e|cdk-validation)
        run_test_category "${TEST_CATEGORY}" "${VERBOSE}"
        ;;
    *)
        print_error "Invalid test category: ${TEST_CATEGORY}"
        show_usage
        exit 1
        ;;
esac
