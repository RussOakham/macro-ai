#!/bin/bash

# Recreate Development Parameters Script
# This script recreates the missing development parameters by copying from existing macro-ai- prefixed parameters

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

# Check if AWS CLI is available
check_aws_cli() {
    if ! command -v aws &> /dev/null; then
        log_error "AWS CLI is not installed or not in PATH"
        exit 1
    fi
    
    # Test AWS credentials
    if ! aws sts get-caller-identity &> /dev/null; then
        log_error "AWS credentials not configured or invalid"
        exit 1
    fi
    
    log_success "AWS CLI and credentials verified"
}

# Copy parameter from source to destination
copy_parameter() {
    local source_name="$1"
    local dest_name="$2"
    local description="$3"
    
    log_info "Copying parameter: $source_name → $dest_name"
    
    # Get the source parameter value
    if ! source_value=$(aws ssm get-parameter --name "$source_name" --query "Parameter.Value" --output text 2>/dev/null); then
        log_error "Failed to retrieve source parameter: $source_name"
        return 1
    fi
    
    # Get the source parameter type
    if ! source_type=$(aws ssm get-parameter --name "$source_name" --query "Parameter.Type" --output text 2>/dev/null); then
        log_error "Failed to retrieve source parameter type: $source_name"
        return 1
    fi
    
    # Get the source parameter tier
    if ! source_tier=$(aws ssm get-parameter --name "$source_name" --query "Parameter.Tier" --output text 2>/dev/null); then
        log_warning "Failed to retrieve source parameter tier for $source_name, using Standard"
        source_tier="Standard"
    fi
    
    # Handle None tier (convert to Standard)
    if [[ "$source_tier" == "None" ]]; then
        source_tier="Standard"
        log_info "Converting None tier to Standard for parameter: $source_name"
    fi
    
    log_info "Source parameter details:"
    log_info "  Type: $source_type"
    log_info "  Tier: $source_tier"
    log_info "  Value length: ${#source_value} characters"
    
    # Create the destination parameter
    if aws ssm put-parameter \
        --name "$dest_name" \
        --value "$source_value" \
        --type "$source_type" \
        --tier "$source_tier" \
        --description "$description" \
        --overwrite; then
        log_success "Successfully created parameter: $dest_name"
    else
        log_error "Failed to create parameter: $dest_name"
        return 1
    fi
}

# Create a parameter with a placeholder value
create_placeholder_parameter() {
    local param_name="$1"
    local placeholder_value="$2"
    local description="$3"
    local param_type="${4:-String}"
    local tier="${5:-Standard}"
    
    log_info "Creating placeholder parameter: $param_name"
    
    if aws ssm put-parameter \
        --name "$param_name" \
        --value "$placeholder_value" \
        --type "$param_type" \
        --tier "$tier" \
        --description "$description" \
        --overwrite; then
        log_success "Successfully created placeholder parameter: $param_name"
    else
        log_error "Failed to create placeholder parameter: $param_name"
        return 1
    fi
}

# Main function
main() {
    log_info "Starting development parameter recreation"
    
    # Check prerequisites
    check_aws_cli
    
    # Define parameter mappings (source → destination)
    declare -A parameter_mappings=(
        ["macro-ai-cognito-user-pool-id"]="macro-ai-development-AWS_COGNITO_USER_POOL_ID"
        ["macro-ai-cognito-user-pool-client-id"]="macro-ai-development-AWS_COGNITO_USER_POOL_CLIENT_ID"
        ["macro-ai-database-url"]="macro-ai-development-RELATIONAL_DATABASE_URL"
        ["macro-ai-openai-key"]="macro-ai-development-OPENAI_API_KEY"
        ["macro-ai-redis-url"]="macro-ai-development-REDIS_URL"
    )
    
    # Define placeholder parameters that need manual values
    declare -A placeholder_params=(
        ["macro-ai-development-API_KEY"]="REPLACE_WITH_ACTUAL_API_KEY"
        ["macro-ai-development-AWS_COGNITO_REGION"]="us-east-1"
        ["macro-ai-development-AWS_COGNITO_USER_POOL_SECRET_KEY"]="REPLACE_WITH_ACTUAL_SECRET_KEY"
        ["macro-ai-development-AWS_COGNITO_ACCESS_KEY"]="REPLACE_WITH_ACTUAL_ACCESS_KEY"
        ["macro-ai-development-AWS_COGNITO_SECRET_KEY"]="REPLACE_WITH_ACTUAL_SECRET_KEY"
        ["macro-ai-development-COOKIE_ENCRYPTION_KEY"]="REPLACE_WITH_ACTUAL_COOKIE_KEY"
        ["macro-ai-development-NON_RELATIONAL_DATABASE_URL"]="REPLACE_WITH_ACTUAL_NOSQL_URL"
    )
    
    log_info "Copying existing parameters to development namespace..."
    
    # Copy existing parameters
    local copy_errors=0
    for source_name in "${!parameter_mappings[@]}"; do
        dest_name="${parameter_mappings[$source_name]}"
        description="Copied from $source_name for development environment"
        
        if ! copy_parameter "$source_name" "$dest_name" "$description"; then
            copy_errors=$((copy_errors + 1))
        fi
    done
    
    log_info "Creating placeholder parameters..."
    
    # Create placeholder parameters
    local placeholder_errors=0
    for param_name in "${!placeholder_params[@]}"; do
        placeholder_value="${placeholder_params[$param_name]}"
        description="Placeholder parameter for development environment - requires manual update"
        
        if ! create_placeholder_parameter "$param_name" "$placeholder_value" "$description"; then
            placeholder_errors=$((placeholder_errors + 1))
        fi
    done
    
    # Summary
    echo ""
    log_info "Parameter recreation summary:"
    log_info "  Parameters copied: $(( ${#parameter_mappings[@]} - copy_errors ))"
    log_info "  Copy errors: $copy_errors"
    log_info "  Placeholder parameters created: $(( ${#placeholder_params[@]} - placeholder_errors ))"
    log_info "  Placeholder errors: $placeholder_errors"
    
    if [[ $copy_errors -eq 0 && $placeholder_errors -eq 0 ]]; then
        log_success "All development parameters created successfully!"
        log_info ""
        log_info "Next steps:"
        log_info "1. Update placeholder parameters with actual values:"
        for param_name in "${!placeholder_params[@]}"; do
            if [[ "${placeholder_params[$param_name]}" == REPLACE_WITH_* ]]; then
                log_info "   - $param_name"
            fi
        done
        log_info ""
        log_info "2. Verify all parameters exist:"
        log_info "   aws ssm describe-parameters --query \"Parameters[?starts_with(Name, '/macro-ai/development/')].{Name: Name, Type: Type, Tier: Tier}\" --output table"
    else
        log_error "Some parameters failed to be created. Please check the errors above."
        exit 1
    fi
}

# Run main function
main "$@"
