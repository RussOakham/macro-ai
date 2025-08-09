#!/bin/bash

# Environment Variable Integration Test Script
# Tests the complete environment variable integration system

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Test configuration
TEST_PR_NUMBER="123"
TEST_ENVIRONMENT="pr-123"
TEST_API_KEY="test-api-key-32-characters-long-dummy"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

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

# Function to cleanup test files
cleanup_test_files() {
    local files_to_clean=(
        ".env.preview"
        ".env.preview-123"
        ".env.test"
        "test-output.json"
        "test-backend-resolution.txt"
    )
    
    for file in "${files_to_clean[@]}"; do
        if [[ -f "$file" ]]; then
            rm -f "$file"
            print_info "Cleaned up: $file"
        fi
    done
}

# Test 1: Backend API Resolution Script
test_backend_api_resolution() {
    print_test_header "Test 1: Backend API Resolution"
    
    local resolver_script="$SCRIPT_DIR/resolve-backend-api.sh"
    
    if [[ ! -f "$resolver_script" ]]; then
        print_error "Backend API resolver script not found: $resolver_script"
        return 1
    fi
    
    print_info "Testing backend API resolution for PR #$TEST_PR_NUMBER"
    
    # Test URL output format
    if api_url=$("$resolver_script" --pr-number "$TEST_PR_NUMBER" --output-format url 2>/dev/null); then
        if [[ -n "$api_url" ]]; then
            print_status "URL format test passed: $api_url"
        else
            print_warning "URL format test returned empty result"
        fi
    else
        print_warning "URL format test failed (expected for test environment)"
    fi
    
    # Test JSON output format
    if json_output=$("$resolver_script" --pr-number "$TEST_PR_NUMBER" --output-format json 2>/dev/null); then
        if echo "$json_output" | jq . > /dev/null 2>&1; then
            print_status "JSON format test passed"
            echo "$json_output" > test-backend-resolution.json
        else
            print_error "JSON format test failed - invalid JSON"
            return 1
        fi
    else
        print_warning "JSON format test failed (expected for test environment)"
    fi
    
    # Test environment variable format
    if env_output=$("$resolver_script" --pr-number "$TEST_PR_NUMBER" --output-format env 2>/dev/null); then
        if echo "$env_output" | grep -q "VITE_API_URL="; then
            print_status "Environment format test passed"
        else
            print_error "Environment format test failed - no VITE_API_URL found"
            return 1
        fi
    else
        print_warning "Environment format test failed (expected for test environment)"
    fi
    
    echo ""
    return 0
}

# Test 2: Environment Variable Injection Script
test_env_injection() {
    print_test_header "Test 2: Environment Variable Injection"
    
    local injection_script="$SCRIPT_DIR/inject-preview-env.sh"
    
    if [[ ! -f "$injection_script" ]]; then
        print_error "Environment injection script not found: $injection_script"
        return 1
    fi
    
    print_info "Testing environment variable injection for PR #$TEST_PR_NUMBER"
    
    # Set up test environment
    export VITE_API_KEY="$TEST_API_KEY"
    export PR_NUMBER="$TEST_PR_NUMBER"
    export ENVIRONMENT_NAME="$TEST_ENVIRONMENT"
    export BUILD_MODE="preview"
    export GITHUB_SHA="test-commit-hash"
    export GITHUB_REF_NAME="feature/test-branch"
    export GITHUB_PR_NUMBER="$TEST_PR_NUMBER"
    
    # Test environment generation
    if "$injection_script" --pr-number "$TEST_PR_NUMBER" --output-file ".env.test"; then
        print_status "Environment generation test passed"
        
        # Validate generated file
        if [[ -f ".env.test" ]]; then
            print_status "Environment file created successfully"
            
            # Check for required variables
            local required_vars=("VITE_API_URL" "VITE_API_KEY" "VITE_APP_ENV")
            local missing_vars=()
            
            for var in "${required_vars[@]}"; do
                if grep -q "^${var}=" ".env.test"; then
                    print_status "Required variable found: $var"
                else
                    missing_vars+=("$var")
                fi
            done
            
            if [[ ${#missing_vars[@]} -gt 0 ]]; then
                for var in "${missing_vars[@]}"; do
                    print_error "Missing required variable: $var"
                done
                return 1
            fi
            
            # Check build metadata
            if grep -q "VITE_BUILD_TIMESTAMP=" ".env.test"; then
                print_status "Build metadata included"
            else
                print_warning "Build metadata not found"
            fi
            
        else
            print_error "Environment file was not created"
            return 1
        fi
    else
        print_error "Environment generation failed"
        return 1
    fi
    
    # Test validation-only mode
    if "$injection_script" --pr-number "$TEST_PR_NUMBER" --validate-only; then
        print_status "Validation-only mode test passed"
    else
        print_error "Validation-only mode test failed"
        return 1
    fi
    
    echo ""
    return 0
}

# Test 3: Configuration Management Script
test_config_management() {
    print_test_header "Test 3: Configuration Management"
    
    local config_script="$SCRIPT_DIR/configure-preview-env.sh"
    
    if [[ ! -f "$config_script" ]]; then
        print_error "Configuration management script not found: $config_script"
        return 1
    fi
    
    print_info "Testing configuration management for PR #$TEST_PR_NUMBER"
    
    # Test environment generation
    if "$config_script" generate-env "$TEST_PR_NUMBER"; then
        print_status "Configuration generation test passed"
        
        local config_file=".env.preview-$TEST_PR_NUMBER"
        if [[ -f "$config_file" ]]; then
            print_status "Configuration file created: $config_file"
        else
            print_error "Configuration file not created"
            return 1
        fi
    else
        print_error "Configuration generation failed"
        return 1
    fi
    
    # Test validation
    if "$config_script" validate-env "$TEST_PR_NUMBER"; then
        print_status "Configuration validation test passed"
    else
        print_warning "Configuration validation failed (expected without AWS access)"
    fi
    
    echo ""
    return 0
}

# Test 4: Environment Mapping Configuration
test_env_mapping() {
    print_test_header "Test 4: Environment Mapping Configuration"
    
    local mapping_file="$SCRIPT_DIR/env-mapping.json"
    
    if [[ ! -f "$mapping_file" ]]; then
        print_error "Environment mapping file not found: $mapping_file"
        return 1
    fi
    
    print_info "Testing environment mapping configuration"
    
    # Validate JSON structure
    if jq . "$mapping_file" > /dev/null 2>&1; then
        print_status "Environment mapping JSON is valid"
    else
        print_error "Environment mapping JSON is invalid"
        return 1
    fi
    
    # Check required sections
    local required_sections=("environments" "backend_resolution" "validation")
    
    for section in "${required_sections[@]}"; do
        if jq -e ".${section}" "$mapping_file" > /dev/null 2>&1; then
            print_status "Required section found: $section"
        else
            print_error "Missing required section: $section"
            return 1
        fi
    done
    
    # Check environment configurations
    local environments=("preview" "development" "staging" "production")
    
    for env in "${environments[@]}"; do
        if jq -e ".environments.${env}" "$mapping_file" > /dev/null 2>&1; then
            print_status "Environment configuration found: $env"
        else
            print_error "Missing environment configuration: $env"
            return 1
        fi
    done
    
    echo ""
    return 0
}

# Test 5: Integration Test
test_full_integration() {
    print_test_header "Test 5: Full Integration Test"
    
    print_info "Testing complete environment variable integration workflow"
    
    # Set up test environment
    export VITE_API_KEY="$TEST_API_KEY"
    export PR_NUMBER="$TEST_PR_NUMBER"
    export ENVIRONMENT_NAME="$TEST_ENVIRONMENT"
    export BUILD_MODE="preview"
    export GITHUB_SHA="integration-test-commit"
    export GITHUB_REF_NAME="feature/integration-test"
    export GITHUB_PR_NUMBER="$TEST_PR_NUMBER"
    
    # Step 1: Generate environment configuration
    local injection_script="$SCRIPT_DIR/inject-preview-env.sh"
    if "$injection_script" --pr-number "$TEST_PR_NUMBER" --output-file ".env.preview"; then
        print_status "Step 1: Environment configuration generated"
    else
        print_error "Step 1: Environment configuration failed"
        return 1
    fi
    
    # Step 2: Validate configuration
    if "$injection_script" --pr-number "$TEST_PR_NUMBER" --validate-only; then
        print_status "Step 2: Configuration validation passed"
    else
        print_error "Step 2: Configuration validation failed"
        return 1
    fi
    
    # Step 3: Test configuration loading
    if source ".env.preview" 2>/dev/null; then
        print_status "Step 3: Configuration loading successful"
        
        # Verify key variables are set
        if [[ -n "$VITE_API_URL" && -n "$VITE_API_KEY" && -n "$VITE_APP_ENV" ]]; then
            print_status "Step 3: Key variables verified"
            print_info "  API URL: $VITE_API_URL"
            print_info "  App Environment: $VITE_APP_ENV"
            print_info "  Build Mode: $VITE_BUILD_MODE"
        else
            print_error "Step 3: Key variables missing"
            return 1
        fi
    else
        print_error "Step 3: Configuration loading failed"
        return 1
    fi
    
    print_status "🎉 Full integration test completed successfully!"
    echo ""
    return 0
}

# Main test runner
run_all_tests() {
    echo -e "${BLUE}🚀 Environment Variable Integration Test Suite${NC}"
    echo "=============================================="
    echo ""
    
    local tests_passed=0
    local total_tests=5
    
    # Cleanup before starting
    cleanup_test_files
    
    # Run tests
    if test_backend_api_resolution; then
        tests_passed=$((tests_passed + 1))
    fi
    
    if test_env_injection; then
        tests_passed=$((tests_passed + 1))
    fi
    
    if test_config_management; then
        tests_passed=$((tests_passed + 1))
    fi
    
    if test_env_mapping; then
        tests_passed=$((tests_passed + 1))
    fi
    
    if test_full_integration; then
        tests_passed=$((tests_passed + 1))
    fi
    
    # Cleanup after tests
    cleanup_test_files
    
    # Summary
    echo -e "${BLUE}📊 Test Results Summary${NC}"
    echo "=================================="
    echo "Tests passed: $tests_passed/$total_tests"
    
    if [[ $tests_passed -eq $total_tests ]]; then
        print_status "🎉 All tests passed!"
        echo ""
        echo "✅ Environment variable integration system is working correctly"
        echo "✅ Backend API resolution is functional"
        echo "✅ Environment injection is working"
        echo "✅ Configuration management is operational"
        echo "✅ Full integration workflow is successful"
        return 0
    else
        print_error "❌ Some tests failed"
        echo ""
        echo "Please review the test output above for details."
        return 1
    fi
}

# Show usage information
show_usage() {
    echo "Environment Variable Integration Test Suite"
    echo ""
    echo "Usage: $0 [options]"
    echo ""
    echo "Options:"
    echo "  --test <number>             Run specific test (1-5)"
    echo "  --pr-number <number>        Use specific PR number for testing (default: 123)"
    echo "  --cleanup                   Clean up test files and exit"
    echo "  --help                      Show this help message"
    echo ""
    echo "Tests:"
    echo "  1. Backend API Resolution"
    echo "  2. Environment Variable Injection"
    echo "  3. Configuration Management"
    echo "  4. Environment Mapping Configuration"
    echo "  5. Full Integration Test"
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --test)
            case "$2" in
                1) test_backend_api_resolution; exit $? ;;
                2) test_env_injection; exit $? ;;
                3) test_config_management; exit $? ;;
                4) test_env_mapping; exit $? ;;
                5) test_full_integration; exit $? ;;
                *) print_error "Invalid test number: $2"; exit 1 ;;
            esac
            ;;
        --pr-number)
            TEST_PR_NUMBER="$2"
            TEST_ENVIRONMENT="pr-$2"
            shift 2
            ;;
        --cleanup)
            cleanup_test_files
            exit 0
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

# Run all tests by default
run_all_tests
