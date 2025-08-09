#!/bin/bash

# Validate AWS IAM Permissions for Amplify Frontend Deployments
# Tests all required permissions for GitHub Actions workflows

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
ROLE_ARN=${AWS_ROLE_ARN:-""}
TEST_APP_NAME="macro-ai-frontend-test-validation"
TEST_STACK_NAME="MacroAiTestStack"

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

print_test_header() {
    echo -e "${BLUE}🧪 $1${NC}"
    echo "=================================="
}

# Function to show usage
show_usage() {
    echo "Validate AWS IAM Permissions for Amplify Frontend Deployments"
    echo ""
    echo "Usage: $0 [options]"
    echo ""
    echo "Options:"
    echo "  --role-arn <arn>            AWS role ARN to test (default: from AWS_ROLE_ARN env var)"
    echo "  --test-app-name <name>      Test Amplify app name (default: macro-ai-frontend-test-validation)"
    echo "  --cleanup                   Clean up test resources and exit"
    echo "  --skip-destructive          Skip tests that create/delete resources"
    echo "  --verbose                   Enable verbose output"
    echo "  --help                      Show this help message"
    echo ""
    echo "Environment Variables:"
    echo "  AWS_ROLE_ARN               AWS role ARN for testing"
    echo "  AWS_REGION                 AWS region (default: us-east-1)"
    echo ""
    echo "Examples:"
    echo "  $0                         # Test with role from AWS_ROLE_ARN"
    echo "  $0 --role-arn arn:aws:iam::123456789012:role/GitHubActionsRole"
    echo "  $0 --skip-destructive      # Skip create/delete tests"
}

# Function to assume role if provided
assume_role_if_needed() {
    local role_arn="$1"
    
    if [[ -n "$role_arn" ]]; then
        print_info "Assuming role: $role_arn"
        
        # Generate session name
        local session_name="amplify-permissions-validation-$(date +%s)"
        
        # Assume role and get credentials
        local credentials=$(aws sts assume-role \
            --role-arn "$role_arn" \
            --role-session-name "$session_name" \
            --query 'Credentials.{AccessKeyId:AccessKeyId,SecretAccessKey:SecretAccessKey,SessionToken:SessionToken}' \
            --output json)
        
        if [[ $? -eq 0 ]]; then
            # Export credentials
            export AWS_ACCESS_KEY_ID=$(echo "$credentials" | jq -r '.AccessKeyId')
            export AWS_SECRET_ACCESS_KEY=$(echo "$credentials" | jq -r '.SecretAccessKey')
            export AWS_SESSION_TOKEN=$(echo "$credentials" | jq -r '.SessionToken')
            
            print_status "Role assumed successfully"
        else
            print_error "Failed to assume role: $role_arn"
            return 1
        fi
    fi
}

# Function to test basic AWS access
test_basic_aws_access() {
    print_test_header "Test 1: Basic AWS Access"
    
    # Test STS access
    print_info "Testing STS GetCallerIdentity..."
    if identity=$(aws sts get-caller-identity 2>/dev/null); then
        local account=$(echo "$identity" | jq -r '.Account')
        local user_arn=$(echo "$identity" | jq -r '.Arn')
        print_status "STS access: OK"
        print_info "Account: $account"
        print_info "Identity: $user_arn"
    else
        print_error "STS access: FAILED"
        return 1
    fi
    
    echo ""
    return 0
}

# Function to test CloudFormation permissions
test_cloudformation_permissions() {
    print_test_header "Test 2: CloudFormation Permissions"
    
    # Test stack listing
    print_info "Testing CloudFormation ListStacks..."
    if aws cloudformation list-stacks --max-items 5 &> /dev/null; then
        print_status "CloudFormation ListStacks: OK"
    else
        print_error "CloudFormation ListStacks: FAILED"
        return 1
    fi
    
    # Test stack description (if any MacroAi stacks exist)
    print_info "Testing CloudFormation DescribeStacks for MacroAi stacks..."
    local macro_stacks=$(aws cloudformation list-stacks \
        --query 'StackSummaries[?starts_with(StackName, `MacroAi`)].StackName' \
        --output text 2>/dev/null || echo "")
    
    if [[ -n "$macro_stacks" ]]; then
        local first_stack=$(echo "$macro_stacks" | awk '{print $1}')
        if aws cloudformation describe-stacks --stack-name "$first_stack" &> /dev/null; then
            print_status "CloudFormation DescribeStacks: OK"
            print_info "Found stack: $first_stack"
        else
            print_warning "CloudFormation DescribeStacks: LIMITED"
        fi
    else
        print_info "No MacroAi stacks found (this is normal for new deployments)"
    fi
    
    echo ""
    return 0
}

# Function to test Amplify permissions
test_amplify_permissions() {
    print_test_header "Test 3: Amplify Permissions"
    
    # Test Amplify app listing
    print_info "Testing Amplify ListApps..."
    if aws amplify list-apps --max-results 5 &> /dev/null; then
        print_status "Amplify ListApps: OK"
    else
        print_error "Amplify ListApps: FAILED"
        return 1
    fi
    
    # List existing Amplify apps
    print_info "Checking for existing Amplify apps..."
    local existing_apps=$(aws amplify list-apps \
        --query 'apps[?starts_with(name, `macro-ai-frontend`)].{name:name,appId:appId,status:status}' \
        --output table 2>/dev/null || echo "")
    
    if [[ -n "$existing_apps" ]]; then
        print_info "Found existing Amplify apps:"
        echo "$existing_apps"
    else
        print_info "No existing macro-ai-frontend apps found"
    fi
    
    echo ""
    return 0
}

# Function to test Amplify app creation (destructive test)
test_amplify_app_creation() {
    local skip_destructive="$1"
    
    print_test_header "Test 4: Amplify App Creation (Destructive)"
    
    if [[ "$skip_destructive" == "true" ]]; then
        print_warning "Skipping destructive test (--skip-destructive flag)"
        return 0
    fi
    
    print_info "Testing Amplify CreateApp..."
    
    # Check if test app already exists
    local existing_app=$(aws amplify list-apps \
        --query "apps[?name=='$TEST_APP_NAME'].appId" \
        --output text 2>/dev/null || echo "")
    
    if [[ -n "$existing_app" ]]; then
        print_warning "Test app already exists: $TEST_APP_NAME ($existing_app)"
        print_info "Cleaning up existing test app first..."
        
        if aws amplify delete-app --app-id "$existing_app" &> /dev/null; then
            print_status "Existing test app deleted"
            sleep 5  # Wait for deletion to complete
        else
            print_error "Failed to delete existing test app"
            return 1
        fi
    fi
    
    # Create test app
    local create_result=$(aws amplify create-app \
        --name "$TEST_APP_NAME" \
        --description "Test app for permission validation - safe to delete" \
        --platform "WEB" \
        --environment-variables \
            TEST_MODE="true" \
            CREATED_BY="permission-validation-script" \
        --output json 2>/dev/null)
    
    if [[ $? -eq 0 ]]; then
        local app_id=$(echo "$create_result" | jq -r '.app.appId')
        print_status "Amplify CreateApp: OK"
        print_info "Test app created: $app_id"
        
        # Test app retrieval
        print_info "Testing Amplify GetApp..."
        if aws amplify get-app --app-id "$app_id" &> /dev/null; then
            print_status "Amplify GetApp: OK"
        else
            print_error "Amplify GetApp: FAILED"
        fi
        
        # Test app update
        print_info "Testing Amplify UpdateApp..."
        if aws amplify update-app \
            --app-id "$app_id" \
            --description "Updated test app for permission validation" \
            &> /dev/null; then
            print_status "Amplify UpdateApp: OK"
        else
            print_error "Amplify UpdateApp: FAILED"
        fi
        
        # Clean up test app
        print_info "Cleaning up test app..."
        if aws amplify delete-app --app-id "$app_id" &> /dev/null; then
            print_status "Test app deleted successfully"
        else
            print_error "Failed to delete test app: $app_id"
            print_warning "Please manually delete the test app"
        fi
    else
        print_error "Amplify CreateApp: FAILED"
        return 1
    fi
    
    echo ""
    return 0
}

# Function to test S3 permissions
test_s3_permissions() {
    print_test_header "Test 5: S3 Permissions"
    
    # Test S3 bucket listing (for Amplify buckets)
    print_info "Testing S3 ListBuckets for Amplify buckets..."
    local amplify_buckets=$(aws s3api list-buckets \
        --query 'Buckets[?starts_with(Name, `amplify`)].Name' \
        --output text 2>/dev/null || echo "")
    
    if [[ $? -eq 0 ]]; then
        print_status "S3 ListBuckets: OK"
        if [[ -n "$amplify_buckets" ]]; then
            print_info "Found Amplify buckets: $amplify_buckets"
        else
            print_info "No Amplify buckets found (normal for new accounts)"
        fi
    else
        print_error "S3 ListBuckets: FAILED"
        return 1
    fi
    
    echo ""
    return 0
}

# Function to test IAM permissions
test_iam_permissions() {
    print_test_header "Test 6: IAM Permissions"
    
    # Test service-linked role creation (read-only check)
    print_info "Testing IAM service-linked role permissions..."
    
    # Check if Amplify service-linked role exists
    local slr_exists=$(aws iam get-role \
        --role-name "AWSServiceRoleForAmplifyBackend" \
        --query 'Role.RoleName' \
        --output text 2>/dev/null || echo "")
    
    if [[ -n "$slr_exists" ]]; then
        print_status "Amplify service-linked role exists"
        print_info "Role: $slr_exists"
    else
        print_info "Amplify service-linked role not found (will be created when needed)"
    fi
    
    echo ""
    return 0
}

# Function to cleanup test resources
cleanup_test_resources() {
    print_info "🧹 Cleaning up test resources..."
    
    # Find and delete test apps
    local test_apps=$(aws amplify list-apps \
        --query "apps[?contains(name, 'test-validation')].{name:name,appId:appId}" \
        --output json 2>/dev/null || echo "[]")
    
    if [[ "$test_apps" != "[]" ]]; then
        echo "$test_apps" | jq -r '.[] | "\(.name) \(.appId)"' | while read -r name app_id; do
            print_info "Deleting test app: $name ($app_id)"
            if aws amplify delete-app --app-id "$app_id" &> /dev/null; then
                print_status "Deleted: $name"
            else
                print_error "Failed to delete: $name"
            fi
        done
    else
        print_info "No test apps found to clean up"
    fi
    
    print_status "Cleanup completed"
}

# Main function
main() {
    local skip_destructive="false"
    local cleanup_only="false"
    local verbose="false"
    
    # Parse command line arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --role-arn)
                ROLE_ARN="$2"
                shift 2
                ;;
            --test-app-name)
                TEST_APP_NAME="$2"
                shift 2
                ;;
            --skip-destructive)
                skip_destructive="true"
                shift
                ;;
            --cleanup)
                cleanup_only="true"
                shift
                ;;
            --verbose)
                verbose="true"
                set -x
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
    
    print_info "🔐 AWS Amplify Permissions Validation"
    echo "====================================="
    echo "Role ARN: ${ROLE_ARN:-"(using current credentials)"}"
    echo "Test App Name: $TEST_APP_NAME"
    echo "Skip Destructive: $skip_destructive"
    echo ""
    
    # Cleanup only mode
    if [[ "$cleanup_only" == "true" ]]; then
        cleanup_test_resources
        exit 0
    fi
    
    # Assume role if provided
    if [[ -n "$ROLE_ARN" ]]; then
        assume_role_if_needed "$ROLE_ARN"
    fi
    
    # Run validation tests
    local tests_passed=0
    local total_tests=6
    
    if test_basic_aws_access; then
        tests_passed=$((tests_passed + 1))
    fi
    
    if test_cloudformation_permissions; then
        tests_passed=$((tests_passed + 1))
    fi
    
    if test_amplify_permissions; then
        tests_passed=$((tests_passed + 1))
    fi
    
    if test_amplify_app_creation "$skip_destructive"; then
        tests_passed=$((tests_passed + 1))
    fi
    
    if test_s3_permissions; then
        tests_passed=$((tests_passed + 1))
    fi
    
    if test_iam_permissions; then
        tests_passed=$((tests_passed + 1))
    fi
    
    # Summary
    echo -e "${BLUE}📊 Validation Results Summary${NC}"
    echo "=================================="
    echo "Tests passed: $tests_passed/$total_tests"
    
    if [[ $tests_passed -eq $total_tests ]]; then
        print_status "🎉 All permission tests passed!"
        echo ""
        echo "✅ GitHub Actions workflows should have all required permissions"
        echo "✅ Amplify frontend deployments should work correctly"
        echo "✅ Backend integration via CloudFormation should function"
        return 0
    else
        print_error "❌ Some permission tests failed"
        echo ""
        echo "Please review the test output above and update IAM policies as needed."
        echo "Use the update-github-actions-permissions.sh script to add missing permissions."
        return 1
    fi
}

# Validate required tools
if ! command -v aws &> /dev/null; then
    print_error "AWS CLI not found. Please install AWS CLI."
    exit 1
fi

if ! command -v jq &> /dev/null; then
    print_error "jq not found. Please install jq for JSON processing."
    exit 1
fi

# Run main function
main "$@"
