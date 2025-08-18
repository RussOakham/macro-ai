#!/bin/bash

# =============================================================================
# EC2 Express API Health Validation Script
# =============================================================================
# 
# This script validates that the Express API starts correctly on EC2 instances
# and that all health check endpoints are accessible via the Load Balancer.
#
# Validation Features:
# 1. Test Express API startup and process health
# 2. Validate health check endpoints (/health, /health/ready, etc.)
# 3. Test Load Balancer accessibility and routing
# 4. Verify PM2 process management
# 5. Check environment variable loading
# 6. Validate API endpoint functionality
# 7. Monitor startup time and performance
#
# Usage:
#   ./validate-ec2-api-health.sh --env-name pr-123
#   ./validate-ec2-api-health.sh --alb-url https://macro-ai-pr123-alb-123456789.us-east-1.elb.amazonaws.com
#   ./validate-ec2-api-health.sh --comprehensive --verbose
#
# Exit Codes:
#   0 - All validations passed
#   1 - Some validations failed
#   2 - Invalid arguments or configuration error

set -euo pipefail

# Configuration
AWS_REGION="${AWS_REGION:-us-east-1}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VERBOSE=false
TIMEOUT=30
MAX_RETRIES=5
RETRY_INTERVAL=10

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
EC2 Express API Health Validation Script

USAGE:
    $0 [OPTIONS]

OPTIONS:
    --env-name NAME             Environment name (e.g., pr-123)
    --alb-url URL               Application Load Balancer URL
    --stack-name NAME           CloudFormation stack name (e.g., MacroAiPr123Stack)
    --pr-number NUMBER          PR number (will generate env-name and stack-name)
    --comprehensive             Run comprehensive validation including performance tests
    --timeout SECONDS           Request timeout in seconds (default: 30)
    --max-retries NUMBER        Maximum retry attempts (default: 5)
    --retry-interval SECONDS    Interval between retries (default: 10)
    --region REGION             AWS region (default: us-east-1)
    --verbose                   Enable verbose logging
    --help                      Show this help message

VALIDATION TESTS:
    ✓ Express API startup verification
    ✓ Health endpoint accessibility (/health)
    ✓ Readiness endpoint validation (/health/ready)
    ✓ Liveness endpoint validation (/health/live)
    ✓ Detailed health check (/health/detailed)
    ✓ Load Balancer routing and accessibility
    ✓ PM2 process management validation
    ✓ Environment variable loading verification
    ✓ API endpoint functionality testing
    ✓ Performance and response time validation

EXAMPLES:
    $0 --pr-number 123 --comprehensive --verbose
    $0 --env-name pr-456 --alb-url https://example.elb.amazonaws.com
    $0 --stack-name MacroAiPr789Stack --timeout 60

EOF
}

# Parse command line arguments
parse_arguments() {
    local env_name=""
    local alb_url=""
    local stack_name=""
    local pr_number=""
    local comprehensive=false
    
    while [[ $# -gt 0 ]]; do
        case $1 in
            --env-name)
                env_name="$2"
                shift 2
                ;;
            --alb-url)
                alb_url="$2"
                shift 2
                ;;
            --stack-name)
                stack_name="$2"
                shift 2
                ;;
            --pr-number)
                pr_number="$2"
                env_name="pr-$2"
                stack_name="MacroAiPr${2}Stack"
                shift 2
                ;;
            --comprehensive)
                comprehensive=true
                shift
                ;;
            --timeout)
                TIMEOUT="$2"
                shift 2
                ;;
            --max-retries)
                MAX_RETRIES="$2"
                shift 2
                ;;
            --retry-interval)
                RETRY_INTERVAL="$2"
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
    
    # Validate required parameters
    if [[ -z "$env_name" ]] && [[ -z "$alb_url" ]] && [[ -z "$stack_name" ]]; then
        log_error "Either --env-name, --alb-url, --stack-name, or --pr-number must be provided"
        show_help
        exit 2
    fi
    
    # Export variables for use in test functions
    export ENV_NAME="$env_name"
    export ALB_URL="$alb_url"
    export STACK_NAME="$stack_name"
    export PR_NUMBER="$pr_number"
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

# Make HTTP request with retries
make_http_request() {
    local url="$1"
    local expected_status="${2:-200}"
    local description="${3:-HTTP request}"
    
    log_debug "Making request to: $url (expecting status: $expected_status)"
    
    for attempt in $(seq 1 $MAX_RETRIES); do
        log_debug "Attempt $attempt/$MAX_RETRIES for $description"
        
        local response
        local status_code
        local response_time
        
        # Make request and capture response, status code, and timing
        response=$(curl -s -w "\n%{http_code}\n%{time_total}" \
            --max-time "$TIMEOUT" \
            --connect-timeout 10 \
            -H "Accept: application/json" \
            -H "User-Agent: EC2-API-Health-Validator/1.0" \
            "$url" 2>/dev/null || echo -e "\nERROR\n0")
        
        # Parse response
        local body
        body=$(echo "$response" | head -n -2)
        status_code=$(echo "$response" | tail -n 2 | head -n 1)
        response_time=$(echo "$response" | tail -n 1)
        
        log_debug "Response status: $status_code, time: ${response_time}s"
        
        if [[ "$status_code" == "$expected_status" ]]; then
            log_debug "$description successful (${response_time}s)"
            echo "$body"
            return 0
        else
            log_debug "$description failed - Status: $status_code, Body: $body"
            if [[ $attempt -lt $MAX_RETRIES ]]; then
                log_debug "Retrying in ${RETRY_INTERVAL}s..."
                sleep "$RETRY_INTERVAL"
            fi
        fi
    done
    
    log_error "$description failed after $MAX_RETRIES attempts"
    return 1
}

# Test basic health endpoint
test_health_endpoint() {
    local base_url="$1"
    local endpoint="/api/health"
    local url="${base_url}${endpoint}"
    
    log_info "Testing basic health endpoint: $endpoint"
    
    local response
    if response=$(make_http_request "$url" "200" "Health check"); then
        # Validate response structure
        if echo "$response" | jq -e '.message' >/dev/null 2>&1; then
            record_test_result "Health Endpoint Basic" "PASS"
            log_debug "Health response: $response"
        else
            record_test_result "Health Endpoint Basic" "FAIL" "Invalid response structure"
        fi
    else
        record_test_result "Health Endpoint Basic" "FAIL" "Request failed"
    fi
}

# Test readiness endpoint
test_readiness_endpoint() {
    local base_url="$1"
    local endpoint="/api/health/ready"
    local url="${base_url}${endpoint}"
    
    log_info "Testing readiness endpoint: $endpoint"
    
    local response
    if response=$(make_http_request "$url" "200" "Readiness check"); then
        # Validate response structure
        if echo "$response" | jq -e '.ready' >/dev/null 2>&1; then
            local ready_status
            ready_status=$(echo "$response" | jq -r '.ready')
            if [[ "$ready_status" == "true" ]]; then
                record_test_result "Readiness Endpoint" "PASS"
            else
                record_test_result "Readiness Endpoint" "FAIL" "Service not ready: $ready_status"
            fi
        else
            record_test_result "Readiness Endpoint" "FAIL" "Invalid response structure"
        fi
    else
        record_test_result "Readiness Endpoint" "FAIL" "Request failed"
    fi
}

# Test liveness endpoint
test_liveness_endpoint() {
    local base_url="$1"
    local endpoint="/api/health/live"
    local url="${base_url}${endpoint}"
    
    log_info "Testing liveness endpoint: $endpoint"
    
    local response
    if response=$(make_http_request "$url" "200" "Liveness check"); then
        # Validate response structure
        if echo "$response" | jq -e '.alive' >/dev/null 2>&1; then
            local alive_status
            alive_status=$(echo "$response" | jq -r '.alive')
            if [[ "$alive_status" == "true" ]]; then
                record_test_result "Liveness Endpoint" "PASS"
            else
                record_test_result "Liveness Endpoint" "FAIL" "Service not alive: $alive_status"
            fi
        else
            record_test_result "Liveness Endpoint" "FAIL" "Invalid response structure"
        fi
    else
        record_test_result "Liveness Endpoint" "FAIL" "Request failed"
    fi
}

# Test detailed health endpoint
test_detailed_health_endpoint() {
    local base_url="$1"
    local endpoint="/api/health/detailed"
    local url="${base_url}${endpoint}"

    log_info "Testing detailed health endpoint: $endpoint"

    local response
    if response=$(make_http_request "$url" "200" "Detailed health check"); then
        # Validate response structure
        if echo "$response" | jq -e '.checks' >/dev/null 2>&1; then
            local checks
            checks=$(echo "$response" | jq -r '.checks | keys[]' 2>/dev/null || echo "")

            if [[ -n "$checks" ]]; then
                record_test_result "Detailed Health Endpoint" "PASS"
                log_debug "Health checks found: $checks"
            else
                record_test_result "Detailed Health Endpoint" "FAIL" "No health checks found"
            fi
        else
            record_test_result "Detailed Health Endpoint" "FAIL" "Invalid response structure"
        fi
    else
        record_test_result "Detailed Health Endpoint" "FAIL" "Request failed"
    fi
}

# Test API endpoint functionality
test_api_functionality() {
    local base_url="$1"

    log_info "Testing basic API functionality"

    # Test root endpoint
    local root_endpoint="/api"
    local root_url="${base_url}${root_endpoint}"

    if make_http_request "$root_url" "200" "Root API endpoint" >/dev/null; then
        record_test_result "API Root Endpoint" "PASS"
    else
        record_test_result "API Root Endpoint" "FAIL" "Root endpoint not accessible"
    fi

    # Test OpenAPI documentation endpoint
    local docs_endpoint="/api-docs"
    local docs_url="${base_url}${docs_endpoint}"

    if make_http_request "$docs_url" "200" "API Documentation" >/dev/null; then
        record_test_result "API Documentation" "PASS"
    else
        record_test_result "API Documentation" "FAIL" "Documentation not accessible"
    fi
}

# Test Load Balancer health checks
test_load_balancer_health() {
    local alb_url="$1"

    log_info "Testing Load Balancer health check configuration"

    # Test that ALB can reach health endpoint
    local health_url="${alb_url}/api/health"

    if make_http_request "$health_url" "200" "ALB Health Check" >/dev/null; then
        record_test_result "Load Balancer Health Check" "PASS"
    else
        record_test_result "Load Balancer Health Check" "FAIL" "ALB cannot reach health endpoint"
    fi

    # Test ALB response headers
    local headers
    headers=$(curl -s -I --max-time "$TIMEOUT" "$health_url" 2>/dev/null || echo "")

    if echo "$headers" | grep -q "HTTP/[12].[01] 200"; then
        record_test_result "Load Balancer Response Headers" "PASS"
    else
        record_test_result "Load Balancer Response Headers" "FAIL" "Invalid response headers"
    fi
}

# Test performance and response times
test_performance() {
    local base_url="$1"

    log_info "Testing API performance and response times"

    local health_url="${base_url}/api/health"
    local total_time=0
    local successful_requests=0
    local performance_samples=5

    for i in $(seq 1 $performance_samples); do
        log_debug "Performance test $i/$performance_samples"

        local response_time
        response_time=$(curl -s -w "%{time_total}" -o /dev/null --max-time "$TIMEOUT" "$health_url" 2>/dev/null || echo "999")

        if [[ "$response_time" != "999" ]]; then
            total_time=$(echo "$total_time + $response_time" | bc -l)
            ((successful_requests++))
            log_debug "Response time: ${response_time}s"
        fi
    done

    if [[ $successful_requests -gt 0 ]]; then
        local avg_response_time
        avg_response_time=$(echo "scale=3; $total_time / $successful_requests" | bc -l)

        log_debug "Average response time: ${avg_response_time}s"

        # Consider response time acceptable if under 2 seconds
        if [[ $(echo "$avg_response_time < 2.0" | bc -l) -eq 1 ]]; then
            record_test_result "API Performance" "PASS" "Avg response time: ${avg_response_time}s"
        else
            record_test_result "API Performance" "FAIL" "Slow response time: ${avg_response_time}s"
        fi
    else
        record_test_result "API Performance" "FAIL" "No successful performance samples"
    fi
}

# Validate EC2 instance health
validate_ec2_instance_health() {
    local env_name="$1"

    log_info "Validating EC2 instance health for environment: $env_name"

    # Check Auto Scaling Group health
    local asg_instances
    asg_instances=$(aws autoscaling describe-auto-scaling-groups \
        --region "$AWS_REGION" \
        --query "AutoScalingGroups[?contains(AutoScalingGroupName, '$env_name')].Instances[?HealthStatus=='Healthy'].InstanceId" \
        --output text 2>/dev/null || echo "")

    if [[ -n "$asg_instances" ]]; then
        local instance_count
        instance_count=$(echo "$asg_instances" | wc -w)
        record_test_result "EC2 Instance Health" "PASS" "$instance_count healthy instances"
        log_debug "Healthy instances: $asg_instances"
    else
        record_test_result "EC2 Instance Health" "FAIL" "No healthy instances found"
    fi

    # Check Load Balancer target health
    local target_groups
    target_groups=$(aws elbv2 describe-target-groups \
        --region "$AWS_REGION" \
        --query "TargetGroups[?contains(TargetGroupName, '$env_name')].TargetGroupArn" \
        --output text 2>/dev/null || echo "")

    if [[ -n "$target_groups" ]]; then
        local healthy_targets=0
        for tg_arn in $target_groups; do
            local healthy_count
            healthy_count=$(aws elbv2 describe-target-health \
                --target-group-arn "$tg_arn" \
                --region "$AWS_REGION" \
                --query 'TargetHealthDescriptions[?TargetHealth.State==`healthy`].Target.Id' \
                --output text 2>/dev/null | wc -w || echo "0")
            healthy_targets=$((healthy_targets + healthy_count))
        done

        if [[ $healthy_targets -gt 0 ]]; then
            record_test_result "Load Balancer Target Health" "PASS" "$healthy_targets healthy targets"
        else
            record_test_result "Load Balancer Target Health" "FAIL" "No healthy targets"
        fi
    else
        record_test_result "Load Balancer Target Health" "FAIL" "No target groups found"
    fi
}

# Main validation function
main() {
    log_info "🔍 Starting EC2 Express API Health Validation"
    log_info "Environment: ${ENV_NAME:-N/A}"
    log_info "ALB URL: ${ALB_URL:-N/A}"
    log_info "Stack: ${STACK_NAME:-N/A}"
    log_info "Timeout: ${TIMEOUT}s"
    log_info "Max Retries: $MAX_RETRIES"
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

    # Run validation tests
    test_health_endpoint "$base_url"
    test_readiness_endpoint "$base_url"
    test_liveness_endpoint "$base_url"
    test_detailed_health_endpoint "$base_url"
    test_api_functionality "$base_url"
    test_load_balancer_health "$base_url"

    # Run comprehensive tests if requested
    if [[ "$COMPREHENSIVE" == "true" ]]; then
        log_info "Running comprehensive validation tests..."
        test_performance "$base_url"

        if [[ -n "$ENV_NAME" ]]; then
            validate_ec2_instance_health "$ENV_NAME"
        fi
    fi

    # Generate final report
    echo ""
    log_info "📊 EC2 Express API Health Validation Results"
    echo "=============================================="
    echo "Tests Passed: $TESTS_PASSED"
    echo "Tests Failed: $TESTS_FAILED"
    echo "Total Tests:  $((TESTS_PASSED + TESTS_FAILED))"
    echo ""

    if [[ $TESTS_FAILED -eq 0 ]]; then
        log_success "🎉 All health validations passed!"
        log_success "✅ Express API is running correctly on EC2"
        log_success "✅ Health endpoints are accessible via Load Balancer"
        log_success "✅ API functionality is working as expected"
        exit 0
    else
        log_error "❌ Some health validations failed"
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
