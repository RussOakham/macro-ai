#!/bin/bash

# =============================================================================
# Parameter Store Organization Script
# =============================================================================
# 
# This script organizes Parameter Store parameters into a structured hierarchy
# and establishes parameter sharing strategies across environments.
#
# Features:
# 1. Create organized parameter hierarchies for each environment
# 2. Migrate existing parameters to new structure
# 3. Establish parameter sharing for preview environments
# 4. Validate parameter organization
# 5. Generate parameter management documentation
#
# Usage:
#   ./organize-parameter-store.sh --organize-all
#   ./organize-parameter-store.sh --migrate-existing
#   ./organize-parameter-store.sh --validate-structure
#   ./organize-parameter-store.sh --create-shared-params
#
# Exit Codes:
#   0 - All operations completed successfully
#   1 - Some operations failed
#   2 - Invalid arguments or configuration error

set -euo pipefail

# Configuration
AWS_REGION="${AWS_REGION:-us-east-1}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DRY_RUN=false
VERBOSE=false
BACKUP_ENABLED=true

# Parameter organization strategy
ENVIRONMENTS=("development" "staging" "production")
SHARED_ENV="development"  # Preview environments share development parameters

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

log_debug() {
    if [[ "$VERBOSE" == "true" ]]; then
        echo -e "${BLUE}[DEBUG]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
    fi
}

# Error handling
error_exit() {
    log_error "$1"
    exit 1
}

# Show help
show_help() {
    cat << EOF
Parameter Store Organization Script

This script organizes AWS Systems Manager Parameter Store parameters into
a structured hierarchy for the Macro AI application.

USAGE:
    $0 [OPTIONS] COMMAND

COMMANDS:
    organize-all        Create complete parameter hierarchy for all environments
    migrate-existing    Migrate existing parameters to new structure
    validate-structure  Validate current parameter organization
    create-shared       Create shared parameters for preview environments
    backup-params       Backup existing parameters before reorganization
    restore-params      Restore parameters from backup
    show-structure      Display current parameter structure

OPTIONS:
    --dry-run          Show what would be done without making changes
    --verbose          Enable verbose logging
    --no-backup        Skip parameter backup (not recommended)
    --region REGION    AWS region (default: us-east-1)
    --help, -h         Show this help message

EXAMPLES:
    # Organize all parameters with backup
    $0 organize-all

    # Migrate existing parameters (dry run first)
    $0 --dry-run migrate-existing
    $0 migrate-existing

    # Validate current structure
    $0 validate-structure

    # Create shared development parameters for preview environments
    $0 create-shared

PARAMETER HIERARCHY:
    /macro-ai/development/    - Development environment parameters
    /macro-ai/staging/        - Staging environment parameters  
    /macro-ai/production/     - Production environment parameters
    
    Preview environments (pr-*) share development parameters for cost optimization.

EOF
}

# Parse command line arguments
parse_arguments() {
    local command=""
    
    while [[ $# -gt 0 ]]; do
        case $1 in
            --dry-run)
                DRY_RUN=true
                shift
                ;;
            --verbose)
                VERBOSE=true
                shift
                ;;
            --no-backup)
                BACKUP_ENABLED=false
                shift
                ;;
            --region)
                AWS_REGION="$2"
                shift 2
                ;;
            --help|-h)
                show_help
                exit 0
                ;;
            organize-all|migrate-existing|validate-structure|create-shared|backup-params|restore-params|show-structure)
                if [[ -n "$command" ]]; then
                    error_exit "Multiple commands specified. Please specify only one command."
                fi
                command="$1"
                shift
                ;;
            *)
                error_exit "Unknown option: $1. Use --help for usage information."
                ;;
        esac
    done
    
    if [[ -z "$command" ]]; then
        error_exit "No command specified. Use --help for usage information."
    fi
    
    export COMMAND="$command"
}

# Validate AWS credentials and access
validate_aws_access() {
    log_info "Validating AWS credentials and Parameter Store access..."
    
    if ! aws sts get-caller-identity > /dev/null 2>&1; then
        error_exit "AWS credentials not available or invalid"
    fi
    
    # Test Parameter Store access
    if ! aws ssm describe-parameters --max-items 1 --region "$AWS_REGION" > /dev/null 2>&1; then
        error_exit "Cannot access Parameter Store. Check IAM permissions."
    fi
    
    log_success "AWS credentials and Parameter Store access validated"
}

# Define parameter structure
get_parameter_definitions() {
    # Define all required parameters with their properties
    cat << 'EOF'
# Critical parameters (SecureString, Advanced tier)
API_KEY:SecureString:Advanced:API key for application authentication
AWS_COGNITO_USER_POOL_SECRET_KEY:SecureString:Advanced:AWS Cognito User Pool secret key
# AWS Cognito credentials removed - using IAM roles instead
COOKIE_ENCRYPTION_KEY:SecureString:Advanced:Cookie encryption key for session management
OPENAI_API_KEY:SecureString:Advanced:OpenAI API key for AI functionality
RELATIONAL_DATABASE_URL:SecureString:Advanced:PostgreSQL database connection string
NON_RELATIONAL_DATABASE_URL:SecureString:Advanced:Redis database connection string

# Standard parameters (String, Standard tier)
AWS_COGNITO_REGION:String:Standard:AWS Cognito region
AWS_COGNITO_USER_POOL_ID:String:Standard:AWS Cognito User Pool ID
AWS_COGNITO_USER_POOL_CLIENT_ID:String:Standard:AWS Cognito User Pool Client ID
CORS_ALLOWED_ORIGINS:String:Standard:CORS allowed origins configuration
EOF
}

# Create parameter hierarchy for an environment
create_environment_parameters() {
    local environment="$1"
    local prefix="/macro-ai/$environment"
    
    log_info "Creating parameter hierarchy for environment: $environment"
    log_info "Parameter prefix: $prefix"
    
    local created_count=0
    local skipped_count=0
    
    # Read parameter definitions
    while IFS=':' read -r param_name param_type param_tier param_description; do
        # Skip comments and empty lines
        [[ "$param_name" =~ ^#.*$ ]] && continue
        [[ -z "$param_name" ]] && continue
        
        local param_path="${prefix}/${param_name}"
        
        log_debug "Processing parameter: $param_path"
        
        # Check if parameter already exists
        if aws ssm get-parameter --name "$param_path" --region "$AWS_REGION" > /dev/null 2>&1; then
            log_debug "Parameter already exists: $param_path"
            ((skipped_count++))
            continue
        fi
        
        # Create parameter
        if [[ "$DRY_RUN" == "true" ]]; then
            log_info "[DRY RUN] Would create parameter: $param_path ($param_type, $param_tier)"
        else
            log_debug "Creating parameter: $param_path"
            
            local tier_option=""
            if [[ "$param_tier" == "Advanced" ]]; then
                tier_option="--tier Advanced"
            fi
            
            if aws ssm put-parameter \
                --name "$param_path" \
                --value "PLACEHOLDER_UPDATE_AFTER_CREATION" \
                --type "$param_type" \
                --description "$param_description" \
                $tier_option \
                --region "$AWS_REGION" > /dev/null 2>&1; then
                
                log_success "Created parameter: $param_name"
                ((created_count++))
            else
                log_error "Failed to create parameter: $param_path"
            fi
        fi
    done < <(get_parameter_definitions)
    
    log_info "Environment $environment: Created $created_count parameters, Skipped $skipped_count existing"
}

# Main execution
main() {
    log_info "🏗️ Parameter Store Organization Script"
    log_info "Command: $COMMAND"
    log_info "Region: $AWS_REGION"
    log_info "Dry Run: $DRY_RUN"
    log_info "Backup Enabled: $BACKUP_ENABLED"
    echo ""
    
    validate_aws_access
    
    case "$COMMAND" in
        organize-all)
            organize_all_parameters
            ;;
        migrate-existing)
            migrate_existing_parameters
            ;;
        validate-structure)
            validate_parameter_structure
            ;;
        create-shared)
            create_shared_parameters
            ;;
        backup-params)
            backup_parameters
            ;;
        restore-params)
            restore_parameters
            ;;
        show-structure)
            show_parameter_structure
            ;;
        *)
            error_exit "Unknown command: $COMMAND"
            ;;
    esac
    
    log_success "Parameter Store organization completed successfully!"
}

# Organize all parameters for all environments
organize_all_parameters() {
    log_info "🏗️ Organizing parameters for all environments..."

    if [[ "$BACKUP_ENABLED" == "true" ]]; then
        backup_parameters
    fi

    # Create parameters for each environment
    for env in "${ENVIRONMENTS[@]}"; do
        create_environment_parameters "$env"
    done

    # Create shared parameters for preview environments
    create_shared_parameters

    # Validate the structure
    validate_parameter_structure

    log_success "All parameters organized successfully!"
}

# Migrate existing parameters to new structure
migrate_existing_parameters() {
    log_info "🔄 Migrating existing parameters to new structure..."

    if [[ "$BACKUP_ENABLED" == "true" ]]; then
        backup_parameters
    fi

    # Find existing parameters that need migration
    log_info "Scanning for existing parameters to migrate..."

    # Look for old root-level parameters
    local old_params
    old_params=$(aws ssm describe-parameters \
        --parameter-filters "Key=Name,Option=BeginsWith,Values=macro-ai-" \
        --query "Parameters[*].Name" \
        --output text \
        --region "$AWS_REGION" 2>/dev/null || echo "")

    if [[ -n "$old_params" ]]; then
        log_info "Found existing root-level parameters to migrate:"
        echo "$old_params" | tr '\t' '\n' | while read -r param_name; do
            [[ -z "$param_name" ]] && continue
            log_info "  - $param_name"
            migrate_single_parameter "$param_name"
        done
    else
        log_info "No root-level parameters found to migrate"
    fi

    log_success "Parameter migration completed!"
}

# Migrate a single parameter
migrate_single_parameter() {
    local old_param_name="$1"

    # Map old parameter names to new structure
    local new_param_name=""
    case "$old_param_name" in
        "macro-ai-cognito-user-pool-client-id")
            new_param_name="AWS_COGNITO_USER_POOL_CLIENT_ID"
            ;;
        "macro-ai-cognito-user-pool-id")
            new_param_name="AWS_COGNITO_USER_POOL_ID"
            ;;
        "macro-ai-database-url")
            new_param_name="RELATIONAL_DATABASE_URL"
            ;;
        "macro-ai-openai-key")
            new_param_name="OPENAI_API_KEY"
            ;;
        "macro-ai-redis-url")
            new_param_name="NON_RELATIONAL_DATABASE_URL"
            ;;
        *)
            log_warning "Unknown parameter mapping for: $old_param_name"
            return
            ;;
    esac

    # Get the parameter value
    local param_value
    param_value=$(aws ssm get-parameter \
        --name "$old_param_name" \
        --with-decryption \
        --query "Parameter.Value" \
        --output text \
        --region "$AWS_REGION" 2>/dev/null || echo "")

    if [[ -z "$param_value" ]]; then
        log_error "Could not retrieve value for parameter: $old_param_name"
        return
    fi

    # Copy to development environment (shared by preview environments)
    local new_param_path="/macro-ai/development/$new_param_name"

    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "[DRY RUN] Would migrate: $old_param_name -> $new_param_path"
    else
        # Determine parameter type based on content
        local param_type="String"
        if [[ "$new_param_name" =~ (API_KEY|DATABASE_URL|SECRET|ENCRYPTION) ]]; then
            param_type="SecureString"
        fi

        # Create the new parameter
        if aws ssm put-parameter \
            --name "$new_param_path" \
            --value "$param_value" \
            --type "$param_type" \
            --description "Migrated from $old_param_name" \
            --overwrite \
            --region "$AWS_REGION" > /dev/null 2>&1; then

            log_success "Migrated: $old_param_name -> $new_param_path"
        else
            log_error "Failed to migrate: $old_param_name -> $new_param_path"
        fi
    fi
}

# Create shared parameters for preview environments
create_shared_parameters() {
    log_info "🔗 Creating shared parameters for preview environments..."

    # Preview environments share development parameters
    local shared_prefix="/macro-ai/$SHARED_ENV"

    log_info "Ensuring shared parameters exist at: $shared_prefix"
    create_environment_parameters "$SHARED_ENV"

    log_success "Shared parameters configured for preview environments"
}

# Validate parameter structure
validate_parameter_structure() {
    log_info "✅ Validating parameter structure..."

    local validation_errors=0
    local total_params=0

    # Check each environment
    for env in "${ENVIRONMENTS[@]}"; do
        local prefix="/macro-ai/$env"
        log_info "Validating environment: $env ($prefix)"

        # Count parameters in this environment
        local env_params
        env_params=$(aws ssm get-parameters-by-path \
            --path "$prefix" \
            --query "Parameters[*].Name" \
            --output text \
            --region "$AWS_REGION" 2>/dev/null || echo "")

        local env_param_count=0
        if [[ -n "$env_params" ]]; then
            env_param_count=$(echo "$env_params" | wc -w)
        fi

        log_info "  Found $env_param_count parameters"
        total_params=$((total_params + env_param_count))

        # Validate required parameters exist
        while IFS=':' read -r param_name param_type param_tier param_description; do
            # Skip comments and empty lines
            [[ "$param_name" =~ ^#.*$ ]] && continue
            [[ -z "$param_name" ]] && continue

            local param_path="${prefix}/${param_name}"

            if ! aws ssm get-parameter --name "$param_path" --region "$AWS_REGION" > /dev/null 2>&1; then
                log_warning "Missing required parameter: $param_path"
                ((validation_errors++))
            fi
        done < <(get_parameter_definitions)
    done

    # Report validation results
    log_info "Validation Results:"
    log_info "  Total parameters found: $total_params"
    log_info "  Validation errors: $validation_errors"

    if [[ $validation_errors -eq 0 ]]; then
        log_success "Parameter structure validation passed!"
    else
        log_warning "Parameter structure validation found $validation_errors issues"
    fi
}

# Backup existing parameters
backup_parameters() {
    log_info "💾 Backing up existing parameters..."

    local backup_dir="$SCRIPT_DIR/../backups/parameter-store"
    local backup_file="$backup_dir/parameters-backup-$(date +%Y%m%d-%H%M%S).json"

    # Create backup directory
    mkdir -p "$backup_dir"

    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "[DRY RUN] Would backup parameters to: $backup_file"
        return
    fi

    # Get all macro-ai parameters
    log_info "Retrieving all macro-ai parameters for backup..."

    local all_params
    all_params=$(aws ssm describe-parameters \
        --parameter-filters "Key=Name,Option=BeginsWith,Values=macro-ai" \
        --query "Parameters[*].Name" \
        --output json \
        --region "$AWS_REGION" 2>/dev/null || echo "[]")

    if [[ "$all_params" == "[]" ]]; then
        log_warning "No macro-ai parameters found to backup"
        return
    fi

    # Create backup with parameter values
    local backup_data="{"
    backup_data+='"timestamp":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'",'
    backup_data+='"region":"'$AWS_REGION'",'
    backup_data+='"parameters":['

    local first=true
    echo "$all_params" | jq -r '.[]' | while read -r param_name; do
        [[ -z "$param_name" ]] && continue

        local param_info
        param_info=$(aws ssm get-parameter \
            --name "$param_name" \
            --with-decryption \
            --query '{Name:Parameter.Name,Type:Parameter.Type,Value:Parameter.Value}' \
            --output json \
            --region "$AWS_REGION" 2>/dev/null || echo "{}")

        if [[ "$param_info" != "{}" ]]; then
            if [[ "$first" == "true" ]]; then
                first=false
            else
                backup_data+=","
            fi
            backup_data+="$param_info"
        fi
    done

    backup_data+=']}'

    # Save backup file
    echo "$backup_data" | jq '.' > "$backup_file"

    log_success "Parameters backed up to: $backup_file"
}

# Restore parameters from backup
restore_parameters() {
    log_info "🔄 Restoring parameters from backup..."

    local backup_dir="$SCRIPT_DIR/../backups/parameter-store"

    # Find the most recent backup
    local backup_file
    backup_file=$(find "$backup_dir" -name "parameters-backup-*.json" -type f | sort -r | head -n 1)

    if [[ -z "$backup_file" || ! -f "$backup_file" ]]; then
        error_exit "No backup file found in $backup_dir"
    fi

    log_info "Restoring from backup: $backup_file"

    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "[DRY RUN] Would restore parameters from: $backup_file"
        return
    fi

    # Read and restore parameters
    local restored_count=0
    local failed_count=0

    jq -r '.parameters[] | @base64' "$backup_file" | while read -r param_data; do
        local param_info
        param_info=$(echo "$param_data" | base64 --decode)

        local param_name
        param_name=$(echo "$param_info" | jq -r '.Name')
        local param_type
        param_type=$(echo "$param_info" | jq -r '.Type')
        local param_value
        param_value=$(echo "$param_info" | jq -r '.Value')

        log_debug "Restoring parameter: $param_name"

        if aws ssm put-parameter \
            --name "$param_name" \
            --value "$param_value" \
            --type "$param_type" \
            --overwrite \
            --region "$AWS_REGION" > /dev/null 2>&1; then

            log_success "Restored: $param_name"
            ((restored_count++))
        else
            log_error "Failed to restore: $param_name"
            ((failed_count++))
        fi
    done

    log_info "Restore completed: $restored_count restored, $failed_count failed"
}

# Show current parameter structure
show_parameter_structure() {
    log_info "📋 Current Parameter Store Structure"
    echo ""

    # Show structure for each environment
    for env in "${ENVIRONMENTS[@]}"; do
        local prefix="/macro-ai/$env"
        echo -e "${BLUE}Environment: $env${NC}"
        echo -e "${BLUE}Prefix: $prefix${NC}"

        local params
        params=$(aws ssm get-parameters-by-path \
            --path "$prefix" \
            --query "Parameters[*].[Name,Type,LastModifiedDate]" \
            --output table \
            --region "$AWS_REGION" 2>/dev/null || echo "No parameters found")

        if [[ "$params" == "No parameters found" ]]; then
            echo -e "${YELLOW}  No parameters found${NC}"
        else
            echo "$params"
        fi
        echo ""
    done

    # Show preview environment sharing info
    echo -e "${BLUE}Preview Environment Strategy:${NC}"
    echo -e "  Preview environments (pr-*) share parameters from: /macro-ai/$SHARED_ENV/"
    echo -e "  This provides cost optimization and consistent configuration."
    echo ""
}

# Parse arguments and run main function
parse_arguments "$@"
main
