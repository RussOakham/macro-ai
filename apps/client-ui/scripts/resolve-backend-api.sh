#!/bin/bash

# Backend API Resolution Script for Frontend Preview Environments
# Dynamically resolves backend API endpoints for frontend preview deployments

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
PR_NUMBER=${PR_NUMBER:-""}
ENVIRONMENT_NAME=${ENVIRONMENT_NAME:-""}
AWS_REGION=${AWS_REGION:-"us-east-1"}
FALLBACK_API_URL=${FALLBACK_API_URL:-"https://api-development.macro-ai.com/api"}

# Backend stack naming convention
BACKEND_STACK_PREFIX="MacroAi"
BACKEND_STACK_SUFFIX="Stack"

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
    echo "Backend API Resolution for Frontend Preview Environments"
    echo ""
    echo "Usage: $0 [options]"
    echo ""
    echo "Options:"
    echo "  --pr-number <number>        PR number for environment resolution"
    echo "  --environment <name>        Environment name (e.g., pr-123, staging, production)"
    echo "  --region <region>           AWS region (default: us-east-1)"
    echo "  --fallback-url <url>        Fallback API URL if backend not found"
    echo "  --output-format <format>    Output format: env|json|url (default: env)"
    echo "  --debug                     Enable debug output"
    echo "  --help                      Show this help message"
    echo ""
    echo "Environment Variables:"
    echo "  PR_NUMBER                   Pull request number"
    echo "  ENVIRONMENT_NAME            Environment name"
    echo "  AWS_REGION                  AWS region"
    echo "  FALLBACK_API_URL            Fallback API URL"
    echo "  DEBUG                       Enable debug mode"
    echo ""
    echo "Examples:"
    echo "  $0 --pr-number 123"
    echo "  $0 --environment pr-123 --output-format json"
    echo "  $0 --pr-number 123 --fallback-url https://api.example.com/api"
}

# Function to normalize environment name
normalize_environment_name() {
    local env_name="$1"
    
    # Convert to title case for stack naming (e.g., pr-123 -> Pr123)
    if [[ "$env_name" =~ ^pr-([0-9]+)$ ]]; then
        echo "Pr${BASH_REMATCH[1]}"
    elif [[ "$env_name" == "staging" ]]; then
        echo "Staging"
    elif [[ "$env_name" == "production" ]]; then
        echo "Production"
    elif [[ "$env_name" == "development" ]]; then
        echo "Development"
    else
        # Generic normalization: capitalize first letter, remove hyphens
        echo "$(echo "$env_name" | sed 's/-//g' | awk '{print toupper(substr($0,1,1)) tolower(substr($0,2))}')"
    fi
}

# Function to resolve backend stack name
resolve_backend_stack_name() {
    local env_name="$1"
    local normalized_env=$(normalize_environment_name "$env_name")
    echo "${BACKEND_STACK_PREFIX}${normalized_env}${BACKEND_STACK_SUFFIX}"
}

# Function to check if CloudFormation stack exists
check_stack_exists() {
    local stack_name="$1"
    
    print_debug "Checking if stack exists: $stack_name"
    
    local stack_status=$(aws cloudformation describe-stacks \
        --stack-name "$stack_name" \
        --query 'Stacks[0].StackStatus' \
        --output text 2>/dev/null || echo "DOES_NOT_EXIST")
    
    print_debug "Stack status: $stack_status"
    
    case "$stack_status" in
        "CREATE_COMPLETE"|"UPDATE_COMPLETE")
            echo "true"
            ;;
        "DOES_NOT_EXIST")
            echo "false"
            ;;
        *)
            print_debug "Stack in transitional state: $stack_status"
            echo "false"
            ;;
    esac
}

# Function to get API endpoint from CloudFormation stack
get_api_endpoint_from_stack() {
    local stack_name="$1"
    
    print_debug "Getting API endpoint from stack: $stack_name"
    
    local api_endpoint=$(aws cloudformation describe-stacks \
        --stack-name "$stack_name" \
        --query 'Stacks[0].Outputs[?OutputKey==`ApiEndpoint`].OutputValue' \
        --output text 2>/dev/null || echo "")
    
    if [[ -n "$api_endpoint" && "$api_endpoint" != "None" ]]; then
        print_debug "Found API endpoint: $api_endpoint"
        echo "$api_endpoint"
    else
        print_debug "No API endpoint found in stack outputs"
        echo ""
    fi
}

# Function to resolve API URL with multiple strategies
resolve_api_url() {
    local env_name="$1"
    local api_url=""
    local resolution_method=""
    
    print_info "Resolving API URL for environment: $env_name"
    
    # Strategy 1: Direct environment-based stack lookup
    local stack_name=$(resolve_backend_stack_name "$env_name")
    print_debug "Trying stack name: $stack_name"
    
    if [[ "$(check_stack_exists "$stack_name")" == "true" ]]; then
        local endpoint=$(get_api_endpoint_from_stack "$stack_name")
        if [[ -n "$endpoint" ]]; then
            api_url="${endpoint}api"
            resolution_method="direct_stack"
            print_status "Found backend via direct stack lookup: $stack_name"
        fi
    fi
    
    # Strategy 2: Try alternative stack naming patterns
    if [[ -z "$api_url" && "$env_name" =~ ^pr-([0-9]+)$ ]]; then
        local pr_num="${BASH_REMATCH[1]}"
        local alt_patterns=(
            "MacroAiPr${pr_num}Stack"
            "MacroAiPreview${pr_num}Stack"
            "MacroAiDev${pr_num}Stack"
            "macro-ai-pr-${pr_num}"
        )
        
        for pattern in "${alt_patterns[@]}"; do
            print_debug "Trying alternative pattern: $pattern"
            if [[ "$(check_stack_exists "$pattern")" == "true" ]]; then
                local endpoint=$(get_api_endpoint_from_stack "$pattern")
                if [[ -n "$endpoint" ]]; then
                    api_url="${endpoint}api"
                    resolution_method="alternative_pattern"
                    print_status "Found backend via alternative pattern: $pattern"
                    break
                fi
            fi
        done
    fi
    
    # Strategy 3: Environment-specific fallbacks
    if [[ -z "$api_url" ]]; then
        case "$env_name" in
            "staging"|"stage")
                api_url="https://api-staging.macro-ai.com/api"
                resolution_method="staging_fallback"
                print_warning "Using staging fallback API"
                ;;
            "production"|"prod")
                api_url="https://api.macro-ai.com/api"
                resolution_method="production_fallback"
                print_warning "Using production fallback API"
                ;;
            "development"|"dev")
                api_url="https://api-development.macro-ai.com/api"
                resolution_method="development_fallback"
                print_warning "Using development fallback API"
                ;;
            *)
                api_url="$FALLBACK_API_URL"
                resolution_method="generic_fallback"
                print_warning "Using generic fallback API: $FALLBACK_API_URL"
                ;;
        esac
    fi
    
    # Output resolution results
    echo "$api_url|$resolution_method|$stack_name"
}

# Function to validate API endpoint
validate_api_endpoint() {
    local api_url="$1"
    
    print_info "Validating API endpoint: $api_url"
    
    # Basic URL format validation
    if [[ ! "$api_url" =~ ^https?:// ]]; then
        print_error "Invalid API URL format: $api_url"
        return 1
    fi
    
    # Optional: Test connectivity (can be disabled for speed)
    if [[ "${VALIDATE_CONNECTIVITY:-false}" == "true" ]]; then
        local http_status=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$api_url" 2>/dev/null || echo "000")
        
        case "$http_status" in
            "200"|"404"|"401"|"403")
                print_status "API endpoint is accessible (HTTP $http_status)"
                ;;
            "000")
                print_warning "API endpoint connectivity test failed"
                ;;
            *)
                print_warning "API endpoint returned HTTP $http_status"
                ;;
        esac
    fi
    
    return 0
}

# Function to generate environment variables
generate_environment_variables() {
    local api_url="$1"
    local resolution_method="$2"
    local stack_name="$3"
    local env_name="$4"
    
    cat << EOF
# Backend API Configuration
# Generated on: $(date -u '+%Y-%m-%d %H:%M:%S UTC')
# Environment: $env_name
# Resolution method: $resolution_method
# Stack name: $stack_name

VITE_API_URL=$api_url
VITE_API_RESOLUTION_METHOD=$resolution_method
VITE_BACKEND_STACK_NAME=$stack_name
VITE_API_RESOLVED_AT=$(date -u '+%Y-%m-%d %H:%M:%S UTC')
EOF
}

# Function to generate JSON output
generate_json_output() {
    local api_url="$1"
    local resolution_method="$2"
    local stack_name="$3"
    local env_name="$4"
    
    cat << EOF
{
  "api_url": "$api_url",
  "resolution_method": "$resolution_method",
  "backend_stack_name": "$stack_name",
  "environment_name": "$env_name",
  "resolved_at": "$(date -u '+%Y-%m-%d %H:%M:%S UTC')",
  "aws_region": "$AWS_REGION",
  "fallback_url": "$FALLBACK_API_URL"
}
EOF
}

# Main resolution function
main() {
    local output_format="env"
    
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
            --region)
                AWS_REGION="$2"
                shift 2
                ;;
            --fallback-url)
                FALLBACK_API_URL="$2"
                shift 2
                ;;
            --output-format)
                output_format="$2"
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
    if [[ -z "$ENVIRONMENT_NAME" ]]; then
        print_error "Environment name is required (use --environment or --pr-number)"
        show_usage
        exit 1
    fi
    
    # Validate AWS CLI
    if ! command -v aws &> /dev/null; then
        print_error "AWS CLI not found. Please install AWS CLI."
        exit 1
    fi
    
    if ! aws sts get-caller-identity &> /dev/null; then
        print_error "AWS credentials not configured or invalid"
        exit 1
    fi
    
    print_debug "Starting API resolution for environment: $ENVIRONMENT_NAME"
    print_debug "AWS Region: $AWS_REGION"
    print_debug "Fallback URL: $FALLBACK_API_URL"
    
    # Resolve API URL
    local resolution_result=$(resolve_api_url "$ENVIRONMENT_NAME")
    IFS='|' read -r api_url resolution_method stack_name <<< "$resolution_result"
    
    # Validate the resolved API URL
    if ! validate_api_endpoint "$api_url"; then
        print_error "API endpoint validation failed"
        exit 1
    fi
    
    # Generate output based on format
    case "$output_format" in
        "env")
            generate_environment_variables "$api_url" "$resolution_method" "$stack_name" "$ENVIRONMENT_NAME"
            ;;
        "json")
            generate_json_output "$api_url" "$resolution_method" "$stack_name" "$ENVIRONMENT_NAME"
            ;;
        "url")
            echo "$api_url"
            ;;
        *)
            print_error "Invalid output format: $output_format"
            exit 1
            ;;
    esac
    
    # Log resolution summary to stderr (so it doesn't interfere with output)
    print_info "✅ API resolution completed successfully" >&2
    print_info "Environment: $ENVIRONMENT_NAME" >&2
    print_info "API URL: $api_url" >&2
    print_info "Method: $resolution_method" >&2
}

# Run main function
main "$@"
