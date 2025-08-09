#!/bin/bash

# Environment Variable Injection Script for Frontend Preview Builds
# Dynamically injects environment variables for preview deployments

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
PR_NUMBER=${PR_NUMBER:-""}
ENVIRONMENT_NAME=${ENVIRONMENT_NAME:-""}
BUILD_MODE=${BUILD_MODE:-"preview"}
OUTPUT_FILE=${OUTPUT_FILE:-".env.preview"}

# Required environment variables for frontend
REQUIRED_VARS=(
    "VITE_API_KEY"
)

# Optional environment variables with defaults
declare -A DEFAULT_VALUES=(
    ["VITE_APP_NAME"]="Macro AI (Preview)"
    ["VITE_ENABLE_DEVTOOLS"]="true"
    ["VITE_ENABLE_DEBUG_LOGGING"]="true"
    ["VITE_PREVIEW_MODE"]="true"
)

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
    echo -e "${CYAN}ℹ${NC} $1"
}

print_debug() {
    if [[ "${DEBUG:-false}" == "true" ]]; then
        echo -e "${BLUE}🐛${NC} $1"
    fi
}

# Function to show usage
show_usage() {
    echo "Environment Variable Injection for Frontend Preview Builds"
    echo ""
    echo "Usage: $0 [options]"
    echo ""
    echo "Options:"
    echo "  --pr-number <number>        PR number for environment resolution"
    echo "  --environment <name>        Environment name (e.g., pr-123, staging)"
    echo "  --build-mode <mode>         Build mode: preview|staging|production (default: preview)"
    echo "  --output-file <file>        Output environment file (default: .env.preview)"
    echo "  --validate-only             Only validate environment, don't generate file"
    echo "  --debug                     Enable debug output"
    echo "  --help                      Show this help message"
    echo ""
    echo "Environment Variables:"
    echo "  PR_NUMBER                   Pull request number"
    echo "  ENVIRONMENT_NAME            Environment name"
    echo "  VITE_API_KEY               API authentication key (required)"
    echo "  VITE_API_URL               Backend API URL (auto-resolved if not set)"
    echo "  BUILD_MODE                  Build mode"
    echo "  OUTPUT_FILE                 Output file path"
    echo ""
    echo "Examples:"
    echo "  $0 --pr-number 123"
    echo "  $0 --environment staging --build-mode staging"
    echo "  $0 --pr-number 123 --output-file .env.local"
}

# Function to validate required environment variables
validate_required_variables() {
    local validation_errors=0
    
    print_info "Validating required environment variables..."
    
    for var in "${REQUIRED_VARS[@]}"; do
        local var_value="${!var}"
        if [[ -z "$var_value" ]]; then
            print_error "Missing required environment variable: $var"
            validation_errors=$((validation_errors + 1))
        else
            print_debug "Found required variable: $var"
        fi
    done
    
    return $validation_errors
}

# Function to resolve API URL using enhanced API resolution service
resolve_api_url() {
    local env_name="$1"

    print_info "Resolving backend API URL for environment: $env_name"

    # Check if API resolution service exists
    local resolver_script="./scripts/api-resolution-service.sh"
    if [[ ! -f "$resolver_script" ]]; then
        print_warning "API resolution service not found: $resolver_script"

        # Fallback to legacy resolver
        local legacy_resolver="./scripts/resolve-backend-api.sh"
        if [[ -f "$legacy_resolver" ]]; then
            print_info "Using legacy backend resolver"
            local api_url=""
            if api_url=$("$legacy_resolver" --environment "$env_name" --output-format url 2>/dev/null); then
                if [[ -n "$api_url" ]]; then
                    print_status "Resolved API URL: $api_url"
                    echo "$api_url"
                    return 0
                fi
            fi
        fi

        return 1
    fi

    # Prepare arguments for API resolution service
    local resolver_args=(
        "--environment" "$env_name"
        "--output-format" "url"
    )

    # Add PR number if available
    if [[ -n "$PR_NUMBER" ]]; then
        resolver_args+=("--pr-number" "$PR_NUMBER")
    fi

    # Enable connectivity validation if requested
    if [[ "${VALIDATE_API_CONNECTIVITY:-false}" == "true" ]]; then
        resolver_args+=("--validate-connectivity")
    fi

    # Enable debug mode if set
    if [[ "${DEBUG:-false}" == "true" ]]; then
        resolver_args+=("--debug")
    fi

    # Run the API resolution service
    local api_url=""
    if api_url=$(bash "$resolver_script" "${resolver_args[@]}" 2>/dev/null); then
        if [[ -n "$api_url" && "$api_url" != "null" ]]; then
            print_status "API URL resolved: $api_url"
            echo "$api_url"
            return 0
        fi
    fi

    print_warning "Could not resolve API URL via API resolution service"
    return 1
}

# Function to get build metadata
get_build_metadata() {
    local build_timestamp=$(date -u '+%Y-%m-%d %H:%M:%S UTC')
    local build_commit="${GITHUB_SHA:-$(git rev-parse HEAD 2>/dev/null || echo "unknown")}"
    local build_branch="${GITHUB_REF_NAME:-$(git branch --show-current 2>/dev/null || echo "unknown")}"
    local build_pr="${PR_NUMBER:-${GITHUB_PR_NUMBER:-"unknown"}}"
    
    echo "$build_timestamp|$build_commit|$build_branch|$build_pr"
}

# Function to generate environment configuration
generate_environment_config() {
    local env_name="$1"
    local output_file="$2"
    
    print_info "Generating environment configuration for: $env_name"
    
    # Get build metadata
    local metadata=$(get_build_metadata)
    IFS='|' read -r build_timestamp build_commit build_branch build_pr <<< "$metadata"
    
    # Resolve API URL if not already set
    local api_url="${VITE_API_URL:-""}"
    if [[ -z "$api_url" ]]; then
        if api_url=$(resolve_api_url "$env_name"); then
            print_status "API URL resolved dynamically"
        else
            # Use environment-specific fallback
            case "$env_name" in
                "staging"|"stage")
                    api_url="https://api-staging.macro-ai.com/api"
                    ;;
                "production"|"prod")
                    api_url="https://api.macro-ai.com/api"
                    ;;
                *)
                    api_url="https://api-development.macro-ai.com/api"
                    ;;
            esac
            print_warning "Using fallback API URL: $api_url"
        fi
    else
        print_status "Using provided API URL: $api_url"
    fi
    
    # Create output directory if needed
    local output_dir=$(dirname "$output_file")
    if [[ "$output_dir" != "." && ! -d "$output_dir" ]]; then
        mkdir -p "$output_dir"
        print_debug "Created output directory: $output_dir"
    fi
    
    # Generate environment file
    cat > "$output_file" << EOF
# Frontend Preview Environment Configuration
# Generated on: $build_timestamp
# Environment: $env_name
# Build mode: $BUILD_MODE

# API Configuration
VITE_API_URL=$api_url
VITE_API_KEY=${VITE_API_KEY}

# Application Configuration
VITE_APP_ENV=$env_name
VITE_APP_NAME=${VITE_APP_NAME:-${DEFAULT_VALUES["VITE_APP_NAME"]}}
VITE_APP_VERSION=1.0.0-${env_name}

# Feature Flags
VITE_ENABLE_DEVTOOLS=${VITE_ENABLE_DEVTOOLS:-${DEFAULT_VALUES["VITE_ENABLE_DEVTOOLS"]}}
VITE_ENABLE_DEBUG_LOGGING=${VITE_ENABLE_DEBUG_LOGGING:-${DEFAULT_VALUES["VITE_ENABLE_DEBUG_LOGGING"]}}
VITE_PREVIEW_MODE=${VITE_PREVIEW_MODE:-${DEFAULT_VALUES["VITE_PREVIEW_MODE"]}}

# Preview-specific Configuration
VITE_PR_NUMBER=$build_pr
VITE_ENVIRONMENT_TYPE=$BUILD_MODE

# Build Metadata
VITE_BUILD_TIMESTAMP=$build_timestamp
VITE_BUILD_COMMIT=$build_commit
VITE_BUILD_BRANCH=$build_branch

# Runtime Configuration
VITE_NODE_ENV=${NODE_ENV:-production}
VITE_BUILD_MODE=$BUILD_MODE
EOF

    # Add mode-specific configurations
    case "$BUILD_MODE" in
        "preview")
            cat >> "$output_file" << EOF

# Preview Mode Specific
VITE_SHOW_BUILD_INFO=true
VITE_ENABLE_PERFORMANCE_MONITORING=true
VITE_ENABLE_ERROR_REPORTING=true
EOF
            ;;
        "staging")
            cat >> "$output_file" << EOF

# Staging Mode Specific
VITE_SHOW_BUILD_INFO=true
VITE_ENABLE_PERFORMANCE_MONITORING=true
VITE_ENABLE_ERROR_REPORTING=true
VITE_ENABLE_ANALYTICS=false
EOF
            ;;
        "production")
            cat >> "$output_file" << EOF

# Production Mode Specific
VITE_SHOW_BUILD_INFO=false
VITE_ENABLE_PERFORMANCE_MONITORING=false
VITE_ENABLE_ERROR_REPORTING=true
VITE_ENABLE_ANALYTICS=true
VITE_ENABLE_DEVTOOLS=false
VITE_ENABLE_DEBUG_LOGGING=false
EOF
            ;;
    esac
    
    print_status "Environment configuration generated: $output_file"
    
    # Display configuration summary
    echo ""
    print_info "Configuration Summary:"
    echo "  Environment: $env_name"
    echo "  Build Mode: $BUILD_MODE"
    echo "  API URL: $api_url"
    echo "  Output File: $output_file"
    echo "  Build Timestamp: $build_timestamp"
    echo "  Commit: ${build_commit:0:8}"
    echo ""
}

# Function to validate generated configuration
validate_configuration() {
    local config_file="$1"
    
    print_info "Validating generated configuration: $config_file"
    
    if [[ ! -f "$config_file" ]]; then
        print_error "Configuration file not found: $config_file"
        return 1
    fi
    
    # Source the configuration file
    set -a  # Export all variables
    source "$config_file"
    set +a  # Stop exporting
    
    local validation_errors=0
    
    # Validate required Vite variables
    local vite_required_vars=("VITE_API_URL" "VITE_API_KEY" "VITE_APP_ENV")
    
    for var in "${vite_required_vars[@]}"; do
        local var_value="${!var}"
        if [[ -z "$var_value" ]]; then
            print_error "Missing required Vite variable: $var"
            validation_errors=$((validation_errors + 1))
        else
            print_debug "Valid Vite variable: $var = $var_value"
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
    
    # Validate environment name format
    if [[ -n "$VITE_APP_ENV" ]]; then
        if [[ "$VITE_APP_ENV" =~ ^(pr-[0-9]+|staging|production|development)$ ]]; then
            print_status "Environment name format is valid"
        else
            print_warning "Non-standard environment name: $VITE_APP_ENV"
        fi
    fi
    
    return $validation_errors
}

# Function to display configuration
display_configuration() {
    local config_file="$1"
    
    if [[ ! -f "$config_file" ]]; then
        print_error "Configuration file not found: $config_file"
        return 1
    fi
    
    print_info "Configuration file contents:"
    echo ""
    
    # Display with syntax highlighting if available
    if command -v bat &> /dev/null; then
        bat --style=plain --language=bash "$config_file"
    elif command -v highlight &> /dev/null; then
        highlight -O ansi --syntax=bash "$config_file"
    else
        cat "$config_file"
    fi
    
    echo ""
}

# Main function
main() {
    local validate_only=false
    
    # Parse command line arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --pr-number)
                PR_NUMBER="$2"
                ENVIRONMENT_NAME="pr-$2"
                shift 2
                ;;
            --environment)
                ENVIRONMENT_NAME="$2"
                shift 2
                ;;
            --build-mode)
                BUILD_MODE="$2"
                shift 2
                ;;
            --output-file)
                OUTPUT_FILE="$2"
                shift 2
                ;;
            --validate-only)
                validate_only=true
                shift
                ;;
            --debug)
                DEBUG="true"
                shift
                ;;
            --help|-h)
                show_usage
                exit 0
                ;;
            *)
                print_error "Unknown option: $1"
                show_usage
                exit 1
                ;;
        esac
    done
    
    # Validate required parameters
    if [[ -z "$ENVIRONMENT_NAME" ]]; then
        print_error "Environment name is required (use --environment or --pr-number)"
        show_usage
        exit 1
    fi
    
    print_debug "Starting environment variable injection"
    print_debug "Environment: $ENVIRONMENT_NAME"
    print_debug "Build Mode: $BUILD_MODE"
    print_debug "Output File: $OUTPUT_FILE"
    
    # Validate required environment variables
    if ! validate_required_variables; then
        print_error "Environment validation failed"
        exit 1
    fi
    
    # If validate-only mode, exit after validation
    if [[ "$validate_only" == "true" ]]; then
        print_status "Environment validation completed successfully"
        exit 0
    fi
    
    # Generate environment configuration
    generate_environment_config "$ENVIRONMENT_NAME" "$OUTPUT_FILE"
    
    # Validate generated configuration
    if ! validate_configuration "$OUTPUT_FILE"; then
        print_error "Generated configuration validation failed"
        exit 1
    fi
    
    # Display configuration if in debug mode
    if [[ "${DEBUG:-false}" == "true" ]]; then
        display_configuration "$OUTPUT_FILE"
    fi
    
    print_status "🎉 Environment variable injection completed successfully!"
    print_info "Configuration file: $OUTPUT_FILE"
    print_info "Environment: $ENVIRONMENT_NAME"
    print_info "Build mode: $BUILD_MODE"
}

# Run main function
main "$@"
