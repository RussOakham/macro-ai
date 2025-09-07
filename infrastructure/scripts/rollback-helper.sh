#!/bin/bash

# ============================================================================
# Rollback Helper Script for Macro AI Infrastructure
# ============================================================================
#
# This script provides manual rollback capabilities for emergency situations
# or when automated rollback workflows fail.
#
# Usage:
#   ./rollback-helper.sh <environment> <rollback-type> [options]
#
# Environments: production, staging, feature
# Rollback Types: service, database, full, emergency
#
# Options:
#   --target-version VERSION    Specific version to rollback to
#   --force                     Force rollback without confirmations
#   --dry-run                   Show what would be done without executing
#   --help                      Show this help message
#
# Examples:
#   ./rollback-helper.sh production service --target-version v1.2.3
#   ./rollback-helper.sh staging full --force
#   ./rollback-helper.sh feature emergency --dry-run
#
# ============================================================================

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
AWS_REGION="us-east-1"

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1" >&2
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1" >&2
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1" >&2
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1" >&2
}

# Show usage information
show_usage() {
    cat << EOF
Macro AI Rollback Helper Script

USAGE:
    $0 <environment> <rollback-type> [options]

ENVIRONMENTS:
    production    Production environment
    staging       Staging environment
    feature       Feature environment

ROLLBACK TYPES:
    service       Rollback ECS service to previous version
    database      Rollback database migrations
    full          Full rollback (service + database)
    emergency     Emergency rollback with minimal checks

OPTIONS:
    --target-version VERSION    Specific version to rollback to
    --force                     Force rollback without confirmations
    --dry-run                   Show what would be done without executing
    --help                      Show this help message

EXAMPLES:
    $0 production service --target-version v1.2.3
    $0 staging full --force
    $0 feature emergency --dry-run

EOF
}

# Validate environment parameter
validate_environment() {
    local env="$1"
    case "$env" in
        production|staging|feature)
            return 0
            ;;
        *)
            log_error "Invalid environment: $env"
            log_error "Must be one of: production, staging, feature"
            exit 1
            ;;
    esac
}

# Validate rollback type
validate_rollback_type() {
    local type="$1"
    case "$type" in
        service|database|full|emergency)
            return 0
            ;;
        *)
            log_error "Invalid rollback type: $type"
            log_error "Must be one of: service, database, full, emergency"
            exit 1
            ;;
    esac
}

# Get AWS resource names for environment
get_aws_resources() {
    local env="$1"

    case "$env" in
        production)
            echo "MacroAiProductionStack" "macro-ai-production-service" "macro-ai-production-cluster" "macro-ai-express-api"
            ;;
        staging)
            echo "MacroAiStagingStack" "macro-ai-staging-service" "macro-ai-staging-cluster" "macro-ai-staging-express-api"
            ;;
        feature)
            echo "MacroAiFeatureStack" "macro-ai-feature-service" "macro-ai-feature-cluster" "macro-ai-feature-express-api"
            ;;
    esac
}

# Get previous stable version from ECR
get_previous_version() {
    local repo_name="$1"
    local current_version="$2"

    log_info "Finding previous stable version for repository: $repo_name"

    # Get all image tags sorted by push date
    local images
    images=$(aws ecr describe-images \
        --repository-name "$repo_name" \
        --query 'sort_by(imageDetails,&imagePushedAt)[].imageTags[0]' \
        --output text 2>/dev/null || echo "")

    if [[ -z "$images" ]]; then
        log_warn "No images found in repository $repo_name"
        echo "latest"
        return
    fi

    # Find the version before current
    local found_current=false
    local previous_version=""

    for image in $images; do
        if [[ "$image" == "$current_version" ]]; then
            found_current=true
            continue
        fi

        if [[ "$found_current" == true ]]; then
            previous_version="$image"
            break
        fi
    done

    if [[ -z "$previous_version" ]]; then
        log_warn "No previous version found, using latest"
        echo "latest"
    else
        echo "$previous_version"
    fi
}

# Perform safety checks
perform_safety_checks() {
    local env="$1"
    local rollback_type="$2"
    local target_version="$3"
    local force="$4"

    log_info "Performing safety checks..."

    local issues_found=false

    # Check 1: Verify AWS credentials
    if ! aws sts get-caller-identity &>/dev/null; then
        log_error "AWS credentials are not configured or invalid"
        issues_found=true
    else
        log_success "AWS credentials verified"
    fi

    # Check 2: Verify target version exists (unless emergency)
    if [[ "$rollback_type" != "emergency" ]]; then
        read -r stack_name service_name cluster_name repo_name <<< "$(get_aws_resources "$env")"

        local image_exists
        image_exists=$(aws ecr describe-images \
            --repository-name "$repo_name" \
            --image-ids imageTag="$target_version" \
            --query 'length(imageDetails)' \
            --output text 2>/dev/null || echo "0")

        if [[ "$image_exists" == "0" ]]; then
            log_error "Target version '$target_version' not found in ECR repository '$repo_name'"
            issues_found=true
        else
            log_success "Target version '$target_version' verified in ECR"
        fi
    fi

    # Check 3: Verify ECS service exists
    if [[ "$rollback_type" == "service" || "$rollback_type" == "full" ]]; then
        read -r stack_name service_name cluster_name repo_name <<< "$(get_aws_resources "$env")"

        local service_exists
        service_exists=$(aws ecs describe-services \
            --cluster "$cluster_name" \
            --services "$service_name" \
            --query 'length(services)' \
            --output text 2>/dev/null || echo "0")

        if [[ "$service_exists" == "0" ]]; then
            log_error "ECS service '$service_name' not found in cluster '$cluster_name'"
            issues_found=true
        else
            log_success "ECS service '$service_name' verified"
        fi
    fi

    # Return result
    if [[ "$issues_found" == true ]]; then
        if [[ "$force" == true ]]; then
            log_warn "Safety issues found but proceeding due to --force flag"
            return 0
        else
            log_error "Safety checks failed. Use --force to bypass or fix the issues."
            return 1
        fi
    else
        log_success "All safety checks passed"
        return 0
    fi
}

# Execute service rollback
rollback_service() {
    local env="$1"
    local target_version="$2"
    local dry_run="$3"

    read -r stack_name service_name cluster_name repo_name <<< "$(get_aws_resources "$env")"

    log_info "Executing service rollback for $env environment"
    log_info "Target version: $target_version"
    log_info "Service: $service_name"
    log_info "Cluster: $cluster_name"

    if [[ "$dry_run" == true ]]; then
        echo "DRY RUN: Would rollback service $service_name to version $target_version"
        return 0
    fi

    # Get current task definition
    log_info "Getting current task definition..."
    local current_task_def
    current_task_def=$(aws ecs describe-services \
        --cluster "$cluster_name" \
        --services "$service_name" \
        --query 'services[0].taskDefinition' \
        --output text)

    log_info "Current task definition: $current_task_def"

    # Create new task definition with rollback image
    log_info "Creating new task definition with rollback image..."
    local account_id
    account_id=$(aws sts get-caller-identity --query 'Account' --output text)

    local image_uri="$account_id.dkr.ecr.$AWS_REGION.amazonaws.com/$repo_name:$target_version"

    local new_task_def
    new_task_def=$(aws ecs describe-task-definition \
        --task-definition "$current_task_def" \
        --query 'taskDefinition' \
        | jq --arg IMAGE_URI "$image_uri" \
            '.containerDefinitions[0].image = $IMAGE_URI' \
        | aws ecs register-task-definition \
          --cli-input-json file:///dev/stdin \
          --query 'taskDefinition.taskDefinitionArn' \
          --output text)

    log_success "New task definition created: $new_task_def"

    # Update service to use new task definition
    log_info "Updating ECS service with new task definition..."
    aws ecs update-service \
        --cluster "$cluster_name" \
        --service "$service_name" \
        --task-definition "$new_task_def" \
        --force-new-deployment

    log_success "Service update initiated"

    # Wait for deployment to complete
    log_info "Waiting for deployment to stabilize..."
    aws ecs wait services-stable \
        --cluster "$cluster_name" \
        --services "$service_name"

    log_success "Service rollback completed successfully"
}

# Execute database rollback
rollback_database() {
    local env="$1"
    local dry_run="$2"

    log_info "Executing database rollback for $env environment"

    if [[ "$dry_run" == true ]]; then
        echo "DRY RUN: Would rollback database for $env environment"
        echo "DRY RUN: This would typically involve running down migrations"
        return 0
    fi

    # Set environment-specific database connection
    case "$env" in
        production)
            export NEON_BRANCH_NAME="main-production-branch"
            export APP_ENV="production"
            ;;
        staging)
            export NEON_BRANCH_NAME="auto-branch-from-production"
            export APP_ENV="staging"
            ;;
        feature)
            export NEON_BRANCH_NAME="preview-pr-manual"
            export APP_ENV="feature"
            ;;
    esac

    log_warn "Database rollback functionality needs to be implemented"
    log_info "This would typically involve:"
    log_info "1. Connecting to the Neon database"
    log_info "2. Running down migrations"
    log_info "3. Verifying database integrity"

    # Placeholder for actual database rollback logic
    log_success "Database rollback placeholder completed"
}

# Main rollback execution
execute_rollback() {
    local env="$1"
    local rollback_type="$2"
    local target_version="$3"
    local force="$4"
    local dry_run="$5"

    log_info "Starting rollback process..."
    log_info "Environment: $env"
    log_info "Type: $rollback_type"
    log_info "Target Version: $target_version"
    log_info "Force: $force"
    log_info "Dry Run: $dry_run"

    # Perform safety checks
    if ! perform_safety_checks "$env" "$rollback_type" "$target_version" "$force"; then
        return 1
    fi

    # Execute rollback based on type
    case "$rollback_type" in
        service)
            rollback_service "$env" "$target_version" "$dry_run"
            ;;
        database)
            rollback_database "$env" "$dry_run"
            ;;
        full)
            log_info "Executing full rollback (service + database)..."
            rollback_database "$env" "$dry_run"
            rollback_service "$env" "$target_version" "$dry_run"
            ;;
        emergency)
            log_warn "Executing emergency rollback with minimal checks..."
            rollback_service "$env" "$target_version" "$dry_run"
            ;;
    esac

    if [[ "$dry_run" != true ]]; then
        log_success "Rollback completed successfully"
    else
        log_info "Dry run completed - no changes made"
    fi
}

# Main script logic
main() {
    # Parse command line arguments
    local environment=""
    local rollback_type=""
    local target_version=""
    local force=false
    local dry_run=false

    while [[ $# -gt 0 ]]; do
        case $1 in
            --target-version)
                target_version="$2"
                shift 2
                ;;
            --force)
                force=true
                shift
                ;;
            --dry-run)
                dry_run=true
                shift
                ;;
            --help)
                show_usage
                exit 0
                ;;
            -*)
                log_error "Unknown option: $1"
                show_usage
                exit 1
                ;;
            *)
                if [[ -z "$environment" ]]; then
                    environment="$1"
                elif [[ -z "$rollback_type" ]]; then
                    rollback_type="$1"
                else
                    log_error "Too many positional arguments"
                    show_usage
                    exit 1
                fi
                shift
                ;;
        esac
    done

    # Validate required arguments
    if [[ -z "$environment" || -z "$rollback_type" ]]; then
        log_error "Environment and rollback type are required"
        show_usage
        exit 1
    fi

    # Validate arguments
    validate_environment "$environment"
    validate_rollback_type "$rollback_type"

    # Auto-detect target version if not provided
    if [[ -z "$target_version" ]]; then
        read -r stack_name service_name cluster_name repo_name <<< "$(get_aws_resources "$environment")"
        target_version=$(get_previous_version "$repo_name" "")
        log_info "Auto-detected target version: $target_version"
    fi

    # Execute rollback
    execute_rollback "$environment" "$rollback_type" "$target_version" "$force" "$dry_run"
}

# Run main function if script is executed directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi
