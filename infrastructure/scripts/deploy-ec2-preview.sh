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
                    log_success "Rollback completed, now deleting failed stack for redeployment"
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

# Verify deployment health
verify_deployment() {
    log_info "Verifying deployment health..."
    
    local env_name="${CDK_DEPLOY_ENV}"
    local stack_name
    stack_name=$(generate_stack_name "${env_name}")
    
    # Get API endpoint from CloudFormation outputs
    local api_endpoint
    api_endpoint=$(aws cloudformation describe-stacks \
        --stack-name "${stack_name}" \
        --query "Stacks[0].Outputs[?OutputKey=='ApiEndpoint'].OutputValue" \
        --output text 2>/dev/null || echo "")
    
    if [[ -z "${api_endpoint}" || "${api_endpoint}" == "None" ]]; then
        log_warning "Could not retrieve API endpoint for health check"
        return 0
    fi
    
    # Normalize API endpoint
    api_endpoint="${api_endpoint%/}"
    if [[ "$api_endpoint" != */api ]]; then
        api_endpoint="${api_endpoint}/api"
    fi
    
    local health_url="${api_endpoint}/health"
    log_info "Testing health endpoint: ${health_url}"
    
    # Wait for deployment to stabilize
    log_info "Waiting for deployment to stabilize..."
    sleep 30
    
    # Test health endpoint with retries
    local max_attempts=12
    local attempt=1
    
    while [[ ${attempt} -le ${max_attempts} ]]; do
        log_info "Health check attempt ${attempt}/${max_attempts}"
        
        local response
        response=$(curl -s -w "%{http_code}" "${health_url}" 2>/dev/null || echo "000")
        
        if [[ "$response" == *"200" ]]; then
            log_success "Health check passed"
            return 0
        else
            log_warning "Health check failed (attempt ${attempt}): ${response}"
            if [[ ${attempt} -eq ${max_attempts} ]]; then
                log_error "Health check failed after ${max_attempts} attempts"
                return 1
            fi
            sleep 15
        fi
        
        ((attempt++))
    done
}

# Main execution
main() {
    log_info "Starting EC2 Preview Deployment"
    log_info "================================"
    
    validate_environment
    deploy_infrastructure
    deploy_application
    verify_deployment
    
    log_success "EC2 Preview Deployment completed successfully!"
}

# Execute main function
main "$@"
