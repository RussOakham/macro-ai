#!/bin/bash

# Test version of EC2 Configuration Bootstrap Script
# This version removes sudo requirements for integration testing

set -euo pipefail

# Default values
APP_ENV=""
REGION="us-east-1"
ENV_FILE="/tmp/macro-ai-test.env"
DRY_RUN=false
VERBOSE=false

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    if [[ "${VERBOSE}" == "true" ]]; then
        echo -e "${BLUE}[INFO]${NC} $1" >&2
    fi
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

# Function to show usage
show_usage() {
    cat << EOF
EC2 Configuration Bootstrap Script (Test Version)

USAGE:
    $0 --app-env <environment> [OPTIONS]

REQUIRED:
    --app-env ENV           Application environment (development, staging, production, pr-*)

OPTIONS:
    --region REGION         AWS region (default: us-east-1)
    --env-file FILE         Environment file path (default: /tmp/macro-ai-test.env)
    --dry-run              Show what would be done without making changes
    --verbose              Enable verbose output
    --help                 Show this help message

EXAMPLES:
    # Fetch development parameters
    $0 --app-env development

    # Fetch production parameters with custom file
    $0 --app-env production --env-file /tmp/prod.env

    # Dry run for staging
    $0 --app-env staging --dry-run --verbose

EOF
}

# Function to validate AWS CLI and credentials
validate_aws_access() {
    log_info "Validating AWS CLI and credentials..."
    
    if ! command -v aws &> /dev/null; then
        log_error "AWS CLI is not installed"
        return 1
    fi
    
    if ! aws sts get-caller-identity &> /dev/null; then
        log_error "AWS credentials not configured or invalid"
        return 1
    fi
    
    log_info "AWS access validated"
    return 0
}

# Function to get parameter store prefix based on environment
get_parameter_prefix() {
    if [[ "${APP_ENV}" =~ ^pr- ]]; then
        echo "/macro-ai/development/"
    else
        echo "/macro-ai/${APP_ENV}/"
    fi
}

# Function to fetch parameters from Parameter Store
fetch_parameters() {
    local prefix
    prefix=$(get_parameter_prefix)
    
    log_info "Fetching parameters from Parameter Store with prefix: ${prefix}"
    
    local parameters
    if ! parameters=$(aws ssm get-parameters-by-path \
        --path "${prefix}" \
        --region "${REGION}" \
        --recursive \
        --with-decryption \
        --query 'Parameters[].{Name:Name,Value:Value}' \
        --output json 2>/dev/null); then
        log_warning "Failed to fetch parameters or no parameters found"
        echo "[]"
        return 0
    fi
    
    echo "${parameters}"
}

# Function to convert parameters to environment variables
convert_to_env_vars() {
    local parameters="$1"
    local prefix
    prefix=$(get_parameter_prefix)
    
    local env_vars=""
    local count=0
    
    while IFS= read -r param; do
        if [[ -n "${param}" ]]; then
            local name
            local value
            name=$(echo "${param}" | jq -r '.Name' | sed "s|^${prefix}||")
            value=$(echo "${param}" | jq -r '.Value')
            
            if [[ -n "${name}" && -n "${value}" ]]; then
                env_vars="${env_vars}${name}=${value}\n"
                ((count++))
            fi
        fi
    done < <(echo "${parameters}" | jq -c '.[]')
    
    # Add standard environment variables
    env_vars="${env_vars}NODE_ENV=production\n"
    env_vars="${env_vars}APP_ENV=${APP_ENV}\n"
    ((count+=2))
    
    log_info "Retrieved ${count} environment variables"
    echo -e "${env_vars}"
}

# Function to create environment file
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
    
    # Create directory if it doesn't exist (without sudo for testing)
    if [[ ! -d "${env_file_dir}" ]]; then
        mkdir -p "${env_file_dir}"
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
        echo -e "${env_vars}"
    } > "${temp_file}"
    
    # Move to final location (without sudo for testing)
    mv "${temp_file}" "${ENV_FILE}"
    
    log_success "Environment file created successfully: ${ENV_FILE}"
}

# Main function
main() {
    # Parse command line arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --app-env)
                APP_ENV="$2"
                shift 2
                ;;
            --region)
                REGION="$2"
                shift 2
                ;;
            --env-file)
                ENV_FILE="$2"
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
            --help)
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
    
    # Validate required arguments
    if [[ -z "${APP_ENV}" ]]; then
        log_error "App environment is required"
        show_usage
        exit 1
    fi
    
    log_info "Starting configuration bootstrap for environment: ${APP_ENV}"
    log_info "AWS Region: ${REGION}"
    log_info "Environment file: ${ENV_FILE}"
    
    # Validate AWS access
    if ! validate_aws_access; then
        exit 1
    fi
    
    # Fetch parameters
    local parameters
    parameters=$(fetch_parameters)
    
    # Convert to environment variables
    local env_vars
    env_vars=$(convert_to_env_vars "${parameters}")
    
    # Create environment file
    create_env_file "${env_vars}"
    
    log_success "Configuration bootstrap completed successfully"
}

# Run main function
main "$@"
