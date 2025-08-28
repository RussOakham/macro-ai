#!/bin/bash

# GitHub Actions EC2 Deployment Script
# This script is designed to be used in GitHub Actions workflows
# for deploying applications to EC2 instances
# 
# Note: The application now automatically determines the parameter store prefix from APP_ENV:
# - pr-* environments → /macro-ai/development/
# - development → /macro-ai/development/
# - staging → /macro-ai/staging/
# - production → /macro-ai/production/

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1" >&2
}

# Error handling
error_exit() {
    log_error "$1"
    exit 1
}

# Configuration from environment variables
PR_NUMBER="${PR_NUMBER:-}"
ARTIFACT_URL="${ARTIFACT_URL:-}"
VERSION="${VERSION:-}"
BRANCH_NAME="${BRANCH_NAME:-}"
ENVIRONMENT="${ENVIRONMENT:-development}"
APP_ENV="${APP_ENV:-development}"
AWS_REGION="${AWS_REGION:-us-east-1}"

# Infrastructure configuration
VPC_ID="${VPC_ID:-}"
SUBNET_IDS="${SUBNET_IDS:-}"
SECURITY_GROUP_ID="${SECURITY_GROUP_ID:-}"
LAUNCH_TEMPLATE_ID="${LAUNCH_TEMPLATE_ID:-}"
TARGET_GROUP_ARN="${TARGET_GROUP_ARN:-}"
ARTIFACT_BUCKET="${ARTIFACT_BUCKET:-}"

# Deployment options
INSTANCE_COUNT="${INSTANCE_COUNT:-1}"
TIMEOUT_MINUTES="${TIMEOUT_MINUTES:-25}"
HEALTH_CHECK_RETRIES="${HEALTH_CHECK_RETRIES:-10}"

# Validate required environment variables
validate_environment() {
    log_info "Validating environment configuration..."

    local required_vars=(
        "PR_NUMBER"
        "ARTIFACT_URL"
        "VERSION"
        "AWS_REGION"
        "VPC_ID"
        "SUBNET_IDS"
        "SECURITY_GROUP_ID"
        "LAUNCH_TEMPLATE_ID"
        "TARGET_GROUP_ARN"
        "ARTIFACT_BUCKET"
    )

    local missing_vars=()
    for var in "${required_vars[@]}"; do
        if [[ -z "${!var}" ]]; then
            missing_vars+=("$var")
        fi
    done

    if [[ ${#missing_vars[@]} -gt 0 ]]; then
        log_error "Missing required environment variables:"
        printf '%s\n' "${missing_vars[@]}"
        error_exit "Please set all required environment variables"
    fi

    log_success "Environment validation completed"

    # Validate Parameter Store configuration
    validate_parameter_store
}

# Validate Parameter Store parameters exist before deployment
validate_parameter_store() {
    log_info "Validating Parameter Store configuration..."

    # Determine the correct parameter prefix based on APP_ENV
    local param_prefix
    if [[ "$APP_ENV" == pr-* ]]; then
        # Preview environments (pr-123) use development parameters
        param_prefix="/macro-ai/development"
    elif [[ "$APP_ENV" == "development" ]]; then
        param_prefix="/macro-ai/development"
    elif [[ "$APP_ENV" == "staging" ]]; then
        param_prefix="/macro-ai/staging"
    elif [[ "$APP_ENV" == "production" ]]; then
        param_prefix="/macro-ai/production"
    else
        # Default to development for unknown environments
        param_prefix="/macro-ai/development"
    fi

    log_info "App Environment: $APP_ENV"
    log_info "Using Parameter Store prefix: $param_prefix"

    # Test AWS credentials and Parameter Store access
    log_info "Testing AWS credentials and Parameter Store access..."
    if ! aws sts get-caller-identity > /dev/null 2>&1; then
        error_exit "AWS credentials not available or invalid"
    fi

    # Define required parameters for the application
    local required_params=(
        "API_KEY"
        "AWS_COGNITO_REGION"
        "AWS_COGNITO_USER_POOL_ID"
        "AWS_COGNITO_USER_POOL_CLIENT_ID"
        "AWS_COGNITO_USER_POOL_SECRET_KEY"
        # AWS Cognito credentials removed - using IAM roles instead
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
        log_info "Checking parameter: $param_path"

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
        error_exit "Parameter Store validation failed"
    fi

    log_success "All required Parameter Store parameters found"
    log_success "Parameter Store validation completed"
}

# Setup AWS CLI and dependencies
setup_dependencies() {
    log_info "Setting up dependencies..."

    # Install AWS CLI if not present
    if ! command -v aws &> /dev/null; then
        log_info "Installing AWS CLI..."
        curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
        unzip awscliv2.zip
        sudo ./aws/install
        rm -rf aws awscliv2.zip
    fi

    # Verify AWS credentials
    if ! aws sts get-caller-identity &> /dev/null; then
        error_exit "AWS credentials not configured or invalid"
    fi

    # Install Node.js and pnpm if needed for the deployment script
    if ! command -v node &> /dev/null; then
        log_info "Installing Node.js..."
        curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
        sudo dnf install -y nodejs
    fi

    if ! command -v pnpm &> /dev/null; then
        log_info "Installing pnpm..."
        npm install -g pnpm
    fi

    log_success "Dependencies setup completed"
}

# Build and upload application artifact
build_and_upload_artifact() {
    log_info "Building and uploading application artifact..."

    local build_dir="build-$(date +%s)"
    local artifact_name="macro-ai-express-api-${VERSION}.tar.gz"
    local artifact_key="artifacts/${PR_NUMBER}/${artifact_name}"

    # Create build directory
    mkdir -p "$build_dir"
    cd "$build_dir"

    # Clone or copy the application code
    # In a real GitHub Actions workflow, the code would already be checked out
    if [[ -n "${GITHUB_WORKSPACE:-}" ]]; then
        cp -r "${GITHUB_WORKSPACE}/apps/express-api" ./
    else
        log_warning "GITHUB_WORKSPACE not set, assuming local development"
        cp -r "../apps/express-api" ./
    fi

    cd express-api

    # Install dependencies and build
    log_info "Installing dependencies..."
    pnpm install --frozen-lockfile

    log_info "Building application..."
    pnpm build

    # Create deployment package
    log_info "Creating deployment package..."
    tar -czf "../${artifact_name}" \
        --exclude=node_modules \
        --exclude=.git \
        --exclude=.env* \
        --exclude=*.log \
        .

    # Upload to S3
    log_info "Uploading artifact to S3..."
    aws s3 cp "../${artifact_name}" "s3://${ARTIFACT_BUCKET}/${artifact_key}"

    # Set output for GitHub Actions
    if [[ -n "${GITHUB_OUTPUT:-}" ]]; then
        echo "artifact-url=s3://${ARTIFACT_BUCKET}/${artifact_key}" >> "$GITHUB_OUTPUT"
        echo "artifact-key=${artifact_key}" >> "$GITHUB_OUTPUT"
    fi

    # Update ARTIFACT_URL for deployment
    export ARTIFACT_URL="s3://${ARTIFACT_BUCKET}/${artifact_key}"

    cd ../..
    rm -rf "$build_dir"

    log_success "Artifact build and upload completed"
}

# Deploy to EC2 using the TypeScript utility
deploy_to_ec2() {
    log_info "Deploying to EC2 instances..."

    # Set environment variables for the deployment script
    export AWS_REGION
    export VPC_ID
    export SUBNET_IDS
    export SECURITY_GROUP_ID
    export LAUNCH_TEMPLATE_ID
    export TARGET_GROUP_ARN
    export ARTIFACT_BUCKET
    export ENVIRONMENT

    # Navigate to infrastructure directory
    local script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    local infra_dir="$(dirname "$script_dir")"
    cd "$infra_dir"

    # Install dependencies if needed
    if [[ ! -d "node_modules" ]]; then
        log_info "Installing infrastructure dependencies..."
        pnpm install
    fi

    # Run the deployment
    log_info "Executing EC2 deployment..."
    pnpm tsx scripts/deploy-ec2.ts deploy \
        --pr "$PR_NUMBER" \
        --artifact "$ARTIFACT_URL" \
        --version "$VERSION" \
        --branch "$BRANCH_NAME" \
        --instances "$INSTANCE_COUNT"

    log_success "EC2 deployment completed"

    # Allow time for AWS resources to become available after CDK deployment
    log_info "⏳ Allowing 30 seconds for AWS resources to become available..."
    sleep 30
}

# Wait for deployment to be healthy using direct AWS API queries
wait_for_healthy_deployment() {
    log_info "🚀 Starting robust deployment health check with progressive timeout stages..."

    # Extract deployment configuration from CloudFormation stack
    local stack_name="MacroAiPr-${PR_NUMBER}Stack"
    log_info "📋 Extracting deployment configuration from stack: $stack_name"

    # Get stack outputs
    local stack_outputs
    if ! stack_outputs=$(aws cloudformation describe-stacks --stack-name "$stack_name" --query "Stacks[0].Outputs" --output json 2>/dev/null); then
        log_error "❌ Failed to get CloudFormation stack outputs for $stack_name"
        return 1
    fi

    # Extract Auto Scaling Group name and environment
    local asg_name environment_name
    asg_name=$(echo "$stack_outputs" | jq -r '.[] | select(.OutputKey=="AutoScalingGroupName") | .OutputValue')
    environment_name=$(echo "$stack_outputs" | jq -r '.[] | select(.OutputKey=="EnvironmentName") | .OutputValue')

    if [[ -z "$asg_name" || "$asg_name" == "null" ]]; then
        log_error "❌ Failed to extract Auto Scaling Group name from stack outputs"
        return 1
    fi

    log_info "✅ Found Auto Scaling Group: $asg_name"
    log_info "✅ Environment: $environment_name"

    # Get target group ARN using naming pattern
    local target_group_arn
    if ! target_group_arn=$(aws elbv2 describe-target-groups \
        --query "TargetGroups[?contains(TargetGroupName, 'pr-${PR_NUMBER}')].TargetGroupArn" \
        --output text 2>/dev/null | head -1); then
        log_error "❌ Failed to get target group ARN for PR $PR_NUMBER"
        return 1
    fi

    if [[ -z "$target_group_arn" || "$target_group_arn" == "None" ]]; then
        log_error "❌ No target group found for PR $PR_NUMBER"
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

# Phase 1: Wait for instances to be running (5 minutes timeout)
wait_for_instances_running() {
    local asg_name="$1"
    local phase_timeout=300  # 5 minutes
    local check_interval=15  # Check every 15 seconds
    local max_attempts=$((phase_timeout / check_interval))
    local attempt=1

    log_info "🔄 Phase 1: Waiting for instances to reach running state (timeout: ${phase_timeout}s)..."

    while [[ $attempt -le $max_attempts ]]; do
        log_info "📊 Phase 1 - Attempt $attempt/$max_attempts: Checking instance states..."

        # Get instance IDs from Auto Scaling Group
        local instance_ids
        if ! instance_ids=$(aws autoscaling describe-auto-scaling-groups \
            --auto-scaling-group-names "$asg_name" \
            --query "AutoScalingGroups[0].Instances[*].InstanceId" \
            --output text 2>/dev/null); then
            log_error "❌ Failed to get instances from ASG: $asg_name"
            return 1
        fi

        if [[ -z "$instance_ids" || "$instance_ids" == "None" ]]; then
            log_info "⏳ No instances found in ASG yet, waiting..."
            sleep $check_interval
            ((attempt++))
            continue
        fi

        # Convert space-separated string to array
        local instance_array=($instance_ids)
        local total_instances=${#instance_array[@]}
        log_info "📋 Found $total_instances instance(s): ${instance_ids}"

        # Check instance states
        local running_count=0
        local pending_count=0
        local other_count=0

        for instance_id in "${instance_array[@]}"; do
            local state
            if state=$(aws ec2 describe-instances \
                --instance-ids "$instance_id" \
                --query "Reservations[0].Instances[0].State.Name" \
                --output text 2>/dev/null); then

                case "$state" in
                    "running")
                        ((running_count++))
                        ;;
                    "pending")
                        ((pending_count++))
                        ;;
                    *)
                        ((other_count++))
                        log_info "⚠️  Instance $instance_id in unexpected state: $state"
                        ;;
                esac
            else
                log_info "⚠️  Failed to get state for instance: $instance_id"
                ((other_count++))
            fi
        done

        log_info "📈 Instance states: $running_count running, $pending_count pending, $other_count other"

        # Check if all instances are running
        if [[ $running_count -eq $total_instances ]]; then
            log_success "✅ Phase 1 complete: All $total_instances instance(s) are running!"
            return 0
        fi

        # Check for failed instances
        if [[ $other_count -gt 0 ]]; then
            log_info "⚠️  Some instances in unexpected states, continuing to monitor..."
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

    log_info "🔄 Phase 2: Waiting for user data scripts to complete (timeout: ${phase_timeout}s)..."

    while [[ $attempt -le $max_attempts ]]; do
        log_info "📊 Phase 2 - Attempt $attempt/$max_attempts: Checking system status..."

        # Get instance IDs from Auto Scaling Group
        local instance_ids
        if ! instance_ids=$(aws autoscaling describe-auto-scaling-groups \
            --auto-scaling-group-names "$asg_name" \
            --query "AutoScalingGroups[0].Instances[*].InstanceId" \
            --output text 2>/dev/null); then
            log_error "❌ Failed to get instances from ASG: $asg_name"
            return 1
        fi

        if [[ -z "$instance_ids" || "$instance_ids" == "None" ]]; then
            log_error "❌ No instances found in ASG: $asg_name"
            return 1
        fi

        # Convert space-separated string to array
        local instance_array=($instance_ids)
        local total_instances=${#instance_array[@]}

        # Check instance status (system status indicates user data completion)
        local ok_count=0
        local initializing_count=0
        local other_count=0

        for instance_id in "${instance_array[@]}"; do
            # Get both instance status and system status
            local status_info
            if status_info=$(aws ec2 describe-instance-status \
                --instance-ids "$instance_id" \
                --query "InstanceStatuses[0].[InstanceStatus.Status,SystemStatus.Status]" \
                --output text 2>/dev/null); then

                local instance_status=$(echo "$status_info" | cut -f1)
                local system_status=$(echo "$status_info" | cut -f2)

                # Both instance and system status should be "ok" for user data completion
                if [[ "$instance_status" == "ok" && "$system_status" == "ok" ]]; then
                    ((ok_count++))
                elif [[ "$instance_status" == "initializing" || "$system_status" == "initializing" ]]; then
                    ((initializing_count++))
                else
                    ((other_count++))
                    log_info "⚠️  Instance $instance_id status: instance=$instance_status, system=$system_status"
                fi
            else
                # Instance might not have status yet if very recently launched
                log_info "⏳ Instance $instance_id status not available yet (recently launched)"
                ((initializing_count++))
            fi
        done

        log_info "📈 System status: $ok_count ready, $initializing_count initializing, $other_count other"

        # Check if all instances have completed user data
        if [[ $ok_count -eq $total_instances ]]; then
            log_success "✅ Phase 2 complete: All $total_instances instance(s) have completed user data scripts!"
            return 0
        fi

        # Provide detailed progress
        if [[ $initializing_count -gt 0 ]]; then
            log_info "⏳ Phase 2 - $initializing_count instance(s) still running user data scripts..."
        fi

        log_info "⏳ Phase 2 - $ok_count/$total_instances instances ready, waiting ${check_interval}s..."
        sleep $check_interval
        ((attempt++))
    done

    log_error "❌ Phase 2 timeout: User data scripts did not complete within ${phase_timeout}s"
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
        local healthy_count=0
        local unhealthy_count=0
        local other_count=0
        local total_targets=0

        while IFS=$'\t' read -r target_id health_state reason description; do
            ((total_targets++))

            case "$health_state" in
                "healthy")
                    ((healthy_count++))
                    log_info "✅ Target $target_id: healthy"
                    ;;
                "unhealthy")
                    ((unhealthy_count++))
                    log_info "❌ Target $target_id: unhealthy - $reason ($description)"
                    ;;
                "initial"|"draining"|"unavailable")
                    ((other_count++))
                    log_info "⏳ Target $target_id: $health_state - $reason"
                    ;;
                *)
                    ((other_count++))
                    log_info "⚠️  Target $target_id: unknown state '$health_state' - $reason"
                    ;;
            esac
        done <<< "$health_info"

        log_info "📈 Target health: $healthy_count healthy, $unhealthy_count unhealthy, $other_count other (total: $total_targets)"

        # Check if all targets are healthy
        if [[ $total_targets -gt 0 && $healthy_count -eq $total_targets ]]; then
            log_success "✅ Phase 3 complete: All $total_targets target(s) are healthy in ALB!"
            return 0
        fi

        # Provide guidance on common issues
        if [[ $unhealthy_count -gt 0 ]]; then
            log_info "💡 Unhealthy targets detected. Common causes:"
            log_info "   - Application not yet listening on port 3040"
            log_info "   - Health check endpoint /api/health not responding"
            log_info "   - Security group blocking ALB health checks"
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

# Set GitHub Actions outputs
set_github_outputs() {
    if [[ -n "${GITHUB_OUTPUT:-}" ]]; then
        log_info "Setting GitHub Actions outputs..."

        # Get deployment status
        local status_output
        status_output=$(pnpm tsx scripts/deploy-ec2.ts status --pr "$PR_NUMBER" 2>&1 || true)

        # Extract information and set outputs
        echo "pr-number=${PR_NUMBER}" >> "$GITHUB_OUTPUT"
        echo "version=${VERSION}" >> "$GITHUB_OUTPUT"
        echo "environment=${ENVIRONMENT}" >> "$GITHUB_OUTPUT"
        echo "deployment-status=success" >> "$GITHUB_OUTPUT"

        # Try to extract health check URL (this would need to be implemented in the status command)
        # For now, we'll construct it based on the ALB
        if [[ -n "${ALB_DNS_NAME:-}" ]]; then
            echo "health-check-url=http://${ALB_DNS_NAME}/api/health" >> "$GITHUB_OUTPUT"
        fi

        log_success "GitHub Actions outputs set"
    fi
}

# Cleanup on failure
cleanup_on_failure() {
    log_warning "Deployment failed, cleaning up..."

    # Only cleanup if we have the necessary information
    if [[ -n "$PR_NUMBER" ]]; then
        pnpm tsx scripts/deploy-ec2.ts cleanup --pr "$PR_NUMBER" --force || true
    fi

    log_info "Cleanup completed"
}

# Main deployment function
main() {
    log_info "Starting GitHub Actions EC2 deployment"
    log_info "PR: $PR_NUMBER, Version: $VERSION, Environment: $ENVIRONMENT"

    # Trap errors for cleanup
    trap cleanup_on_failure ERR

    # Execute deployment steps
    validate_environment
    setup_dependencies
    build_and_upload_artifact
    deploy_to_ec2
    wait_for_healthy_deployment
    set_github_outputs

    log_success "GitHub Actions EC2 deployment completed successfully!"
}

# Show help
show_help() {
    cat << EOF
GitHub Actions EC2 Deployment Script

This script deploys applications to EC2 instances in the Macro AI infrastructure.
It's designed to be used in GitHub Actions workflows.

Required Environment Variables:
  PR_NUMBER              - Pull request number
  ARTIFACT_URL           - S3 URL for application artifact (or will be built)
  VERSION                - Deployment version
  AWS_REGION             - AWS region
  VPC_ID                 - VPC ID for deployment
  SUBNET_IDS             - Comma-separated subnet IDs
  SECURITY_GROUP_ID      - Security group ID
  LAUNCH_TEMPLATE_ID     - EC2 launch template ID
  TARGET_GROUP_ARN       - ALB target group ARN
  ARTIFACT_BUCKET        - S3 bucket for artifacts

Optional Environment Variables:
  BRANCH_NAME            - Git branch name
  ENVIRONMENT            - Environment name (default: development)
  INSTANCE_COUNT         - Number of instances (default: 1)
  TIMEOUT_MINUTES        - Deployment timeout (default: 15)

Usage:
  ./github-actions-deploy.sh [command]

Commands:
  deploy    - Deploy application (default)
  status    - Check deployment status
  cleanup   - Clean up deployment
  help      - Show this help

Examples:
  # Deploy in GitHub Actions
  ./github-actions-deploy.sh deploy

  # Check status
  ./github-actions-deploy.sh status

  # Cleanup
  ./github-actions-deploy.sh cleanup
EOF
}

# Command handling
case "${1:-deploy}" in
    deploy)
        main
        ;;
    status)
        validate_environment
        pnpm tsx scripts/deploy-ec2.ts status --pr "$PR_NUMBER"
        ;;
    cleanup)
        validate_environment
        pnpm tsx scripts/deploy-ec2.ts cleanup --pr "$PR_NUMBER" --force
        ;;
    help|--help|-h)
        show_help
        ;;
    *)
        log_error "Unknown command: $1"
        show_help
        exit 1
        ;;
esac
