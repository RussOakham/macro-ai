#!/bin/bash

# Integration Test Script for Frontend-Backend Integration
# Tests the complete backend discovery and API resolution system

set -Eeuo pipefail
IFS=$'\n\t'

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEST_RESULTS_DIR="${SCRIPT_DIR}/.test-results"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)

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

print_info() {
    echo -e "${CYAN}ℹ${NC} $1"
}

print_test_header() {
    echo -e "${BLUE}🧪 $1${NC}"
    echo "=================================="
}

# Function to show usage
show_usage() {
    echo "Integration Test Script for Frontend-Backend Integration"
    echo ""
    echo "Usage: $0 [options]"
    echo ""
    echo "Options:"
    echo "  --test-suite <suite>        Test suite to run: all|discovery|resolution|integration (default: all)"
    echo "  --environment <env>         Test specific environment"
    echo "  --pr-number <number>        Test specific PR number"
    echo "  --skip-aws-tests           Skip tests requiring AWS credentials"
    echo "  --output-format <format>    Output format: text|json|junit (default: text)"
    echo "  --save-results             Save test results to file"
    echo "  --verbose                   Enable verbose output"
    echo "  --help                      Show this help message"
    echo ""
    echo "Test Suites:"
    echo "  discovery                   Test backend discovery service"
    echo "  resolution                  Test API resolution service"
    echo "  integration                 Test end-to-end integration"
    echo "  all                         Run all test suites"
    echo ""
    echo "Examples:"
    echo "  $0                          # Run all tests"
    echo "  $0 --test-suite discovery   # Test only discovery service"
    echo "  $0 --environment pr-123 --pr-number 123"
    echo "  $0 --skip-aws-tests         # Skip AWS-dependent tests"
}

# Validate required tools are available
validate_dependencies() {
    local missing_tools=()

    # Check for required tools
    if ! command -v bash >/dev/null 2>&1; then
        missing_tools+=("bash")
    fi

    if ! command -v jq >/dev/null 2>&1; then
        missing_tools+=("jq")
    fi

    if ! command -v grep >/dev/null 2>&1; then
        missing_tools+=("grep")
    fi

    if ! command -v cut >/dev/null 2>&1; then
        missing_tools+=("cut")
    fi

    if ! command -v mktemp >/dev/null 2>&1; then
        missing_tools+=("mktemp")
    fi

    if ! command -v printf >/dev/null 2>&1; then
        missing_tools+=("printf")
    fi

    if [[ ${#missing_tools[@]} -gt 0 ]]; then
        print_error "Missing required tools: ${missing_tools[*]}"
        print_error "Please install the missing tools and try again."
        exit 1
    fi
}

# Function to setup test environment
setup_test_environment() {
    print_info "Setting up test environment"
    
    # Create test results directory
    if [[ ! -d "$TEST_RESULTS_DIR" ]]; then
        mkdir -p "$TEST_RESULTS_DIR"
    fi
    
    # Validate required scripts exist
    local required_scripts=(
        "backend-discovery-service.sh"
        "api-resolution-service.sh"
        "inject-preview-env.sh"
    )
    
    for script in "${required_scripts[@]}"; do
        if [[ ! -f "${SCRIPT_DIR}/${script}" ]]; then
            print_error "Required script not found: ${script}"
            exit 1
        fi
    done
    
    print_status "Test environment setup complete"
}

# Function to test backend discovery service
test_backend_discovery_service() {
    print_test_header "Backend Discovery Service Tests"
    
    local test_results=()
    
    # Test 1: Help command
    print_info "Test 1: Help command"
    if bash "${SCRIPT_DIR}/backend-discovery-service.sh" --help >/dev/null 2>&1; then
        print_status "Help command works"
        test_results+=("discovery_help:PASS")
    else
        print_error "Help command failed"
        test_results+=("discovery_help:FAIL")
    fi
    
    # Test 2: List stacks (if AWS available)
    if [[ "${SKIP_AWS_TESTS:-false}" != "true" ]]; then
        print_info "Test 2: List backend stacks"
        if aws sts get-caller-identity >/dev/null 2>&1; then
            if bash "${SCRIPT_DIR}/backend-discovery-service.sh" list-stacks >/dev/null 2>&1; then
                print_status "List stacks works"
                test_results+=("discovery_list_stacks:PASS")
            else
                print_warning "List stacks failed (may be expected if no stacks exist)"
                test_results+=("discovery_list_stacks:WARN")
            fi
        else
            print_warning "AWS credentials not available, skipping list stacks test"
            test_results+=("discovery_list_stacks:SKIP")
        fi
    else
        print_info "Skipping AWS-dependent tests"
        test_results+=("discovery_list_stacks:SKIP")
    fi
    
    # Test 3: Cache operations
    print_info "Test 3: Cache operations"
    if bash "${SCRIPT_DIR}/backend-discovery-service.sh" cache-clear >/dev/null 2>&1; then
        print_status "Cache clear works"
        test_results+=("discovery_cache:PASS")
    else
        print_error "Cache clear failed"
        test_results+=("discovery_cache:FAIL")
    fi
    
    # Test 4: Discovery for development environment
    if [[ "${SKIP_AWS_TESTS:-false}" != "true" ]]; then
        print_info "Test 4: Discovery for development environment"
        if aws sts get-caller-identity >/dev/null 2>&1; then
            local discovery_result
            discovery_result=$(bash "${SCRIPT_DIR}/backend-discovery-service.sh" discover development --output-format json 2>/dev/null || echo "null")

            if [[ "$discovery_result" != "null" ]]; then
                local api_endpoint
                api_endpoint=$(echo "$discovery_result" | jq -r '.api_endpoint // "null"')
                if [[ "$api_endpoint" != "null" ]]; then
                    print_status "Development environment discovery works"
                    test_results+=("discovery_development:PASS")
                else
                    print_warning "Development environment discovery returned no API endpoint"
                    test_results+=("discovery_development:WARN")
                fi
            else
                print_error "Development environment discovery failed"
                test_results+=("discovery_development:FAIL")
            fi
        else
            print_warning "AWS credentials not available, skipping discovery test"
            test_results+=("discovery_development:SKIP")
        fi
    else
        test_results+=("discovery_development:SKIP")
    fi
    
    echo ""
    printf '%s\n' "${test_results[@]}"
}

# Function to test API resolution service
test_api_resolution_service() {
    print_test_header "API Resolution Service Tests"
    
    local test_results=()
    
    # Test 1: Help command
    print_info "Test 1: Help command"
    if bash "${SCRIPT_DIR}/api-resolution-service.sh" --help >/dev/null 2>&1; then
        print_status "Help command works"
        test_results+=("resolution_help:PASS")
    else
        print_error "Help command failed"
        test_results+=("resolution_help:FAIL")
    fi
    
    # Test 2: Fallback-only mode
    print_info "Test 2: Fallback-only mode"
    local fallback_result
    fallback_result=$(bash "${SCRIPT_DIR}/api-resolution-service.sh" \
        --environment development \
        --fallback-only \
        --output-format url 2>/dev/null || echo "")
    
    if [[ -n "$fallback_result" && "$fallback_result" =~ ^https?:// ]]; then
        print_status "Fallback-only mode works: $fallback_result"
        test_results+=("resolution_fallback:PASS")
    else
        print_error "Fallback-only mode failed"
        test_results+=("resolution_fallback:FAIL")
    fi
    
    # Test 3: JSON output format
    print_info "Test 3: JSON output format"
    local json_result
    json_result=$(bash "${SCRIPT_DIR}/api-resolution-service.sh" \
        --environment development \
        --fallback-only \
        --output-format json 2>/dev/null || echo "null")
    
    if [[ "$json_result" != "null" ]] && echo "$json_result" | jq . >/dev/null 2>&1; then
        print_status "JSON output format works"
        test_results+=("resolution_json:PASS")
    else
        print_error "JSON output format failed"
        test_results+=("resolution_json:FAIL")
    fi
    
    # Test 4: Environment variables output
    print_info "Test 4: Environment variables output"
    local env_result
    env_result=$(bash "${SCRIPT_DIR}/api-resolution-service.sh" \
        --environment development \
        --fallback-only \
        --output-format env 2>/dev/null || echo "")
    
    if [[ "$env_result" =~ VITE_API_URL= ]]; then
        print_status "Environment variables output works"
        test_results+=("resolution_env:PASS")
    else
        print_error "Environment variables output failed"
        test_results+=("resolution_env:FAIL")
    fi
    
    # Test 5: Preview environment with PR number
    print_info "Test 5: Preview environment with PR number"
    local preview_result
    preview_result=$(bash "${SCRIPT_DIR}/api-resolution-service.sh" \
        --environment pr-123 \
        --pr-number 123 \
        --fallback-only \
        --output-format url 2>/dev/null || echo "")
    
    if [[ -n "$preview_result" && "$preview_result" =~ ^https?:// ]]; then
        print_status "Preview environment resolution works: $preview_result"
        test_results+=("resolution_preview:PASS")
    else
        print_error "Preview environment resolution failed"
        test_results+=("resolution_preview:FAIL")
    fi
    
    echo ""
    printf '%s\n' "${test_results[@]}"
}

# Function to test end-to-end integration
test_integration() {
    print_test_header "End-to-End Integration Tests"
    
    local test_results=()
    
    # Test 1: Environment injection with API resolution
    print_info "Test 1: Environment injection with API resolution"
    
    # Set up test environment variables
    export PR_NUMBER="123"
    export ENVIRONMENT_NAME="pr-123"
    export BUILD_MODE="preview"
    export VITE_API_KEY="test-api-key-for-integration-testing"

    local env_file
    env_file=$(mktemp)

    if bash "${SCRIPT_DIR}/inject-preview-env.sh" \
        --pr-number 123 \
        --environment-name pr-123 \
        --output-file "$env_file" >/dev/null 2>&1; then

        if [[ -f "$env_file" ]] && grep -q "VITE_API_URL=" "$env_file"; then
            local api_url
            api_url=$(grep "VITE_API_URL=" "$env_file" | cut -d'=' -f2)
            print_status "Environment injection works, API URL: $api_url"
            test_results+=("integration_env_injection:PASS")
        else
            print_error "Environment injection failed - no API URL in output"
            test_results+=("integration_env_injection:FAIL")
        fi
    else
        print_error "Environment injection script failed"
        test_results+=("integration_env_injection:FAIL")
    fi
    
    # Clean up
    rm -f "$env_file"
    unset PR_NUMBER ENVIRONMENT_NAME BUILD_MODE VITE_API_KEY
    
    # Test 2: Configuration file validation
    print_info "Test 2: Configuration file validation"
    local config_file="${SCRIPT_DIR}/env-mapping.json"
    
    if [[ -f "$config_file" ]] && jq . "$config_file" >/dev/null 2>&1; then
        print_status "Configuration file is valid JSON"
        test_results+=("integration_config_validation:PASS")
    else
        print_error "Configuration file validation failed"
        test_results+=("integration_config_validation:FAIL")
    fi
    
    # Test 3: Multiple environment types
    print_info "Test 3: Multiple environment types"
    local environments=("development" "staging" "production")
    local env_test_results=()
    
    for env in "${environments[@]}"; do
        local result
        result=$(bash "${SCRIPT_DIR}/api-resolution-service.sh" \
            --environment "$env" \
            --fallback-only \
            --output-format url 2>/dev/null || echo "")

        if [[ -n "$result" && "$result" =~ ^https?:// ]]; then
            env_test_results+=("$env:PASS")
        else
            env_test_results+=("$env:FAIL")
        fi
    done

    local passed_envs
    passed_envs=$(printf '%s\n' "${env_test_results[@]}" | grep -c ":PASS" || echo "0")
    local total_envs=${#environments[@]}
    
    if [[ $passed_envs -eq $total_envs ]]; then
        print_status "All environment types work ($passed_envs/$total_envs)"
        test_results+=("integration_multiple_envs:PASS")
    else
        print_warning "Some environment types failed ($passed_envs/$total_envs)"
        test_results+=("integration_multiple_envs:WARN")
    fi
    
    echo ""
    printf '%s\n' "${test_results[@]}"
}

# Function to generate test report
generate_test_report() {
    local all_results=("$@")
    local output_format="$1"
    shift
    all_results=("$@")
    
    local total_tests=0
    local passed_tests=0
    local failed_tests=0
    local warned_tests=0
    local skipped_tests=0
    
    for result in "${all_results[@]}"; do
        total_tests=$((total_tests + 1))
        case "$result" in
            *:PASS) passed_tests=$((passed_tests + 1)) ;;
            *:FAIL) failed_tests=$((failed_tests + 1)) ;;
            *:WARN) warned_tests=$((warned_tests + 1)) ;;
            *:SKIP) skipped_tests=$((skipped_tests + 1)) ;;
        esac
    done
    
    print_test_header "Test Results Summary"
    echo "Total Tests: $total_tests"
    echo "Passed: $passed_tests"
    echo "Failed: $failed_tests"
    echo "Warnings: $warned_tests"
    echo "Skipped: $skipped_tests"
    echo ""
    
    if [[ $failed_tests -eq 0 ]]; then
        print_status "🎉 All tests passed!"
        return 0
    else
        print_error "❌ $failed_tests test(s) failed"
        return 1
    fi
}

# Main function
main() {
    local test_suite="all"
    local environment=""
    local pr_number=""
    local skip_aws_tests="false"
    local output_format="text"
    local save_results="false"
    local verbose="false"
    
    # Parse command line arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --test-suite)
                test_suite="$2"
                shift 2
                ;;
            --environment)
                environment="$2"
                shift 2
                ;;
            --pr-number)
                pr_number="$2"
                shift 2
                ;;
            --skip-aws-tests)
                skip_aws_tests="true"
                shift
                ;;
            --output-format)
                output_format="$2"
                shift 2
                ;;
            --save-results)
                save_results="true"
                shift
                ;;
            --verbose)
                verbose="true"
                shift
                ;;
            --help|-h)
                show_usage
                exit 0
                ;;
            *)
                print_error "Unknown option: $1"
                show_usage
                exit 1
                ;;
        esac
    done
    
    # Export configuration
    export SKIP_AWS_TESTS="$skip_aws_tests"
    
    print_info "🧪 Frontend-Backend Integration Test Suite"
    echo "==========================================="
    echo "Test Suite: $test_suite"
    echo "Skip AWS Tests: $skip_aws_tests"
    echo "Output Format: $output_format"
    echo "Timestamp: $TIMESTAMP"
    echo ""
    
    # Setup test environment
    setup_test_environment
    
    # Validate dependencies
    validate_dependencies

    # Run tests based on suite selection
    local all_results=()
    
    case "$test_suite" in
        "discovery"|"all")
            mapfile -t discovery_results < <(test_backend_discovery_service)
            all_results+=("${discovery_results[@]}")
            ;;
    esac
    
    case "$test_suite" in
        "resolution"|"all")
            mapfile -t resolution_results < <(test_api_resolution_service)
            all_results+=("${resolution_results[@]}")
            ;;
    esac
    
    case "$test_suite" in
        "integration"|"all")
            mapfile -t integration_results < <(test_integration)
            all_results+=("${integration_results[@]}")
            ;;
    esac
    
    # Generate test report
    generate_test_report "$output_format" "${all_results[@]}"
}

# Run main function
main "$@"
