#!/bin/bash

# Configuration Management Script for Amplify Preview Environments
# Manages environment-specific configuration for preview deployments

set -Eeuo pipefail
IFS=$'\n\t'

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PR_NUMBER=${PR_NUMBER:-""}
ENVIRONMENT_NAME=${ENVIRONMENT_NAME:-"preview"}
AWS_REGION=${AWS_REGION:-"us-east-1"}
APP_NAME_PREFIX="macro-ai-frontend-pr-"

# Environment variable defaults
DEFAULT_VITE_API_URL="https://api-development.macro-ai.com/api"
DEFAULT_VITE_APP_NAME="Macro AI (Preview)"
DEFAULT_VITE_ENABLE_DEVTOOLS="true"
DEFAULT_VITE_ENABLE_DEBUG_LOGGING="true"

# Function to print status messages
print_status() {
    echo -e "${GREEN}✓${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

# Function to show usage
show_usage() {
    echo "Configuration Management for Amplify Preview Environments"
    echo ""
    echo "Usage: $0 <command> [options]"
    echo ""
    echo "Commands:"
    echo "  generate-env <pr_number>     Generate environment configuration file"
    echo "  validate-env <pr_number>     Validate environment configuration"
    echo "  update-app-env <pr_number>   Update Amplify app environment variables"
    echo "  show-config <pr_number>      Show current configuration"
    echo ""
    echo "Environment Variables:"
    echo "  VITE_API_URL                 Backend API URL"
    echo "  VITE_API_KEY                 API authentication key"
    echo "  VITE_APP_ENV                 Application environment"
    echo "  VITE_APP_NAME                Application display name"
    echo "  VITE_ENABLE_DEVTOOLS         Enable development tools"
    echo "  VITE_ENABLE_DEBUG_LOGGING    Enable debug logging"
    echo ""
    echo "Examples:"
    echo "  $0 generate-env 123"
    echo "  $0 validate-env 123"
    echo "  $0 update-app-env 123"
}

# Function to generate environment configuration
generate_environment_config() {
    local pr_number="$1"
    
    if [[ -z "$pr_number" ]]; then
        print_error "PR number is required"
        exit 1
    fi
    
    local env_name="pr-${pr_number}"
    local config_file=".env.preview-${pr_number}"
    
    print_info "Generating environment configuration for PR #${pr_number}"
    
    # Determine API URL based on backend environment
    local api_url="$DEFAULT_VITE_API_URL"
    
    # Check if backend preview environment exists
    local backend_stack_name="MacroAiPr${pr_number}Stack"
    local backend_api_endpoint=""
    
    if command -v aws &> /dev/null && aws sts get-caller-identity &> /dev/null; then
        backend_api_endpoint=$(aws cloudformation describe-stacks \
            --stack-name "$backend_stack_name" \
            --query 'Stacks[0].Outputs[?OutputKey==`ApiEndpoint`].OutputValue' \
            --output text 2>/dev/null || echo "")
        
        if [[ -n "$backend_api_endpoint" ]]; then
            api_url="${backend_api_endpoint}api"
            print_status "Found backend preview environment: $api_url"
        else
            print_warning "Backend preview not found, using fallback API: $api_url"
        fi
    else
        print_warning "AWS CLI not available, using default API URL"
    fi
    
    # Generate configuration file
    cat > "$config_file" << EOF
# Environment Configuration for Preview PR #${pr_number}
# Generated on: $(date -u '+%Y-%m-%d %H:%M:%S UTC')

# API Configuration
VITE_API_URL=${api_url}
VITE_API_KEY=\${VITE_API_KEY:-""}

# Application Configuration
VITE_APP_ENV=${env_name}
VITE_APP_NAME=${DEFAULT_VITE_APP_NAME}
VITE_APP_VERSION=1.0.0-preview-${pr_number}

# Feature Flags
VITE_ENABLE_DEVTOOLS=${DEFAULT_VITE_ENABLE_DEVTOOLS}
VITE_ENABLE_DEBUG_LOGGING=${DEFAULT_VITE_ENABLE_DEBUG_LOGGING}

# Preview-specific Configuration
VITE_PREVIEW_MODE=true
VITE_PR_NUMBER=${pr_number}
VITE_ENVIRONMENT_TYPE=preview

# Build Configuration
VITE_BUILD_TIMESTAMP=$(date -u '+%Y-%m-%d %H:%M:%S UTC')
VITE_BUILD_COMMIT=\${GITHUB_SHA:-"unknown"}
VITE_BUILD_BRANCH=\${GITHUB_REF_NAME:-"unknown"}
EOF
    
    print_status "Configuration file generated: $config_file"
    
    # Display configuration summary
    echo ""
    print_info "Configuration Summary:"
    echo "  Environment: $env_name"
    echo "  API URL: $api_url"
    echo "  App Name: $DEFAULT_VITE_APP_NAME"
    echo "  Debug Mode: $DEFAULT_VITE_ENABLE_DEBUG_LOGGING"
    echo ""
    
    return 0
}

# Function to validate environment configuration
validate_environment_config() {
    local pr_number="$1"
    
    if [[ -z "$pr_number" ]]; then
        print_error "PR number is required"
        exit 1
    fi
    
    local config_file=".env.preview-${pr_number}"
    
    print_info "Validating environment configuration for PR #${pr_number}"
    
    # Check if config file exists
    if [[ ! -f "$config_file" ]]; then
        print_error "Configuration file not found: $config_file"
        print_info "Run: $0 generate-env $pr_number"
        exit 1
    fi
    
    print_status "Configuration file found: $config_file"
    
    # Load and validate configuration
    source "$config_file"
    
    local validation_errors=0
    
    # Validate required variables
    local required_vars=("VITE_API_URL" "VITE_APP_ENV" "VITE_APP_NAME")
    
    for var in "${required_vars[@]}"; do
        local var_value="${!var}"
        if [[ -z "$var_value" ]]; then
            print_error "Missing required variable: $var"
            validation_errors=$((validation_errors + 1))
        else
            print_status "Valid: $var = $var_value"
        fi
    done
    
    # Validate API URL format
    if [[ -n "$VITE_API_URL" ]]; then
        if [[ "$VITE_API_URL" =~ ^https?:// ]]; then
            print_status "API URL format is valid"
        else
            print_error "Invalid API URL format: $VITE_API_URL"
            validation_errors=$((validation_errors + 1))
        fi
    fi
    
    # Validate environment name
    if [[ -n "$VITE_APP_ENV" ]]; then
        if [[ "$VITE_APP_ENV" == "pr-${pr_number}" ]]; then
            print_status "Environment name matches PR number"
        else
            print_warning "Environment name doesn't match expected pattern: pr-${pr_number}"
        fi
    fi
    
    # Check for API key placeholder
    if [[ "$VITE_API_KEY" == "\${VITE_API_KEY:-\"\"}" ]] || [[ -z "$VITE_API_KEY" ]]; then
        print_warning "API key is not set - ensure VITE_API_KEY environment variable is provided"
    else
        print_status "API key is configured"
    fi
    
    echo ""
    if [[ $validation_errors -eq 0 ]]; then
        print_status "🎉 Configuration validation passed!"
        return 0
    else
        print_error "❌ Configuration validation failed with $validation_errors errors"
        return 1
    fi
}

# Function to update Amplify app environment variables
update_amplify_app_environment() {
    local pr_number="$1"
    
    if [[ -z "$pr_number" ]]; then
        print_error "PR number is required"
        exit 1
    fi
    
    local app_name="${APP_NAME_PREFIX}${pr_number}"
    local config_file=".env.preview-${pr_number}"
    
    print_info "Updating Amplify app environment variables for PR #${pr_number}"
    
    # Check if config file exists
    if [[ ! -f "$config_file" ]]; then
        print_error "Configuration file not found: $config_file"
        print_info "Run: $0 generate-env $pr_number"
        exit 1
    fi
    
    # Load configuration
    source "$config_file"
    
    # Get app ID
    local app_info=$(aws amplify list-apps \
        --query "apps[?name=='${app_name}'].{appId:appId}" \
        --output json 2>/dev/null || echo "[]")
    
    if [[ "$app_info" == "[]" ]]; then
        print_error "Amplify app not found: $app_name"
        exit 1
    fi
    
    local app_id=$(echo "$app_info" | jq -r '.[0].appId')
    print_status "Found Amplify app: $app_id"
    
    # Update environment variables
    print_info "Updating environment variables..."
    
    aws amplify update-app \
        --app-id "$app_id" \
        --environment-variables \
            VITE_API_URL="$VITE_API_URL" \
            VITE_API_KEY="${VITE_API_KEY:-""}" \
            VITE_APP_ENV="$VITE_APP_ENV" \
            VITE_APP_NAME="$VITE_APP_NAME" \
            VITE_APP_VERSION="$VITE_APP_VERSION" \
            VITE_ENABLE_DEVTOOLS="$VITE_ENABLE_DEVTOOLS" \
            VITE_ENABLE_DEBUG_LOGGING="$VITE_ENABLE_DEBUG_LOGGING" \
            VITE_PREVIEW_MODE="$VITE_PREVIEW_MODE" \
            VITE_PR_NUMBER="$VITE_PR_NUMBER" \
            VITE_ENVIRONMENT_TYPE="$VITE_ENVIRONMENT_TYPE" \
            VITE_BUILD_TIMESTAMP="$VITE_BUILD_TIMESTAMP" \
            VITE_BUILD_COMMIT="${VITE_BUILD_COMMIT:-""}" \
            VITE_BUILD_BRANCH="${VITE_BUILD_BRANCH:-""}" \
        > /dev/null
    
    print_status "Environment variables updated successfully"
    
    # Trigger a new deployment to apply changes
    print_info "Triggering new deployment to apply changes..."
    
    local deployment_result=$(aws amplify start-job \
        --app-id "$app_id" \
        --branch-name "main" \
        --job-type "RELEASE" \
        --output json 2>/dev/null || echo "{}")
    
    if [[ "$deployment_result" != "{}" ]]; then
        local job_id=$(echo "$deployment_result" | jq -r '.jobSummary.jobId // empty')
        if [[ -n "$job_id" ]]; then
            print_status "Deployment triggered: $job_id"
        else
            print_warning "Deployment may have been triggered, but job ID not available"
        fi
    else
        print_warning "Could not trigger automatic deployment - manual deployment may be required"
    fi
}

# Function to show current configuration
show_current_config() {
    local pr_number="$1"
    
    if [[ -z "$pr_number" ]]; then
        print_error "PR number is required"
        exit 1
    fi
    
    local app_name="${APP_NAME_PREFIX}${pr_number}"
    
    print_info "Current configuration for PR #${pr_number}"
    echo ""
    
    # Get app info
    local app_info=$(aws amplify list-apps \
        --query "apps[?name=='${app_name}'].{appId:appId}" \
        --output json 2>/dev/null || echo "[]")
    
    if [[ "$app_info" == "[]" ]]; then
        print_error "Amplify app not found: $app_name"
        exit 1
    fi
    
    local app_id=$(echo "$app_info" | jq -r '.[0].appId')
    
    # Get detailed app info with environment variables
    local detailed_info=$(aws amplify get-app --app-id "$app_id" --output json 2>/dev/null || echo "{}")
    
    if [[ "$detailed_info" != "{}" ]]; then
        local env_vars=$(echo "$detailed_info" | jq -r '.app.environmentVariables // {}')
        
        echo "📱 App ID: $app_id"
        echo "🌐 App Name: $app_name"
        echo ""
        echo "🔧 Environment Variables:"
        
        if [[ "$env_vars" != "{}" ]]; then
            echo "$env_vars" | jq -r 'to_entries[] | "  \(.key): \(.value)"'
        else
            print_warning "No environment variables found"
        fi
    else
        print_error "Could not retrieve app configuration"
        exit 1
    fi
}

# Main script logic
main() {
    local command="$1"
    local pr_number="$2"
    
    case "$command" in
        "generate-env")
            generate_environment_config "$pr_number"
            ;;
        "validate-env")
            validate_environment_config "$pr_number"
            ;;
        "update-app-env")
            update_amplify_app_environment "$pr_number"
            ;;
        "show-config")
            show_current_config "$pr_number"
            ;;
        "help"|"--help"|"-h")
            show_usage
            ;;
        *)
            print_error "Unknown command: $command"
            echo ""
            show_usage
            exit 1
            ;;
    esac
}

# Validate AWS CLI if needed
if [[ "$1" != "generate-env" ]] && [[ "$1" != "validate-env" ]]; then
    if ! command -v aws &> /dev/null; then
        print_error "AWS CLI not found. Please install AWS CLI."
        exit 1
    fi

    if ! aws sts get-caller-identity &> /dev/null; then
        print_error "AWS credentials not configured or invalid"
        exit 1
    fi
fi

# Run main function
main "$@"
