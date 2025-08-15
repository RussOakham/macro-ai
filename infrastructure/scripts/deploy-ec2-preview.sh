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
    
    # Set CDK context for preview deployment
    local cdk_context=(
        "--context" "deploymentType=preview"
        "--context" "environment=${env_name}"
        "--context" "prNumber=${PR_NUMBER}"
        "--context" "branchName=${BRANCH_NAME}"
        "--context" "scale=${CDK_DEPLOY_SCALE}"
        "--context" "corsAllowedOrigins=${CORS_ALLOWED_ORIGINS}"
    )
    
    # Deploy the stack using CDK
    log_info "Deploying CDK stack: ${stack_name}"
    
    if ! cdk deploy "${stack_name}" \
        --require-approval never \
        --outputs-file "cdk-outputs.json" \
        "${cdk_context[@]}" \
        --verbose; then
        log_error "CDK deployment failed"
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
