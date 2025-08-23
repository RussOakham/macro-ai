#!/bin/bash
#
# EC2 Configuration Bootstrap Script
# Fetches parameters from AWS Parameter Store and creates environment file for systemd service
#
# This script replaces the complex Parameter Store integration within the Node.js application
# with a simple infrastructure-level approach that fetches parameters before starting the app.
#
# Usage:
#   ./bootstrap-ec2-config.sh [OPTIONS]
#
# Options:
#   --app-env ENV          Application environment (development, staging, production, pr-*)
#   --region REGION        AWS region (default: us-east-1)
#   --env-file PATH        Output environment file path (default: /etc/macro-ai.env)
#   --parameter-prefix     Parameter Store prefix override
#   --dry-run             Show what would be done without making changes
#   --verbose             Enable verbose logging
#   --help                Show this help message

set -euo pipefail

# Default configuration
DEFAULT_REGION="us-east-1"
DEFAULT_ENV_FILE="/etc/macro-ai.env"
DEFAULT_APP_ENV="production"

# Script configuration
SCRIPT_NAME="$(basename "$0")"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Initialize variables
APP_ENV="${DEFAULT_APP_ENV}"
AWS_REGION="${DEFAULT_REGION}"
ENV_FILE="${DEFAULT_ENV_FILE}"
PARAMETER_PREFIX=""
DRY_RUN=false
VERBOSE=false

# Logging functions
log_info() {
    echo "[INFO] $*" >&2
}

log_warn() {
    echo "[WARN] $*" >&2
}

log_error() {
    echo "[ERROR] $*" >&2
}

log_debug() {
    if [[ "${VERBOSE}" == "true" ]]; then
        echo "[DEBUG] $*" >&2
    fi
}

# Show help message
show_help() {
    cat << EOF
EC2 Configuration Bootstrap Script

Fetches parameters from AWS Parameter Store and creates environment file for systemd service.
This replaces complex Parameter Store integration within the Node.js application.

USAGE:
    $SCRIPT_NAME [OPTIONS]

OPTIONS:
    --app-env ENV          Application environment (development, staging, production, pr-*)
                          Default: $DEFAULT_APP_ENV
    --region REGION        AWS region
                          Default: $DEFAULT_REGION
    --env-file PATH        Output environment file path
                          Default: $DEFAULT_ENV_FILE
    --parameter-prefix     Parameter Store prefix override
                          Default: Auto-detected based on app-env
    --dry-run             Show what would be done without making changes
    --verbose             Enable verbose logging
    --help                Show this help message

EXAMPLES:
    # Bootstrap production environment
    $SCRIPT_NAME --app-env production

    # Bootstrap PR environment (uses development parameters)
    $SCRIPT_NAME --app-env pr-123

    # Dry run for staging environment
    $SCRIPT_NAME --app-env staging --dry-run --verbose

PARAMETER MAPPING:
    Preview environments (pr-*) automatically use development parameters for cost optimization.
    
    Environment -> Parameter Store Path:
    - development -> /macro-ai/development/
    - staging     -> /macro-ai/staging/
    - production  -> /macro-ai/production/
    - pr-*        -> /macro-ai/development/ (shared)

EOF
}

# Parse command line arguments
parse_args() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            --app-env)
                APP_ENV="$2"
                shift 2
                ;;
            --region)
                AWS_REGION="$2"
                shift 2
                ;;
            --env-file)
                ENV_FILE="$2"
                shift 2
                ;;
            --parameter-prefix)
                PARAMETER_PREFIX="$2"
                shift 2
                ;;
            --dry-run)
                DRY_RUN=true
                shift
                ;;
            --verbose)
                VERBOSE=true
                shift
                ;;
            --help|-h)
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

# Determine Parameter Store prefix based on environment
get_parameter_prefix() {
    if [[ -n "${PARAMETER_PREFIX}" ]]; then
        echo "${PARAMETER_PREFIX}"
        return
    fi

    # Map PR environments to development parameters for cost optimization
    if [[ "${APP_ENV}" =~ ^pr- ]]; then
        echo "/macro-ai/development/"
    else
        echo "/macro-ai/${APP_ENV}/"
    fi
}

# Validate prerequisites
validate_prerequisites() {
    log_debug "Validating prerequisites..."

    # Check if AWS CLI is available
    if ! command -v aws &> /dev/null; then
        log_error "AWS CLI is not installed or not in PATH"
        exit 1
    fi

    # Check AWS credentials/role
    if ! aws sts get-caller-identity &> /dev/null; then
        log_error "AWS credentials not configured or insufficient permissions"
        exit 1
    fi

    # Check if we can access Parameter Store
    local test_prefix
    test_prefix="$(get_parameter_prefix)"
    
    log_debug "Testing Parameter Store access with prefix: ${test_prefix}"
    
    if ! aws ssm get-parameters-by-path \
        --path "${test_prefix}" \
        --max-items 1 \
        --region "${AWS_REGION}" &> /dev/null; then
        log_error "Cannot access Parameter Store with prefix: ${test_prefix}"
        log_error "Check IAM permissions for ssm:GetParametersByPath"
        exit 1
    fi

    log_debug "Prerequisites validation passed"
}

# Fetch parameters from Parameter Store
fetch_parameters() {
    local prefix
    prefix="$(get_parameter_prefix)"
    
    log_info "Fetching parameters from Parameter Store..."
    log_debug "Parameter Store prefix: ${prefix}"
    log_debug "AWS Region: ${AWS_REGION}"

    # Fetch all parameters under the prefix
    local params_json
    params_json=$(aws ssm get-parameters-by-path \
        --path "${prefix}" \
        --with-decryption \
        --recursive \
        --region "${AWS_REGION}" \
        --output json)

    if [[ -z "${params_json}" ]] || [[ "${params_json}" == "null" ]]; then
        log_error "No parameters found at prefix: ${prefix}"
        exit 1
    fi

    # Parse parameters and convert to environment variable format
    local env_vars
    env_vars=$(echo "${params_json}" | jq -r '
        .Parameters[] | 
        {
            name: (.Name | split("/") | last),
            value: .Value,
            type: .Type
        } | 
        "\(.name)=\(.value)"
    ')

    if [[ -z "${env_vars}" ]]; then
        log_error "Failed to parse parameters from Parameter Store"
        exit 1
    fi

    # Validate that critical parameters were decrypted properly
    log_info "Validating parameter decryption..."
    
    # Check for encrypted values that might indicate decryption failure
    local encrypted_patterns=("AQICAH" "AQICAI" "AQICAHjWlQ")
    local has_encrypted_values=false
    
    while IFS= read -r line; do
        if [[ -n "$line" ]]; then
            local param_name="${line%%=*}"
            local param_value="${line#*=}"
            
            # Check if this looks like an encrypted value
            for pattern in "${encrypted_patterns[@]}"; do
                if [[ "$param_value" == *"$pattern"* ]]; then
                    log_warn "Parameter ${param_name} appears to be encrypted (starts with ${pattern})"
                    has_encrypted_values=true
                    break
                fi
            done
            
            # Special check for OpenAI API key format
            if [[ "$param_name" == "openai-api-key" ]] && [[ ! "$param_value" =~ ^sk- ]]; then
                log_error "OpenAI API key does not have expected format (should start with 'sk-')"
                log_error "Current value starts with: ${param_value:0:10}..."
                log_error "This may indicate a decryption issue or incorrect parameter value"
                has_encrypted_values=true
            fi
        fi
    done <<< "$env_vars"
    
    if [[ "$has_encrypted_values" == "true" ]]; then
        log_error "Some parameters appear to be encrypted or have incorrect format"
        log_error "This may indicate a decryption issue with SecureString parameters"
        log_error "Please check:"
        log_error "  1. IAM permissions include ssm:GetParametersByPath with decryption"
        log_error "  2. Parameters are stored as SecureString in Parameter Store"
        log_error "  3. KMS key permissions for decryption"
        exit 1
    fi

    echo "${env_vars}"
}

# Create environment file
create_env_file() {
    local env_vars="$1"
    local env_file_dir
    env_file_dir="$(dirname "${ENV_FILE}")"

    log_info "Creating environment file: ${ENV_FILE}"

    if [[ "${DRY_RUN}" == "true" ]]; then
        log_info "[DRY RUN] Would create environment file with content:"
        echo "# Auto-generated environment file for macro-ai"
        echo "# Generated at: $(date -u '+%Y-%m-%d %H:%M:%S UTC')"
        echo "# App Environment: ${APP_ENV}"
        echo "# Parameter Store Prefix: $(get_parameter_prefix)"
        echo ""
        echo "${env_vars}"
        return
    fi

    # Create directory if it doesn't exist
    if [[ ! -d "${env_file_dir}" ]]; then
        sudo mkdir -p "${env_file_dir}"
    fi

    # Create temporary file with proper content
    local temp_file
    temp_file=$(mktemp)
    
    {
        echo "# Auto-generated environment file for macro-ai"
        echo "# Generated at: $(date -u '+%Y-%m-%d %H:%M:%S UTC')"
        echo "# App Environment: ${APP_ENV}"
        echo "# Parameter Store Prefix: $(get_parameter_prefix)"
        echo ""
        echo "${env_vars}"
        echo ""
        echo "# Additional environment variables"
        echo "NODE_ENV=production"
        echo "APP_ENV=${APP_ENV}"
    } > "${temp_file}"

    # Move to final location with proper permissions
    sudo mv "${temp_file}" "${ENV_FILE}"
    sudo chmod 600 "${ENV_FILE}"
    sudo chown root:root "${ENV_FILE}"

    log_info "Environment file created successfully"
    log_debug "Environment file permissions: $(ls -la "${ENV_FILE}")"
}

# Main execution function
main() {
    log_info "Starting EC2 configuration bootstrap..."
    log_debug "Script: ${SCRIPT_NAME}"
    log_debug "Arguments: $*"

    parse_args "$@"

    log_info "Configuration:"
    log_info "  App Environment: ${APP_ENV}"
    log_info "  AWS Region: ${AWS_REGION}"
    log_info "  Environment File: ${ENV_FILE}"
    log_info "  Parameter Prefix: $(get_parameter_prefix)"
    log_info "  Dry Run: ${DRY_RUN}"

    validate_prerequisites

    local env_vars
    env_vars=$(fetch_parameters)

    if [[ -z "${env_vars}" ]]; then
        log_error "No environment variables retrieved"
        exit 1
    fi

    log_info "Retrieved $(echo "${env_vars}" | wc -l) environment variables"

    create_env_file "${env_vars}"

    log_info "EC2 configuration bootstrap completed successfully"
}

# Execute main function with all arguments
main "$@"
