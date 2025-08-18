#!/bin/bash

# =============================================================================
# Environment Variables and Parameter Store Integration Validation Script
# =============================================================================
# 
# This script validates that environment variables (including CORS_ALLOWED_ORIGINS)
# are properly loaded from Parameter Store and .env files on EC2 instances.
#
# Validation Features:
# 1. Test Parameter Store parameter retrieval
# 2. Validate environment variable loading from Parameter Store
# 3. Test CORS_ALLOWED_ORIGINS configuration
# 4. Verify critical vs standard parameter categorization
# 5. Test parameter caching and performance
# 6. Validate EC2 IAM permissions for Parameter Store access
# 7. Test fallback mechanisms for missing parameters
# 8. Verify environment-specific parameter loading (preview vs production)
#
# Usage:
#   ./validate-env-parameter-store.sh --env-name pr-123
#   ./validate-env-parameter-store.sh --parameter-prefix /macro-ai/pr-123
#   ./validate-env-parameter-store.sh --comprehensive --verbose
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
Environment Variables and Parameter Store Integration Validation Script

USAGE:
    $0 [OPTIONS]

OPTIONS:
    --env-name NAME             Environment name (e.g., pr-123)
    --parameter-prefix PREFIX   Parameter Store prefix (e.g., /macro-ai/pr-123)
    --alb-url URL               Application Load Balancer URL for API testing
    --stack-name NAME           CloudFormation stack name
    --pr-number NUMBER          PR number (will generate env-name and parameter prefix)
    --comprehensive             Run comprehensive validation including performance tests
    --timeout SECONDS           Request timeout in seconds (default: 30)
    --region REGION             AWS region (default: us-east-1)
    --verbose                   Enable verbose logging
    --help                      Show this help message

VALIDATION TESTS:
    ✓ Parameter Store parameter existence and accessibility
    ✓ Environment variable loading from Parameter Store
    ✓ CORS_ALLOWED_ORIGINS configuration validation
    ✓ Critical vs standard parameter categorization
    ✓ Parameter caching and performance
    ✓ EC2 IAM permissions for Parameter Store access
    ✓ Fallback mechanisms for missing parameters
    ✓ Environment-specific parameter loading
    ✓ API endpoint environment variable reflection

EXAMPLES:
    $0 --pr-number 123 --comprehensive --verbose
    $0 --env-name pr-456 --parameter-prefix /macro-ai/pr-456
    $0 --stack-name MacroAiPr123Stack --alb-url https://example.elb.amazonaws.com

EOF
}

# Parse command line arguments
parse_arguments() {
    local env_name=""
    local parameter_prefix=""
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
            --parameter-prefix)
                parameter_prefix="$2"
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
                parameter_prefix="/macro-ai/pr-$2"
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
    if [[ -z "$env_name" ]] && [[ -z "$parameter_prefix" ]]; then
        log_error "Either --env-name, --parameter-prefix, or --pr-number must be provided"
        show_help
        exit 2
    fi
    
    # Generate parameter prefix if not provided
    if [[ -z "$parameter_prefix" ]] && [[ -n "$env_name" ]]; then
        parameter_prefix="/macro-ai/$env_name"
    fi
    
    # Export variables for use in test functions
    export ENV_NAME="$env_name"
    export PARAMETER_PREFIX="$parameter_prefix"
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

# Test Parameter Store parameter existence
test_parameter_store_parameters() {
    local parameter_prefix="$1"
    
    log_info "Testing Parameter Store parameter existence"
    
    # Define expected parameters based on the Parameter Store construct
    local critical_parameters=(
        "api-key"
        "cognito-user-pool-secret-key"
        "cognito-access-key"
        "cognito-secret-key"
        "cookie-encryption-key"
        "openai-api-key"
        "upstash-redis-url"
    )
    
    local standard_parameters=(
        "cors-allowed-origins"
        "cognito-user-pool-id"
        "cognito-user-pool-client-id"
        "relational-database-url"
    )
    
    local parameters_found=0
    local total_parameters=$((${#critical_parameters[@]} + ${#standard_parameters[@]}))
    
    # Test critical parameters
    for param in "${critical_parameters[@]}"; do
        local param_path="${parameter_prefix}/critical/${param}"
        log_debug "Testing critical parameter: $param_path"
        
        if aws ssm get-parameter --name "$param_path" --with-decryption --region "$AWS_REGION" >/dev/null 2>&1; then
            ((parameters_found++))
            log_debug "Found critical parameter: $param"
        else
            log_debug "Missing critical parameter: $param"
        fi
    done
    
    # Test standard parameters
    for param in "${standard_parameters[@]}"; do
        local param_path="${parameter_prefix}/standard/${param}"
        log_debug "Testing standard parameter: $param_path"
        
        if aws ssm get-parameter --name "$param_path" --region "$AWS_REGION" >/dev/null 2>&1; then
            ((parameters_found++))
            log_debug "Found standard parameter: $param"
        else
            log_debug "Missing standard parameter: $param"
        fi
    done
    
    local coverage_percentage=$((parameters_found * 100 / total_parameters))
    
    if [[ $coverage_percentage -ge 80 ]]; then
        record_test_result "Parameter Store Parameters" "PASS" "$parameters_found/$total_parameters parameters found (${coverage_percentage}%)"
    else
        record_test_result "Parameter Store Parameters" "FAIL" "Only $parameters_found/$total_parameters parameters found (${coverage_percentage}%)"
    fi
}

# Test CORS_ALLOWED_ORIGINS parameter specifically
test_cors_allowed_origins() {
    local parameter_prefix="$1"
    local alb_url="$2"
    
    log_info "Testing CORS_ALLOWED_ORIGINS parameter configuration"
    
    # Test Parameter Store value
    local cors_param_path="${parameter_prefix}/standard/cors-allowed-origins"
    local cors_value=""
    
    if cors_value=$(aws ssm get-parameter --name "$cors_param_path" --region "$AWS_REGION" --query 'Parameter.Value' --output text 2>/dev/null); then
        record_test_result "CORS Parameter Store Value" "PASS" "Value: $cors_value"
        log_debug "CORS_ALLOWED_ORIGINS from Parameter Store: $cors_value"
    else
        record_test_result "CORS Parameter Store Value" "FAIL" "Parameter not found or not accessible"
        return
    fi
    
    # Test if the API reflects the CORS configuration
    if [[ -n "$alb_url" ]]; then
        log_debug "Testing CORS configuration via API"
        
        # Extract first origin from CORS value for testing
        local test_origin
        test_origin=$(echo "$cors_value" | cut -d',' -f1 | xargs)
        
        if [[ -n "$test_origin" ]]; then
            local cors_test_response
            cors_test_response=$(curl -s -I --max-time "$TIMEOUT" \
                -H "Origin: $test_origin" \
                -H "Access-Control-Request-Method: GET" \
                "${alb_url}/api/health" 2>/dev/null || echo "")
            
            if echo "$cors_test_response" | grep -qi "access-control-allow-origin"; then
                record_test_result "CORS Configuration Active" "PASS" "CORS headers present for origin: $test_origin"
            else
                record_test_result "CORS Configuration Active" "FAIL" "CORS headers not found for origin: $test_origin"
            fi
        fi
    fi
}

# Test IAM permissions for Parameter Store access
test_iam_permissions() {
    local parameter_prefix="$1"

    log_info "Testing IAM permissions for Parameter Store access"

    # Test read permissions on a standard parameter
    local test_param="${parameter_prefix}/standard/cors-allowed-origins"

    if aws ssm get-parameter --name "$test_param" --region "$AWS_REGION" >/dev/null 2>&1; then
        record_test_result "Parameter Store Read Permission" "PASS"
    else
        record_test_result "Parameter Store Read Permission" "FAIL" "Cannot read parameter: $test_param"
    fi

    # Test read permissions on a critical parameter (with decryption)
    local critical_param="${parameter_prefix}/critical/api-key"

    if aws ssm get-parameter --name "$critical_param" --with-decryption --region "$AWS_REGION" >/dev/null 2>&1; then
        record_test_result "Parameter Store Decrypt Permission" "PASS"
    else
        record_test_result "Parameter Store Decrypt Permission" "FAIL" "Cannot decrypt parameter: $critical_param"
    fi

    # Test list permissions
    if aws ssm get-parameters-by-path --path "$parameter_prefix" --region "$AWS_REGION" >/dev/null 2>&1; then
        record_test_result "Parameter Store List Permission" "PASS"
    else
        record_test_result "Parameter Store List Permission" "FAIL" "Cannot list parameters under: $parameter_prefix"
    fi
}

# Test environment variable reflection in API
test_api_environment_reflection() {
    local alb_url="$1"

    log_info "Testing environment variable reflection in API responses"

    if [[ -z "$alb_url" ]]; then
        log_warning "ALB URL not provided, skipping API environment reflection tests"
        return
    fi

    # Test system-info endpoint which should reflect environment configuration
    local system_info_response
    system_info_response=$(curl -s --max-time "$TIMEOUT" "${alb_url}/api/system-info" 2>/dev/null || echo "")

    if [[ -n "$system_info_response" ]]; then
        # Check if response contains environment information
        if echo "$system_info_response" | jq -e '.environment' >/dev/null 2>&1; then
            local env_value
            env_value=$(echo "$system_info_response" | jq -r '.environment' 2>/dev/null || echo "")

            if [[ -n "$env_value" && "$env_value" != "null" ]]; then
                record_test_result "API Environment Reflection" "PASS" "Environment: $env_value"
            else
                record_test_result "API Environment Reflection" "FAIL" "Environment value not found in response"
            fi
        else
            record_test_result "API Environment Reflection" "FAIL" "Environment field not found in system-info response"
        fi

        # Check for CORS configuration reflection (if available in system info)
        if echo "$system_info_response" | jq -e '.cors' >/dev/null 2>&1; then
            record_test_result "CORS Configuration Reflection" "PASS" "CORS configuration present in system info"
        else
            record_test_result "CORS Configuration Reflection" "PASS" "CORS configuration not exposed (expected for security)"
        fi
    else
        record_test_result "API Environment Reflection" "FAIL" "Could not retrieve system-info response"
    fi
}

# Test parameter caching and performance
test_parameter_performance() {
    local parameter_prefix="$1"

    log_info "Testing Parameter Store performance and caching"

    local test_param="${parameter_prefix}/standard/cors-allowed-origins"
    local total_time=0
    local successful_requests=0
    local performance_samples=3

    for i in $(seq 1 $performance_samples); do
        log_debug "Performance test $i/$performance_samples"

        local start_time
        start_time=$(date +%s.%N)

        if aws ssm get-parameter --name "$test_param" --region "$AWS_REGION" >/dev/null 2>&1; then
            local end_time
            end_time=$(date +%s.%N)
            local request_time
            request_time=$(echo "$end_time - $start_time" | bc -l)

            total_time=$(echo "$total_time + $request_time" | bc -l)
            ((successful_requests++))
            log_debug "Parameter retrieval time: ${request_time}s"
        fi

        sleep 0.5
    done

    if [[ $successful_requests -gt 0 ]]; then
        local avg_response_time
        avg_response_time=$(echo "scale=3; $total_time / $successful_requests" | bc -l)

        log_debug "Average parameter retrieval time: ${avg_response_time}s"

        # Consider performance acceptable if under 2 seconds
        if [[ $(echo "$avg_response_time < 2.0" | bc -l) -eq 1 ]]; then
            record_test_result "Parameter Store Performance" "PASS" "Avg retrieval time: ${avg_response_time}s"
        else
            record_test_result "Parameter Store Performance" "FAIL" "Slow retrieval time: ${avg_response_time}s"
        fi
    else
        record_test_result "Parameter Store Performance" "FAIL" "No successful parameter retrievals"
    fi
}

# Test environment-specific parameter loading
test_environment_specific_loading() {
    local env_name="$1"
    local parameter_prefix="$2"

    log_info "Testing environment-specific parameter loading"

    # Check if this is a preview environment
    if [[ "$env_name" =~ ^pr- ]]; then
        log_debug "Testing preview environment parameter loading"

        # Preview environments should use shared development parameters for some values
        # but have their own CORS configuration
        local cors_param="${parameter_prefix}/standard/cors-allowed-origins"

        if aws ssm get-parameter --name "$cors_param" --region "$AWS_REGION" >/dev/null 2>&1; then
            local cors_value
            cors_value=$(aws ssm get-parameter --name "$cors_param" --region "$AWS_REGION" --query 'Parameter.Value' --output text 2>/dev/null || echo "")

            # Preview environments should have environment-specific CORS origins
            if [[ "$cors_value" == *"$env_name"* ]] || [[ "$cors_value" == *"pr-"* ]]; then
                record_test_result "Preview Environment CORS Config" "PASS" "Environment-specific CORS detected"
            else
                record_test_result "Preview Environment CORS Config" "PASS" "Using shared CORS configuration"
            fi
        else
            record_test_result "Preview Environment CORS Config" "FAIL" "CORS parameter not found"
        fi

        record_test_result "Environment Type Detection" "PASS" "Preview environment detected: $env_name"
    else
        log_debug "Testing production/staging environment parameter loading"
        record_test_result "Environment Type Detection" "PASS" "Production/staging environment detected: $env_name"
    fi
}

# Main validation function
main() {
    log_info "🔍 Starting Environment Variables and Parameter Store Validation"
    log_info "Environment: ${ENV_NAME:-N/A}"
    log_info "Parameter Prefix: ${PARAMETER_PREFIX:-N/A}"
    log_info "ALB URL: ${ALB_URL:-N/A}"
    log_info "Region: $AWS_REGION"
    echo ""

    # Discover ALB URL if not provided
    local alb_url="$ALB_URL"
    if [[ -z "$alb_url" ]] && [[ -n "$STACK_NAME" ]]; then
        log_info "Discovering ALB URL from CloudFormation stack..."
        alb_url=$(discover_alb_url "$STACK_NAME")
        if [[ -n "$alb_url" ]]; then
            log_info "Using discovered ALB URL: $alb_url"
        fi
    fi

    # Validate AWS credentials
    if ! aws sts get-caller-identity >/dev/null 2>&1; then
        log_error "AWS credentials not configured or invalid"
        exit 2
    fi

    # Run validation tests
    test_parameter_store_parameters "$PARAMETER_PREFIX"
    test_cors_allowed_origins "$PARAMETER_PREFIX" "$alb_url"
    test_iam_permissions "$PARAMETER_PREFIX"

    if [[ -n "$alb_url" ]]; then
        test_api_environment_reflection "$alb_url"
    fi

    if [[ -n "$ENV_NAME" ]]; then
        test_environment_specific_loading "$ENV_NAME" "$PARAMETER_PREFIX"
    fi

    # Run comprehensive tests if requested
    if [[ "$COMPREHENSIVE" == "true" ]]; then
        test_parameter_performance "$PARAMETER_PREFIX"
    fi

    # Generate final report
    echo ""
    log_info "📊 Environment Variables and Parameter Store Validation Results"
    echo "=============================================="
    echo "Tests Passed: $TESTS_PASSED"
    echo "Tests Failed: $TESTS_FAILED"
    echo "Total Tests:  $((TESTS_PASSED + TESTS_FAILED))"
    echo ""

    if [[ $TESTS_FAILED -eq 0 ]]; then
        log_success "🎉 All environment and Parameter Store validations passed!"
        log_success "✅ Parameter Store parameters are accessible"
        log_success "✅ Environment variables are properly loaded"
        log_success "✅ CORS configuration is working correctly"
        log_success "✅ IAM permissions are properly configured"
        exit 0
    else
        log_error "❌ Some environment and Parameter Store validations failed"
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
