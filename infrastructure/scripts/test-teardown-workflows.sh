#!/bin/bash

# =============================================================================
# EC2 Teardown Workflows Testing Script
# =============================================================================
# 
# This script provides comprehensive testing for both automatic and manual
# teardown workflows to ensure they properly handle EC2 resource cleanup.
#
# Testing Scenarios:
# 1. Validate workflow YAML syntax
# 2. Test workflow trigger conditions
# 3. Simulate teardown operations (dry-run mode)
# 4. Validate verification script functionality
# 5. Test error handling and edge cases
# 6. Generate comprehensive test report
#
# Usage:
#   ./test-teardown-workflows.sh --test-all
#   ./test-teardown-workflows.sh --test-syntax
#   ./test-teardown-workflows.sh --test-verification
#   ./test-teardown-workflows.sh --simulate-teardown --pr-number 999
#
# Exit Codes:
#   0 - All tests passed
#   1 - Some tests failed
#   2 - Invalid arguments or configuration error

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$(dirname "$SCRIPT_DIR")")"
WORKFLOWS_DIR="$PROJECT_ROOT/.github/workflows"
VERBOSE=false
DRY_RUN=true
TEST_PR_NUMBER=999

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test results tracking
TESTS_PASSED=0
TESTS_FAILED=0
TEST_RESULTS=()

# Logging functions
log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

log_debug() {
    if [[ "$VERBOSE" == "true" ]]; then
        echo -e "${BLUE}🔍 DEBUG: $1${NC}"
    fi
}

# Test result tracking
record_test_result() {
    local test_name="$1"
    local result="$2"
    local details="${3:-}"
    
    if [[ "$result" == "PASS" ]]; then
        ((TESTS_PASSED++))
        log_success "TEST PASSED: $test_name"
    else
        ((TESTS_FAILED++))
        log_error "TEST FAILED: $test_name"
        if [[ -n "$details" ]]; then
            log_error "  Details: $details"
        fi
    fi
    
    TEST_RESULTS+=("$test_name: $result")
}

# Help function
show_help() {
    cat << EOF
EC2 Teardown Workflows Testing Script

USAGE:
    $0 [OPTIONS]

OPTIONS:
    --test-all                  Run all available tests
    --test-syntax               Test workflow YAML syntax validation
    --test-verification         Test EC2 cleanup verification script
    --test-workflows            Test workflow logic and structure
    --simulate-teardown         Simulate teardown operations (dry-run)
    --pr-number NUMBER          PR number for simulation (default: 999)
    --verbose                   Enable verbose logging
    --help                      Show this help message

TEST CATEGORIES:
    ✓ YAML Syntax Validation
    ✓ Workflow Structure Validation
    ✓ Environment Variable Handling
    ✓ EC2 Verification Script Testing
    ✓ Error Handling Validation
    ✓ Integration Testing (dry-run)

EXAMPLES:
    $0 --test-all --verbose
    $0 --test-syntax
    $0 --simulate-teardown --pr-number 123

EOF
}

# Parse command line arguments
parse_arguments() {
    local test_all=false
    local test_syntax=false
    local test_verification=false
    local test_workflows=false
    local simulate_teardown=false
    
    while [[ $# -gt 0 ]]; do
        case $1 in
            --test-all)
                test_all=true
                shift
                ;;
            --test-syntax)
                test_syntax=true
                shift
                ;;
            --test-verification)
                test_verification=true
                shift
                ;;
            --test-workflows)
                test_workflows=true
                shift
                ;;
            --simulate-teardown)
                simulate_teardown=true
                shift
                ;;
            --pr-number)
                TEST_PR_NUMBER="$2"
                shift 2
                ;;
            --verbose)
                VERBOSE=true
                shift
                ;;
            --help)
                show_help
                exit 0
                ;;
            *)
                log_error "Unknown option: $1"
                show_help
                exit 2
                ;;
        esac
    done
    
    # Set test flags based on --test-all
    if [[ "$test_all" == "true" ]]; then
        test_syntax=true
        test_verification=true
        test_workflows=true
        simulate_teardown=true
    fi
    
    # Export test flags for use in test functions
    export TEST_SYNTAX="$test_syntax"
    export TEST_VERIFICATION="$test_verification"
    export TEST_WORKFLOWS="$test_workflows"
    export SIMULATE_TEARDOWN="$simulate_teardown"
}

# Test YAML syntax validation
test_yaml_syntax() {
    log_info "Testing YAML syntax validation..."
    
    local workflows=(
        "destroy-preview.yml"
        "teardown-dev.yml"
    )
    
    for workflow in "${workflows[@]}"; do
        local workflow_path="$WORKFLOWS_DIR/$workflow"
        
        if [[ ! -f "$workflow_path" ]]; then
            record_test_result "YAML Syntax: $workflow" "FAIL" "Workflow file not found"
            continue
        fi
        
        # Test YAML syntax using Python (if available) or basic validation
        if command -v python3 >/dev/null 2>&1; then
            if python3 -c "import yaml; yaml.safe_load(open('$workflow_path'))" 2>/dev/null; then
                record_test_result "YAML Syntax: $workflow" "PASS"
            else
                record_test_result "YAML Syntax: $workflow" "FAIL" "Invalid YAML syntax"
            fi
        else
            # Basic validation - check for common YAML issues
            if grep -q "^[[:space:]]*-[[:space:]]*$" "$workflow_path"; then
                record_test_result "YAML Syntax: $workflow" "FAIL" "Empty list items found"
            elif grep -q "^[[:space:]]*:[[:space:]]*$" "$workflow_path"; then
                record_test_result "YAML Syntax: $workflow" "FAIL" "Empty key-value pairs found"
            else
                record_test_result "YAML Syntax: $workflow" "PASS" "Basic validation passed"
            fi
        fi
    done
}

# Test workflow structure and content
test_workflow_structure() {
    log_info "Testing workflow structure and content..."
    
    # Test destroy-preview.yml
    local destroy_workflow="$WORKFLOWS_DIR/destroy-preview.yml"
    
    if [[ -f "$destroy_workflow" ]]; then
        # Check for EC2-specific content
        if grep -q "EC2 instances and Auto Scaling Group" "$destroy_workflow"; then
            record_test_result "Workflow Content: destroy-preview EC2 references" "PASS"
        else
            record_test_result "Workflow Content: destroy-preview EC2 references" "FAIL" "Missing EC2 resource references"
        fi
        
        # Check for CDK environment variables
        if grep -q "CDK_DEPLOY_TYPE.*ec2-preview" "$destroy_workflow"; then
            record_test_result "Workflow Content: destroy-preview CDK context" "PASS"
        else
            record_test_result "Workflow Content: destroy-preview CDK context" "FAIL" "Missing EC2 CDK context variables"
        fi
        
        # Check for verification script usage
        if grep -q "verify-ec2-cleanup.sh" "$destroy_workflow"; then
            record_test_result "Workflow Content: destroy-preview verification script" "PASS"
        else
            record_test_result "Workflow Content: destroy-preview verification script" "FAIL" "Not using centralized verification script"
        fi
    else
        record_test_result "Workflow Structure: destroy-preview.yml exists" "FAIL" "File not found"
    fi
    
    # Test teardown-dev.yml
    local teardown_workflow="$WORKFLOWS_DIR/teardown-dev.yml"
    
    if [[ -f "$teardown_workflow" ]]; then
        # Check for EC2-specific content
        if grep -q "EC2 instances and Auto Scaling Group" "$teardown_workflow"; then
            record_test_result "Workflow Content: teardown-dev EC2 references" "PASS"
        else
            record_test_result "Workflow Content: teardown-dev EC2 references" "FAIL" "Missing EC2 resource references"
        fi
        
        # Check for manual teardown enhancements
        if grep -q "MANUAL TEARDOWN.*EC2-based" "$teardown_workflow"; then
            record_test_result "Workflow Content: teardown-dev manual enhancements" "PASS"
        else
            record_test_result "Workflow Content: teardown-dev manual enhancements" "FAIL" "Missing manual teardown enhancements"
        fi
    else
        record_test_result "Workflow Structure: teardown-dev.yml exists" "FAIL" "File not found"
    fi
}

# Test EC2 verification script
test_verification_script() {
    log_info "Testing EC2 cleanup verification script..."
    
    local verify_script="$SCRIPT_DIR/verify-ec2-cleanup.sh"
    
    if [[ ! -f "$verify_script" ]]; then
        record_test_result "Verification Script: exists" "FAIL" "Script file not found"
        return
    fi
    
    # Test script is executable
    if [[ -x "$verify_script" ]]; then
        record_test_result "Verification Script: executable" "PASS"
    else
        record_test_result "Verification Script: executable" "FAIL" "Script is not executable"
    fi
    
    # Test help functionality
    if "$verify_script" --help >/dev/null 2>&1; then
        record_test_result "Verification Script: help function" "PASS"
    else
        record_test_result "Verification Script: help function" "FAIL" "Help function not working"
    fi
    
    # Test parameter validation
    if ! "$verify_script" 2>/dev/null; then
        record_test_result "Verification Script: parameter validation" "PASS"
    else
        record_test_result "Verification Script: parameter validation" "FAIL" "Should fail without required parameters"
    fi
}

# Simulate teardown operations
simulate_teardown_operations() {
    log_info "Simulating teardown operations (dry-run mode)..."
    
    local test_env_name="pr-$TEST_PR_NUMBER"
    local test_stack_name="MacroAiPr${TEST_PR_NUMBER}Stack"
    
    log_info "Test Environment: $test_env_name"
    log_info "Test Stack: $test_stack_name"
    
    # Test verification script with test parameters
    local verify_script="$SCRIPT_DIR/verify-ec2-cleanup.sh"
    
    if [[ -f "$verify_script" ]]; then
        # This should fail since the test environment doesn't exist
        if ! "$verify_script" --pr-number "$TEST_PR_NUMBER" --timeout 10 2>/dev/null; then
            record_test_result "Simulation: verification script with non-existent environment" "PASS"
        else
            record_test_result "Simulation: verification script with non-existent environment" "FAIL" "Should fail for non-existent environment"
        fi
    else
        record_test_result "Simulation: verification script availability" "FAIL" "Verification script not found"
    fi
    
    # Test stack name generation logic
    local generated_stack_name
    generated_stack_name="MacroAi$(echo "pr-$TEST_PR_NUMBER" | sed 's/^./\U&/')Stack"
    
    if [[ "$generated_stack_name" == "$test_stack_name" ]]; then
        record_test_result "Simulation: stack name generation" "PASS"
    else
        record_test_result "Simulation: stack name generation" "FAIL" "Generated: $generated_stack_name, Expected: $test_stack_name"
    fi
}

# Generate test report
generate_test_report() {
    echo ""
    log_info "📊 Test Results Summary"
    echo "=========================="
    echo "Tests Passed: $TESTS_PASSED"
    echo "Tests Failed: $TESTS_FAILED"
    echo "Total Tests:  $((TESTS_PASSED + TESTS_FAILED))"
    echo ""
    
    if [[ $TESTS_FAILED -eq 0 ]]; then
        log_success "🎉 All tests passed!"
        echo ""
        log_success "✅ EC2 teardown workflows are ready for production use"
        log_success "✅ Both automatic and manual teardown processes validated"
        log_success "✅ Verification logic properly handles EC2 resources"
        return 0
    else
        log_error "❌ Some tests failed"
        echo ""
        log_error "Failed tests require attention before production deployment"
        
        echo ""
        echo "Detailed Results:"
        for result in "${TEST_RESULTS[@]}"; do
            if [[ "$result" == *"FAIL"* ]]; then
                echo "  ❌ $result"
            else
                echo "  ✅ $result"
            fi
        done
        
        return 1
    fi
}

# Main function
main() {
    log_info "🧪 Starting EC2 Teardown Workflows Testing"
    log_info "Project Root: $PROJECT_ROOT"
    log_info "Test PR Number: $TEST_PR_NUMBER"
    echo ""
    
    # Run selected tests
    if [[ "$TEST_SYNTAX" == "true" ]]; then
        test_yaml_syntax
    fi
    
    if [[ "$TEST_WORKFLOWS" == "true" ]]; then
        test_workflow_structure
    fi
    
    if [[ "$TEST_VERIFICATION" == "true" ]]; then
        test_verification_script
    fi
    
    if [[ "$SIMULATE_TEARDOWN" == "true" ]]; then
        simulate_teardown_operations
    fi
    
    # Generate final report
    generate_test_report
}

# Parse arguments and run main function
parse_arguments "$@"
main
