#!/bin/bash

# Macro AI Preview Stack Management Utility
# Provides utilities for managing CloudFormation stacks in failed states
# Specifically designed for PR preview environments that need to be redeployable

set -euo pipefail

# Color codes for output
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly BLUE='\033[0;34m'
readonly NC='\033[0m' # No Color

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

# Print usage information
print_usage() {
    cat << EOF
Macro AI Preview Stack Management Utility

USAGE:
    $0 <command> [options]

COMMANDS:
    status <stack-name>           Check stack status
    delete <stack-name>           Delete a stack (with confirmation)
    force-delete <stack-name>     Force delete a stack (no confirmation)
    cleanup-failed <stack-name>   Clean up a failed stack for redeployment
    cleanup-orphaned <env-name>   Clean up orphaned AWS resources (e.g., pr-35)
    list-preview-stacks          List all preview stacks
    help                         Show this help message

EXAMPLES:
    # Check status of a PR stack
    $0 status MacroAiPr-35Stack
    
    # Clean up a failed stack for redeployment
    $0 cleanup-failed MacroAiPr-35Stack
    
    # List all preview stacks
    $0 list-preview-stacks
    
    # Force delete a stack
    $0 force-delete MacroAiPr-35Stack

NOTES:
    - This utility is designed for PR preview environments
    - Failed stacks (ROLLBACK_COMPLETE, etc.) can be cleaned up for redeployment
    - Always check stack status before performing operations
EOF
}

# Check if AWS CLI is available and configured
check_aws_cli() {
    if ! command -v aws &> /dev/null; then
        log_error "AWS CLI is not installed or not in PATH"
        exit 1
    fi
    
    if ! aws sts get-caller-identity &> /dev/null; then
        log_error "AWS credentials not configured or invalid"
        exit 1
    fi
}

# Get stack status
get_stack_status() {
    local stack_name="$1"
    
    local stack_status
    stack_status=$(aws cloudformation describe-stacks \
        --stack-name "${stack_name}" \
        --query 'Stacks[0].StackStatus' \
        --output text 2>/dev/null || echo "DOES_NOT_EXIST")
    
    echo "${stack_status}"
}

# Get detailed stack information
get_stack_info() {
    local stack_name="$1"
    
    local stack_info
    stack_info=$(aws cloudformation describe-stacks \
        --stack-name "${stack_name}" \
        --query 'Stacks[0].{Status:StackStatus,CreationTime:CreationTime,LastUpdatedTime:LastUpdatedTime}' \
        --output json 2>/dev/null || echo "null")
    
    echo "${stack_info}"
}

# Status command
status_command() {
    local stack_name="$1"
    
    log_info "Checking status for stack: ${stack_name}"
    
    local stack_status
    stack_status=$(get_stack_status "${stack_name}")
    
    case "${stack_status}" in
        "DOES_NOT_EXIST")
            log_info "Stack does not exist"
            ;;
        "CREATE_COMPLETE"|"UPDATE_COMPLETE")
            log_success "Stack is healthy: ${stack_status}"
            ;;
        "ROLLBACK_COMPLETE"|"CREATE_FAILED"|"UPDATE_ROLLBACK_COMPLETE")
            log_warning "Stack is in failed state: ${stack_status}"
            log_warning "This stack needs to be deleted before redeployment"
            ;;
        "DELETE_IN_PROGRESS")
            log_info "Stack is being deleted: ${stack_status}"
            ;;
        "CREATE_IN_PROGRESS"|"UPDATE_IN_PROGRESS")
            log_info "Stack is being modified: ${stack_status}"
            ;;
        *)
            log_warning "Stack is in unexpected state: ${stack_status}"
            ;;
    esac
    
    # Show detailed information if stack exists
    if [[ "${stack_status}" != "DOES_NOT_EXIST" ]]; then
        local stack_info
        stack_info=$(get_stack_info "${stack_name}")
        
        if [[ "${stack_info}" != "null" ]]; then
            log_info "Stack Details:"
            # Parse JSON without jq for better compatibility
            local status created updated
            status=$(echo "${stack_info}" | grep -o '"Status":"[^"]*"' | cut -d'"' -f4 || echo "Unknown")
            created=$(echo "${stack_info}" | grep -o '"CreationTime":"[^"]*"' | cut -d'"' -f4 || echo "Unknown")
            updated=$(echo "${stack_info}" | grep -o '"LastUpdatedTime":"[^"]*"' | cut -d'"' -f4 || echo "")

            echo "  Status: ${status}"
            echo "  Created: ${created}"
            if [[ -n "${updated}" ]]; then
                echo "  Last Updated: ${updated}"
            fi
        fi
    fi
}

# Delete stack with confirmation
delete_command() {
    local stack_name="$1"
    local force="${2:-false}"
    
    local stack_status
    stack_status=$(get_stack_status "${stack_name}")
    
    if [[ "${stack_status}" == "DOES_NOT_EXIST" ]]; then
        log_info "Stack does not exist: ${stack_name}"
        return 0
    fi
    
    if [[ "${force}" != "true" ]]; then
        log_warning "This will delete the stack: ${stack_name}"
        log_warning "Current status: ${stack_status}"
        echo -n "Are you sure? (y/N): "
        read -r confirmation
        
        if [[ "${confirmation}" != "y" && "${confirmation}" != "Y" ]]; then
            log_info "Operation cancelled"
            return 0
        fi
    fi
    
    log_info "Deleting stack: ${stack_name}"
    
    if aws cloudformation delete-stack --stack-name "${stack_name}"; then
        log_success "Stack deletion initiated"
        log_info "Use 'status' command to monitor deletion progress"
    else
        log_error "Failed to initiate stack deletion"
        exit 1
    fi
}

# Clean up orphaned AWS resources that prevent redeployment
cleanup_orphaned_resources() {
    local env_name="$1"

    log_info "Cleaning up orphaned AWS resources for environment: ${env_name}"

    # Extract PR number from environment name (e.g., pr-35 -> 35)
    local pr_number
    pr_number=${env_name#pr-}

    # Clean up CloudWatch Log Groups
    log_info "Cleaning up CloudWatch Log Groups..."

    # Multiple patterns to handle case variations and naming inconsistencies
    local log_group_patterns=(
        "/aws/deployment/macro-ai-${env_name}"
        "/aws/ec2/macro-ai-PR${pr_number}"
        "/aws/ec2/macro-ai-pr-${pr_number}"
    )

    for pattern in "${log_group_patterns[@]}"; do
        log_info "Checking log groups with pattern: ${pattern}*"

        # Get all log groups matching the pattern
        local matching_groups
        matching_groups=$(aws logs describe-log-groups --log-group-name-prefix "${pattern}" --query 'logGroups[].logGroupName' --output text 2>/dev/null || echo "")

        if [[ -n "${matching_groups}" && "${matching_groups}" != "None" ]]; then
            # Convert tab-separated values to array
            IFS=$'\t' read -ra log_group_array <<< "${matching_groups}"

            for log_group in "${log_group_array[@]}"; do
                if [[ -n "${log_group}" ]]; then
                    log_info "Deleting log group: ${log_group}"
                    if aws logs delete-log-group --log-group-name "${log_group}" 2>/dev/null; then
                        log_success "Deleted log group: ${log_group}"
                    else
                        log_warning "Failed to delete log group: ${log_group}"
                    fi
                    sleep 1  # Rate limiting
                fi
            done
        else
            log_info "No log groups found with pattern: ${pattern}*"
        fi
    done

    # Clean up DynamoDB Tables
    log_info "Cleaning up DynamoDB Tables..."

    # Multiple table name patterns to handle case variations
    local table_patterns=(
        "macro-ai-${env_name}-deployment-history"
        "macro-ai-pr-${pr_number}-deployment-history"
        "macro-ai-PR${pr_number}-deployment-history"
    )

    for table_name in "${table_patterns[@]}"; do
        if aws dynamodb describe-table --table-name "${table_name}" &>/dev/null; then
            log_info "Deleting DynamoDB table: ${table_name}"
            if aws dynamodb delete-table --table-name "${table_name}" &>/dev/null; then
                log_success "Deleted DynamoDB table: ${table_name}"

                # Wait for table deletion to complete
                log_info "Waiting for table deletion to complete..."
                local max_wait=120  # 2 minutes
                local wait_time=0
                local check_interval=10

                while [[ ${wait_time} -lt ${max_wait} ]]; do
                    if ! aws dynamodb describe-table --table-name "${table_name}" &>/dev/null; then
                        log_success "DynamoDB table deletion completed"
                        break
                    fi

                    log_info "Waiting for table deletion... (${wait_time}s/${max_wait}s)"
                    sleep ${check_interval}
                    wait_time=$((wait_time + check_interval))
                done
            else
                log_warning "Failed to delete DynamoDB table: ${table_name}"
            fi
        else
            log_info "DynamoDB table does not exist: ${table_name}"
        fi
    done

    # Clean up any orphaned SNS topics
    log_info "Cleaning up SNS Topics..."
    local sns_topics=(
        "macro-ai-${env_name}-critical-alerts"
        "macro-ai-${env_name}-warning-alerts"
        "macro-ai-${env_name}-info-alerts"
    )

    for topic_name in "${sns_topics[@]}"; do
        local topic_arn
        topic_arn=$(aws sns list-topics --query "Topics[?contains(TopicArn, '${topic_name}')].TopicArn" --output text 2>/dev/null || echo "")

        if [[ -n "${topic_arn}" ]]; then
            log_info "Deleting SNS topic: ${topic_name}"
            if aws sns delete-topic --topic-arn "${topic_arn}" 2>/dev/null; then
                log_success "Deleted SNS topic: ${topic_name}"
            else
                log_warning "Failed to delete SNS topic: ${topic_name}"
            fi
        else
            log_info "SNS topic does not exist: ${topic_name}"
        fi
    done

    log_success "Orphaned resource cleanup completed"
}

# Cleanup failed stack for redeployment
cleanup_failed_command() {
    local stack_name="$1"

    local stack_status
    stack_status=$(get_stack_status "${stack_name}")

    # Extract environment name from stack name (MacroAiPr-35Stack -> pr-35)
    local env_name
    env_name=$(echo "${stack_name}" | sed 's/MacroAi\(.*\)Stack/\1/' | sed 's/^./\l&/' | sed 's/\([A-Z]\)/-\l\1/g')

    case "${stack_status}" in
        "DOES_NOT_EXIST")
            log_info "Stack does not exist, checking for orphaned resources..."
            cleanup_orphaned_resources "${env_name}"
            log_success "Environment is ready for deployment"
            return 0
            ;;
        "CREATE_COMPLETE"|"UPDATE_COMPLETE")
            log_info "Stack is healthy, no cleanup needed"
            return 0
            ;;
        "ROLLBACK_COMPLETE"|"CREATE_FAILED"|"UPDATE_ROLLBACK_COMPLETE")
            log_warning "Stack is in failed state: ${stack_status}"
            log_info "Cleaning up failed stack for redeployment..."
            delete_command "${stack_name}" "true"

            # Wait for deletion to complete
            log_info "Waiting for stack deletion to complete..."
            local max_wait=300  # 5 minutes
            local wait_time=0
            local check_interval=15

            while [[ ${wait_time} -lt ${max_wait} ]]; do
                local current_status
                current_status=$(get_stack_status "${stack_name}")

                if [[ "${current_status}" == "DOES_NOT_EXIST" ]]; then
                    log_success "Stack deletion completed"
                    break
                elif [[ "${current_status}" == "DELETE_FAILED" ]]; then
                    log_error "Stack deletion failed. Manual intervention required."
                    exit 1
                fi

                log_info "Waiting for deletion... (${wait_time}s/${max_wait}s)"
                sleep ${check_interval}
                wait_time=$((wait_time + check_interval))
            done

            # Clean up any orphaned resources
            log_info "Cleaning up orphaned resources..."
            cleanup_orphaned_resources "${env_name}"

            log_success "Stack cleanup completed successfully"
            log_success "Environment is ready for redeployment"
            return 0
            ;;
        *)
            log_warning "Stack is in state: ${stack_status}"
            log_warning "Cannot clean up stack in this state"
            exit 1
            ;;
    esac
}

# List preview stacks
list_preview_stacks_command() {
    log_info "Listing all Macro AI preview stacks..."
    
    local stacks
    stacks=$(aws cloudformation list-stacks \
        --query 'StackSummaries[?contains(StackName, `MacroAiPr`) && StackStatus != `DELETE_COMPLETE`].{Name:StackName,Status:StackStatus,Created:CreationTime}' \
        --output json)
    
    if [[ "${stacks}" == "[]" || -z "${stacks}" ]]; then
        log_info "No preview stacks found"
        return 0
    fi

    log_info "Found preview stacks:"
    # Parse JSON without jq for better compatibility
    echo "${stacks}" | grep -o '"Name":"[^"]*"' | cut -d'"' -f4 | while read -r name; do
        echo "  ${name}"
    done
}

# Main function
main() {
    if [[ $# -eq 0 ]]; then
        print_usage
        exit 1
    fi
    
    check_aws_cli
    
    local command="$1"
    shift
    
    case "${command}" in
        "status")
            if [[ $# -ne 1 ]]; then
                log_error "Usage: $0 status <stack-name>"
                exit 1
            fi
            status_command "$1"
            ;;
        "delete")
            if [[ $# -ne 1 ]]; then
                log_error "Usage: $0 delete <stack-name>"
                exit 1
            fi
            delete_command "$1" "false"
            ;;
        "force-delete")
            if [[ $# -ne 1 ]]; then
                log_error "Usage: $0 force-delete <stack-name>"
                exit 1
            fi
            delete_command "$1" "true"
            ;;
        "cleanup-failed")
            if [[ $# -ne 1 ]]; then
                log_error "Usage: $0 cleanup-failed <stack-name>"
                exit 1
            fi
            cleanup_failed_command "$1"
            ;;
        "cleanup-orphaned")
            if [[ $# -ne 1 ]]; then
                log_error "Usage: $0 cleanup-orphaned <env-name>"
                exit 1
            fi
            cleanup_orphaned_resources "$1"
            ;;
        "list-preview-stacks")
            list_preview_stacks_command
            ;;
        "help"|"-h"|"--help")
            print_usage
            ;;
        *)
            log_error "Unknown command: ${command}"
            print_usage
            exit 1
            ;;
    esac
}

# Execute main function
main "$@"
