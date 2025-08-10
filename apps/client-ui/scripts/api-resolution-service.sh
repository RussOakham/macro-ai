#!/bin/bash

# API Resolution Service for Frontend-Backend Integration
# High-level service that orchestrates backend discovery and API resolution

set -Eeuo pipefail
IFS=$'\n\t'

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DISCOVERY_SERVICE="${SCRIPT_DIR}/backend-discovery-service.sh"
CONFIG_FILE="${SCRIPT_DIR}/env-mapping.json"
DEBUG=${DEBUG:-"false"}

# Function to print status messages (all output to stderr to avoid contaminating JSON output)
print_status() {
    echo -e "${GREEN}✓${NC} $1" >&2
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1" >&2
}

print_error() {
    echo -e "${RED}✗${NC} $1" >&2
}

print_info() {
    echo -e "${CYAN}ℹ${NC} $1" >&2
}

print_debug() {
    if [[ "$DEBUG" == "true" ]]; then
        echo -e "${BLUE}🐛${NC} $1" >&2
    fi
}

# Function to show usage
show_usage() {
    echo "API Resolution Service for Frontend-Backend Integration"
    echo ""
    echo "Usage: $0 [options]"
    echo ""
    echo "Options:"
    echo "  --environment <env>         Target environment (required)"
    echo "  --pr-number <number>        PR number for preview environments"
    echo "  --output-format <format>    Output format: json|env|url (default: env)"
    echo "  --validate-connectivity     Enable API connectivity validation"
    echo "  --force-refresh             Force refresh of cached results"
    echo "  --fallback-only             Skip backend discovery, use fallback only"
    echo "  --region <region>           AWS region (default: us-east-1)"
    echo "  --timeout <seconds>         API validation timeout (default: 10)"
    echo "  --debug                     Enable debug output"
    echo "  --help                      Show this help message"
    echo ""
    echo "Environment Variables:"
    echo "  ENVIRONMENT_NAME            Target environment"
    echo "  PR_NUMBER                   Pull request number"
    echo "  AWS_REGION                  AWS region"
    echo "  VITE_API_KEY               API authentication key"
    echo "  FALLBACK_API_URL           Custom fallback API URL"
    echo ""
    echo "Examples:"
    echo "  $0 --environment pr-123 --pr-number 123"
    echo "  $0 --environment staging --validate-connectivity"
    echo "  $0 --environment production --output-format json"
    echo "  $0 --environment pr-456 --pr-number 456 --force-refresh"
}

# Function to validate dependencies
validate_dependencies() {
    print_debug "Validating dependencies"
    
    # Check if backend discovery service exists (only when not in fallback-only mode)
    if [[ "${FALLBACK_ONLY:-false}" != "true" ]]; then
        if [[ ! -f "$BACKEND_DISCOVERY_SERVICE" ]]; then
            print_error "Backend discovery service not found: $BACKEND_DISCOVERY_SERVICE"
            exit 1
        fi
    fi

    # Check if configuration file exists
    if [[ ! -f "$CONFIG_FILE" ]]; then
        print_error "Configuration file not found: $CONFIG_FILE"
        exit 1
    fi
    
    # Check required tools
    local required_tools=("jq" "curl")
    if [[ "${FALLBACK_ONLY:-false}" != "true" ]]; then
        required_tools+=("aws")
    fi
    for tool in "${required_tools[@]}"; do
        if ! command -v "$tool" &> /dev/null; then
            print_error "Required tool not found: $tool"
            exit 1
        fi
    done

    print_debug "All dependencies validated"
}

# Function to load environment configuration
load_environment_config() {
    local environment="$1"
    
    print_debug "Loading environment configuration for: $environment"
    
    # Determine environment type
    local env_type="development"
    if [[ "$environment" =~ ^pr-[0-9]+$ ]]; then
        env_type="preview"
    elif [[ "$environment" =~ ^(staging|stage)$ ]]; then
        env_type="staging"
    elif [[ "$environment" =~ ^(production|prod)$ ]]; then
        env_type="production"
    fi
    
    # Load configuration from JSON
    local config=$(jq -r ".environments.${env_type} // .environments.development" "$CONFIG_FILE")
    
    if [[ "$config" == "null" ]]; then
        print_warning "No configuration found for environment type: $env_type"
        config='{}'
    fi
    
    echo "$config"
}

# Function to resolve API with multiple strategies
resolve_api_with_strategies() {
    local environment="$1"
    local pr_number="$2"
    local validate_connectivity="$3"
    local force_refresh="$4"
    local fallback_only="$5"
    
    print_info "Resolving API for environment: $environment"
    
    local resolution_result='{
        "environment": "'$environment'",
        "pr_number": "'${pr_number:-null}'",
        "resolved_at": "'$(date -u '+%Y-%m-%d %H:%M:%S UTC')'",
        "strategies_attempted": [],
        "final_api_url": null,
        "resolution_method": null,
        "backend_stack": null,
        "validation": {
            "performed": false,
            "status": null,
            "response_time_ms": null
        },
        "fallback_used": false,
        "success": false
    }'
    
    # Strategy 1: Backend Discovery (unless fallback-only)
    if [[ "$fallback_only" != "true" ]]; then
        print_debug "Strategy 1: Backend Discovery"
        
        local discovery_args=(
            "discover" "$environment"
            "--output-format" "json"
        )
        
        if [[ -n "$pr_number" ]]; then
            discovery_args+=("--pr-number" "$pr_number")
        fi

        if [[ "$validate_connectivity" == "true" ]]; then
            discovery_args+=("--validate-connectivity")
        fi

        if [[ "$force_refresh" == "true" ]]; then
            discovery_args+=("--cache-ttl" "0")
        fi

        if [[ -n "$aws_region" ]]; then
            discovery_args+=("--region" "$aws_region")
        fi

        if [[ "$DEBUG" == "true" ]]; then
            discovery_args+=("--debug")
        fi

        local discovery_result=""
        # Capture JSON from stdout only; send stderr to debug
        if discovery_result="$(
            bash "$BACKEND_DISCOVERY_SERVICE" "${discovery_args[@]}" \
                2> >(while read -r line; do print_debug "discovery: $line"; done)
        )"; then
            # Check if the result is valid JSON
            if echo "$discovery_result" | jq . >/dev/null 2>&1; then
                local backend_found
                backend_found="$(echo "$discovery_result" | jq -r '.backend_found // false')"
                local api_endpoint
                api_endpoint="$(echo "$discovery_result" | jq -r '.api_endpoint // null')"

                if [[ "$backend_found" == "true" && -n "$api_endpoint" && "$api_endpoint" != "null" ]]; then
                    resolution_result=$(echo "$resolution_result" | jq \
                        --arg api_url "$api_endpoint" \
                        --arg method "backend_discovery" \
                        --arg stack "$(echo "$discovery_result" | jq -r '.stack_name // "unknown"')" \
                        --argjson validation "$(echo "$discovery_result" | jq '.validation // {}')" \
                        '.strategies_attempted += ["backend_discovery"] |
                         .final_api_url = $api_url |
                         .resolution_method = $method |
                         .backend_stack = $stack |
                         .validation = $validation |
                         .success = true')

                    print_status "Backend discovery successful: $api_endpoint"
                else
                    resolution_result=$(echo "$resolution_result" | jq '.strategies_attempted += ["backend_discovery"]')
                    print_debug "Backend discovery failed or no backend found"
                fi
            else
                resolution_result=$(echo "$resolution_result" | jq '.strategies_attempted += ["backend_discovery"]')
                print_debug "Backend discovery service returned invalid JSON: $discovery_result"
            fi
        else
            resolution_result=$(echo "$resolution_result" | jq '.strategies_attempted += ["backend_discovery"]')
            print_debug "Backend discovery service failed with exit code: $?"
        fi
    fi
    
    # Strategy 2: Environment-specific fallback (if backend discovery failed)
    if [[ "$(echo "$resolution_result" | jq -r '.success')" == "false" ]]; then
        print_debug "Strategy 2: Environment-specific fallback"
        
        local env_config=$(load_environment_config "$environment")
        local fallback_url=$(echo "$env_config" | jq -r '.fallback_api_url // "https://api-development.macro-ai.com/api"')
        
        # Override with custom fallback if provided
        if [[ -n "${FALLBACK_API_URL:-}" ]]; then
            fallback_url="$FALLBACK_API_URL"
        fi
        
        resolution_result=$(echo "$resolution_result" | jq \
            --arg api_url "$fallback_url" \
            --arg method "environment_fallback" \
            '.strategies_attempted += ["environment_fallback"] |
             .final_api_url = $api_url |
             .resolution_method = $method |
             .fallback_used = true |
             .success = true')
        
        print_warning "Using environment fallback: $fallback_url"
        
        # Validate fallback if requested
        if [[ "$validate_connectivity" == "true" ]]; then
            local validation_result
            validation_result="$(bash "$BACKEND_DISCOVERY_SERVICE" validate "$fallback_url" --timeout "$timeout" 2>/dev/null || echo '{"connectivity_checked": false}')"
            resolution_result=$(echo "$resolution_result" | jq \
                --argjson validation "$validation_result" \
                '.validation = $validation')
        fi
    fi

    # Strategy 3: Final fallback (if all else fails)
    if [[ "$(echo "$resolution_result" | jq -r '.success')" == "false" ]]; then
        print_debug "Strategy 3: Final fallback"

        local final_fallback_url="https://api-development.macro-ai.com/api"

        resolution_result=$(echo "$resolution_result" | jq \
            --arg api_url "$final_fallback_url" \
            --arg method "final_fallback" \
            '.strategies_attempted += ["final_fallback"] |
             .final_api_url = $api_url |
             .resolution_method = $method |
             .fallback_used = true |
             .success = true')

        print_warning "Using final fallback URL: $final_fallback_url"
    fi

    echo "$resolution_result"
}

# Function to format output
format_output() {
    local resolution_result="$1"
    local output_format="$2"
    local environment="$3"
    local output_file="$4"

    local output_content=""

    case "$output_format" in
        "json")
            output_content=$(echo "$resolution_result" | jq .)
            ;;
        "env")
            local api_url=$(echo "$resolution_result" | jq -r '.final_api_url')
            local resolution_method=$(echo "$resolution_result" | jq -r '.resolution_method')
            local backend_stack=$(echo "$resolution_result" | jq -r '.backend_stack // "none"')
            local fallback_used=$(echo "$resolution_result" | jq -r '.fallback_used')
            local resolved_at=$(echo "$resolution_result" | jq -r '.resolved_at')
            
            output_content=$(cat << EOF
# API Resolution Results
# Generated on: $resolved_at
# Environment: $environment
# Resolution method: $resolution_method
# Fallback used: $fallback_used

VITE_API_URL=$api_url
VITE_API_RESOLUTION_METHOD=$resolution_method
VITE_BACKEND_STACK_NAME=$backend_stack
VITE_API_FALLBACK_USED=$fallback_used
VITE_API_RESOLVED_AT=$resolved_at
EOF
)
            ;;
        "url")
            output_content=$(echo "$resolution_result" | jq -r '.final_api_url')
            ;;
        *)
            print_error "Invalid output format: $output_format"
            exit 1
            ;;
    esac

    # Output to file or stdout
    if [[ -n "$output_file" ]]; then
        echo "$output_content" > "$output_file"
        print_debug "Output written to: $output_file"
    else
        echo "$output_content"
    fi
}

# Function to log resolution summary
log_resolution_summary() {
    local resolution_result="$1"
    
    local environment=$(echo "$resolution_result" | jq -r '.environment')
    local api_url=$(echo "$resolution_result" | jq -r '.final_api_url')
    local method=$(echo "$resolution_result" | jq -r '.resolution_method')
    local success=$(echo "$resolution_result" | jq -r '.success')
    local strategies=$(echo "$resolution_result" | jq -r '.strategies_attempted | join(", ")')
    
    print_info "=== API Resolution Summary ===" >&2
    print_info "Environment: $environment" >&2
    print_info "Success: $success" >&2
    print_info "Final API URL: $api_url" >&2
    print_info "Resolution Method: $method" >&2
    print_info "Strategies Attempted: $strategies" >&2
    
    # Validation summary
    local validation_performed=$(echo "$resolution_result" | jq -r '.validation.performed // false')
    if [[ "$validation_performed" == "true" ]]; then
        local validation_status=$(echo "$resolution_result" | jq -r '.validation.status // "unknown"')
        local response_time=$(echo "$resolution_result" | jq -r '.validation.response_time_ms // "unknown"')
        print_info "Validation Status: $validation_status" >&2
        print_info "Response Time: ${response_time}ms" >&2
    fi
    
    print_info "===============================" >&2
}

# Main function
main() {
    local environment="${ENVIRONMENT_NAME:-}"
    local pr_number="${PR_NUMBER:-}"
    local output_format="env"
    local output_file=""
    local validate_connectivity="false"
    local force_refresh="false"
    local fallback_only="false"
    local aws_region="${AWS_REGION:-us-east-1}"
    local timeout="10"
    
    # Parse command line arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --environment)
                environment="$2"
                shift 2
                ;;
            --pr-number)
                pr_number="$2"
                shift 2
                ;;
            --output-format)
                output_format="$2"
                shift 2
                ;;
            --output-file)
                output_file="$2"
                shift 2
                ;;
            --validate-connectivity)
                validate_connectivity="true"
                shift
                ;;
            --force-refresh)
                force_refresh="true"
                shift
                ;;
            --fallback-only)
                fallback_only="true"
                shift
                ;;
            --region)
                aws_region="$2"
                shift 2
                ;;
            --timeout)
                timeout="$2"
                shift 2
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
    if [[ -z "$environment" ]]; then
        print_error "Environment is required (use --environment or set ENVIRONMENT_NAME)"
        show_usage
        exit 1
    fi
    
    # Export environment variables for child processes
    export AWS_REGION="$aws_region"
    export DEBUG
    export FALLBACK_ONLY="$fallback_only"

    print_debug "Starting API resolution for environment: $environment"

    # Validate dependencies (after args and with FALLBACK_ONLY awareness)
    validate_dependencies

    # Resolve API with multiple strategies
    local resolution_result=$(resolve_api_with_strategies "$environment" "$pr_number" "$validate_connectivity" "$force_refresh" "$fallback_only")
    
    # Check if resolution was successful
    local success=$(echo "$resolution_result" | jq -r '.success')
    if [[ "$success" != "true" ]]; then
        print_error "API resolution failed for environment: $environment, using emergency fallback"

        # Emergency fallback - create a minimal successful result
        resolution_result='{
            "environment": "'$environment'",
            "pr_number": "'${pr_number:-null}'",
            "resolved_at": "'$(date -u '+%Y-%m-%d %H:%M:%S UTC')'",
            "strategies_attempted": ["emergency_fallback"],
            "final_api_url": "https://api-development.macro-ai.com/api",
            "resolution_method": "emergency_fallback",
            "backend_stack": null,
            "validation": {
                "performed": false,
                "status": null,
                "response_time_ms": null
            },
            "fallback_used": true,
            "success": true
        }'
    fi
    
    # Format and output results
    format_output "$resolution_result" "$output_format" "$environment" "$output_file"
    
    # Log summary to stderr (doesn't interfere with output)
    log_resolution_summary "$resolution_result"
}

# Run main function
main "$@"
