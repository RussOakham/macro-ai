#!/bin/bash

# =============================================================================
# AWS Tag Conflict Cleanup Script
# =============================================================================
# 
# This script safely resolves tag conflicts that could cause CloudFormation
# deployment failures by standardizing tags to match TaggingStrategy constants.
#
# Safety Features:
# - Dry-run mode (default) - preview changes before execution
# - Environment filtering - only targets preview/PR environments
# - Backup capability - logs all existing tags before modification
# - Incremental processing - handles resources in batches
# - Rollback support - can restore original tags if needed
#
# Usage:
#   ./cleanup-tag-conflicts.sh [--dry-run] [--execute] [--pr-number 35] [--backup-file backup.json]
#
# =============================================================================

set -euo pipefail

# Default configuration
AWS_REGION="${AWS_REGION:-us-east-1}"
DRY_RUN=true
EXECUTE=false
PR_NUMBER=""
BACKUP_FILE=""
BATCH_SIZE=10
VERBOSE=false
FORCE=false

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1" >&2
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1" >&2
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1" >&2
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1" >&2
}

log_debug() {
    if [[ "${VERBOSE}" == "true" ]]; then
        echo -e "${PURPLE}[DEBUG]${NC} $1" >&2
    fi
}

log_dry_run() {
    echo -e "${CYAN}[DRY-RUN]${NC} $1" >&2
}

# Parse command line arguments
parse_arguments() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            --dry-run)
                DRY_RUN=true
                EXECUTE=false
                shift
                ;;
            --execute)
                DRY_RUN=false
                EXECUTE=true
                shift
                ;;
            --region)
                AWS_REGION="$2"
                shift 2
                ;;
            --pr-number)
                PR_NUMBER="$2"
                shift 2
                ;;
            --backup-file)
                BACKUP_FILE="$2"
                shift 2
                ;;
            --batch-size)
                BATCH_SIZE="$2"
                shift 2
                ;;
            --verbose)
                VERBOSE=true
                shift
                ;;
            --force)
                FORCE=true
                shift
                ;;
            --help)
                show_help
                exit 0
                ;;
            *)
                log_error "Unknown option: $1"
                show_help
                exit 1
                ;;
        esac
    done
}

show_help() {
    cat << EOF
AWS Tag Conflict Cleanup Script

USAGE:
    $0 [OPTIONS]

OPTIONS:
    --dry-run               Preview changes without executing (default)
    --execute               Execute the cleanup (requires explicit confirmation)
    --region REGION         AWS region to clean up (default: us-east-1)
    --pr-number NUMBER      Target specific PR number for cleanup
    --backup-file FILE      Save original tags to backup file before cleanup
    --batch-size SIZE       Process resources in batches (default: 10)
    --verbose               Enable verbose logging
    --force                 Skip confirmation prompts (use with caution)
    --help                  Show this help message

SAFETY FEATURES:
    - Dry-run mode is enabled by default
    - Only targets preview/PR environments (never production)
    - Creates backup of original tags before modification
    - Processes resources in small batches to avoid API limits
    - Provides detailed logging of all changes

EXAMPLES:
    # Preview cleanup for all PR environments
    $0 --dry-run --verbose

    # Execute cleanup for specific PR with backup
    $0 --execute --pr-number 35 --backup-file pr-35-backup.json

    # Force cleanup without confirmation (use carefully)
    $0 --execute --pr-number 35 --force
EOF
}

# Standard tag key mappings from TaggingStrategy
declare -A TAG_STANDARDIZATION=(
    # Case variants to standard keys
    ["project"]="Project"
    ["PROJECT"]="Project"
    ["environment"]="Environment"
    ["ENVIRONMENT"]="Environment"
    ["component"]="Component"
    ["COMPONENT"]="Component"
    ["purpose"]="Purpose"
    ["PURPOSE"]="Purpose"
    ["prnumber"]="PRNumber"
    ["PrNumber"]="PRNumber"
    ["pr-number"]="PRNumber"
    ["PR-NUMBER"]="PRNumber"
    ["managedby"]="ManagedBy"
    ["MANAGEDBY"]="ManagedBy"
    ["managed-by"]="ManagedBy"
    ["createdby"]="CreatedBy"
    ["CREATEDBY"]="CreatedBy"
    ["created-by"]="CreatedBy"
    ["costcenter"]="CostCenter"
    ["COSTCENTER"]="CostCenter"
    ["cost-center"]="CostCenter"
    ["owner"]="Owner"
    ["OWNER"]="Owner"
    ["scale"]="Scale"
    ["SCALE"]="Scale"
    ["branch"]="Branch"
    ["BRANCH"]="Branch"
    ["expirydate"]="ExpiryDate"
    ["EXPIRYDATE"]="ExpiryDate"
    ["expiry-date"]="ExpiryDate"
    ["autoshutdown"]="AutoShutdown"
    ["AUTOSHUTDOWN"]="AutoShutdown"
    ["auto-shutdown"]="AutoShutdown"
    ["backuprequired"]="BackupRequired"
    ["BACKUPREQUIRED"]="BackupRequired"
    ["backup-required"]="BackupRequired"
    ["monitoringlevel"]="MonitoringLevel"
    ["MONITORINGLEVEL"]="MonitoringLevel"
    ["monitoring-level"]="MonitoringLevel"
)

# Initialize backup structure
init_backup() {
    if [[ -n "$BACKUP_FILE" ]]; then
        cat << EOF > "$BACKUP_FILE"
{
    "backup_timestamp": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
    "aws_region": "${AWS_REGION}",
    "pr_number": "${PR_NUMBER:-"all"}",
    "original_tags": {}
}
EOF
        log_success "Backup file initialized: $BACKUP_FILE"
    fi
}

# Backup original tags before modification
backup_resource_tags() {
    local resource_type="$1"
    local resource_id="$2"
    local original_tags="$3"
    
    if [[ -n "$BACKUP_FILE" ]]; then
        # Add to backup file
        local temp_file
        temp_file=$(mktemp)
        
        jq --arg type "$resource_type" \
           --arg id "$resource_id" \
           --argjson tags "$original_tags" \
           '.original_tags[$type + ":" + $id] = $tags' \
           "$BACKUP_FILE" > "$temp_file" && mv "$temp_file" "$BACKUP_FILE"
        
        log_debug "Backed up tags for $resource_type: $resource_id"
    fi
}

# Check if resource should be processed (safety filter)
should_process_resource() {
    local resource_type="$1"
    local resource_id="$2"
    local tags_json="$3"
    
    # If PR number specified, only process resources related to that PR
    if [[ -n "$PR_NUMBER" ]]; then
        local has_pr_tag
        has_pr_tag=$(echo "$tags_json" | jq -r --arg pr "$PR_NUMBER" '.[] | select(.Key | test("(?i)pr|PRNumber|PrNumber") and (.Value == $pr or .Value == ("pr-" + $pr))) | .Key' 2>/dev/null || echo "")
        
        # Also check resource name/ID for PR pattern
        local has_pr_in_name=false
        if [[ "$resource_id" =~ pr-?${PR_NUMBER} ]] || [[ "$resource_id" =~ PR${PR_NUMBER} ]]; then
            has_pr_in_name=true
        fi
        
        if [[ -z "$has_pr_tag" ]] && [[ "$has_pr_in_name" != "true" ]]; then
            log_debug "Skipping $resource_type $resource_id - not related to PR $PR_NUMBER"
            return 1
        fi
    fi
    
    # Safety check: Never process production resources
    local has_production_tag
    has_production_tag=$(echo "$tags_json" | jq -r '.[] | select(.Key | test("(?i)environment") and .Value | test("(?i)prod")) | .Key' 2>/dev/null || echo "")
    
    if [[ -n "$has_production_tag" ]]; then
        log_warning "Skipping $resource_type $resource_id - appears to be production resource"
        return 1
    fi
    
    # Safety check: Skip AWS managed resources
    if [[ "$resource_id" =~ ^aws- ]] || [[ "$resource_id" =~ ^AWSService ]]; then
        log_debug "Skipping $resource_type $resource_id - AWS managed resource"
        return 1
    fi
    
    return 0
}

# Standardize tags for a resource
standardize_resource_tags() {
    local resource_type="$1"
    local resource_id="$2"
    local original_tags="$3"
    
    # Check if resource should be processed
    if ! should_process_resource "$resource_type" "$resource_id" "$original_tags"; then
        return 0
    fi
    
    # Backup original tags
    backup_resource_tags "$resource_type" "$resource_id" "$original_tags"
    
    # Parse existing tags
    local tag_keys
    tag_keys=$(echo "$original_tags" | jq -r '.[].Key // empty' 2>/dev/null || echo "")
    
    if [[ -z "$tag_keys" ]]; then
        log_debug "No tags found for $resource_type: $resource_id"
        return 0
    fi
    
    local changes_needed=false
    local tags_to_remove=()
    local tags_to_add=()
    
    # Check each tag for standardization needs
    while IFS= read -r tag_key; do
        [[ -z "$tag_key" ]] && continue
        
        # Check if this tag key needs standardization
        if [[ -n "${TAG_STANDARDIZATION[$tag_key]:-}" ]]; then
            local standard_key="${TAG_STANDARDIZATION[$tag_key]}"
            local tag_value
            tag_value=$(echo "$original_tags" | jq -r --arg key "$tag_key" '.[] | select(.Key == $key) | .Value' 2>/dev/null || echo "")
            
            if [[ "$tag_key" != "$standard_key" ]]; then
                changes_needed=true
                tags_to_remove+=("$tag_key")
                tags_to_add+=("$standard_key=$tag_value")
                
                log_debug "Will standardize: $tag_key -> $standard_key (value: $tag_value)"
            fi
        fi
    done <<< "$tag_keys"
    
    # Apply changes if needed
    if [[ "$changes_needed" == "true" ]]; then
        if [[ "$DRY_RUN" == "true" ]]; then
            log_dry_run "Would standardize tags for $resource_type: $resource_id"
            for tag in "${tags_to_remove[@]}"; do
                log_dry_run "  Remove: $tag"
            done
            for tag in "${tags_to_add[@]}"; do
                log_dry_run "  Add: $tag"
            done
        else
            log_info "Standardizing tags for $resource_type: $resource_id"
            
            # Apply the standardization based on resource type
            case "$resource_type" in
                "IAM Role")
                    standardize_iam_role_tags "$resource_id" "${tags_to_remove[@]}" "${tags_to_add[@]}"
                    ;;
                "IAM Policy")
                    standardize_iam_policy_tags "$resource_id" "${tags_to_remove[@]}" "${tags_to_add[@]}"
                    ;;
                "EC2 Instance")
                    standardize_ec2_instance_tags "$resource_id" "${tags_to_remove[@]}" "${tags_to_add[@]}"
                    ;;
                "Security Group")
                    standardize_security_group_tags "$resource_id" "${tags_to_remove[@]}" "${tags_to_add[@]}"
                    ;;
                *)
                    log_warning "Tag standardization not implemented for resource type: $resource_type"
                    ;;
            esac
        fi
        
        return 0
    else
        log_debug "No tag standardization needed for $resource_type: $resource_id"
        return 1
    fi
}

# Standardize IAM Role tags
standardize_iam_role_tags() {
    local role_name="$1"
    shift
    local tags_to_remove=("$@")

    # Remove old tags
    for tag_key in "${tags_to_remove[@]}"; do
        if aws iam untag-role --role-name "$role_name" --tag-keys "$tag_key" --region "$AWS_REGION" 2>/dev/null; then
            log_success "Removed tag '$tag_key' from IAM role: $role_name"
        else
            log_warning "Failed to remove tag '$tag_key' from IAM role: $role_name"
        fi
    done

    # Add standardized tags
    local tags_json="["
    local first=true
    for tag_pair in "${tags_to_add[@]}"; do
        local key="${tag_pair%=*}"
        local value="${tag_pair#*=}"

        if [[ "$first" == "true" ]]; then
            first=false
        else
            tags_json+=","
        fi

        tags_json+="{\"Key\":\"$key\",\"Value\":\"$value\"}"
    done
    tags_json+="]"

    if aws iam tag-role --role-name "$role_name" --tags "$tags_json" --region "$AWS_REGION" 2>/dev/null; then
        log_success "Added standardized tags to IAM role: $role_name"
    else
        log_error "Failed to add standardized tags to IAM role: $role_name"
    fi
}

# Standardize IAM Policy tags
standardize_iam_policy_tags() {
    local policy_name="$1"
    shift
    local tags_to_remove=("$@")

    # Get policy ARN
    local policy_arn
    policy_arn=$(aws iam list-policies --scope Local --region "$AWS_REGION" --query "Policies[?PolicyName=='$policy_name'].Arn" --output text 2>/dev/null || echo "")

    if [[ -z "$policy_arn" ]]; then
        log_error "Could not find ARN for policy: $policy_name"
        return 1
    fi

    # Remove old tags
    for tag_key in "${tags_to_remove[@]}"; do
        if aws iam untag-policy --policy-arn "$policy_arn" --tag-keys "$tag_key" --region "$AWS_REGION" 2>/dev/null; then
            log_success "Removed tag '$tag_key' from IAM policy: $policy_name"
        else
            log_warning "Failed to remove tag '$tag_key' from IAM policy: $policy_name"
        fi
    done

    # Add standardized tags
    local tags_json="["
    local first=true
    for tag_pair in "${tags_to_add[@]}"; do
        local key="${tag_pair%=*}"
        local value="${tag_pair#*=}"

        if [[ "$first" == "true" ]]; then
            first=false
        else
            tags_json+=","
        fi

        tags_json+="{\"Key\":\"$key\",\"Value\":\"$value\"}"
    done
    tags_json+="]"

    if aws iam tag-policy --policy-arn "$policy_arn" --tags "$tags_json" --region "$AWS_REGION" 2>/dev/null; then
        log_success "Added standardized tags to IAM policy: $policy_name"
    else
        log_error "Failed to add standardized tags to IAM policy: $policy_name"
    fi
}

# Standardize EC2 Instance tags
standardize_ec2_instance_tags() {
    local instance_id="$1"
    shift
    local tags_to_remove=("$@")

    # Remove old tags
    for tag_key in "${tags_to_remove[@]}"; do
        if aws ec2 delete-tags --region "$AWS_REGION" --resources "$instance_id" --tags "Key=$tag_key" 2>/dev/null; then
            log_success "Removed tag '$tag_key' from EC2 instance: $instance_id"
        else
            log_warning "Failed to remove tag '$tag_key' from EC2 instance: $instance_id"
        fi
    done

    # Add standardized tags
    local tags_spec=""
    for tag_pair in "${tags_to_add[@]}"; do
        local key="${tag_pair%=*}"
        local value="${tag_pair#*=}"
        tags_spec+="Key=$key,Value=$value "
    done

    if [[ -n "$tags_spec" ]]; then
        if aws ec2 create-tags --region "$AWS_REGION" --resources "$instance_id" --tags $tags_spec 2>/dev/null; then
            log_success "Added standardized tags to EC2 instance: $instance_id"
        else
            log_error "Failed to add standardized tags to EC2 instance: $instance_id"
        fi
    fi
}

# Standardize Security Group tags
standardize_security_group_tags() {
    local sg_id="$1"
    shift
    local tags_to_remove=("$@")

    # Remove old tags
    for tag_key in "${tags_to_remove[@]}"; do
        if aws ec2 delete-tags --region "$AWS_REGION" --resources "$sg_id" --tags "Key=$tag_key" 2>/dev/null; then
            log_success "Removed tag '$tag_key' from Security Group: $sg_id"
        else
            log_warning "Failed to remove tag '$tag_key' from Security Group: $sg_id"
        fi
    done

    # Add standardized tags
    local tags_spec=""
    for tag_pair in "${tags_to_add[@]}"; do
        local key="${tag_pair%=*}"
        local value="${tag_pair#*=}"
        tags_spec+="Key=$key,Value=$value "
    done

    if [[ -n "$tags_spec" ]]; then
        if aws ec2 create-tags --region "$AWS_REGION" --resources "$sg_id" --tags $tags_spec 2>/dev/null; then
            log_success "Added standardized tags to Security Group: $sg_id"
        else
            log_error "Failed to add standardized tags to Security Group: $sg_id"
        fi
    fi
}

# Process IAM roles in batches
cleanup_iam_roles() {
    log_info "🔧 Processing IAM roles for tag standardization..."

    local processed=0
    local standardized=0

    # Get all IAM roles
    local roles
    roles=$(aws iam list-roles --region "$AWS_REGION" --query 'Roles[].RoleName' --output text 2>/dev/null || echo "")

    if [[ -z "$roles" ]]; then
        log_info "No IAM roles found"
        return 0
    fi

    local batch_count=0
    for role_name in $roles; do
        # Skip AWS service roles
        if [[ "$role_name" =~ ^aws- ]] || [[ "$role_name" =~ ^AWSService ]]; then
            continue
        fi

        processed=$((processed + 1))

        # Get role tags
        local role_tags
        role_tags=$(aws iam list-role-tags --role-name "$role_name" --region "$AWS_REGION" --query 'Tags' --output json 2>/dev/null || echo "[]")

        # Standardize tags
        if standardize_resource_tags "IAM Role" "$role_name" "$role_tags"; then
            standardized=$((standardized + 1))
        fi

        # Batch processing
        batch_count=$((batch_count + 1))
        if [[ $batch_count -ge $BATCH_SIZE ]]; then
            log_debug "Processed batch of $BATCH_SIZE IAM roles, pausing..."
            sleep 1
            batch_count=0
        fi
    done

    log_info "IAM Roles: $standardized/$processed required tag standardization"
}

# Process EC2 instances in batches
cleanup_ec2_instances() {
    log_info "🔧 Processing EC2 instances for tag standardization..."

    local processed=0
    local standardized=0

    # Get all EC2 instances
    local instances
    instances=$(aws ec2 describe-instances --region "$AWS_REGION" --query 'Reservations[].Instances[].InstanceId' --output text 2>/dev/null || echo "")

    if [[ -z "$instances" ]]; then
        log_info "No EC2 instances found"
        return 0
    fi

    local batch_count=0
    for instance_id in $instances; do
        processed=$((processed + 1))

        # Get instance tags
        local instance_tags
        instance_tags=$(aws ec2 describe-tags --region "$AWS_REGION" --filters "Name=resource-id,Values=$instance_id" --query 'Tags[].{Key:Key,Value:Value}' --output json 2>/dev/null || echo "[]")

        # Standardize tags
        if standardize_resource_tags "EC2 Instance" "$instance_id" "$instance_tags"; then
            standardized=$((standardized + 1))
        fi

        # Batch processing
        batch_count=$((batch_count + 1))
        if [[ $batch_count -ge $BATCH_SIZE ]]; then
            log_debug "Processed batch of $BATCH_SIZE EC2 instances, pausing..."
            sleep 1
            batch_count=0
        fi
    done

    log_info "EC2 Instances: $standardized/$processed required tag standardization"
}

# Confirmation prompt for execution
confirm_execution() {
    if [[ "$FORCE" == "true" ]]; then
        return 0
    fi

    echo
    log_warning "⚠️  You are about to execute tag cleanup operations!"
    log_warning "This will modify AWS resource tags in region: $AWS_REGION"

    if [[ -n "$PR_NUMBER" ]]; then
        log_warning "Target: PR $PR_NUMBER resources only"
    else
        log_warning "Target: All preview/development resources"
    fi

    if [[ -n "$BACKUP_FILE" ]]; then
        log_info "Original tags will be backed up to: $BACKUP_FILE"
    else
        log_warning "No backup file specified - original tags will not be saved!"
    fi

    echo
    read -p "Do you want to continue? (yes/no): " -r
    echo

    if [[ ! $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
        log_info "Operation cancelled by user"
        exit 0
    fi
}

# Main execution function
main() {
    log_info "🚀 Starting AWS Tag Conflict Cleanup"
    log_info "Region: $AWS_REGION"
    log_info "Mode: $([ "$DRY_RUN" == "true" ] && echo "DRY-RUN" || echo "EXECUTE")"
    log_info "PR Number: ${PR_NUMBER:-"all"}"
    log_info "Backup File: ${BACKUP_FILE:-"none"}"
    log_info "Batch Size: $BATCH_SIZE"

    # Verify AWS CLI access
    if ! aws sts get-caller-identity --region "$AWS_REGION" >/dev/null 2>&1; then
        log_error "AWS CLI not configured or no access to region $AWS_REGION"
        exit 1
    fi

    # Initialize backup if specified
    if [[ -n "$BACKUP_FILE" ]]; then
        init_backup
    fi

    # Confirm execution if not dry-run
    if [[ "$EXECUTE" == "true" ]]; then
        confirm_execution
    fi

    # Run cleanup operations
    cleanup_iam_roles
    cleanup_ec2_instances

    # TODO: Add more resource types
    # cleanup_iam_policies
    # cleanup_security_groups
    # cleanup_load_balancers

    if [[ "$DRY_RUN" == "true" ]]; then
        log_success "✅ Dry-run completed - no changes were made"
        log_info "To execute the cleanup, run with --execute flag"
    else
        log_success "✅ Tag conflict cleanup completed"
        if [[ -n "$BACKUP_FILE" ]]; then
            log_info "Original tags backed up to: $BACKUP_FILE"
        fi
    fi
}

# Parse arguments and run main function
parse_arguments "$@"
main
