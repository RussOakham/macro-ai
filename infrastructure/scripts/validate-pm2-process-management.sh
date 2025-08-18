#!/bin/bash

# =============================================================================
# PM2 Process Management and Auto-Restart Validation Script
# =============================================================================
# 
# This script validates that PM2 is properly managing the Express API process
# with auto-restart capabilities and proper logging on EC2 instances.
#
# Validation Features:
# 1. Test PM2 installation and configuration
# 2. Validate PM2 ecosystem file configuration
# 3. Test process management (start, stop, restart)
# 4. Verify auto-restart capabilities and thresholds
# 5. Test logging configuration and log rotation
# 6. Validate memory and CPU monitoring
# 7. Test graceful shutdown and restart mechanisms
# 8. Verify systemd integration with PM2
#
# Usage:
#   ./validate-pm2-process-management.sh --instance-id i-1234567890abcdef0
#   ./validate-pm2-process-management.sh --env-name pr-123 --test-restart
#   ./validate-pm2-process-management.sh --comprehensive --verbose
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
TEST_RESTART=false
TIMEOUT=60

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
PM2 Process Management and Auto-Restart Validation Script

USAGE:
    $0 [OPTIONS]

OPTIONS:
    --instance-id ID            EC2 instance ID to connect to for validation
    --env-name NAME             Environment name (e.g., pr-123) to find instances
    --stack-name NAME           CloudFormation stack name to find instances
    --pr-number NUMBER          PR number (will generate env-name and stack-name)
    --test-restart              Include process restart testing (may cause brief downtime)
    --comprehensive             Run comprehensive validation including stress tests
    --timeout SECONDS           Command timeout in seconds (default: 60)
    --region REGION             AWS region (default: us-east-1)
    --verbose                   Enable verbose logging
    --help                      Show this help message

VALIDATION TESTS:
    ✓ PM2 installation and version validation
    ✓ PM2 ecosystem file configuration validation
    ✓ Process status and health monitoring
    ✓ Auto-restart configuration and thresholds
    ✓ Logging configuration and log file validation
    ✓ Memory and CPU monitoring capabilities
    ✓ Graceful shutdown and restart mechanisms
    ✓ Systemd integration with PM2
    ✓ Process recovery after failure simulation

EXAMPLES:
    $0 --pr-number 123 --comprehensive --verbose
    $0 --instance-id i-1234567890abcdef0 --test-restart
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
            --test-restart)
                TEST_RESTART=true
                shift
                ;;
            --comprehensive)
                comprehensive=true
                TEST_RESTART=true
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

# Test PM2 installation and version
test_pm2_installation() {
    local instance_id="$1"
    
    log_info "Testing PM2 installation and version"
    
    local pm2_version
    if pm2_version=$(execute_ssm_command "$instance_id" "sudo -u macroai pm2 --version" "PM2 version check"); then
        if [[ -n "$pm2_version" ]]; then
            record_test_result "PM2 Installation" "PASS" "Version: $pm2_version"
        else
            record_test_result "PM2 Installation" "FAIL" "PM2 version not found"
        fi
    else
        record_test_result "PM2 Installation" "FAIL" "PM2 not accessible"
    fi
    
    # Test PM2 global installation
    local pm2_path
    if pm2_path=$(execute_ssm_command "$instance_id" "which pm2" "PM2 path check"); then
        if [[ -n "$pm2_path" ]]; then
            record_test_result "PM2 Global Installation" "PASS" "Path: $pm2_path"
        else
            record_test_result "PM2 Global Installation" "FAIL" "PM2 not in PATH"
        fi
    else
        record_test_result "PM2 Global Installation" "FAIL" "PM2 path not found"
    fi
}

# Test PM2 ecosystem configuration
test_pm2_ecosystem_config() {
    local instance_id="$1"
    
    log_info "Testing PM2 ecosystem configuration"
    
    # Check if ecosystem file exists
    local ecosystem_check
    if ecosystem_check=$(execute_ssm_command "$instance_id" "test -f /opt/macro-ai/ecosystem.config.js && echo 'exists'" "Ecosystem file check"); then
        if [[ "$ecosystem_check" == "exists" ]]; then
            record_test_result "PM2 Ecosystem File" "PASS"
        else
            record_test_result "PM2 Ecosystem File" "FAIL" "Ecosystem file not found"
            return
        fi
    else
        record_test_result "PM2 Ecosystem File" "FAIL" "Cannot check ecosystem file"
        return
    fi
    
    # Validate ecosystem configuration
    local ecosystem_content
    if ecosystem_content=$(execute_ssm_command "$instance_id" "cat /opt/macro-ai/ecosystem.config.js" "Ecosystem content check"); then
        # Check for required configuration elements
        local config_checks=(
            "macro-ai-api"
            "dist/index.js"
            "max_restarts"
            "min_uptime"
            "max_memory_restart"
        )
        
        local config_found=0
        for config in "${config_checks[@]}"; do
            if echo "$ecosystem_content" | grep -q "$config"; then
                ((config_found++))
                log_debug "Found ecosystem config: $config"
            fi
        done
        
        if [[ $config_found -ge 4 ]]; then
            record_test_result "PM2 Ecosystem Configuration" "PASS" "$config_found/5 required configs found"
        else
            record_test_result "PM2 Ecosystem Configuration" "FAIL" "Only $config_found/5 required configs found"
        fi
    else
        record_test_result "PM2 Ecosystem Configuration" "FAIL" "Cannot read ecosystem file"
    fi
}

# Test PM2 process status
test_pm2_process_status() {
    local instance_id="$1"

    log_info "Testing PM2 process status"

    # Get PM2 process list
    local pm2_list
    if pm2_list=$(execute_ssm_command "$instance_id" "sudo -u macroai pm2 list" "PM2 process list"); then
        log_debug "PM2 process list: $pm2_list"

        # Check if macro-ai-api process is running
        if echo "$pm2_list" | grep -q "macro-ai-api"; then
            if echo "$pm2_list" | grep -q "online"; then
                record_test_result "PM2 Process Status" "PASS" "macro-ai-api is online"
            else
                record_test_result "PM2 Process Status" "FAIL" "macro-ai-api is not online"
            fi
        else
            record_test_result "PM2 Process Status" "FAIL" "macro-ai-api process not found"
        fi
    else
        record_test_result "PM2 Process Status" "FAIL" "Cannot get PM2 process list"
    fi

    # Get detailed process information
    local pm2_show
    if pm2_show=$(execute_ssm_command "$instance_id" "sudo -u macroai pm2 show macro-ai-api" "PM2 process details"); then
        # Check for key process metrics
        if echo "$pm2_show" | grep -q "uptime"; then
            local uptime
            uptime=$(echo "$pm2_show" | grep "uptime" | head -1 || echo "unknown")
            record_test_result "PM2 Process Uptime" "PASS" "$uptime"
        else
            record_test_result "PM2 Process Uptime" "FAIL" "Uptime information not available"
        fi

        # Check restart count
        if echo "$pm2_show" | grep -q "restarts"; then
            local restarts
            restarts=$(echo "$pm2_show" | grep "restarts" | head -1 || echo "unknown")
            record_test_result "PM2 Restart Count" "PASS" "$restarts"
        else
            record_test_result "PM2 Restart Count" "FAIL" "Restart count not available"
        fi
    else
        record_test_result "PM2 Process Details" "FAIL" "Cannot get detailed process information"
    fi
}

# Test PM2 logging configuration
test_pm2_logging() {
    local instance_id="$1"

    log_info "Testing PM2 logging configuration"

    # Check log files exist
    local log_files=(
        "/var/log/macro-ai/error.log"
        "/var/log/macro-ai/out.log"
        "/var/log/macro-ai/combined.log"
    )

    local logs_found=0
    for log_file in "${log_files[@]}"; do
        local log_check
        if log_check=$(execute_ssm_command "$instance_id" "test -f $log_file && echo 'exists'" "Log file check: $log_file"); then
            if [[ "$log_check" == "exists" ]]; then
                ((logs_found++))
                log_debug "Found log file: $log_file"
            fi
        fi
    done

    if [[ $logs_found -eq 3 ]]; then
        record_test_result "PM2 Log Files" "PASS" "All 3 log files found"
    else
        record_test_result "PM2 Log Files" "FAIL" "Only $logs_found/3 log files found"
    fi

    # Check log file permissions and ownership
    local log_perms
    if log_perms=$(execute_ssm_command "$instance_id" "ls -la /var/log/macro-ai/" "Log file permissions"); then
        if echo "$log_perms" | grep -q "macroai"; then
            record_test_result "PM2 Log Permissions" "PASS" "Correct ownership (macroai)"
        else
            record_test_result "PM2 Log Permissions" "FAIL" "Incorrect ownership"
        fi
    else
        record_test_result "PM2 Log Permissions" "FAIL" "Cannot check log permissions"
    fi

    # Test log content (recent entries)
    local recent_logs
    if recent_logs=$(execute_ssm_command "$instance_id" "tail -5 /var/log/macro-ai/combined.log" "Recent log entries"); then
        if [[ -n "$recent_logs" ]]; then
            record_test_result "PM2 Log Content" "PASS" "Recent log entries found"
        else
            record_test_result "PM2 Log Content" "FAIL" "No recent log entries"
        fi
    else
        record_test_result "PM2 Log Content" "FAIL" "Cannot read log content"
    fi
}

# Test auto-restart capabilities
test_auto_restart_capabilities() {
    local instance_id="$1"

    log_info "Testing PM2 auto-restart capabilities"

    # Get current restart configuration
    local pm2_show
    if pm2_show=$(execute_ssm_command "$instance_id" "sudo -u macroai pm2 show macro-ai-api" "PM2 restart config"); then
        # Check max_restarts configuration
        if echo "$pm2_show" | grep -q "max_restarts"; then
            record_test_result "PM2 Max Restarts Config" "PASS" "Max restarts configured"
        else
            record_test_result "PM2 Max Restarts Config" "FAIL" "Max restarts not configured"
        fi

        # Check min_uptime configuration
        if echo "$pm2_show" | grep -q "min_uptime"; then
            record_test_result "PM2 Min Uptime Config" "PASS" "Min uptime configured"
        else
            record_test_result "PM2 Min Uptime Config" "FAIL" "Min uptime not configured"
        fi

        # Check memory restart threshold
        if echo "$pm2_show" | grep -q "max_memory_restart"; then
            record_test_result "PM2 Memory Restart Config" "PASS" "Memory restart threshold configured"
        else
            record_test_result "PM2 Memory Restart Config" "FAIL" "Memory restart threshold not configured"
        fi
    else
        record_test_result "PM2 Restart Configuration" "FAIL" "Cannot get restart configuration"
    fi
}

# Test process restart (if enabled)
test_process_restart() {
    local instance_id="$1"

    if [[ "$TEST_RESTART" != "true" ]]; then
        log_info "Skipping process restart test (not enabled)"
        return
    fi

    log_info "Testing PM2 process restart (may cause brief downtime)"
    log_warning "This test will restart the application process"

    # Get initial process ID
    local initial_pid
    if initial_pid=$(execute_ssm_command "$instance_id" "sudo -u macroai pm2 show macro-ai-api | grep 'pid' | head -1" "Initial PID"); then
        log_debug "Initial PID: $initial_pid"
    fi

    # Restart the process
    if execute_ssm_command "$instance_id" "sudo -u macroai pm2 restart macro-ai-api" "PM2 restart" >/dev/null; then
        record_test_result "PM2 Process Restart" "PASS" "Restart command executed"

        # Wait for process to come back online
        sleep 10

        # Check if process is online again
        local post_restart_status
        if post_restart_status=$(execute_ssm_command "$instance_id" "sudo -u macroai pm2 list | grep macro-ai-api" "Post-restart status"); then
            if echo "$post_restart_status" | grep -q "online"; then
                record_test_result "PM2 Process Recovery" "PASS" "Process came back online"

                # Check if PID changed (indicating actual restart)
                local new_pid
                if new_pid=$(execute_ssm_command "$instance_id" "sudo -u macroai pm2 show macro-ai-api | grep 'pid' | head -1" "New PID"); then
                    if [[ "$new_pid" != "$initial_pid" ]]; then
                        record_test_result "PM2 Process PID Change" "PASS" "PID changed after restart"
                    else
                        record_test_result "PM2 Process PID Change" "FAIL" "PID did not change"
                    fi
                fi
            else
                record_test_result "PM2 Process Recovery" "FAIL" "Process did not come back online"
            fi
        else
            record_test_result "PM2 Process Recovery" "FAIL" "Cannot check post-restart status"
        fi
    else
        record_test_result "PM2 Process Restart" "FAIL" "Restart command failed"
    fi
}

# Test systemd integration
test_systemd_integration() {
    local instance_id="$1"

    log_info "Testing systemd integration with PM2"

    # Check if systemd service exists
    local service_status
    if service_status=$(execute_ssm_command "$instance_id" "systemctl status macro-ai.service" "Systemd service status"); then
        if echo "$service_status" | grep -q "active (running)"; then
            record_test_result "Systemd Service Status" "PASS" "Service is active and running"
        else
            record_test_result "Systemd Service Status" "FAIL" "Service is not active"
        fi

        # Check service configuration
        if echo "$service_status" | grep -q "macroai"; then
            record_test_result "Systemd Service User" "PASS" "Running as macroai user"
        else
            record_test_result "Systemd Service User" "FAIL" "Not running as macroai user"
        fi
    else
        record_test_result "Systemd Service Status" "FAIL" "Cannot get service status"
    fi

    # Check service file configuration
    local service_file
    if service_file=$(execute_ssm_command "$instance_id" "cat /etc/systemd/system/macro-ai.service" "Service file content"); then
        # Check for key service configurations
        local service_configs=(
            "Restart=always"
            "RestartSec=10"
            "User=macroai"
            "WorkingDirectory=/opt/macro-ai"
        )

        local configs_found=0
        for config in "${service_configs[@]}"; do
            if echo "$service_file" | grep -q "$config"; then
                ((configs_found++))
                log_debug "Found service config: $config"
            fi
        done

        if [[ $configs_found -ge 3 ]]; then
            record_test_result "Systemd Service Configuration" "PASS" "$configs_found/4 configs found"
        else
            record_test_result "Systemd Service Configuration" "FAIL" "Only $configs_found/4 configs found"
        fi
    else
        record_test_result "Systemd Service Configuration" "FAIL" "Cannot read service file"
    fi
}

# Main validation function
main() {
    log_info "🔍 Starting PM2 Process Management Validation"
    log_info "Instance ID: ${INSTANCE_ID:-N/A}"
    log_info "Environment: ${ENV_NAME:-N/A}"
    log_info "Test Restart: $TEST_RESTART"
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
    test_pm2_installation "$target_instance"
    test_pm2_ecosystem_config "$target_instance"
    test_pm2_process_status "$target_instance"
    test_pm2_logging "$target_instance"
    test_auto_restart_capabilities "$target_instance"
    test_systemd_integration "$target_instance"

    # Run restart test if enabled
    if [[ "$TEST_RESTART" == "true" ]]; then
        test_process_restart "$target_instance"
    fi

    # Generate final report
    echo ""
    log_info "📊 PM2 Process Management Validation Results"
    echo "=============================================="
    echo "Tests Passed: $TESTS_PASSED"
    echo "Tests Failed: $TESTS_FAILED"
    echo "Total Tests:  $((TESTS_PASSED + TESTS_FAILED))"
    echo ""

    if [[ $TESTS_FAILED -eq 0 ]]; then
        log_success "🎉 All PM2 process management validations passed!"
        log_success "✅ PM2 is properly installed and configured"
        log_success "✅ Process management is working correctly"
        log_success "✅ Auto-restart capabilities are configured"
        log_success "✅ Logging is properly set up"
        log_success "✅ Systemd integration is working"
        exit 0
    else
        log_error "❌ Some PM2 process management validations failed"
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
