#!/bin/bash

# Health Check Script for Amplify Preview Environments
# Validates that deployed preview environments are working correctly

set -Eeuo pipefail
IFS=$'\n\t'

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PR_NUMBER=${1:-""}
AWS_REGION=${AWS_REGION:-"us-east-1"}
APP_NAME_PREFIX="macro-ai-frontend-pr-"
TIMEOUT=30

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
    echo "Health Check Script for Amplify Preview Environments"
    echo ""
    echo "Usage: $0 <pr_number>"
    echo ""
    echo "Examples:"
    echo "  $0 123    # Check health of PR #123 preview environment"
}

# Function to check if URL is accessible
check_url_health() {
    local url="$1"
    local description="$2"
    
    print_info "Checking $description: $url"
    
    # Check if URL responds with 200 status
    local http_status=$(curl -s -o /dev/null -w "%{http_code}" --max-time $TIMEOUT "$url" 2>/dev/null || echo "000")
    
    case "$http_status" in
        "200")
            print_status "$description is accessible (HTTP $http_status)"
            return 0
            ;;
        "000")
            print_error "$description is not accessible (connection failed)"
            return 1
            ;;
        *)
            print_warning "$description returned HTTP $http_status"
            return 1
            ;;
    esac
}

# Function to check content validity
check_content_validity() {
    local url="$1"
    
    print_info "Checking content validity..."
    
    # Get page content
    local content=$(curl -s --max-time $TIMEOUT "$url" 2>/dev/null || echo "")
    
    if [[ -z "$content" ]]; then
        print_error "No content received from URL"
        return 1
    fi
    
    # Check for basic HTML structure
    if echo "$content" | grep -q "<html"; then
        print_status "Valid HTML content detected"
    else
        print_warning "HTML structure not detected"
    fi
    
    # Check for React app indicators
    if echo "$content" | grep -q "react\|React"; then
        print_status "React application detected"
    else
        print_warning "React application indicators not found"
    fi
    
    # Check for our app-specific content
    if echo "$content" | grep -q "Macro AI"; then
        print_status "Macro AI application content detected"
    else
        print_warning "Macro AI specific content not found"
    fi
    
    # Check for error indicators
    if echo "$content" | grep -qi "error\|exception\|failed"; then
        print_warning "Potential error content detected in page"
    fi
    
    return 0
}

# Function to check API connectivity
check_api_connectivity() {
    local preview_url="$1"
    
    print_info "Checking API connectivity..."
    
    # Try to extract API URL from the preview environment
    # This would typically be done by checking the deployed app's configuration
    # For now, we'll make a basic assumption about the API endpoint
    
    local api_url=""
    
    # Try to get environment variables from Amplify app
    if [[ -n "$APP_ID" ]]; then
        local app_info=$(aws amplify get-app --app-id "$APP_ID" --output json 2>/dev/null || echo "{}")
        api_url=$(echo "$app_info" | jq -r '.app.environmentVariables.VITE_API_URL // empty' 2>/dev/null || echo "")
    fi
    
    if [[ -n "$api_url" ]]; then
        print_info "Testing API endpoint: $api_url"
        
        # Check if API endpoint is accessible
        local api_status=$(curl -s -o /dev/null -w "%{http_code}" --max-time $TIMEOUT "$api_url/health" 2>/dev/null || echo "000")
        
        case "$api_status" in
            "200")
                print_status "API endpoint is accessible"
                ;;
            "404")
                print_warning "API health endpoint not found (this may be normal)"
                ;;
            "000")
                print_error "API endpoint is not accessible"
                ;;
            *)
                print_warning "API endpoint returned HTTP $api_status"
                ;;
        esac
    else
        print_warning "Could not determine API URL from environment variables"
    fi
}

# Function to check performance metrics
check_performance() {
    local url="$1"
    
    print_info "Checking performance metrics..."
    
    # Measure response time
    local response_time=$(curl -s -o /dev/null -w "%{time_total}" --max-time $TIMEOUT "$url" 2>/dev/null || echo "0")
    
    if [[ "$response_time" != "0" ]]; then
        local response_ms=$(echo "$response_time * 1000" | bc 2>/dev/null || echo "0")
        
        if (( $(echo "$response_time < 2.0" | bc -l 2>/dev/null || echo "0") )); then
            print_status "Response time: ${response_ms}ms (good)"
        elif (( $(echo "$response_time < 5.0" | bc -l 2>/dev/null || echo "0") )); then
            print_warning "Response time: ${response_ms}ms (acceptable)"
        else
            print_error "Response time: ${response_ms}ms (slow)"
        fi
    else
        print_error "Could not measure response time"
    fi
    
    # Check content size
    local content_size=$(curl -s --max-time $TIMEOUT "$url" 2>/dev/null | wc -c || echo "0")
    
    if [[ "$content_size" -gt 0 ]]; then
        local size_kb=$((content_size / 1024))
        print_status "Content size: ${size_kb}KB"
        
        if [[ $size_kb -lt 10 ]]; then
            print_warning "Content size seems small - possible error page"
        fi
    else
        print_error "No content received"
    fi
}

# Main health check function
perform_health_check() {
    local pr_number="$1"
    local app_name="${APP_NAME_PREFIX}${pr_number}"
    
    echo -e "${BLUE}🏥 Health Check: Preview Environment PR #${pr_number}${NC}"
    echo ""
    
    # Get app info
    local app_info=$(aws amplify list-apps \
        --query "apps[?name=='${app_name}'].{appId:appId,status:status}" \
        --output json 2>/dev/null || echo "[]")
    
    if [[ "$app_info" == "[]" ]]; then
        print_error "Preview environment not found for PR #${pr_number}"
        exit 1
    fi
    
    APP_ID=$(echo "$app_info" | jq -r '.[0].appId')
    local status=$(echo "$app_info" | jq -r '.[0].status')
    
    print_info "App ID: $APP_ID"
    print_info "Status: $status"
    echo ""
    
    # Check app status first
    if [[ "$status" != "AVAILABLE" ]]; then
        print_error "App is not in AVAILABLE status: $status"
        exit 1
    fi
    
    # Get app URL
    local detailed_info=$(aws amplify get-app --app-id "$APP_ID" --output json 2>/dev/null || echo "{}")
    local default_domain=$(echo "$detailed_info" | jq -r '.app.defaultDomain // empty')
    
    if [[ -z "$default_domain" ]]; then
        print_error "Could not determine app URL"
        exit 1
    fi
    
    local app_url="https://main.${default_domain}"
    print_info "Testing URL: $app_url"
    echo ""
    
    # Perform health checks
    local checks_passed=0
    local total_checks=4
    
    # 1. Basic connectivity
    if check_url_health "$app_url" "Frontend application"; then
        checks_passed=$((checks_passed + 1))
    fi
    echo ""
    
    # 2. Content validity
    if check_content_validity "$app_url"; then
        checks_passed=$((checks_passed + 1))
    fi
    echo ""
    
    # 3. API connectivity
    if check_api_connectivity "$app_url"; then
        checks_passed=$((checks_passed + 1))
    fi
    echo ""
    
    # 4. Performance
    if check_performance "$app_url"; then
        checks_passed=$((checks_passed + 1))
    fi
    echo ""
    
    # Summary
    echo -e "${BLUE}📊 Health Check Summary${NC}"
    echo "=================================="
    echo "Checks passed: $checks_passed/$total_checks"
    echo "Preview URL: $app_url"
    
    if [[ $checks_passed -eq $total_checks ]]; then
        print_status "🎉 All health checks passed!"
        exit 0
    elif [[ $checks_passed -ge $((total_checks / 2)) ]]; then
        print_warning "⚠️ Some health checks failed, but preview is partially functional"
        exit 1
    else
        print_error "❌ Multiple health checks failed - preview may not be working correctly"
        exit 2
    fi
}

# Main script logic
if [[ -z "$PR_NUMBER" ]]; then
    print_error "PR number is required"
    echo ""
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

# Validate curl
if ! command -v curl &> /dev/null; then
    print_error "curl not found. Please install curl."
    exit 1
fi

# Run health check
perform_health_check "$PR_NUMBER"
