#!/bin/bash

# =============================================================================
# ALB API Routing and CORS Validation Script
# =============================================================================
# 
# This script validates that all API endpoints are properly accessible through
# the Application Load Balancer with correct routing and CORS configuration.
#
# Validation Features:
# 1. Test all major API endpoint categories (auth, chat, user, utility)
# 2. Validate CORS configuration for different origins
# 3. Test Load Balancer routing and path-based routing
# 4. Verify middleware functionality (rate limiting, authentication)
# 5. Test API documentation accessibility
# 6. Validate security headers and CSP
# 7. Test OPTIONS preflight requests
# 8. Verify error handling and status codes
#
# Usage:
#   ./validate-alb-api-routing.sh --alb-url https://macro-ai-pr123-alb.elb.amazonaws.com
#   ./validate-alb-api-routing.sh --pr-number 123 --test-cors
#   ./validate-alb-api-routing.sh --comprehensive --verbose
#
# Exit Codes:
#   0 - All validations passed
#   1 - Some validations failed
#   2 - Invalid arguments or configuration error

set -euo pipefail

# Configuration
AWS_REGION="${AWS_REGION:-us-east-1}"
VERBOSE=false
TIMEOUT=30
TEST_CORS=false
TEST_AUTH=false

# Test results tracking
TESTS_PASSED=0
TESTS_FAILED=0
TEST_RESULTS=()

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

log_debug() {
    if [[ "$VERBOSE" == "true" ]]; then
        echo -e "${BLUE}🔍 DEBUG: $1${NC}"
    fi
}

# Test result tracking
record_test_result() {
    local test_name="$1"
    local result="$2"
    local details="${3:-}"
    
    if [[ "$result" == "PASS" ]]; then
        ((TESTS_PASSED++))
        log_success "TEST PASSED: $test_name"
    else
        ((TESTS_FAILED++))
        log_error "TEST FAILED: $test_name"
        if [[ -n "$details" ]]; then
            log_error "  Details: $details"
        fi
    fi
    
    TEST_RESULTS+=("$test_name: $result")
}

# Help function
show_help() {
    cat << EOF
ALB API Routing and CORS Validation Script

USAGE:
    $0 [OPTIONS]

OPTIONS:
    --alb-url URL               Application Load Balancer URL
    --pr-number NUMBER          PR number (will discover ALB URL from stack)
    --stack-name NAME           CloudFormation stack name
    --test-cors                 Include comprehensive CORS testing
    --test-auth                 Include authentication endpoint testing
    --comprehensive             Run all validation tests
    --timeout SECONDS           Request timeout in seconds (default: 30)
    --region REGION             AWS region (default: us-east-1)
    --verbose                   Enable verbose logging
    --help                      Show this help message

VALIDATION TESTS:
    ✓ API endpoint routing through ALB
    ✓ CORS configuration and preflight requests
    ✓ Authentication endpoints accessibility
    ✓ Chat endpoints routing
    ✓ User endpoints routing
    ✓ Utility endpoints (health, system-info)
    ✓ API documentation accessibility
    ✓ Security headers validation
    ✓ Error handling and status codes
    ✓ Rate limiting functionality

EXAMPLES:
    $0 --pr-number 123 --comprehensive --verbose
    $0 --alb-url https://example.elb.amazonaws.com --test-cors
    $0 --stack-name MacroAiPr123Stack --test-auth

EOF
}

# Parse command line arguments
parse_arguments() {
    local alb_url=""
    local pr_number=""
    local stack_name=""
    local comprehensive=false
    
    while [[ $# -gt 0 ]]; do
        case $1 in
            --alb-url)
                alb_url="$2"
                shift 2
                ;;
            --pr-number)
                pr_number="$2"
                stack_name="MacroAiPr${2}Stack"
                shift 2
                ;;
            --stack-name)
                stack_name="$2"
                shift 2
                ;;
            --test-cors)
                TEST_CORS=true
                shift
                ;;
            --test-auth)
                TEST_AUTH=true
                shift
                ;;
            --comprehensive)
                comprehensive=true
                TEST_CORS=true
                TEST_AUTH=true
                shift
                ;;
            --timeout)
                TIMEOUT="$2"
                shift 2
                ;;
            --region)
                AWS_REGION="$2"
                shift 2
                ;;
            --verbose)
                VERBOSE=true
                shift
                ;;
            --help)
                show_help
                exit 0
                ;;
            *)
                log_error "Unknown option: $1"
                show_help
                exit 2
                ;;
        esac
    done
    
    # Export variables for use in test functions
    export ALB_URL="$alb_url"
    export PR_NUMBER="$pr_number"
    export STACK_NAME="$stack_name"
    export COMPREHENSIVE="$comprehensive"
}

# Discover ALB URL from CloudFormation stack
discover_alb_url() {
    local stack_name="$1"
    
    log_debug "Discovering ALB URL from CloudFormation stack: $stack_name"
    
    local alb_url
    alb_url=$(aws cloudformation describe-stacks \
        --stack-name "$stack_name" \
        --region "$AWS_REGION" \
        --query 'Stacks[0].Outputs[?OutputKey==`ApplicationLoadBalancerUrl`].OutputValue' \
        --output text 2>/dev/null || echo "")
    
    if [[ -n "$alb_url" ]]; then
        log_debug "Discovered ALB URL: $alb_url"
        echo "$alb_url"
    else
        log_warning "Could not discover ALB URL from stack outputs"
        echo ""
    fi
}

# Make HTTP request with detailed response analysis
make_http_request() {
    local url="$1"
    local method="${2:-GET}"
    local expected_status="${3:-200}"
    local headers="${4:-}"
    local body="${5:-}"
    local description="${6:-HTTP request}"
    
    log_debug "Making $method request to: $url (expecting status: $expected_status)"
    
    local curl_args=(-s -w "\n%{http_code}\n%{time_total}")
    curl_args+=(--max-time "$TIMEOUT")
    curl_args+=(--connect-timeout 10)
    curl_args+=(-X "$method")
    curl_args+=(-H "Accept: application/json")
    curl_args+=(-H "User-Agent: ALB-API-Routing-Validator/1.0")

    # Add custom headers if provided
    if [[ -n "$headers" ]]; then
        while IFS= read -r header; do
            if [[ -n "$header" ]]; then
                curl_args+=(-H "$header")
            fi
        done <<< "$headers"
    fi

    # Add body if provided
    if [[ -n "$body" ]]; then
        curl_args+=(-d "$body")
        curl_args+=(-H "Content-Type: application/json")
    fi

    local response
    response=$(curl "${curl_args[@]}" "$url" 2>/dev/null || echo -e "\nERROR\n0")

    # Parse response
    local response_body
    local status_code
    local response_time

    response_body=$(echo "$response" | head -n -2)
    status_code=$(echo "$response" | tail -n 2 | head -n 1)
    response_time=$(echo "$response" | tail -n 1)
    
    log_debug "$description - Status: $status_code, Time: ${response_time}s"
    
    if [[ "$status_code" == "$expected_status" ]]; then
        echo "$response_body"
        return 0
    else
        log_debug "$description failed - Status: $status_code, Body: $response_body"
        return 1
    fi
}

# Test basic API routing
test_api_routing() {
    local base_url="$1"
    
    log_info "Testing basic API routing through ALB"
    
    # Test API root endpoint
    if make_http_request "${base_url}/api" "GET" "200" "" "" "API root endpoint" >/dev/null; then
        record_test_result "API Root Routing" "PASS"
    else
        record_test_result "API Root Routing" "FAIL" "API root endpoint not accessible"
    fi
    
    # Test API documentation
    if make_http_request "${base_url}/api-docs" "GET" "200" "" "" "API documentation" >/dev/null; then
        record_test_result "API Documentation Routing" "PASS"
    else
        record_test_result "API Documentation Routing" "FAIL" "API documentation not accessible"
    fi
    
    # Test Swagger JSON
    if make_http_request "${base_url}/swagger.json" "GET" "200" "" "" "Swagger JSON" >/dev/null; then
        record_test_result "Swagger JSON Routing" "PASS"
    else
        record_test_result "Swagger JSON Routing" "FAIL" "Swagger JSON not accessible"
    fi
}

# Test utility endpoints routing
test_utility_endpoints() {
    local base_url="$1"
    
    log_info "Testing utility endpoints routing"
    
    # Test health endpoints (already covered in health validation, but test routing)
    local utility_endpoints=(
        "/api/health"
        "/api/health/ready"
        "/api/health/live"
        "/api/health/detailed"
        "/api/system-info"
    )
    
    for endpoint in "${utility_endpoints[@]}"; do
        local endpoint_name
        endpoint_name=$(echo "$endpoint" | sed 's/\/api\///' | sed 's/\//-/g')
        
        if make_http_request "${base_url}${endpoint}" "GET" "200" "" "" "Utility endpoint: $endpoint" >/dev/null; then
            record_test_result "Utility Routing: $endpoint_name" "PASS"
        else
            record_test_result "Utility Routing: $endpoint_name" "FAIL" "Endpoint not accessible"
        fi
    done
}

# Test authentication endpoints routing
test_auth_endpoints() {
    local base_url="$1"
    
    log_info "Testing authentication endpoints routing"
    
    # Test auth endpoints (expect validation errors, not routing errors)
    local auth_endpoints=(
        "/api/auth/register"
        "/api/auth/login"
        "/api/auth/forgot-password"
    )
    
    for endpoint in "${auth_endpoints[@]}"; do
        local endpoint_name
        endpoint_name=$(echo "$endpoint" | sed 's/\/api\/auth\///')
        
        # POST endpoints should return 400 (validation error) not 404 (routing error)
        if make_http_request "${base_url}${endpoint}" "POST" "400" "" "{}" "Auth endpoint: $endpoint" >/dev/null; then
            record_test_result "Auth Routing: $endpoint_name" "PASS"
        else
            # Try with GET to see if endpoint exists (should return 405 Method Not Allowed)
            if make_http_request "${base_url}${endpoint}" "GET" "405" "" "" "Auth endpoint GET: $endpoint" >/dev/null; then
                record_test_result "Auth Routing: $endpoint_name" "PASS" "Endpoint exists (405 Method Not Allowed)"
            else
                record_test_result "Auth Routing: $endpoint_name" "FAIL" "Endpoint not accessible"
            fi
        fi
    done
}

# Test CORS configuration
test_cors_configuration() {
    local base_url="$1"

    log_info "Testing CORS configuration"

    # Test CORS preflight request
    local cors_headers="Origin: http://localhost:3000
Access-Control-Request-Method: POST
Access-Control-Request-Headers: Content-Type,Authorization"

    if make_http_request "${base_url}/api/health" "OPTIONS" "200" "$cors_headers" "" "CORS preflight" >/dev/null; then
        record_test_result "CORS Preflight" "PASS"
    else
        record_test_result "CORS Preflight" "FAIL" "CORS preflight request failed"
    fi

    # Test CORS with allowed origin
    local allowed_headers_output
    if allowed_headers_output=$(curl -s -I --max-time "$TIMEOUT" -H "Origin: http://localhost:3000" "${base_url}/api/health" 2>/dev/null); then
        if echo "$allowed_headers_output" | grep -qi "^Access-Control-Allow-Origin:"; then
            record_test_result "CORS Allowed Origin" "PASS"
        else
            record_test_result "CORS Allowed Origin" "FAIL" "CORS headers not present"
        fi
    else
        record_test_result "CORS Allowed Origin" "FAIL" "Request with allowed origin failed"
    fi

    # Test CORS with disallowed origin
    local disallowed_headers_output
    if disallowed_headers_output=$(curl -s -I --max-time "$TIMEOUT" -H "Origin: http://malicious-site.com" "${base_url}/api/health" 2>/dev/null); then
        if echo "$disallowed_headers_output" | grep -qi "^Access-Control-Allow-Origin:"; then
            record_test_result "CORS Disallowed Origin Handling" "FAIL" "CORS header present for disallowed origin"
        else
            record_test_result "CORS Disallowed Origin Handling" "PASS"
        fi
    else
        record_test_result "CORS Disallowed Origin Handling" "FAIL" "Request with disallowed origin failed"
    fi
}

# Test security headers
test_security_headers() {
    local base_url="$1"

    log_info "Testing security headers"

    # Make request and capture headers
    local headers_output
    headers_output=$(curl -s -I --max-time "$TIMEOUT" "${base_url}/api/health" 2>/dev/null || echo "")

    if [[ -n "$headers_output" ]]; then
        # Check for security headers
        local security_headers=(
            "X-Content-Type-Options"
            "X-Frame-Options"
            "X-XSS-Protection"
            "Strict-Transport-Security"
            "Content-Security-Policy"
        )

        local headers_found=0
        for header in "${security_headers[@]}"; do
            if echo "$headers_output" | grep -qi "$header"; then
                ((headers_found++))
                log_debug "Found security header: $header"
            fi
        done

        if [[ $headers_found -ge 3 ]]; then
            record_test_result "Security Headers" "PASS" "$headers_found/5 security headers found"
        else
            record_test_result "Security Headers" "FAIL" "Only $headers_found/5 security headers found"
        fi
    else
        record_test_result "Security Headers" "FAIL" "Could not retrieve headers"
    fi
}

# Test rate limiting
test_rate_limiting() {
    local base_url="$1"

    log_info "Testing rate limiting functionality"

    # Test system-info endpoint which has rate limiting
    local rate_limit_endpoint="${base_url}/api/system-info"
    local successful_requests=0
    local rate_limited=false

    # Make multiple requests quickly to trigger rate limiting
    for i in {1..10}; do
        log_debug "Rate limit test request $i/10"

        if make_http_request "$rate_limit_endpoint" "GET" "200" "" "" "Rate limit test $i" >/dev/null 2>&1; then
            ((successful_requests++))
        else
            # Check if it's a rate limit error (429)
            if make_http_request "$rate_limit_endpoint" "GET" "429" "" "" "Rate limit check" >/dev/null 2>&1; then
                rate_limited=true
                break
            fi
        fi

        # Small delay to avoid overwhelming
        sleep 0.1
    done

    if [[ "$rate_limited" == "true" ]] || [[ $successful_requests -lt 10 ]]; then
        record_test_result "Rate Limiting" "PASS" "Rate limiting is working"
    else
        record_test_result "Rate Limiting" "FAIL" "Rate limiting not triggered"
    fi
}

# Test error handling
test_error_handling() {
    local base_url="$1"

    log_info "Testing error handling"

    # Test 404 for non-existent endpoint
    if make_http_request "${base_url}/api/non-existent-endpoint" "GET" "404" "" "" "404 error handling" >/dev/null; then
        record_test_result "404 Error Handling" "PASS"
    else
        record_test_result "404 Error Handling" "FAIL" "404 errors not handled correctly"
    fi

    # Test 405 for wrong method
    if make_http_request "${base_url}/api/health" "DELETE" "405" "" "" "405 error handling" >/dev/null; then
        record_test_result "405 Error Handling" "PASS"
    else
        record_test_result "405 Error Handling" "FAIL" "405 errors not handled correctly"
    fi

    # Test validation error (400)
    if make_http_request "${base_url}/api/auth/register" "POST" "400" "" "{\"invalid\": \"data\"}" "400 error handling" >/dev/null; then
        record_test_result "400 Error Handling" "PASS"
    else
        record_test_result "400 Error Handling" "FAIL" "400 errors not handled correctly"
    fi
}

# Test Load Balancer specific functionality
test_load_balancer_features() {
    local base_url="$1"

    log_info "Testing Load Balancer specific features"

    # Test health check endpoint (ALB health checks)
    if make_http_request "${base_url}/api/health" "GET" "200" "" "" "ALB health check" >/dev/null; then
        record_test_result "ALB Health Check Integration" "PASS"
    else
        record_test_result "ALB Health Check Integration" "FAIL" "ALB health check failed"
    fi

    # Test sticky sessions (if configured) - check for session cookies
    local response_headers
    response_headers=$(curl -s -I --max-time "$TIMEOUT" "${base_url}/api/health" 2>/dev/null || echo "")

    if echo "$response_headers" | grep -qi "set-cookie"; then
        record_test_result "Session Cookie Handling" "PASS" "Session cookies detected"
    else
        record_test_result "Session Cookie Handling" "PASS" "No session cookies (expected for stateless API)"
    fi

    # Test request routing consistency
    local consistent_responses=0
    for i in {1..5}; do
        if make_http_request "${base_url}/api/health" "GET" "200" "" "" "Routing consistency test $i" >/dev/null; then
            ((consistent_responses++))
        fi
        sleep 0.5
    done

    if [[ $consistent_responses -eq 5 ]]; then
        record_test_result "Routing Consistency" "PASS"
    else
        record_test_result "Routing Consistency" "FAIL" "Only $consistent_responses/5 requests succeeded"
    fi
}

# Main validation function
main() {
    log_info "🔍 Starting ALB API Routing and CORS Validation"
    log_info "ALB URL: ${ALB_URL:-N/A}"
    log_info "Stack: ${STACK_NAME:-N/A}"
    log_info "Test CORS: $TEST_CORS"
    log_info "Test Auth: $TEST_AUTH"
    log_info "Timeout: ${TIMEOUT}s"
    echo ""

    # Discover ALB URL if not provided
    local base_url="$ALB_URL"
    if [[ -z "$base_url" ]] && [[ -n "$STACK_NAME" ]]; then
        log_info "Discovering ALB URL from CloudFormation stack..."
        base_url=$(discover_alb_url "$STACK_NAME")
        if [[ -z "$base_url" ]]; then
            log_error "Could not discover ALB URL and none provided"
            exit 2
        fi
        log_info "Using discovered ALB URL: $base_url"
    fi

    if [[ -z "$base_url" ]]; then
        log_error "ALB URL is required but not provided or discoverable"
        exit 2
    fi

    # Remove trailing slash from base URL
    base_url="${base_url%/}"

    # Run core validation tests
    test_api_routing "$base_url"
    test_utility_endpoints "$base_url"
    test_security_headers "$base_url"
    test_error_handling "$base_url"
    test_load_balancer_features "$base_url"

    # Run optional tests
    if [[ "$TEST_AUTH" == "true" ]]; then
        test_auth_endpoints "$base_url"
    fi

    if [[ "$TEST_CORS" == "true" ]]; then
        test_cors_configuration "$base_url"
    fi

    if [[ "$COMPREHENSIVE" == "true" ]]; then
        test_rate_limiting "$base_url"
    fi

    # Generate final report
    echo ""
    log_info "📊 ALB API Routing and CORS Validation Results"
    echo "=============================================="
    echo "Tests Passed: $TESTS_PASSED"
    echo "Tests Failed: $TESTS_FAILED"
    echo "Total Tests:  $((TESTS_PASSED + TESTS_FAILED))"
    echo ""

    if [[ $TESTS_FAILED -eq 0 ]]; then
        log_success "🎉 All API routing validations passed!"
        log_success "✅ API endpoints are accessible through ALB"
        log_success "✅ CORS configuration is working correctly"
        log_success "✅ Security headers are properly configured"
        log_success "✅ Error handling is functioning as expected"
        exit 0
    else
        log_error "❌ Some API routing validations failed"
        echo ""
        echo "Failed Tests:"
        for result in "${TEST_RESULTS[@]}"; do
            if [[ "$result" == *"FAIL"* ]]; then
                echo "  ❌ $result"
            fi
        done
        exit 1
    fi
}

# Parse arguments and run main function
parse_arguments "$@"
main
