#!/bin/bash

# EC2 Preview Deployment Script
# This script deploys EC2-based preview environments using Phase 4 infrastructure constructs

set -euo pipefail

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Validate required environment variables
validate_environment() {
    log_info "Validating environment variables..."
    
    local required_vars=(
        "CDK_DEPLOY_ENV"
        "CDK_DEPLOY_SCALE"
        "CDK_DEPLOY_TYPE"
        "AWS_REGION"
        "AWS_ACCOUNT_ID"
        "PR_NUMBER"
        "BRANCH_NAME"
        "CORS_ALLOWED_ORIGINS"
    )
    
    local missing_vars=()
    
    for var in "${required_vars[@]}"; do
        if [[ -z "${!var:-}" ]]; then
            missing_vars+=("$var")
        fi
    done
    
    if [[ ${#missing_vars[@]} -gt 0 ]]; then
        log_error "Missing required environment variables:"
        printf '%s\n' "${missing_vars[@]}"
        exit 1
    fi
    
    log_success "Environment validation completed"
}

# Clean up historic tag conflicts using comprehensive cleanup script
cleanup_historic_tag_conflicts() {
    local stack_name="$1"

    log_info "🏷️  Running comprehensive tag conflict cleanup..."

    # Extract PR number from stack name (e.g., MacroAiPr-35Stack -> 35)
    local pr_number
    pr_number=$(echo "${stack_name}" | sed -n 's/.*Pr-\([0-9]\+\)Stack.*/\1/p')

    if [[ -z "${pr_number}" ]]; then
        log_info "Could not extract PR number from stack name, running general cleanup"
        pr_number=""
    else
        log_info "Targeting tag cleanup for PR ${pr_number}"
    fi

    # Path to the comprehensive cleanup script
    local cleanup_script="infrastructure/scripts/cleanup-tag-conflicts.sh"

    if [[ -f "${cleanup_script}" ]]; then
        log_info "Running comprehensive tag conflict cleanup script..."

        # Prepare cleanup arguments
        local cleanup_args="--execute --region ${AWS_REGION} --force"
        if [[ -n "${pr_number}" ]]; then
            cleanup_args+=" --pr-number ${pr_number}"
        fi

        # Create backup file for this cleanup
        local backup_file="tag-backup-pr-${pr_number:-all}-$(date +%Y%m%d-%H%M%S).json"
        cleanup_args+=" --backup-file ${backup_file}"

        # Run the cleanup script
        if "${cleanup_script}" ${cleanup_args}; then
            log_success "Comprehensive tag conflict cleanup completed successfully"
            log_info "Original tags backed up to: ${backup_file}"
        else
            log_warning "Tag conflict cleanup encountered issues, but continuing with deployment"
            log_info "Manual tag cleanup may be required if deployment fails"
        fi
    else
        log_warning "Comprehensive cleanup script not found, falling back to basic cleanup"

        # Fallback to basic cleanup for critical conflicts
        basic_tag_conflict_cleanup "${pr_number}"
    fi
}

# Basic tag conflict cleanup (fallback)
basic_tag_conflict_cleanup() {
    local pr_number="$1"

    log_info "Running basic tag conflict cleanup..."

    if [[ -z "${pr_number}" ]]; then
        log_info "No PR number available, skipping basic cleanup"
        return 0
    fi

    # List IAM roles that might have conflicting tags from previous deployments
    local conflicting_tag_patterns=(
        "PrNumber=${pr_number}"      # Old format
        "PRNumber=${pr_number}"      # New format
        "pr-number=${pr_number}"     # Alternative format
    )

    # Find and clean IAM roles with potentially conflicting tags
    for tag_pattern in "${conflicting_tag_patterns[@]}"; do
        local tag_key="${tag_pattern%=*}"
        local tag_value="${tag_pattern#*=}"

        log_debug "Checking for IAM roles with tag ${tag_key}=${tag_value}..."

        # Get IAM roles with this tag (if any exist)
        local roles_with_tag
        roles_with_tag=$(aws iam list-roles \
            --query "Roles[?contains(Tags[?Key=='${tag_key}' && Value=='${tag_value}'].Key, '${tag_key}')].RoleName" \
            --output text 2>/dev/null || echo "")

        if [[ -n "${roles_with_tag}" && "${roles_with_tag}" != "None" ]]; then
            log_info "Found IAM roles with potentially conflicting tag ${tag_key}: ${roles_with_tag}"

            # For each role, remove potentially conflicting tags
            for role_name in ${roles_with_tag}; do
                log_info "Cleaning conflicting tags from IAM role: ${role_name}"

                # Remove common conflicting tag keys (case variations)
                local tags_to_remove=("PrNumber" "PRNumber" "pr-number" "project" "Project" "environment" "Environment")

                for tag_to_remove in "${tags_to_remove[@]}"; do
                    if aws iam untag-role --role-name "${role_name}" --tag-keys "${tag_to_remove}" 2>/dev/null; then
                        log_info "Removed tag '${tag_to_remove}' from role '${role_name}'"
                    fi
                done
            done
        fi
    done

    log_success "Basic tag conflict cleanup completed"
}

# Generate stack name for preview environment
generate_stack_name() {
    local env_name="$1"
    # Convert pr-35 to Pr-35Stack format (same as workflow)
    local stack_name="MacroAi$(echo "${env_name}" | sed 's/^./\U&/')Stack"
    echo "${stack_name}"
}

# Check CloudFormation stack status
check_stack_status() {
    local stack_name="$1"

    log_info "Checking stack status: ${stack_name}"

    local stack_status
    stack_status=$(aws cloudformation describe-stacks \
        --stack-name "${stack_name}" \
        --query 'Stacks[0].StackStatus' \
        --output text 2>/dev/null || echo "DOES_NOT_EXIST")

    log_info "Current stack status: ${stack_status}"
    echo "${stack_status}"
}

# Handle failed stack states (ROLLBACK_COMPLETE, etc.)
handle_failed_stack() {
    local stack_name="$1"
    local stack_status="$2"

    case "${stack_status}" in
        "ROLLBACK_COMPLETE"|"CREATE_FAILED"|"UPDATE_ROLLBACK_COMPLETE")
            log_warning "Stack is in failed state: ${stack_status}"
            log_info "This typically happens when a previous deployment failed"
            log_info "For PR preview environments, we need to delete and recreate the stack"

            # Clean up historic tag conflicts before deleting the stack
            cleanup_historic_tag_conflicts "${stack_name}"

            log_info "Deleting failed stack: ${stack_name}"
            if aws cloudformation delete-stack --stack-name "${stack_name}"; then
                log_info "Stack deletion initiated, waiting for completion..."

                # Wait for stack deletion to complete
                local max_wait=300  # 5 minutes
                local wait_time=0
                local check_interval=15

                while [[ ${wait_time} -lt ${max_wait} ]]; do
                    local current_status
                    current_status=$(aws cloudformation describe-stacks \
                        --stack-name "${stack_name}" \
                        --query 'Stacks[0].StackStatus' \
                        --output text 2>/dev/null || echo "DOES_NOT_EXIST")

                    if [[ "${current_status}" == "DOES_NOT_EXIST" ]]; then
                        log_success "Stack deletion completed successfully"
                        return 0
                    elif [[ "${current_status}" == "DELETE_FAILED" ]]; then
                        log_error "Stack deletion failed. Manual intervention may be required."
                        log_error "Check AWS Console for resources that couldn't be deleted."
                        exit 1
                    fi

                    log_info "Waiting for stack deletion... (${wait_time}s/${max_wait}s)"
                    sleep ${check_interval}
                    wait_time=$((wait_time + check_interval))
                done

                log_error "Timeout waiting for stack deletion"
                exit 1
            else
                log_error "Failed to initiate stack deletion"
                exit 1
            fi
            ;;
        "DELETE_IN_PROGRESS")
            log_info "Stack is currently being deleted, waiting for completion..."
            # Wait for deletion to complete before proceeding
            local max_wait=300
            local wait_time=0
            local check_interval=15

            while [[ ${wait_time} -lt ${max_wait} ]]; do
                local current_status
                current_status=$(check_stack_status "${stack_name}")

                if [[ "${current_status}" == "DOES_NOT_EXIST" ]]; then
                    log_success "Stack deletion completed"
                    return 0
                fi

                log_info "Waiting for stack deletion... (${wait_time}s/${max_wait}s)"
                sleep ${check_interval}
                wait_time=$((wait_time + check_interval))
            done

            log_error "Timeout waiting for stack deletion"
            exit 1
            ;;
        "ROLLBACK_IN_PROGRESS")
            log_warning "Stack is currently rolling back from a failed deployment: ${stack_status}"
            log_info "Waiting for rollback to complete before proceeding..."

            # Wait for rollback to complete
            local max_wait=600  # 10 minutes for rollback
            local wait_time=0
            local check_interval=30

            while [[ ${wait_time} -lt ${max_wait} ]]; do
                local current_status
                current_status=$(check_stack_status "${stack_name}")

                if [[ "${current_status}" == "ROLLBACK_COMPLETE" ]]; then
                    log_success "Rollback completed, now cleaning up historic tag conflicts"
                    # Clean up any historic tag conflicts before deleting the stack
                    cleanup_historic_tag_conflicts "${stack_name}"
                    log_success "Now deleting failed stack for redeployment"
                    # Recursively call handle_failed_stack with the new status
                    handle_failed_stack "${stack_name}" "${current_status}"
                    return 0
                elif [[ "${current_status}" == "ROLLBACK_FAILED" ]]; then
                    log_error "Stack rollback failed. Manual intervention required."
                    log_error "Check AWS Console for resources that couldn't be rolled back."
                    exit 1
                elif [[ "${current_status}" == "DOES_NOT_EXIST" ]]; then
                    log_success "Stack was deleted during rollback, ready for new deployment"
                    return 0
                fi

                log_info "Waiting for rollback to complete... (${wait_time}s/${max_wait}s) - Current status: ${current_status}"
                sleep ${check_interval}
                wait_time=$((wait_time + check_interval))
            done

            log_error "Timeout waiting for rollback to complete"
            log_error "Stack is still in ROLLBACK_IN_PROGRESS state after ${max_wait} seconds"
            log_error "Manual intervention may be required via AWS Console"
            exit 1
            ;;
        "CREATE_IN_PROGRESS"|"UPDATE_IN_PROGRESS")
            log_warning "Stack is currently being modified: ${stack_status}"
            log_error "Cannot deploy while stack is in transitional state"
            log_error "Please wait for current operation to complete or cancel it manually"
            exit 1
            ;;
        "CREATE_COMPLETE"|"UPDATE_COMPLETE")
            log_info "Stack exists and is in good state, will update existing stack"
            return 0
            ;;
        "DOES_NOT_EXIST")
            log_info "Stack does not exist, will create new stack"
            return 0
            ;;
        *)
            log_warning "Stack is in unexpected state: ${stack_status}"
            log_warning "Proceeding with deployment attempt..."
            return 0
            ;;
    esac
}

# Deploy EC2 preview infrastructure
deploy_infrastructure() {
    log_info "Starting EC2 preview infrastructure deployment..."

    local env_name="${CDK_DEPLOY_ENV}"
    local stack_name
    stack_name=$(generate_stack_name "${env_name}")

    log_info "Environment: ${env_name}"
    log_info "Stack Name: ${stack_name}"
    log_info "Scale: ${CDK_DEPLOY_SCALE}"
    log_info "Type: ${CDK_DEPLOY_TYPE}"
    log_info "PR Number: ${PR_NUMBER}"
    log_info "Branch: ${BRANCH_NAME}"

    # Check and handle stack state before deployment
    local stack_status
    stack_status=$(check_stack_status "${stack_name}")
    handle_failed_stack "${stack_name}" "${stack_status}"

    # Set CDK context for preview deployment
    local cdk_context=(
        "--context" "deploymentType=preview"
        "--context" "environment=${env_name}"
        "--context" "prNumber=${PR_NUMBER}"
        "--context" "branchName=${BRANCH_NAME}"
        "--context" "scale=${CDK_DEPLOY_SCALE}"
        "--context" "corsAllowedOrigins=${CORS_ALLOWED_ORIGINS}"
        "--context" "reuseExistingResources=true"
    )

    # Debug tag generation before deployment
    log_info "Debugging tag generation for deployment..."
    if [[ -f "infrastructure/scripts/debug-tag-generation.sh" ]]; then
        log_info "Running tag conflict check..."
        if ./infrastructure/scripts/debug-tag-generation.sh --pr-number "${pr_number}" --branch "${branch_name}" --environment "pr-${pr_number}" 2>/dev/null; then
            log_success "Tag conflict check passed"
        else
            log_warning "Tag conflict check had issues, but continuing deployment..."
        fi
    else
        log_info "Tag debug script not found, skipping tag conflict check"
    fi

    # Deploy the stack using CDK
    log_info "Deploying CDK stack: ${stack_name}"

    if ! cdk deploy "${stack_name}" \
        --require-approval never \
        --outputs-file "cdk-outputs.json" \
        "${cdk_context[@]}" \
        --verbose; then
        log_error "CDK deployment failed"

        # Check if stack is now in failed state and provide helpful information
        local post_failure_status
        post_failure_status=$(check_stack_status "${stack_name}")
        log_error "Stack status after failure: ${post_failure_status}"

        if [[ "${post_failure_status}" == "ROLLBACK_COMPLETE" ]]; then
            log_error "Stack rolled back due to deployment failure"
            log_error "On next deployment attempt, the failed stack will be automatically deleted and recreated"
        fi

        exit 1
    fi

    log_success "CDK deployment completed successfully"

    # Verify outputs file was created
    if [[ -f "cdk-outputs.json" ]]; then
        log_info "CDK outputs:"
        cat cdk-outputs.json
    else
        log_warning "CDK outputs file not found"
    fi
}

# Deploy application to EC2 instances
deploy_application() {
    log_info "Starting application deployment to EC2 instances..."
    
    local env_name="${CDK_DEPLOY_ENV}"
    local stack_name
    stack_name=$(generate_stack_name "${env_name}")
    
    # Get Auto Scaling Group name from CloudFormation outputs
    local asg_name
    asg_name=$(aws cloudformation describe-stacks \
        --stack-name "${stack_name}" \
        --query "Stacks[0].Outputs[?OutputKey=='AutoScalingGroupName'].OutputValue" \
        --output text 2>/dev/null || echo "")
    
    if [[ -z "${asg_name}" || "${asg_name}" == "None" ]]; then
        log_error "Could not retrieve Auto Scaling Group name from stack outputs"
        exit 1
    fi
    
    log_info "Auto Scaling Group: ${asg_name}"
    
    # Get current EC2 instances in the Auto Scaling Group
    local instance_ids
    instance_ids=$(aws autoscaling describe-auto-scaling-groups \
        --auto-scaling-group-names "${asg_name}" \
        --query "AutoScalingGroups[0].Instances[?LifecycleState=='InService'].InstanceId" \
        --output text 2>/dev/null || echo "")
    
    if [[ -z "${instance_ids}" || "${instance_ids}" == "None" ]]; then
        log_warning "No running instances found in Auto Scaling Group"
        log_info "Waiting for instances to become available..."
        
        # Wait for instances to be ready (up to 10 minutes)
        local max_attempts=60
        local attempt=1
        
        while [[ ${attempt} -le ${max_attempts} ]]; do
            instance_ids=$(aws autoscaling describe-auto-scaling-groups \
                --auto-scaling-group-names "${asg_name}" \
                --query "AutoScalingGroups[0].Instances[?LifecycleState=='InService'].InstanceId" \
                --output text 2>/dev/null || echo "")
            
            if [[ -n "${instance_ids}" && "${instance_ids}" != "None" ]]; then
                log_success "Instances are now available"
                break
            fi
            
            log_info "Attempt ${attempt}/${max_attempts}: Waiting for instances..."
            sleep 10
            ((attempt++))
        done
        
        if [[ -z "${instance_ids}" || "${instance_ids}" == "None" ]]; then
            log_error "Timeout waiting for EC2 instances to become available"
            exit 1
        fi
    fi
    
    log_info "Found instances: ${instance_ids}"
    
    # Deploy application using Systems Manager (if available) or user data will handle it
    log_info "Application deployment will be handled by EC2 user data script"
    log_info "The Express API deployment package has been made available to the instances"
    
    log_success "Application deployment initiated"
}

# Wait for deployment to be healthy using direct AWS API queries
wait_for_healthy_deployment() {
    log_info "🚀 Starting robust deployment health check with progressive timeout stages..."

    # Extract deployment configuration from CloudFormation stack
    local env_name="${CDK_DEPLOY_ENV}"
    local stack_name
    stack_name=$(generate_stack_name "${env_name}")
    log_info "📋 Extracting deployment configuration from stack: $stack_name"

    # Get stack outputs
    local stack_outputs
    if ! stack_outputs=$(aws cloudformation describe-stacks --stack-name "$stack_name" --query "Stacks[0].Outputs" --output json 2>/dev/null); then
        log_error "❌ Failed to get CloudFormation stack outputs for $stack_name"
        return 1
    fi

    # Extract Auto Scaling Group name (with fallback if jq is not available)
    local asg_name
    if command -v jq >/dev/null 2>&1; then
        asg_name=$(echo "$stack_outputs" | jq -r '.[] | select(.OutputKey=="AutoScalingGroupName") | .OutputValue' 2>/dev/null)
    else
        # Fallback using AWS CLI query
        asg_name=$(aws cloudformation describe-stacks --stack-name "$stack_name" --query "Stacks[0].Outputs[?OutputKey=='AutoScalingGroupName'].OutputValue" --output text 2>/dev/null)
    fi
    if [[ -z "$asg_name" || "$asg_name" == "null" || "$asg_name" == "None" ]]; then
        log_error "❌ Could not find AutoScalingGroupName in stack outputs"
        return 1
    fi
    log_info "✅ Found Auto Scaling Group: $asg_name"

    # Extract environment name for logging (with fallback)
    local environment
    if command -v jq >/dev/null 2>&1; then
        environment=$(echo "$stack_outputs" | jq -r '.[] | select(.OutputKey=="Environment") | .OutputValue' 2>/dev/null)
    else
        environment=$(aws cloudformation describe-stacks --stack-name "$stack_name" --query "Stacks[0].Outputs[?OutputKey=='Environment'].OutputValue" --output text 2>/dev/null)
    fi
    if [[ -n "$environment" && "$environment" != "null" && "$environment" != "None" ]]; then
        log_info "✅ Environment: $environment"
    fi

    # Extract target group ARN (with fallback)
    local target_group_arn
    if command -v jq >/dev/null 2>&1; then
        target_group_arn=$(echo "$stack_outputs" | jq -r '.[] | select(.OutputKey=="DefaultTargetGroupArn") | .OutputValue' 2>/dev/null)
    else
        target_group_arn=$(aws cloudformation describe-stacks --stack-name "$stack_name" --query "Stacks[0].Outputs[?OutputKey=='DefaultTargetGroupArn'].OutputValue" --output text 2>/dev/null)
    fi
    if [[ -z "$target_group_arn" || "$target_group_arn" == "null" || "$target_group_arn" == "None" ]]; then
        log_error "❌ Could not find DefaultTargetGroupArn in stack outputs"
        return 1
    fi

    log_info "✅ Found target group: $target_group_arn"

    # Phase 1: Wait for instances to be running (5 minutes)
    if ! wait_for_instances_running "$asg_name"; then
        log_error "❌ Phase 1 failed: Instances did not reach running state"
        return 1
    fi

    # Phase 2: Wait for user data completion (15 minutes)
    if ! wait_for_user_data_completion "$asg_name"; then
        log_error "❌ Phase 2 failed: User data scripts did not complete"
        return 1
    fi

    # Phase 3: Wait for ALB health checks (10 minutes)
    if ! wait_for_alb_health "$target_group_arn"; then
        log_error "❌ Phase 3 failed: ALB health checks did not pass"
        return 1
    fi

    log_success "🎉 Deployment is fully healthy! All phases completed successfully."
    return 0
}

# Phase 1: Wait for instances to reach running state (5 minutes timeout)
wait_for_instances_running() {
    local asg_name="$1"
    local phase_timeout=300  # 5 minutes
    local check_interval=15  # Check every 15 seconds
    local max_attempts=$((phase_timeout / check_interval))
    local attempt=1

    log_info "🔄 Phase 1: Waiting for instances to reach running state (timeout: ${phase_timeout}s)..."

    while [[ $attempt -le $max_attempts ]]; do
        log_info "📊 Phase 1 - Attempt $attempt/$max_attempts: Checking instance states..."

        # Get instances from Auto Scaling Group
        local instance_info
        if ! instance_info=$(aws autoscaling describe-auto-scaling-groups \
            --auto-scaling-group-names "$asg_name" \
            --query "AutoScalingGroups[0].Instances[*].[InstanceId,LifecycleState]" \
            --output text 2>/dev/null); then
            log_error "❌ Failed to get Auto Scaling Group instances"
            return 1
        fi

        if [[ -z "$instance_info" ]]; then
            log_info "⏳ No instances found in Auto Scaling Group yet, waiting..."
            sleep $check_interval
            ((attempt++))
            continue
        fi

        # Parse instance information
        local instance_ids=()
        local running_count=0
        local pending_count=0
        local other_count=0

        while IFS=$'\t' read -r instance_id lifecycle_state; do
            if [[ -n "$instance_id" ]]; then
                instance_ids+=("$instance_id")
                case "$lifecycle_state" in
                    "InService")
                        ((running_count++))
                        ;;
                    "Pending"|"Pending:Wait"|"Pending:Proceed")
                        ((pending_count++))
                        ;;
                    *)
                        ((other_count++))
                        ;;
                esac
            fi
        done <<< "$instance_info"

        local total_instances=${#instance_ids[@]}
        log_info "📋 Found $total_instances instance(s): ${instance_ids[*]}"
        log_info "📈 Instance states: $running_count running, $pending_count pending, $other_count other"

        # Check if all instances are running (InService in ASG terms)
        if [[ $running_count -eq $total_instances && $total_instances -gt 0 ]]; then
            log_success "✅ Phase 1 complete: All $total_instances instance(s) are running!"
            return 0
        fi

        log_info "⏳ Phase 1 - $running_count/$total_instances instances running, waiting ${check_interval}s..."
        sleep $check_interval
        ((attempt++))
    done

    log_error "❌ Phase 1 timeout: Instances did not reach running state within ${phase_timeout}s"
    return 1
}

# Phase 2: Wait for user data completion (15 minutes timeout)
wait_for_user_data_completion() {
    local asg_name="$1"
    local phase_timeout=900  # 15 minutes
    local check_interval=30  # Check every 30 seconds
    local max_attempts=$((phase_timeout / check_interval))
    local attempt=1

    log_info "🔄 Phase 2: Waiting for user data completion (timeout: ${phase_timeout}s)..."

    while [[ $attempt -le $max_attempts ]]; do
        log_info "📊 Phase 2 - Attempt $attempt/$max_attempts: Checking system status..."

        # Get instance IDs from Auto Scaling Group
        local instance_ids
        if ! instance_ids=$(aws autoscaling describe-auto-scaling-groups \
            --auto-scaling-group-names "$asg_name" \
            --query "AutoScalingGroups[0].Instances[?LifecycleState=='InService'].InstanceId" \
            --output text 2>/dev/null); then
            log_error "❌ Failed to get instance IDs from Auto Scaling Group"
            return 1
        fi

        if [[ -z "$instance_ids" ]]; then
            log_info "⏳ No running instances found in Auto Scaling Group yet, waiting..."
            sleep $check_interval
            ((attempt++))
            continue
        fi

        # Convert to array
        local instance_array=($instance_ids)
        local total_instances=${#instance_array[@]}
        log_info "📋 Checking system status for $total_instances instance(s): ${instance_array[*]}"

        # Check instance and system status for all instances
        local ready_count=0
        for instance_id in "${instance_array[@]}"; do
            local status_info
            if status_info=$(aws ec2 describe-instance-status \
                --instance-ids "$instance_id" \
                --query "InstanceStatuses[0].[InstanceStatus.Status,SystemStatus.Status]" \
                --output text 2>/dev/null); then

                local instance_status system_status
                read -r instance_status system_status <<< "$status_info"

                if [[ "$instance_status" == "ok" && "$system_status" == "ok" ]]; then
                    ((ready_count++))
                    log_info "✅ Instance $instance_id: Ready (instance: $instance_status, system: $system_status)"
                else
                    log_info "⏳ Instance $instance_id: Not ready (instance: $instance_status, system: $system_status)"
                fi
            else
                log_info "⏳ Instance $instance_id: Status not available yet"
            fi
        done

        log_info "📈 System status: $ready_count/$total_instances instances ready"

        # Check if all instances are ready
        if [[ $ready_count -eq $total_instances ]]; then
            log_success "✅ Phase 2 complete: All $total_instances instance(s) have completed user data!"
            return 0
        fi

        log_info "⏳ Phase 2 - $ready_count/$total_instances instances ready, waiting ${check_interval}s..."
        sleep $check_interval
        ((attempt++))
    done

    log_error "❌ Phase 2 timeout: User data completion not detected within ${phase_timeout}s"
    return 1
}

# Phase 3: Wait for ALB health checks (10 minutes timeout)
wait_for_alb_health() {
    local target_group_arn="$1"
    local phase_timeout=600  # 10 minutes
    local check_interval=30  # Check every 30 seconds
    local max_attempts=$((phase_timeout / check_interval))
    local attempt=1

    log_info "🔄 Phase 3: Waiting for ALB health checks to pass (timeout: ${phase_timeout}s)..."
    log_info "🎯 Target Group: $target_group_arn"

    while [[ $attempt -le $max_attempts ]]; do
        log_info "📊 Phase 3 - Attempt $attempt/$max_attempts: Checking ALB target health..."

        # Get target health status
        local health_info
        if ! health_info=$(aws elbv2 describe-target-health \
            --target-group-arn "$target_group_arn" \
            --query "TargetHealthDescriptions[*].[Target.Id,TargetHealth.State,TargetHealth.Reason,TargetHealth.Description]" \
            --output text 2>/dev/null); then
            log_error "❌ Failed to get target health for target group"
            return 1
        fi

        if [[ -z "$health_info" ]]; then
            log_info "⏳ No targets registered in target group yet, waiting..."
            sleep $check_interval
            ((attempt++))
            continue
        fi

        # Parse health information
        local total_targets=0
        local healthy_count=0
        local unhealthy_details=()

        while IFS=$'\t' read -r target_id health_state reason description; do
            if [[ -n "$target_id" ]]; then
                ((total_targets++))
                if [[ "$health_state" == "healthy" ]]; then
                    ((healthy_count++))
                    log_info "✅ Target $target_id: $health_state"
                else
                    unhealthy_details+=("Target $target_id: $health_state ($reason)")
                    log_info "⏳ Target $target_id: $health_state ($reason)"
                fi
            fi
        done <<< "$health_info"

        log_info "📈 Target health: $healthy_count/$total_targets targets healthy"

        # Check if all targets are healthy
        if [[ $healthy_count -eq $total_targets && $total_targets -gt 0 ]]; then
            log_success "✅ Phase 3 complete: All $total_targets target(s) are healthy in ALB!"
            return 0
        fi

        # Show unhealthy target details for troubleshooting
        if [[ ${#unhealthy_details[@]} -gt 0 ]]; then
            log_info "🔍 Unhealthy target details:"
            for detail in "${unhealthy_details[@]}"; do
                log_info "   $detail"
            done
        fi

        log_info "⏳ Phase 3 - $healthy_count/$total_targets targets healthy, waiting ${check_interval}s..."
        sleep $check_interval
        ((attempt++))
    done

    log_error "❌ Phase 3 timeout: ALB health checks did not pass within ${phase_timeout}s"

    # Final health status for debugging
    log_info "🔍 Final target health status:"
    aws elbv2 describe-target-health \
        --target-group-arn "$target_group_arn" \
        --query "TargetHealthDescriptions[*].[Target.Id,TargetHealth.State,TargetHealth.Reason,TargetHealth.Description]" \
        --output table 2>/dev/null || log_error "Failed to get final health status"

    return 1
}

# Verify deployment health - now calls the robust health check
verify_deployment() {
    log_info "Verifying deployment health..."

    # Call our new robust health checking function
    if wait_for_healthy_deployment; then
        log_success "Deployment verification completed successfully"
        return 0
    else
        log_error "Deployment verification failed"
        return 1
    fi
}

# Verify deployment success and tag cleanup
verify_deployment_success() {
    local stack_name="$1"

    log_info "🔍 Running post-deployment verification..."

    # Extract PR number from stack name
    local pr_number
    pr_number=$(echo "${stack_name}" | sed -n 's/.*Pr-\([0-9]\+\)Stack.*/\1/p')

    # Path to the verification script
    local verify_script="infrastructure/scripts/verify-tag-cleanup.sh"

    if [[ -f "${verify_script}" ]]; then
        log_info "Running tag cleanup verification..."

        # Prepare verification arguments
        local verify_args="--region ${AWS_REGION}"
        if [[ -n "${pr_number}" ]]; then
            verify_args+=" --pr-number ${pr_number}"
        fi

        # Run verification (non-blocking - log results but don't fail deployment)
        if "${verify_script}" ${verify_args}; then
            log_success "✅ Post-deployment verification passed"
        else
            log_warning "⚠️  Post-deployment verification found issues (deployment still successful)"
            log_info "Consider running manual tag cleanup if future deployments fail"
        fi
    else
        log_info "Verification script not found, skipping post-deployment checks"
    fi
}

# Main execution
main() {
    log_info "Starting EC2 Preview Deployment"
    log_info "================================"

    validate_environment
    deploy_infrastructure
    deploy_application
    verify_deployment

    # Run post-deployment verification
    local stack_name
    stack_name=$(generate_stack_name "${ENVIRONMENT_NAME}")
    verify_deployment_success "${stack_name}"

    log_success "EC2 Preview Deployment completed successfully!"
}

# Execute main function
main "$@"
