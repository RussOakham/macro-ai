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
        "DEPLOYMENT_BUCKET"
        "DEPLOYMENT_KEY"
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

    # Validate Parameter Store configuration
    validate_parameter_store
}

# Validate Parameter Store parameters exist before deployment
validate_parameter_store() {
    log_info "Validating Parameter Store configuration..."

    # For preview environments, use development parameter prefix
    local param_prefix="/macro-ai/development/"
    log_info "Using Parameter Store prefix: $param_prefix"

    # Test AWS credentials and Parameter Store access
    log_info "Testing AWS credentials and Parameter Store access..."
    if ! aws sts get-caller-identity > /dev/null 2>&1; then
        log_error "AWS credentials not available or invalid"
        exit 1
    fi

    # Define required parameters for the application
    local required_params=(
        "API_KEY"
        "AWS_COGNITO_REGION"
        "AWS_COGNITO_USER_POOL_ID"
        "AWS_COGNITO_USER_POOL_CLIENT_ID"
        "AWS_COGNITO_USER_POOL_SECRET_KEY"
        "AWS_COGNITO_ACCESS_KEY"
        "AWS_COGNITO_SECRET_KEY"
        "COOKIE_ENCRYPTION_KEY"
        "OPENAI_API_KEY"
        "RELATIONAL_DATABASE_URL"
        "NON_RELATIONAL_DATABASE_URL"
    )

    local missing_params=()
    local found_params=()

    log_info "Checking required Parameter Store parameters..."
    for param in "${required_params[@]}"; do
        local param_path="${param_prefix}${param}"

        if aws ssm get-parameter --name "$param_path" --query "Parameter.Value" --output text > /dev/null 2>&1; then
            log_info "✅ Parameter found: $param"
            found_params+=("$param")
        else
            log_warning "❌ Parameter missing: $param_path"
            missing_params+=("$param")
        fi
    done

    # Report results
    log_info "Parameter Store validation results:"
    log_info "  Found: ${#found_params[@]} parameters"
    log_info "  Missing: ${#missing_params[@]} parameters"

    if [[ ${#missing_params[@]} -gt 0 ]]; then
        log_error "Missing required Parameter Store parameters:"
        for param in "${missing_params[@]}"; do
            log_error "  - ${param_prefix}${param}"
        done
        log_error ""
        log_error "Please ensure all required parameters exist in Parameter Store before deployment."
        log_error "You can create missing parameters using the AWS CLI:"
        log_error ""
        for param in "${missing_params[@]}"; do
            log_error "  aws ssm put-parameter --name '${param_prefix}${param}' --value 'YOUR_VALUE' --type 'SecureString'"
        done
        exit 1
    fi

    log_success "All required Parameter Store parameters found"
    log_success "Parameter Store validation completed"
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

# Simple stack state check - let CDK handle most CloudFormation operations
check_stack_state() {
    local stack_name="$1"
    local stack_status="$2"

    case "${stack_status}" in
        "ROLLBACK_COMPLETE"|"CREATE_FAILED"|"UPDATE_ROLLBACK_COMPLETE")
            log_warning "Stack is in failed state: ${stack_status}"
            log_info "CDK will handle stack cleanup and recreation automatically"
            ;;
        "CREATE_IN_PROGRESS"|"UPDATE_IN_PROGRESS"|"ROLLBACK_IN_PROGRESS"|"DELETE_IN_PROGRESS")
            log_warning "Stack is in transitional state: ${stack_status}"
            log_error "Please wait for current operation to complete before deploying"
            exit 1
            ;;
        "CREATE_COMPLETE"|"UPDATE_COMPLETE")
            log_info "Stack exists and is healthy, will update existing stack"
            ;;
        "DOES_NOT_EXIST")
            log_info "Stack does not exist, will create new stack"
            ;;
        *)
            log_warning "Stack is in state: ${stack_status}"
            log_info "Proceeding with deployment attempt..."
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

    # Check stack state before deployment
    local stack_status
    stack_status=$(check_stack_status "${stack_name}")
    check_stack_state "${stack_name}" "${stack_status}"

    # Set CDK context for preview deployment
    local cdk_context=(
        "--context" "deploymentType=preview"
        "--context" "environment=${env_name}"
        "--context" "prNumber=${PR_NUMBER}"
        "--context" "branchName=${BRANCH_NAME}"
        "--context" "scale=${CDK_DEPLOY_SCALE}"
        "--context" "corsAllowedOrigins=${CORS_ALLOWED_ORIGINS}"
        "--context" "reuseExistingResources=true"
        "--context" "deploymentBucket=${DEPLOYMENT_BUCKET}"
        "--context" "deploymentKey=${DEPLOYMENT_KEY}"
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
        log_error "Check AWS Console for detailed error information"
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
    
    # Note: Instance health checking is now handled by simple ALB health validation
    # in verify_deployment() -> wait_for_healthy_deployment()
    log_info "Auto Scaling Group configured: ${asg_name}"
    log_info "Instance health validation will be performed in the verification phase"
    
    # Deploy application using Systems Manager (if available) or user data will handle it
    log_info "Application deployment will be handled by EC2 user data script"
    log_info "The Express API deployment package has been made available to the instances"
    
    log_success "Application deployment initiated"
}

# Wait for deployment to be healthy using simple ALB health checks
wait_for_healthy_deployment() {
    log_info "🚀 Starting deployment health check..."

    # Extract deployment configuration from CloudFormation stack
    local env_name="${CDK_DEPLOY_ENV}"
    local stack_name
    stack_name=$(generate_stack_name "${env_name}")
    log_info "📋 Checking stack: $stack_name"

    # Get target group ARN from stack outputs
    local target_group_arn
    target_group_arn=$(aws cloudformation describe-stacks \
        --stack-name "$stack_name" \
        --query "Stacks[0].Outputs[?OutputKey=='DefaultTargetGroupArn'].OutputValue" \
        --output text 2>/dev/null)

    if [[ -z "$target_group_arn" || "$target_group_arn" == "None" ]]; then
        log_error "❌ Could not find DefaultTargetGroupArn in stack outputs"
        return 1
    fi

    log_info "✅ Found target group: $target_group_arn"

    # Wait for ALB health checks to pass (10 minutes timeout)
    local timeout=600  # 10 minutes
    local check_interval=30  # Check every 30 seconds
    local max_attempts=$((timeout / check_interval))
    local attempt=1

    log_info "🔄 Waiting for ALB health checks to pass (timeout: ${timeout}s)..."

    while [[ $attempt -le $max_attempts ]]; do
        log_info "📊 Health check attempt $attempt/$max_attempts..."

        # Get target health status
        local health_status
        health_status=$(aws elbv2 describe-target-health \
            --target-group-arn "$target_group_arn" \
            --query "TargetHealthDescriptions[*].TargetHealth.State" \
            --output text 2>/dev/null)

        if [[ -n "$health_status" ]]; then
            local healthy_count=0
            local total_targets=0

            # Count healthy and total targets
            for state in $health_status; do
                ((total_targets++))
                if [[ "$state" == "healthy" ]]; then
                    ((healthy_count++))
                fi
            done

            log_info "📊 Target health: $healthy_count/$total_targets healthy"

            # Check if all targets are healthy
            if [[ $healthy_count -eq $total_targets && $total_targets -gt 0 ]]; then
                log_success "✅ All $total_targets target(s) are healthy in ALB!"
                return 0
            fi
        else
            log_info "📊 No targets found yet, waiting for instances to register..."
        fi

        log_info "⏳ Waiting ${check_interval}s before next check..."
        sleep $check_interval
        ((attempt++))
    done

    log_error "❌ ALB health checks did not pass within ${timeout}s"
    return 1
}


# Verify deployment health using simple ALB health checks
verify_deployment() {
    log_info "Verifying deployment health..."

    # Call our simplified health checking function
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
    stack_name=$(generate_stack_name "${CDK_DEPLOY_ENV}")
    verify_deployment_success "${stack_name}"

    log_success "EC2 Preview Deployment completed successfully!"
}

# Execute main function
main "$@"
