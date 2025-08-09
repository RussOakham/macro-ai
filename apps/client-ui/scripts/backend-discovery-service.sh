#!/bin/bash

# Backend Discovery Service for Frontend-Backend Integration
# Advanced service for discovering and validating backend API endpoints

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_FILE="${SCRIPT_DIR}/env-mapping.json"
CACHE_DIR="${SCRIPT_DIR}/.cache"
CACHE_TTL=${CACHE_TTL:-300}  # 5 minutes default cache TTL
AWS_REGION=${AWS_REGION:-"us-east-1"}
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
    echo "Backend Discovery Service for Frontend-Backend Integration"
    echo ""
    echo "Usage: $0 [command] [options]"
    echo ""
    echo "Commands:"
    echo "  discover <environment>      Discover backend for environment"
    echo "  validate <api-url>          Validate API endpoint"
    echo "  cache-clear                 Clear discovery cache"
    echo "  list-stacks                 List available backend stacks"
    echo "  health-check <api-url>      Perform comprehensive health check"
    echo ""
    echo "Options:"
    echo "  --pr-number <number>        PR number for preview environments"
    echo "  --region <region>           AWS region (default: us-east-1)"
    echo "  --cache-ttl <seconds>       Cache TTL in seconds (default: 300)"
    echo "  --output-format <format>    Output format: json|env|url (default: json)"
    echo "  --validate-connectivity     Enable connectivity validation"
    echo "  --debug                     Enable debug output"
    echo "  --help                      Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 discover pr-123 --pr-number 123"
    echo "  $0 validate https://api.example.com/api"
    echo "  $0 health-check https://api.example.com/api"
    echo "  $0 list-stacks --region us-east-1"
}

# Function to load configuration
load_configuration() {
    if [[ ! -f "$CONFIG_FILE" ]]; then
        print_error "Configuration file not found: $CONFIG_FILE"
        exit 1
    fi
    
    print_debug "Loading configuration from: $CONFIG_FILE"
}

# Function to setup cache directory
setup_cache() {
    if [[ ! -d "$CACHE_DIR" ]]; then
        mkdir -p "$CACHE_DIR"
        print_debug "Created cache directory: $CACHE_DIR"
    fi
}

# Function to get cache key
get_cache_key() {
    local environment="$1"
    local pr_number="$2"
    echo "${environment}-${pr_number:-none}-${AWS_REGION}"
}

# Function to check cache
check_cache() {
    local cache_key="$1"
    local cache_file="${CACHE_DIR}/${cache_key}.json"
    
    if [[ -f "$cache_file" ]]; then
        local cache_age=$(($(date +%s) - $(stat -f %m "$cache_file" 2>/dev/null || stat -c %Y "$cache_file" 2>/dev/null || echo 0)))
        
        if [[ $cache_age -lt $CACHE_TTL ]]; then
            print_debug "Cache hit for key: $cache_key (age: ${cache_age}s)"
            cat "$cache_file"
            return 0
        else
            print_debug "Cache expired for key: $cache_key (age: ${cache_age}s)"
            rm -f "$cache_file"
        fi
    fi
    
    print_debug "Cache miss for key: $cache_key"
    return 1
}

# Function to save to cache
save_to_cache() {
    local cache_key="$1"
    local data="$2"
    local cache_file="${CACHE_DIR}/${cache_key}.json"
    
    echo "$data" > "$cache_file"
    print_debug "Saved to cache: $cache_key"
}

# Function to clear cache
clear_cache() {
    if [[ -d "$CACHE_DIR" ]]; then
        rm -rf "${CACHE_DIR}"/*
        print_status "Cache cleared"
    else
        print_info "Cache directory does not exist"
    fi
}

# Function to get backend stack patterns for environment
get_backend_patterns() {
    local environment="$1"
    local pr_number="$2"
    
    print_debug "Getting backend patterns for environment: $environment"
    
    # Load patterns from configuration
    local patterns=()
    
    if [[ "$environment" =~ ^pr-([0-9]+)$ ]]; then
        local pr_num="${BASH_REMATCH[1]}"
        patterns=(
            "MacroAiPr${pr_num}Stack"
            "MacroAiPreview${pr_num}Stack"
            "MacroAiDev${pr_num}Stack"
            "macro-ai-pr-${pr_num}"
            "MacroAi${environment^}Stack"
        )
    else
        case "$environment" in
            "development"|"dev")
                patterns=("MacroAiDevelopmentStack" "MacroAiDevStack")
                ;;
            "staging"|"stage")
                patterns=("MacroAiStagingStack" "MacroAiStageStack")
                ;;
            "production"|"prod")
                patterns=("MacroAiProductionStack" "MacroAiProdStack")
                ;;
            *)
                patterns=("MacroAi${environment^}Stack")
                ;;
        esac
    fi
    
    printf '%s\n' "${patterns[@]}"
}

# Function to check if CloudFormation stack exists and get status
check_stack_status() {
    local stack_name="$1"
    
    print_debug "Checking stack status: $stack_name"
    
    local stack_info=$(aws cloudformation describe-stacks \
        --stack-name "$stack_name" \
        --query 'Stacks[0].{Status:StackStatus,Outputs:Outputs}' \
        --output json 2>/dev/null || echo "null")
    
    if [[ "$stack_info" == "null" ]]; then
        echo '{"exists": false, "status": "DOES_NOT_EXIST"}'
    else
        local status=$(echo "$stack_info" | jq -r '.Status')
        local outputs=$(echo "$stack_info" | jq '.Outputs // []')
        
        echo "{\"exists\": true, \"status\": \"$status\", \"outputs\": $outputs}"
    fi
}

# Function to extract API endpoint from stack outputs
extract_api_endpoint() {
    local stack_outputs="$1"
    
    print_debug "Extracting API endpoint from stack outputs"
    
    # Try multiple possible output keys
    local endpoint_keys=("ApiEndpoint" "ApiGatewayUrl" "RestApiUrl" "ApiUrl")
    
    for key in "${endpoint_keys[@]}"; do
        local endpoint=$(echo "$stack_outputs" | jq -r ".[] | select(.OutputKey == \"$key\") | .OutputValue" 2>/dev/null || echo "")
        
        if [[ -n "$endpoint" && "$endpoint" != "null" ]]; then
            print_debug "Found API endpoint via key '$key': $endpoint"
            echo "$endpoint"
            return 0
        fi
    done
    
    print_debug "No API endpoint found in stack outputs"
    return 1
}

# Function to discover backend for environment
discover_backend() {
    local environment="$1"
    local pr_number="$2"
    local validate_connectivity="$3"
    
    print_info "Discovering backend for environment: $environment"
    
    # Check cache first
    local cache_key=$(get_cache_key "$environment" "$pr_number")
    if cached_result=$(check_cache "$cache_key"); then
        echo "$cached_result"
        return 0
    fi
    
    # Get backend stack patterns
    local patterns=($(get_backend_patterns "$environment" "$pr_number"))
    
    local discovery_result='{
        "environment": "'$environment'",
        "pr_number": "'${pr_number:-null}'",
        "discovered_at": "'$(date -u '+%Y-%m-%d %H:%M:%S UTC')'",
        "region": "'$AWS_REGION'",
        "backend_found": false,
        "api_endpoint": null,
        "stack_name": null,
        "stack_status": null,
        "resolution_method": null,
        "fallback_url": null,
        "validation": {
            "connectivity_checked": false,
            "connectivity_status": null,
            "response_time_ms": null
        }
    }'
    
    # Try each pattern
    for pattern in "${patterns[@]}"; do
        print_debug "Trying stack pattern: $pattern"
        
        local stack_status=$(check_stack_status "$pattern")
        local exists=$(echo "$stack_status" | jq -r '.exists')
        local status=$(echo "$stack_status" | jq -r '.status')
        
        if [[ "$exists" == "true" && "$status" =~ ^(CREATE_COMPLETE|UPDATE_COMPLETE)$ ]]; then
            local outputs=$(echo "$stack_status" | jq '.outputs')
            
            if api_endpoint=$(extract_api_endpoint "$outputs"); then
                # Ensure API endpoint ends with /api if not already
                if [[ ! "$api_endpoint" =~ /api/?$ ]]; then
                    api_endpoint="${api_endpoint%/}/api"
                fi
                
                discovery_result=$(echo "$discovery_result" | jq \
                    --arg endpoint "$api_endpoint" \
                    --arg stack "$pattern" \
                    --arg status "$status" \
                    --arg method "direct_stack_discovery" \
                    '.backend_found = true |
                     .api_endpoint = $endpoint |
                     .stack_name = $stack |
                     .stack_status = $status |
                     .resolution_method = $method')
                
                print_status "Backend discovered: $pattern -> $api_endpoint"
                break
            fi
        fi
    done
    
    # If no backend found, set fallback URL
    if [[ "$(echo "$discovery_result" | jq -r '.backend_found')" == "false" ]]; then
        local fallback_url=$(get_fallback_url "$environment")
        discovery_result=$(echo "$discovery_result" | jq \
            --arg fallback "$fallback_url" \
            --arg method "fallback_url" \
            '.api_endpoint = $fallback |
             .fallback_url = $fallback |
             .resolution_method = $method')
        
        print_warning "No backend stack found, using fallback: $fallback_url"
    fi
    
    # Validate connectivity if requested
    if [[ "$validate_connectivity" == "true" ]]; then
        local api_endpoint=$(echo "$discovery_result" | jq -r '.api_endpoint')
        if [[ -n "$api_endpoint" && "$api_endpoint" != "null" ]]; then
            local validation_result=$(validate_api_connectivity "$api_endpoint")
            discovery_result=$(echo "$discovery_result" | jq \
                --argjson validation "$validation_result" \
                '.validation = $validation')
        fi
    fi
    
    # Save to cache
    save_to_cache "$cache_key" "$discovery_result"
    
    echo "$discovery_result"
}

# Function to get fallback URL for environment
get_fallback_url() {
    local environment="$1"
    
    case "$environment" in
        "staging"|"stage")
            echo "https://api-staging.macro-ai.com/api"
            ;;
        "production"|"prod")
            echo "https://api.macro-ai.com/api"
            ;;
        *)
            echo "https://api-development.macro-ai.com/api"
            ;;
    esac
}

# Function to validate API connectivity
validate_api_connectivity() {
    local api_url="$1"
    
    print_debug "Validating API connectivity: $api_url"
    
    local start_time=$(date +%s%3N)
    local http_status=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$api_url/health" 2>/dev/null || echo "000")
    local end_time=$(date +%s%3N)
    local response_time=$((end_time - start_time))
    
    local connectivity_status="unknown"
    case "$http_status" in
        "200"|"404"|"401"|"403")
            connectivity_status="accessible"
            ;;
        "000")
            connectivity_status="unreachable"
            ;;
        *)
            connectivity_status="error"
            ;;
    esac
    
    echo "{
        \"connectivity_checked\": true,
        \"connectivity_status\": \"$connectivity_status\",
        \"http_status\": \"$http_status\",
        \"response_time_ms\": $response_time
    }"
}

# Function to list available backend stacks
list_backend_stacks() {
    print_info "Listing available backend stacks in region: $AWS_REGION"
    
    local stacks=$(aws cloudformation list-stacks \
        --stack-status-filter CREATE_COMPLETE UPDATE_COMPLETE \
        --query 'StackSummaries[?contains(StackName, `MacroAi`)].{Name:StackName,Status:StackStatus,Created:CreationTime}' \
        --output json)
    
    echo "$stacks" | jq -r '.[] | "\(.Name) (\(.Status)) - Created: \(.Created)"'
}

# Main function
main() {
    local command=""
    local environment=""
    local pr_number=""
    local api_url=""
    local output_format="json"
    local validate_connectivity="false"
    
    # Parse command line arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            discover|validate|cache-clear|list-stacks|health-check)
                command="$1"
                if [[ "$command" == "discover" || "$command" == "validate" || "$command" == "health-check" ]]; then
                    environment="$2"
                    api_url="$2"
                    shift
                fi
                shift
                ;;
            --pr-number)
                pr_number="$2"
                shift 2
                ;;
            --region)
                AWS_REGION="$2"
                shift 2
                ;;
            --cache-ttl)
                CACHE_TTL="$2"
                shift 2
                ;;
            --output-format)
                output_format="$2"
                shift 2
                ;;
            --validate-connectivity)
                validate_connectivity="true"
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
    
    # Validate AWS CLI
    if ! command -v aws &> /dev/null; then
        print_error "AWS CLI not found. Please install AWS CLI."
        exit 1
    fi
    
    if ! aws sts get-caller-identity &> /dev/null; then
        print_error "AWS credentials not configured or invalid"
        exit 1
    fi
    
    # Setup
    load_configuration
    setup_cache
    
    # Execute command
    case "$command" in
        "discover")
            if [[ -z "$environment" ]]; then
                print_error "Environment is required for discover command"
                show_usage
                exit 1
            fi
            
            result=$(discover_backend "$environment" "$pr_number" "$validate_connectivity")
            
            case "$output_format" in
                "json")
                    echo "$result" | jq .
                    ;;
                "env")
                    api_endpoint=$(echo "$result" | jq -r '.api_endpoint')
                    resolution_method=$(echo "$result" | jq -r '.resolution_method')
                    stack_name=$(echo "$result" | jq -r '.stack_name // "none"')
                    echo "VITE_API_URL=$api_endpoint"
                    echo "VITE_API_RESOLUTION_METHOD=$resolution_method"
                    echo "VITE_BACKEND_STACK_NAME=$stack_name"
                    ;;
                "url")
                    echo "$result" | jq -r '.api_endpoint'
                    ;;
            esac
            ;;
        "validate")
            if [[ -z "$api_url" ]]; then
                print_error "API URL is required for validate command"
                show_usage
                exit 1
            fi
            
            validation_result=$(validate_api_connectivity "$api_url")
            echo "$validation_result" | jq .
            ;;
        "cache-clear")
            clear_cache
            ;;
        "list-stacks")
            list_backend_stacks
            ;;
        "health-check")
            if [[ -z "$api_url" ]]; then
                print_error "API URL is required for health-check command"
                show_usage
                exit 1
            fi
            
            print_info "Performing comprehensive health check for: $api_url"
            validation_result=$(validate_api_connectivity "$api_url")
            echo "$validation_result" | jq .
            ;;
        *)
            print_error "Command is required"
            show_usage
            exit 1
            ;;
    esac
}

# Run main function
main "$@"
