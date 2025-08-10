#!/bin/bash

# AWS Amplify Preview Environment Manager for Macro AI Frontend
# Comprehensive management utility for Amplify preview environments

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
AWS_REGION=${AWS_REGION:-"us-east-1"}
APP_NAME_PREFIX="macro-ai-frontend-pr-"

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

print_header() {
    echo -e "${BLUE}$1${NC}"
}

# Function to show usage
show_usage() {
    echo "AWS Amplify Preview Environment Manager"
    echo ""
    echo "Usage: $0 <command> [options]"
    echo ""
    echo "Commands:"
    echo "  list                    List all preview environments"
    echo "  status <pr_number>      Show status of specific preview environment"
    echo "  logs <pr_number>        Show deployment logs for preview environment"
    echo "  cleanup-old [days]      Clean up preview environments older than N days (default: 7)"
    echo "  validate <pr_number>    Validate preview environment configuration"
    echo "  monitor <pr_number>     Monitor deployment progress"
    echo "  health-check <pr_number> Check health of deployed preview"
    echo ""
    echo "Options:"
    echo "  --region <region>       AWS region (default: us-east-1)"
    echo "  --verbose               Enable verbose output"
    echo "  --dry-run               Show what would be done without executing"
    echo ""
    echo "Examples:"
    echo "  $0 list"
    echo "  $0 status 123"
    echo "  $0 cleanup-old 14"
    echo "  $0 health-check 123"
}

# Function to validate AWS CLI and credentials
validate_aws() {
    if ! command -v aws &> /dev/null; then
        print_error "AWS CLI not found. Please install AWS CLI."
        exit 1
    fi

    if ! aws sts get-caller-identity &> /dev/null; then
        print_error "AWS credentials not configured or invalid"
        exit 1
    fi

    print_status "AWS CLI and credentials validated"
}

# Function to list all preview environments
list_preview_environments() {
    print_header "📱 Amplify Preview Environments"
    echo ""

    # Get all Amplify apps that match our naming pattern
    APPS=$(aws amplify list-apps \
        --query "apps[?starts_with(name, '${APP_NAME_PREFIX}')].{name:name,appId:appId,status:status,createTime:createTime}" \
        --output json 2>/dev/null || echo "[]")

    if [[ "$APPS" == "[]" ]] || [[ -z "$APPS" ]]; then
        print_info "No preview environments found"
        return 0
    fi

    # Parse and display apps
    echo "$APPS" | jq -r '.[] | "\(.name)|\(.appId)|\(.status)|\(.createTime)"' | while IFS='|' read -r name app_id status create_time; do
        # Extract PR number from name
        PR_NUMBER=$(echo "$name" | sed "s/${APP_NAME_PREFIX}//")
        
        # Format create time
        FORMATTED_TIME=$(date -d "$create_time" '+%Y-%m-%d %H:%M:%S' 2>/dev/null || echo "$create_time")
        
        # Color code status
        case "$status" in
            "AVAILABLE")
                STATUS_COLOR="${GREEN}$status${NC}"
                ;;
            "FAILED")
                STATUS_COLOR="${RED}$status${NC}"
                ;;
            *)
                STATUS_COLOR="${YELLOW}$status${NC}"
                ;;
        esac
        
        echo -e "PR #${PR_NUMBER}: ${STATUS_COLOR} (${app_id}) - Created: ${FORMATTED_TIME}"
        
        # Get app URL if available
        APP_URL=$(aws amplify get-app --app-id "$app_id" --query 'app.defaultDomain' --output text 2>/dev/null || echo "")
        if [[ -n "$APP_URL" && "$APP_URL" != "None" ]]; then
            echo -e "  🌐 URL: https://main.${APP_URL}"
        fi
        
        echo ""
    done
}

# Function to show status of specific preview environment
show_preview_status() {
    local pr_number="$1"
    
    if [[ -z "$pr_number" ]]; then
        print_error "PR number is required"
        exit 1
    fi
    
    local app_name="${APP_NAME_PREFIX}${pr_number}"
    
    print_header "📊 Preview Environment Status: PR #${pr_number}"
    echo ""
    
    # Get app info
    local app_info=$(aws amplify list-apps \
        --query "apps[?name=='${app_name}'].{appId:appId,status:status,createTime:createTime,updateTime:updateTime}" \
        --output json 2>/dev/null || echo "[]")
    
    if [[ "$app_info" == "[]" ]]; then
        print_error "Preview environment not found for PR #${pr_number}"
        exit 1
    fi
    
    local app_id=$(echo "$app_info" | jq -r '.[0].appId')
    local status=$(echo "$app_info" | jq -r '.[0].status')
    local create_time=$(echo "$app_info" | jq -r '.[0].createTime')
    local update_time=$(echo "$app_info" | jq -r '.[0].updateTime')
    
    echo "App ID: $app_id"
    echo "Status: $status"
    echo "Created: $(date -d "$create_time" '+%Y-%m-%d %H:%M:%S' 2>/dev/null || echo "$create_time")"
    echo "Updated: $(date -d "$update_time" '+%Y-%m-%d %H:%M:%S' 2>/dev/null || echo "$update_time")"
    echo ""
    
    # Get detailed app info
    local detailed_info=$(aws amplify get-app --app-id "$app_id" --output json 2>/dev/null || echo "{}")
    
    if [[ "$detailed_info" != "{}" ]]; then
        local default_domain=$(echo "$detailed_info" | jq -r '.app.defaultDomain // empty')
        local platform=$(echo "$detailed_info" | jq -r '.app.platform // empty')
        local repository=$(echo "$detailed_info" | jq -r '.app.repository // empty')
        
        if [[ -n "$default_domain" ]]; then
            echo "🌐 URL: https://main.${default_domain}"
        fi
        if [[ -n "$platform" ]]; then
            echo "📱 Platform: $platform"
        fi
        if [[ -n "$repository" ]]; then
            echo "📂 Repository: $repository"
        fi
        echo ""
        
        # Get environment variables
        local env_vars=$(echo "$detailed_info" | jq -r '.app.environmentVariables // {}')
        if [[ "$env_vars" != "{}" ]]; then
            print_header "🔧 Environment Variables:"
            echo "$env_vars" | jq -r 'to_entries[] | "  \(.key): \(.value)"'
            echo ""
        fi
    fi
    
    # Get branch info
    print_header "🌿 Branches:"
    local branches=$(aws amplify list-branches --app-id "$app_id" --output json 2>/dev/null || echo '{"branches":[]}')
    echo "$branches" | jq -r '.branches[] | "  \(.branchName): \(.stage) (\(.framework))"'
    echo ""
    
    # Get recent deployments
    print_header "🚀 Recent Deployments:"
    local jobs=$(aws amplify list-jobs --app-id "$app_id" --branch-name "main" --max-results 5 --output json 2>/dev/null || echo '{"jobSummaries":[]}')
    echo "$jobs" | jq -r '.jobSummaries[] | "  \(.jobId): \(.status) - \(.startTime)"' | head -5
}

# Function to clean up old preview environments
cleanup_old_environments() {
    local days_old="${1:-7}"
    local dry_run="${2:-false}"
    
    print_header "🧹 Cleaning up preview environments older than ${days_old} days"
    echo ""
    
    # Calculate cutoff date
    local cutoff_date=$(date -d "${days_old} days ago" '+%Y-%m-%d')
    local cutoff_timestamp=$(date -d "$cutoff_date" '+%s')
    
    print_info "Cutoff date: $cutoff_date"
    echo ""
    
    # Get all preview apps
    local apps=$(aws amplify list-apps \
        --query "apps[?starts_with(name, '${APP_NAME_PREFIX}')].{name:name,appId:appId,createTime:createTime}" \
        --output json 2>/dev/null || echo "[]")
    
    if [[ "$apps" == "[]" ]]; then
        print_info "No preview environments found"
        return 0
    fi
    
    local cleanup_count=0
    
    echo "$apps" | jq -r '.[] | "\(.name)|\(.appId)|\(.createTime)"' | while IFS='|' read -r name app_id create_time; do
        # Convert create time to timestamp
        local app_timestamp=$(date -d "$create_time" '+%s' 2>/dev/null || echo "0")
        
        if [[ $app_timestamp -lt $cutoff_timestamp ]]; then
            local pr_number=$(echo "$name" | sed "s/${APP_NAME_PREFIX}//")
            
            if [[ "$dry_run" == "true" ]]; then
                echo -e "${YELLOW}[DRY RUN]${NC} Would delete: PR #${pr_number} (${name}) - Created: $create_time"
            else
                echo -e "🗑️ Deleting old preview: PR #${pr_number} (${name}) - Created: $create_time"
                
                if aws amplify delete-app --app-id "$app_id" > /dev/null 2>&1; then
                    print_status "Deleted: $name"
                else
                    print_error "Failed to delete: $name"
                fi
            fi
            
            cleanup_count=$((cleanup_count + 1))
        fi
    done
    
    echo ""
    if [[ "$dry_run" == "true" ]]; then
        print_info "Dry run completed. Would clean up $cleanup_count environments."
    else
        print_status "Cleanup completed. Processed $cleanup_count environments."
    fi
}

# Function to validate preview environment
validate_preview_environment() {
    local pr_number="$1"
    
    if [[ -z "$pr_number" ]]; then
        print_error "PR number is required"
        exit 1
    fi
    
    local app_name="${APP_NAME_PREFIX}${pr_number}"
    
    print_header "🔍 Validating Preview Environment: PR #${pr_number}"
    echo ""
    
    # Check if app exists
    local app_info=$(aws amplify list-apps \
        --query "apps[?name=='${app_name}'].{appId:appId,status:status}" \
        --output json 2>/dev/null || echo "[]")
    
    if [[ "$app_info" == "[]" ]]; then
        print_error "❌ Preview environment not found"
        return 1
    fi
    
    local app_id=$(echo "$app_info" | jq -r '.[0].appId')
    local status=$(echo "$app_info" | jq -r '.[0].status')
    
    print_status "✅ App exists: $app_id"
    
    # Check app status
    case "$status" in
        "AVAILABLE")
            print_status "✅ App status: Available"
            ;;
        "FAILED")
            print_error "❌ App status: Failed"
            return 1
            ;;
        *)
            print_warning "⚠️ App status: $status"
            ;;
    esac
    
    # Check environment variables
    local detailed_info=$(aws amplify get-app --app-id "$app_id" --output json 2>/dev/null || echo "{}")
    local env_vars=$(echo "$detailed_info" | jq -r '.app.environmentVariables // {}')
    
    local required_vars=("VITE_API_URL" "VITE_API_KEY" "VITE_APP_ENV")
    local missing_vars=()
    
    for var in "${required_vars[@]}"; do
        local var_value=$(echo "$env_vars" | jq -r ".[\"$var\"] // empty")
        if [[ -z "$var_value" ]]; then
            missing_vars+=("$var")
        else
            print_status "✅ Environment variable: $var"
        fi
    done
    
    if [[ ${#missing_vars[@]} -gt 0 ]]; then
        for var in "${missing_vars[@]}"; do
            print_error "❌ Missing environment variable: $var"
        done
        return 1
    fi
    
    # Check branches
    local branches=$(aws amplify list-branches --app-id "$app_id" --output json 2>/dev/null || echo '{"branches":[]}')
    local branch_count=$(echo "$branches" | jq '.branches | length')
    
    if [[ $branch_count -gt 0 ]]; then
        print_status "✅ Branches configured: $branch_count"
    else
        print_error "❌ No branches found"
        return 1
    fi
    
    print_status "🎉 Validation completed successfully"
}

# Main script logic
main() {
    local command="$1"
    shift
    
    # Parse global options
    while [[ $# -gt 0 ]]; do
        case $1 in
            --region)
                AWS_REGION="$2"
                shift 2
                ;;
            --verbose)
                set -x
                shift
                ;;
            --dry-run)
                DRY_RUN="true"
                shift
                ;;
            *)
                break
                ;;
        esac
    done
    
    # Validate AWS setup
    validate_aws
    
    # Execute command
    case "$command" in
        "list")
            list_preview_environments
            ;;
        "status")
            show_preview_status "$1"
            ;;
        "cleanup-old")
            cleanup_old_environments "$1" "${DRY_RUN:-false}"
            ;;
        "validate")
            validate_preview_environment "$1"
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

# Run main function with all arguments
main "$@"
