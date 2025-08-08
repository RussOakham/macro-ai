#!/bin/bash

# Convert Parameter Store parameters to SecureString type post-deployment
# This script addresses the CloudFormation limitation where SecureString parameters
# cannot be created directly in templates and must be converted after deployment.

set -euo pipefail

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
AWS_REGION="${AWS_REGION:-us-east-1}"
PARAMETER_PREFIX="${PARAMETER_PREFIX:-/macro-ai}"

# Function to print colored output
print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Function to check if AWS CLI is configured
check_aws_cli() {
    if ! command -v aws &> /dev/null; then
        print_error "AWS CLI is not installed or not in PATH"
        exit 1
    fi

    if ! aws sts get-caller-identity &> /dev/null; then
        print_error "AWS CLI is not configured or credentials are invalid"
        exit 1
    fi

    print_info "AWS CLI is configured and credentials are valid"
}

# Function to convert a parameter to SecureString
convert_to_secure_string() {
    local param_name="$1"
    local tier="$2"
    
    print_info "Converting $param_name to SecureString..."
    
    # Get current parameter value
    local current_value
    if ! current_value=$(aws ssm get-parameter --name "$param_name" --query 'Parameter.Value' --output text 2>/dev/null); then
        print_error "Failed to get current value for $param_name"
        return 1
    fi
    
    # Check if it's already a SecureString
    local current_type
    if current_type=$(aws ssm get-parameter --name "$param_name" --query 'Parameter.Type' --output text 2>/dev/null); then
        if [ "$current_type" = "SecureString" ]; then
            print_info "$param_name is already a SecureString, skipping..."
            return 0
        fi
    fi
    
    # Skip if it's still a placeholder value
    if [ "$current_value" = "PLACEHOLDER_VALUE_UPDATE_AFTER_DEPLOYMENT" ]; then
        print_warning "$param_name still has placeholder value, skipping conversion..."
        print_warning "Please update the parameter value first using: aws ssm put-parameter --name '$param_name' --value 'ACTUAL_VALUE' --type String --overwrite"
        return 0
    fi
    
    # Convert to SecureString
    if aws ssm put-parameter \
        --name "$param_name" \
        --value "$current_value" \
        --type "SecureString" \
        --tier "$tier" \
        --overwrite \
        --region "$AWS_REGION" > /dev/null; then
        print_status "Successfully converted $param_name to SecureString"
    else
        print_error "Failed to convert $param_name to SecureString"
        return 1
    fi
}

# Function to convert critical parameters
convert_critical_parameters() {
    local environment="$1"
    
    echo -e "${BLUE}🔒 Converting critical parameters for $environment environment...${NC}"
    echo ""
    
    # List of critical parameters that should be SecureString
    local critical_params=(
        "api-key"
        "cookie-encryption-key"
        "cognito-user-pool-secret-key"
        "cognito-access-key"
        "cognito-secret-key"
        "openai-api-key"
        "neon-database-url"
        "upstash-redis-url"
    )
    
    local success_count=0
    local total_count=${#critical_params[@]}
    
    for param in "${critical_params[@]}"; do
        local param_name="$PARAMETER_PREFIX/$environment/critical/$param"
        if convert_to_secure_string "$param_name" "Advanced"; then
            ((success_count++))
        fi
    done
    
    echo ""
    print_status "Converted $success_count/$total_count critical parameters to SecureString"
}

# Function to list all environments
list_environments() {
    print_info "Detecting available environments..."

    # Get all parameter paths under the prefix and extract environment names
    local environments=()
    local param_paths
    if param_paths=$(aws ssm get-parameters-by-path \
        --path "$PARAMETER_PREFIX" \
        --recursive \
        --query 'Parameters[].Name' \
        --output text 2>/dev/null); then

        # Extract unique environment names from parameter paths
        while read -r param_name; do
            if [[ "$param_name" =~ $PARAMETER_PREFIX/([^/]+)/ ]]; then
                env_name="${BASH_REMATCH[1]}"
                if [[ ! " ${environments[*]} " =~ " ${env_name} " ]]; then
                    environments+=("$env_name")
                fi
            fi
        done <<< "$param_paths"
    fi

    # Fallback to common environment names if no parameters found
    if [ ${#environments[@]} -eq 0 ]; then
        print_warning "No existing parameters found, using default environments"
        environments=("development" "staging" "production")
    fi

    printf '%s\n' "${environments[@]}"
}

# Function to show usage
show_usage() {
    echo "Usage: $0 [ENVIRONMENT]"
    echo ""
    echo "Convert Parameter Store parameters to SecureString type after CloudFormation deployment"
    echo ""
    echo "Arguments:"
    echo "  ENVIRONMENT    Environment name (development, staging, production)"
    echo "                 If not provided, will process all detected environments"
    echo ""
    echo "Environment Variables:"
    echo "  AWS_REGION           AWS region (default: us-east-1)"
    echo "  PARAMETER_PREFIX     Parameter prefix (default: /macro-ai)"
    echo ""
    echo "Examples:"
    echo "  $0 development       # Convert parameters for development environment"
    echo "  $0                   # Convert parameters for all environments"
    echo ""
}

# Main function
main() {
    echo -e "${BLUE}🔧 Parameter Store SecureString Converter${NC}"
    echo -e "${BLUE}==========================================${NC}"
    echo ""
    
    # Check for help flag
    if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
        show_usage
        exit 0
    fi
    
    # Check AWS CLI
    check_aws_cli
    
    print_info "Using AWS region: $AWS_REGION"
    print_info "Using parameter prefix: $PARAMETER_PREFIX"
    echo ""
    
    # Determine environments to process
    if [ $# -eq 0 ]; then
        # Process all environments
        print_info "No environment specified, processing all detected environments..."
        local environments
        readarray -t environments < <(list_environments)
        
        if [ ${#environments[@]} -eq 0 ]; then
            print_error "No environments detected"
            exit 1
        fi
        
        for env in "${environments[@]}"; do
            convert_critical_parameters "$env"
            echo ""
        done
    else
        # Process specific environment
        local environment="$1"
        convert_critical_parameters "$environment"
    fi
    
    echo ""
    print_status "SecureString conversion completed!"
    echo ""
    print_info "Next steps:"
    echo "  1. Verify parameters are now SecureString type:"
    echo "     aws ssm get-parameter --name '$PARAMETER_PREFIX/ENVIRONMENT/critical/PARAM_NAME' --query 'Parameter.Type'"
    echo "  2. Update any placeholder values with actual secrets"
    echo "  3. Test your application to ensure it can access the converted parameters"
}

# Run main function with all arguments
main "$@"
