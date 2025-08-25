#!/bin/bash

# Environment File Generation Script
# This script generates .env files from AWS Parameter Store during the build process
# This replaces runtime Parameter Store access with build-time configuration injection

set -e

# Colors for output
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

# Default values
ENVIRONMENT=${ENVIRONMENT:-"development"}
OUTPUT_FILE=${OUTPUT_FILE:-".env.${ENVIRONMENT}"}
PARAMETER_PREFIX=${PARAMETER_PREFIX:-"/macro-ai/${ENVIRONMENT}"}
AWS_REGION=${AWS_REGION:-"us-east-1"}

# Show usage
show_usage() {
    cat << EOF
Usage: $0 [OPTIONS]

Generate environment file from AWS Parameter Store

OPTIONS:
    -e, --environment ENV     Environment name (default: development)
    -o, --output FILE         Output file path (default: .env.{environment})
    -p, --prefix PREFIX       Parameter Store prefix (default: /macro-ai/{environment})
    -r, --region REGION       AWS region (default: us-east-1)
    -h, --help               Show this help message

EXAMPLES:
    # Generate development environment file
    $0 -e development

    # Generate production environment file with custom prefix
    $0 -e production -p "/macro-ai/prod" -o .env.prod

    # Generate staging environment file
    $0 -e staging -o .env.staging
EOF
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -e|--environment)
            ENVIRONMENT="$2"
            shift 2
            ;;
        -o|--output)
            OUTPUT_FILE="$2"
            shift 2
            ;;
        -p|--prefix)
            PARAMETER_PREFIX="$2"
            shift 2
            ;;
        -r|--region)
            AWS_REGION="$2"
            shift 2
            ;;
        -h|--help)
            show_usage
            exit 0
            ;;
        *)
            log_error "Unknown option: $1"
            show_usage
            exit 1
            ;;
    esac
done

# Validate required tools
check_requirements() {
    log_info "Checking requirements..."
    
    if ! command -v aws &> /dev/null; then
        log_error "AWS CLI is not installed or not in PATH"
        exit 1
    fi
    
    if ! command -v jq &> /dev/null; then
        log_error "jq is not installed or not in PATH"
        exit 1
    fi
    
    log_success "All requirements met"
}

# Check AWS credentials
check_aws_credentials() {
    log_info "Checking AWS credentials..."
    
    if ! aws sts get-caller-identity &> /dev/null; then
        log_error "AWS credentials not configured or invalid"
        log_error "Please run: aws configure"
        exit 1
    fi
    
    local account_id
    account_id=$(aws sts get-caller-identity --query 'Account' --output text)
    log_success "AWS credentials valid for account: $account_id"
}

# Generate environment file
generate_env_file() {
    log_info "Generating environment file from Parameter Store..."
    log_info "Environment: $ENVIRONMENT"
    log_info "Parameter Prefix: $PARAMETER_PREFIX"
    log_info "Output File: $OUTPUT_FILE"
    log_info "AWS Region: $AWS_REGION"
    
    # Create output directory if it doesn't exist
    local output_dir
    output_dir=$(dirname "$OUTPUT_FILE")
    if [[ ! -d "$output_dir" ]]; then
        mkdir -p "$output_dir"
        log_info "Created output directory: $output_dir"
    fi
    
    # Get all parameters from the specified path
    log_info "Fetching parameters from Parameter Store..."
    
    local parameters_json
    if ! parameters_json=$(aws ssm get-parameters-by-path \
        --path "$PARAMETER_PREFIX" \
        --recursive \
        --with-decryption \
        --region "$AWS_REGION" \
        --output json 2>&1); then
        log_error "Failed to fetch parameters from Parameter Store"
        log_error "Error: $parameters_json"
        exit 1
    fi
    
    # Parse parameters and generate .env file
    log_info "Processing parameters..."
    
    # Start with a header
    cat > "$OUTPUT_FILE" << EOF
# Environment configuration for $ENVIRONMENT
# Generated from AWS Parameter Store: $PARAMETER_PREFIX
# Generated at: $(date -u)
# 
# This file contains environment variables resolved at build time
# DO NOT edit manually - changes will be overwritten on next build
#

EOF
    
    # Extract parameters and convert to .env format
    local param_count=0
    local success_count=0
    local error_count=0
    
    # Process each parameter
    echo "$parameters_json" | jq -r '.Parameters[] | "\(.Name)\t\(.Value)"' | while IFS=$'\t' read -r name value; do
        if [[ -n "$name" && -n "$value" ]]; then
            # Extract parameter name without prefix
            local env_var_name
            env_var_name=$(echo "$name" | sed "s|^$PARAMETER_PREFIX/||" | tr '[:lower:]' '[:upper:]' | tr '-' '_')
            
            # Add to .env file
            echo "$env_var_name=$value" >> "$OUTPUT_FILE"
            ((param_count++))
            ((success_count++))
            
            log_info "Added parameter: $env_var_name"
        fi
    done
    
    # Add standard environment variables
    cat >> "$OUTPUT_FILE" << EOF

# Standard environment variables
NODE_ENV=${ENVIRONMENT}
APP_ENV=${ENVIRONMENT}
PARAMETER_STORE_PREFIX=${PARAMETER_PREFIX}
AWS_REGION=${AWS_REGION}
GENERATED_AT=$(date -u +%Y-%m-%dT%H:%M:%SZ)
EOF
    
    log_success "Environment file generated successfully"
    log_info "Total parameters processed: $param_count"
    log_info "Output file: $OUTPUT_FILE"
    
    # Show file contents (without sensitive values)
    log_info "Environment file contents (parameter names only):"
    grep -E '^[A-Z_]+=' "$OUTPUT_FILE" | cut -d'=' -f1 | sort | while read -r var_name; do
        echo "  $var_name"
    done
}

# Validate generated file
validate_env_file() {
    log_info "Validating generated environment file..."
    
    if [[ ! -f "$OUTPUT_FILE" ]]; then
        log_error "Output file not found: $OUTPUT_FILE"
        exit 1
    fi
    
    local line_count
    line_count=$(wc -l < "$OUTPUT_FILE")
    
    if [[ $line_count -lt 10 ]]; then
        log_warning "Generated file seems small ($line_count lines) - may be missing parameters"
    else
        log_success "Generated file validation passed ($line_count lines)"
    fi
    
    # Check for required parameters
    local required_params=("API_KEY" "AWS_COGNITO_REGION" "RELATIONAL_DATABASE_URL")
    local missing_params=()
    
    for param in "${required_params[@]}"; do
        if ! grep -q "^$param=" "$OUTPUT_FILE"; then
            missing_params+=("$param")
        fi
    done
    
    if [[ ${#missing_params[@]} -gt 0 ]]; then
        log_warning "Missing required parameters: ${missing_params[*]}"
    else
        log_success "All required parameters present"
    fi
}

# Main execution
main() {
    log_info "Starting environment file generation..."
    
    check_requirements
    check_aws_credentials
    generate_env_file
    validate_env_file
    
    log_success "Environment file generation completed successfully!"
    log_info "File: $OUTPUT_FILE"
    log_info "You can now use this file in your Docker build or deployment process"
}

# Run main function
main "$@"
