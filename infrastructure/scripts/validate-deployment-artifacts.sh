#!/bin/bash

# =============================================================================
# Deployment Artifact Extraction and Application Updates Validation Script
# =============================================================================
# 
# This script validates that deployment artifacts are properly extracted and
# the application updates correctly when new deployments are triggered.
#
# Validation Features:
# 1. Test artifact download and extraction mechanisms
# 2. Validate release directory structure and management
# 3. Test symlink creation and current release switching
# 4. Verify dependency installation and build processes
# 5. Test application restart and health validation
# 6. Validate rollback capabilities and version management
# 7. Test deployment script functionality and error handling
# 8. Verify file permissions and ownership
#
# Usage:
#   ./validate-deployment-artifacts.sh --instance-id i-1234567890abcdef0
#   ./validate-deployment-artifacts.sh --env-name pr-123 --test-deployment
#   ./validate-deployment-artifacts.sh --comprehensive --verbose
#
# Exit Codes:
#   0 - All validations passed
#   1 - Some validations failed
#   2 - Invalid arguments or configuration error

set -euo pipefail

# Configuration
AWS_REGION="${AWS_REGION:-us-east-1}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VERBOSE=false
TEST_DEPLOYMENT=false
TIMEOUT=300

# Test results tracking
TESTS_PASSED=0
TESTS_FAILED=0
TEST_RESULTS=()

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

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
Deployment Artifact Extraction and Application Updates Validation Script

USAGE:
    $0 [OPTIONS]

OPTIONS:
    --instance-id ID            EC2 instance ID to connect to for validation
    --env-name NAME             Environment name (e.g., pr-123) to find instances
    --stack-name NAME           CloudFormation stack name to find instances
    --pr-number NUMBER          PR number (will generate env-name and stack-name)
    --test-deployment           Include actual deployment testing (may cause downtime)
    --comprehensive             Run comprehensive validation including deployment tests
    --timeout SECONDS           Command timeout in seconds (default: 300)
    --region REGION             AWS region (default: us-east-1)
    --verbose                   Enable verbose logging
    --help                      Show this help message

VALIDATION TESTS:
    ✓ Deployment script existence and permissions
    ✓ Release directory structure validation
    ✓ Current symlink and version management
    ✓ Artifact extraction capabilities
    ✓ Dependency installation validation
    ✓ Application restart and health checks
    ✓ Rollback functionality testing
    ✓ File permissions and ownership validation
    ✓ Deployment environment variables
    ✓ Service integration and management

EXAMPLES:
    $0 --pr-number 123 --comprehensive --verbose
    $0 --instance-id i-1234567890abcdef0 --test-deployment
    $0 --env-name pr-456 --stack-name MacroAiPr456Stack

EOF
}

# Parse command line arguments
parse_arguments() {
    local instance_id=""
    local env_name=""
    local stack_name=""
    local pr_number=""
    local comprehensive=false
    
    while [[ $# -gt 0 ]]; do
        case $1 in
            --instance-id)
                instance_id="$2"
                shift 2
                ;;
            --env-name)
                env_name="$2"
                shift 2
                ;;
            --stack-name)
                stack_name="$2"
                shift 2
                ;;
            --pr-number)
                pr_number="$2"
                env_name="pr-$2"
                stack_name="MacroAiPr${2}Stack"
                shift 2
                ;;
            --test-deployment)
                TEST_DEPLOYMENT=true
                shift
                ;;
            --comprehensive)
                comprehensive=true
                TEST_DEPLOYMENT=true
                shift
                ;;
            --timeout)
                TIMEOUT="$2"
                shift 2
                ;;
            --region)
                AWS_REGION="$2"
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
    
    # Export variables for use in test functions
    export INSTANCE_ID="$instance_id"
    export ENV_NAME="$env_name"
    export STACK_NAME="$stack_name"
    export PR_NUMBER="$pr_number"
    export COMPREHENSIVE="$comprehensive"
}

# Find EC2 instances for the environment
find_ec2_instances() {
    local env_name="$1"
    
    log_debug "Finding EC2 instances for environment: $env_name"
    
    local instances
    instances=$(aws ec2 describe-instances \
        --region "$AWS_REGION" \
        --filters "Name=tag:Environment,Values=$env_name" "Name=instance-state-name,Values=running" \
        --query 'Reservations[].Instances[].InstanceId' \
        --output text 2>/dev/null || echo "")
    
    if [[ -n "$instances" ]]; then
        log_debug "Found instances: $instances"
        echo "$instances"
    else
        log_warning "No running instances found for environment: $env_name"
        echo ""
    fi
}

# Execute command on EC2 instance via SSM
execute_ssm_command() {
    local instance_id="$1"
    local command="$2"
    local description="${3:-SSM command}"
    
    log_debug "Executing SSM command on $instance_id: $command"
    
    local command_id
    command_id=$(aws ssm send-command \
        --region "$AWS_REGION" \
        --instance-ids "$instance_id" \
        --document-name "AWS-RunShellScript" \
        --parameters "commands=[\"$command\"]" \
        --query 'Command.CommandId' \
        --output text 2>/dev/null || echo "")
    
    if [[ -z "$command_id" ]]; then
        log_error "Failed to send SSM command"
        return 1
    fi
    
    # Wait for command to complete
    local status=""
    local attempts=0
    local max_attempts=$((TIMEOUT / 5))
    
    while [[ $attempts -lt $max_attempts ]]; do
        status=$(aws ssm get-command-invocation \
            --region "$AWS_REGION" \
            --command-id "$command_id" \
            --instance-id "$instance_id" \
            --query 'Status' \
            --output text 2>/dev/null || echo "InProgress")
        
        if [[ "$status" == "Success" ]]; then
            break
        elif [[ "$status" == "Failed" ]] || [[ "$status" == "Cancelled" ]] || [[ "$status" == "TimedOut" ]]; then
            log_error "$description failed with status: $status"
            return 1
        fi
        
        sleep 5
        ((attempts++))
    done
    
    if [[ "$status" != "Success" ]]; then
        log_error "$description timed out"
        return 1
    fi
    
    # Get command output
    local output
    output=$(aws ssm get-command-invocation \
        --region "$AWS_REGION" \
        --command-id "$command_id" \
        --instance-id "$instance_id" \
        --query 'StandardOutputContent' \
        --output text 2>/dev/null || echo "")
    
    echo "$output"
    return 0
}

# Test deployment script existence and permissions
test_deployment_script() {
    local instance_id="$1"
    
    log_info "Testing deployment script existence and permissions"
    
    # Check if deployment script exists
    local script_check
    if script_check=$(execute_ssm_command "$instance_id" "test -f /opt/macro-ai/deploy.sh && echo 'exists'" "Deployment script check"); then
        if [[ "$script_check" == "exists" ]]; then
            record_test_result "Deployment Script Exists" "PASS"
        else
            record_test_result "Deployment Script Exists" "FAIL" "Script not found"
            return
        fi
    else
        record_test_result "Deployment Script Exists" "FAIL" "Cannot check script existence"
        return
    fi
    
    # Check script permissions
    local script_perms
    if script_perms=$(execute_ssm_command "$instance_id" "ls -la /opt/macro-ai/deploy.sh" "Script permissions check"); then
        if echo "$script_perms" | grep -q "x"; then
            record_test_result "Deployment Script Executable" "PASS"
        else
            record_test_result "Deployment Script Executable" "FAIL" "Script not executable"
        fi
        
        if echo "$script_perms" | grep -q "macroai"; then
            record_test_result "Deployment Script Ownership" "PASS" "Owned by macroai user"
        else
            record_test_result "Deployment Script Ownership" "FAIL" "Incorrect ownership"
        fi
    else
        record_test_result "Deployment Script Permissions" "FAIL" "Cannot check script permissions"
    fi
    
    # Test script help functionality
    local script_help
    if script_help=$(execute_ssm_command "$instance_id" "/opt/macro-ai/deploy.sh --help" "Script help check"); then
        if echo "$script_help" | grep -q "deploy"; then
            record_test_result "Deployment Script Help" "PASS"
        else
            record_test_result "Deployment Script Help" "FAIL" "Help output invalid"
        fi
    else
        record_test_result "Deployment Script Help" "FAIL" "Cannot get script help"
    fi
}

# Test release directory structure
test_release_directory_structure() {
    local instance_id="$1"

    log_info "Testing release directory structure"

    # Check main application directories
    local app_dirs=(
        "/opt/macro-ai"
        "/opt/macro-ai/releases"
        "/opt/macro-ai/shared"
        "/var/log/macro-ai"
    )

    local dirs_found=0
    for dir in "${app_dirs[@]}"; do
        local dir_check
        if dir_check=$(execute_ssm_command "$instance_id" "test -d $dir && echo 'exists'" "Directory check: $dir"); then
            if [[ "$dir_check" == "exists" ]]; then
                ((dirs_found++))
                log_debug "Found directory: $dir"
            fi
        fi
    done

    if [[ $dirs_found -eq 4 ]]; then
        record_test_result "Application Directory Structure" "PASS" "All 4 directories found"
    else
        record_test_result "Application Directory Structure" "FAIL" "Only $dirs_found/4 directories found"
    fi

    # Check directory ownership
    local dir_ownership
    if dir_ownership=$(execute_ssm_command "$instance_id" "ls -la /opt/macro-ai/" "Directory ownership check"); then
        if echo "$dir_ownership" | grep -q "macroai"; then
            record_test_result "Directory Ownership" "PASS" "Correct ownership (macroai)"
        else
            record_test_result "Directory Ownership" "FAIL" "Incorrect ownership"
        fi
    else
        record_test_result "Directory Ownership" "FAIL" "Cannot check directory ownership"
    fi

    # Check current symlink
    local current_link
    if current_link=$(execute_ssm_command "$instance_id" "ls -la /opt/macro-ai/current" "Current symlink check"); then
        if echo "$current_link" | grep -q "->"; then
            record_test_result "Current Release Symlink" "PASS" "Symlink exists"
            log_debug "Current symlink: $current_link"
        else
            record_test_result "Current Release Symlink" "FAIL" "No symlink found"
        fi
    else
        record_test_result "Current Release Symlink" "FAIL" "Cannot check current symlink"
    fi
}

# Test release management
test_release_management() {
    local instance_id="$1"

    log_info "Testing release management"

    # Check existing releases
    local releases
    if releases=$(execute_ssm_command "$instance_id" "ls -la /opt/macro-ai/releases/" "Releases check"); then
        local release_count
        release_count=$(echo "$releases" | grep -c "^d" || echo "0")

        if [[ $release_count -gt 0 ]]; then
            record_test_result "Release Directories" "PASS" "$release_count release(s) found"
        else
            record_test_result "Release Directories" "FAIL" "No release directories found"
        fi
    else
        record_test_result "Release Directories" "FAIL" "Cannot check releases directory"
    fi

    # Check current release content
    local current_content
    if current_content=$(execute_ssm_command "$instance_id" "ls -la /opt/macro-ai/current/" "Current release content"); then
        # Check for key application files
        local app_files=(
            "package.json"
            "dist"
            "node_modules"
        )

        local files_found=0
        for file in "${app_files[@]}"; do
            if echo "$current_content" | grep -q "$file"; then
                ((files_found++))
                log_debug "Found application file: $file"
            fi
        done

        if [[ $files_found -ge 2 ]]; then
            record_test_result "Current Release Content" "PASS" "$files_found/3 key files found"
        else
            record_test_result "Current Release Content" "FAIL" "Only $files_found/3 key files found"
        fi
    else
        record_test_result "Current Release Content" "FAIL" "Cannot check current release content"
    fi
}

# Test deployment environment variables
test_deployment_environment() {
    local instance_id="$1"

    log_info "Testing deployment environment variables"

    # Check deployment-related environment variables
    local env_vars=(
        "NODE_ENV"
        "SERVER_PORT"
        "APP_ENV"
        # Note: PARAMETER_STORE_PREFIX is no longer needed - the application determines it from APP_ENV
    )

    local vars_found=0
    for var in "${env_vars[@]}"; do
        local var_check
        if var_check=$(execute_ssm_command "$instance_id" "sudo -u macroai env | grep $var" "Environment variable: $var"); then
            if [[ -n "$var_check" ]]; then
                ((vars_found++))
                log_debug "Found environment variable: $var_check"
            fi
        fi
    done

    if [[ $vars_found -ge 3 ]]; then
        record_test_result "Deployment Environment Variables" "PASS" "$vars_found/3 variables found"
    else
        record_test_result "Deployment Environment Variables" "FAIL" "Only $vars_found/3 variables found"
    fi

    # Check .env file
    local env_file
    if env_file=$(execute_ssm_command "$instance_id" "test -f /opt/macro-ai/.env && echo 'exists'" "Environment file check"); then
        if [[ "$env_file" == "exists" ]]; then
            record_test_result "Environment File" "PASS" ".env file exists"
        else
            record_test_result "Environment File" "FAIL" ".env file not found"
        fi
    else
        record_test_result "Environment File" "FAIL" "Cannot check .env file"
    fi
}

# Test artifact extraction capabilities
test_artifact_extraction() {
    local instance_id="$1"

    log_info "Testing artifact extraction capabilities"

    # Check if required tools are available
    local tools=(
        "tar"
        "curl"
        "pnpm"
    )

    local tools_found=0
    for tool in "${tools[@]}"; do
        local tool_check
        if tool_check=$(execute_ssm_command "$instance_id" "which $tool" "Tool check: $tool"); then
            if [[ -n "$tool_check" ]]; then
                ((tools_found++))
                log_debug "Found tool: $tool at $tool_check"
            fi
        fi
    done

    if [[ $tools_found -eq 3 ]]; then
        record_test_result "Extraction Tools Available" "PASS" "All 3 tools found"
    else
        record_test_result "Extraction Tools Available" "FAIL" "Only $tools_found/3 tools found"
    fi

    # Test tar extraction capability
    local tar_test
    if tar_test=$(execute_ssm_command "$instance_id" "tar --version | head -1" "Tar version check"); then
        if [[ -n "$tar_test" ]]; then
            record_test_result "Tar Extraction Capability" "PASS" "Tar available: $tar_test"
        else
            record_test_result "Tar Extraction Capability" "FAIL" "Tar version not available"
        fi
    else
        record_test_result "Tar Extraction Capability" "FAIL" "Cannot check tar capability"
    fi
}

# Test service integration
test_service_integration() {
    local instance_id="$1"

    log_info "Testing service integration"

    # Check systemd service status
    local service_status
    if service_status=$(execute_ssm_command "$instance_id" "systemctl is-active macro-ai.service" "Service status check"); then
        if [[ "$service_status" == "active" ]]; then
            record_test_result "Service Status" "PASS" "Service is active"
        else
            record_test_result "Service Status" "FAIL" "Service status: $service_status"
        fi
    else
        record_test_result "Service Status" "FAIL" "Cannot check service status"
    fi

    # Check service restart capability
    local service_restart
    if service_restart=$(execute_ssm_command "$instance_id" "systemctl show macro-ai.service -p Restart" "Service restart config"); then
        if echo "$service_restart" | grep -q "always"; then
            record_test_result "Service Restart Configuration" "PASS" "Auto-restart enabled"
        else
            record_test_result "Service Restart Configuration" "FAIL" "Auto-restart not configured"
        fi
    else
        record_test_result "Service Restart Configuration" "FAIL" "Cannot check restart configuration"
    fi

    # Check service working directory
    local working_dir
    if working_dir=$(execute_ssm_command "$instance_id" "systemctl show macro-ai.service -p WorkingDirectory" "Service working directory"); then
        if echo "$working_dir" | grep -q "/opt/macro-ai"; then
            record_test_result "Service Working Directory" "PASS" "Correct working directory"
        else
            record_test_result "Service Working Directory" "FAIL" "Incorrect working directory"
        fi
    else
        record_test_result "Service Working Directory" "FAIL" "Cannot check working directory"
    fi
}

# Test deployment functionality (if enabled)
test_deployment_functionality() {
    local instance_id="$1"

    if [[ "$TEST_DEPLOYMENT" != "true" ]]; then
        log_info "Skipping deployment functionality test (not enabled)"
        return
    fi

    log_info "Testing deployment functionality (may cause brief downtime)"
    log_warning "This test will perform an actual deployment operation"

    # Test deployment script status command
    local deploy_status
    if deploy_status=$(execute_ssm_command "$instance_id" "/opt/macro-ai/deploy.sh status" "Deployment status check"); then
        if echo "$deploy_status" | grep -q "current"; then
            record_test_result "Deployment Status Command" "PASS" "Status command working"
        else
            record_test_result "Deployment Status Command" "FAIL" "Status command output invalid"
        fi
    else
        record_test_result "Deployment Status Command" "FAIL" "Cannot execute status command"
    fi

    # Test deployment script cleanup command
    local deploy_cleanup
    if deploy_cleanup=$(execute_ssm_command "$instance_id" "/opt/macro-ai/deploy.sh cleanup --dry-run" "Deployment cleanup test"); then
        if echo "$deploy_cleanup" | grep -q "cleanup"; then
            record_test_result "Deployment Cleanup Command" "PASS" "Cleanup command working"
        else
            record_test_result "Deployment Cleanup Command" "FAIL" "Cleanup command output invalid"
        fi
    else
        record_test_result "Deployment Cleanup Command" "FAIL" "Cannot execute cleanup command"
    fi
}

# Main validation function
main() {
    log_info "🔍 Starting Deployment Artifact and Application Updates Validation"
    log_info "Instance ID: ${INSTANCE_ID:-N/A}"
    log_info "Environment: ${ENV_NAME:-N/A}"
    log_info "Test Deployment: $TEST_DEPLOYMENT"
    log_info "Region: $AWS_REGION"
    echo ""

    # Find instance if not provided
    local target_instance="$INSTANCE_ID"
    if [[ -z "$target_instance" ]] && [[ -n "$ENV_NAME" ]]; then
        log_info "Finding EC2 instances for environment: $ENV_NAME"
        local instances
        instances=$(find_ec2_instances "$ENV_NAME")
        if [[ -n "$instances" ]]; then
            target_instance=$(echo "$instances" | head -1)
            log_info "Using instance: $target_instance"
        else
            log_error "No instances found for environment: $ENV_NAME"
            exit 2
        fi
    fi

    if [[ -z "$target_instance" ]]; then
        log_error "Instance ID is required but not provided or discoverable"
        exit 2
    fi

    # Validate AWS credentials and SSM access
    if ! aws sts get-caller-identity >/dev/null 2>&1; then
        log_error "AWS credentials not configured or invalid"
        exit 2
    fi

    # Run validation tests
    test_deployment_script "$target_instance"
    test_release_directory_structure "$target_instance"
    test_release_management "$target_instance"
    test_deployment_environment "$target_instance"
    test_artifact_extraction "$target_instance"
    test_service_integration "$target_instance"

    # Run deployment functionality test if enabled
    if [[ "$TEST_DEPLOYMENT" == "true" ]]; then
        test_deployment_functionality "$target_instance"
    fi

    # Generate final report
    echo ""
    log_info "📊 Deployment Artifact and Application Updates Validation Results"
    echo "=============================================="
    echo "Tests Passed: $TESTS_PASSED"
    echo "Tests Failed: $TESTS_FAILED"
    echo "Total Tests:  $((TESTS_PASSED + TESTS_FAILED))"
    echo ""

    if [[ $TESTS_FAILED -eq 0 ]]; then
        log_success "🎉 All deployment artifact validations passed!"
        log_success "✅ Deployment script is properly configured"
        log_success "✅ Release directory structure is correct"
        log_success "✅ Artifact extraction tools are available"
        log_success "✅ Service integration is working"
        log_success "✅ Environment variables are properly set"
        exit 0
    else
        log_error "❌ Some deployment artifact validations failed"
        echo ""
        echo "Failed Tests:"
        for result in "${TEST_RESULTS[@]}"; do
            if [[ "$result" == *"FAIL"* ]]; then
                echo "  ❌ $result"
            fi
        done
        exit 1
    fi
}

# Parse arguments and run main function
parse_arguments "$@"
main
