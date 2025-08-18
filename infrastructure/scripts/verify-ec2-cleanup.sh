#!/bin/bash

# =============================================================================
# EC2 Preview Environment Cleanup Verification Script
# =============================================================================
# 
# This script provides comprehensive verification that EC2-based preview
# environments have been properly cleaned up after teardown operations.
#
# Verification Steps:
# 1. Check CloudFormation stack deletion status
# 2. Verify Auto Scaling Group cleanup
# 3. Verify Application Load Balancer cleanup
# 4. Check for orphaned EC2 instances
# 5. Verify Launch Template cleanup
# 6. Check security group cleanup
# 7. Generate detailed cleanup report
#
# Usage:
#   ./verify-ec2-cleanup.sh --env-name pr-123
#   ./verify-ec2-cleanup.sh --stack-name MacroAiPr123Stack
#   ./verify-ec2-cleanup.sh --pr-number 123
#
# Exit Codes:
#   0 - All resources successfully cleaned up
#   1 - Some resources still exist or verification failed
#   2 - Invalid arguments or configuration error

set -euo pipefail

# Configuration
AWS_REGION="${AWS_REGION:-us-east-1}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VERBOSE=false
WAIT_TIMEOUT=300  # 5 minutes default timeout
CHECK_INTERVAL=10 # Check every 10 seconds

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

# Help function
show_help() {
    cat << EOF
EC2 Preview Environment Cleanup Verification Script

USAGE:
    $0 [OPTIONS]

OPTIONS:
    --env-name NAME             Environment name (e.g., pr-123)
    --stack-name NAME           CloudFormation stack name (e.g., MacroAiPr123Stack)
    --pr-number NUMBER          PR number (will generate env-name and stack-name)
    --region REGION             AWS region (default: us-east-1)
    --timeout SECONDS           Maximum wait time for cleanup (default: 300)
    --interval SECONDS          Check interval in seconds (default: 10)
    --verbose                   Enable verbose logging
    --help                      Show this help message

EXAMPLES:
    $0 --pr-number 123
    $0 --env-name pr-456 --verbose
    $0 --stack-name MacroAiPr789Stack --timeout 600

VERIFICATION CHECKS:
    ✓ CloudFormation stack deletion
    ✓ Auto Scaling Group cleanup
    ✓ Application Load Balancer cleanup
    ✓ EC2 instance termination
    ✓ Launch Template cleanup
    ✓ Security Group cleanup
    ✓ Target Group cleanup

EOF
}

# Parse command line arguments
parse_arguments() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            --env-name)
                ENV_NAME="$2"
                shift 2
                ;;
            --stack-name)
                STACK_NAME="$2"
                shift 2
                ;;
            --pr-number)
                PR_NUMBER="$2"
                # Extract digits and format consistently
                if [[ "$2" =~ ^[0-9]+$ ]]; then
                    ENV_NAME="pr-$2"
                    STACK_NAME="MacroAiPr${2}Stack"
                else
                    log_error "Invalid PR number format: $2. Must be digits only."
                    exit 2
                fi
                shift 2
                ;;
            --region)
                AWS_REGION="$2"
                shift 2
                ;;
            --timeout)
                WAIT_TIMEOUT="$2"
                shift 2
                ;;
            --interval)
                CHECK_INTERVAL="$2"
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

    # Validate required parameters
    if [[ -z "${ENV_NAME:-}" ]] && [[ -z "${STACK_NAME:-}" ]]; then
        log_error "Either --env-name, --stack-name, or --pr-number must be provided"
        show_help
        exit 2
    fi

    # Generate missing parameters using consistent regex extraction and formatting
    if [[ -n "${ENV_NAME:-}" ]] && [[ -z "${STACK_NAME:-}" ]]; then
        # Extract digits from ENV_NAME (pr-123 -> 123) and format STACK_NAME
        if [[ "$ENV_NAME" =~ ^pr-([0-9]+)$ ]]; then
            local digits="${BASH_REMATCH[1]}"
            STACK_NAME="MacroAiPr${digits}Stack"
        else
            log_error "Invalid environment name format: $ENV_NAME. Expected format: pr-<digits>"
            exit 2
        fi
    fi

    if [[ -n "${STACK_NAME:-}" ]] && [[ -z "${ENV_NAME:-}" ]]; then
        # Extract digits from STACK_NAME (MacroAiPr123Stack -> 123) and format ENV_NAME
        if [[ "$STACK_NAME" =~ ^MacroAiPr([0-9]+)Stack$ ]]; then
            local digits="${BASH_REMATCH[1]}"
            ENV_NAME="pr-${digits}"
        else
            log_error "Invalid stack name format: $STACK_NAME. Expected format: MacroAiPr<digits>Stack"
            exit 2
        fi
    fi
}

# Check CloudFormation stack status
verify_cloudformation_stack() {
    log_info "Checking CloudFormation stack: $STACK_NAME"
    
    local stack_status
    stack_status=$(aws cloudformation describe-stacks \
        --stack-name "$STACK_NAME" \
        --region "$AWS_REGION" \
        --query 'Stacks[0].StackStatus' \
        --output text 2>/dev/null || echo "DOES_NOT_EXIST")
    
    if [[ "$stack_status" == "DOES_NOT_EXIST" ]]; then
        log_success "CloudFormation stack successfully deleted"
        return 0
    else
        log_warning "CloudFormation stack still exists with status: $stack_status"
        return 1
    fi
}

# Check Auto Scaling Groups
verify_auto_scaling_groups() {
    log_info "Checking Auto Scaling Groups for environment: $ENV_NAME"
    
    local asg_count
    asg_count=$(aws autoscaling describe-auto-scaling-groups \
        --region "$AWS_REGION" \
        --query "AutoScalingGroups[?contains(AutoScalingGroupName, '$ENV_NAME')].AutoScalingGroupName" \
        --output text 2>/dev/null | wc -w || echo "0")
    
    if [[ "$asg_count" -eq 0 ]]; then
        log_success "No Auto Scaling Groups found"
        return 0
    else
        log_warning "Found $asg_count Auto Scaling Groups still remaining"
        
        if [[ "$VERBOSE" == "true" ]]; then
            local asgs
            asgs=$(aws autoscaling describe-auto-scaling-groups \
                --region "$AWS_REGION" \
                --query "AutoScalingGroups[?contains(AutoScalingGroupName, '$ENV_NAME')].AutoScalingGroupName" \
                --output text 2>/dev/null || echo "")
            log_debug "Remaining ASGs: $asgs"
        fi
        
        return 1
    fi
}

# Check Application Load Balancers
verify_load_balancers() {
    log_info "Checking Application Load Balancers for environment: $ENV_NAME"
    
    local alb_count
    alb_count=$(aws elbv2 describe-load-balancers \
        --region "$AWS_REGION" \
        --query "LoadBalancers[?contains(LoadBalancerName, '$ENV_NAME')].LoadBalancerName" \
        --output text 2>/dev/null | wc -w || echo "0")
    
    if [[ "$alb_count" -eq 0 ]]; then
        log_success "No Application Load Balancers found"
        return 0
    else
        log_warning "Found $alb_count Application Load Balancers still remaining"
        
        if [[ "$VERBOSE" == "true" ]]; then
            local albs
            albs=$(aws elbv2 describe-load-balancers \
                --region "$AWS_REGION" \
                --query "LoadBalancers[?contains(LoadBalancerName, '$ENV_NAME')].LoadBalancerName" \
                --output text 2>/dev/null || echo "")
            log_debug "Remaining ALBs: $albs"
        fi
        
        return 1
    fi
}

# Check EC2 instances
verify_ec2_instances() {
    log_info "Checking EC2 instances for environment: $ENV_NAME"
    
    local instance_count
    instance_count=$(aws ec2 describe-instances \
        --region "$AWS_REGION" \
        --filters "Name=tag:Environment,Values=$ENV_NAME" "Name=instance-state-name,Values=running,pending,stopping,stopped" \
        --query 'Reservations[].Instances[].InstanceId' \
        --output text 2>/dev/null | wc -w || echo "0")
    
    if [[ "$instance_count" -eq 0 ]]; then
        log_success "No EC2 instances found"
        return 0
    else
        log_warning "Found $instance_count EC2 instances still remaining"
        
        if [[ "$VERBOSE" == "true" ]]; then
            local instances
            instances=$(aws ec2 describe-instances \
                --region "$AWS_REGION" \
                --filters "Name=tag:Environment,Values=$ENV_NAME" "Name=instance-state-name,Values=running,pending,stopping,stopped" \
                --query 'Reservations[].Instances[].[InstanceId,State.Name]' \
                --output text 2>/dev/null || echo "")
            log_debug "Remaining instances: $instances"
        fi
        
        return 1
    fi
}

# Check Launch Templates
verify_launch_templates() {
    log_info "Checking Launch Templates for environment: $ENV_NAME"
    local lt_count
    lt_count=$(aws ec2 describe-launch-templates \
        --region "$AWS_REGION" \
        --query "LaunchTemplates[?contains(LaunchTemplateName, '$ENV_NAME')].LaunchTemplateName" \
        --output text 2>/dev/null | wc -w || echo "0")

    if [[ "$lt_count" -eq 0 ]]; then
        log_success "No Launch Templates found"
        return 0
    else
        log_warning "Found $lt_count Launch Templates still remaining"
        if [[ "$VERBOSE" == "true" ]]; then
            local lts
            lts=$(aws ec2 describe-launch-templates \
                --region "$AWS_REGION" \
                --query "LaunchTemplates[?contains(LaunchTemplateName, '$ENV_NAME')].LaunchTemplateName" \
                --output text 2>/dev/null || echo "")
            log_debug "Remaining Launch Templates: $lts"
        fi
        return 1
    fi
}

# Check Security Groups
verify_security_groups() {
    log_info "Checking Security Groups for environment: $ENV_NAME"
    # Match by name or Environment tag
    local sg_ids sg_count
    sg_ids=$(aws ec2 describe-security-groups \
        --region "$AWS_REGION" \
        --filters "Name=group-name,Values=*${ENV_NAME}*" "Name=tag:Environment,Values=${ENV_NAME}" \
        --query 'SecurityGroups[].GroupId' \
        --output text 2>/dev/null || echo "")
    sg_count=$(wc -w <<<"$sg_ids")

    if [[ "$sg_count" -eq 0 ]]; then
        log_success "No Security Groups found"
        return 0
    else
        log_warning "Found $sg_count Security Groups still remaining"
        if [[ "$VERBOSE" == "true" ]]; then
            log_debug "Remaining Security Groups: $sg_ids"
        fi
        return 1
    fi
}

# Check Target Groups
verify_target_groups() {
    log_info "Checking Target Groups for environment: $ENV_NAME"
    local tg_count
    tg_count=$(aws elbv2 describe-target-groups \
        --region "$AWS_REGION" \
        --query "TargetGroups[?contains(TargetGroupName, '$ENV_NAME')].TargetGroupArn" \
        --output text 2>/dev/null | wc -w || echo "0")

    if [[ "$tg_count" -eq 0 ]]; then
        log_success "No Target Groups found"
        return 0
    else
        log_warning "Found $tg_count Target Groups still remaining"
        if [[ "$VERBOSE" == "true" ]]; then
            local tgs
            tgs=$(aws elbv2 describe-target-groups \
                --region "$AWS_REGION" \
                --query "TargetGroups[?contains(TargetGroupName, '$ENV_NAME')].[TargetGroupName,TargetGroupArn]" \
                --output text 2>/dev/null || echo "")
            log_debug "Remaining Target Groups: $tgs"
        fi
        return 1
    fi
}

# Validate timeout and interval parameters
validate_parameters() {
    # Validate timeout is a positive integer
    if ! [[ "$WAIT_TIMEOUT" =~ ^[1-9][0-9]*$ ]]; then
        log_error "Invalid timeout value: $WAIT_TIMEOUT. Must be a positive integer."
        exit 1
    fi

    # Validate interval is a positive integer
    if ! [[ "$CHECK_INTERVAL" =~ ^[1-9][0-9]*$ ]]; then
        log_error "Invalid interval value: $CHECK_INTERVAL. Must be a positive integer."
        exit 1
    fi
}

# Run all verification checks and return true if all pass
run_verification_checks() {
    local all_passed=true

    if ! verify_cloudformation_stack; then
        all_passed=false
    fi

    if ! verify_auto_scaling_groups; then
        all_passed=false
    fi

    if ! verify_load_balancers; then
        all_passed=false
    fi

    if ! verify_ec2_instances; then
        all_passed=false
    fi

    if ! verify_launch_templates; then
        all_passed=false
    fi

    if ! verify_security_groups; then
        all_passed=false
    fi

    if ! verify_target_groups; then
        all_passed=false
    fi

    [[ "$all_passed" == "true" ]]
}

# Main verification function with polling loop
main() {
    log_info "🔍 Starting EC2 cleanup verification"
    log_info "Environment: ${ENV_NAME:-N/A}"
    log_info "Stack: ${STACK_NAME:-N/A}"
    log_info "Region: $AWS_REGION"
    log_info "Timeout: ${WAIT_TIMEOUT}s"
    log_info "Check interval: ${CHECK_INTERVAL}s"
    echo ""

    # Validate parameters before starting
    validate_parameters

    # Capture start time and compute deadline
    local start_time
    start_time=$(date +%s)
    local deadline=$((start_time + WAIT_TIMEOUT))
    local attempt=1

    # Polling loop
    while true; do
        local current_time
        current_time=$(date +%s)

        if [[ $VERBOSE == "true" ]]; then
            local elapsed=$((current_time - start_time))
            log_info "Attempt $attempt (${elapsed}s elapsed)..."
        fi

        # Run verification checks
        if run_verification_checks; then
            echo ""
            log_success "🎉 All EC2 resources successfully cleaned up!"
            log_success "Preview environment '$ENV_NAME' has been completely removed"

            local elapsed_time=$((current_time - start_time))
            log_info "Verification completed in ${elapsed_time}s after $attempt attempt(s)"
            exit 0
        fi

        # Check if timeout has been reached
        if [[ $current_time -ge $deadline ]]; then
            echo ""
            log_error "❌ Timeout reached after ${WAIT_TIMEOUT}s"
            log_error "Some resources still exist or cleanup verification failed"
            log_error "Manual cleanup may be required for remaining resources"

            local elapsed_time=$((current_time - start_time))
            log_info "Verification timed out after ${elapsed_time}s and $attempt attempt(s)"
            exit 1
        fi

        # Print progress and sleep before retry
        if [[ $VERBOSE == "true" ]]; then
            local remaining=$((deadline - current_time))
            log_info "Retrying in ${CHECK_INTERVAL}s (${remaining}s remaining)..."
        fi

        sleep "$CHECK_INTERVAL"
        attempt=$((attempt + 1))
    done
}

# Parse arguments and run main function
parse_arguments "$@"
main
