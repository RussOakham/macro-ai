#!/bin/bash

# Update GitHub Actions IAM Role with Amplify Permissions
# Adds necessary AWS Amplify permissions to existing GitHub Actions role

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
ROLE_NAME=${GITHUB_ACTIONS_ROLE_NAME:-"GitHubActionsRole"}
POLICY_NAME="MacroAiAmplifyDeploymentPolicy"
ENHANCED_POLICY_NAME="MacroAiEnhancedGitHubActionsPolicy"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
POLICIES_DIR="$SCRIPT_DIR/../iam-policies"

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
    echo "Update GitHub Actions IAM Role with Amplify Permissions"
    echo ""
    echo "Usage: $0 [options]"
    echo ""
    echo "Options:"
    echo "  --role-name <name>          GitHub Actions role name (default: GitHubActionsRole)"
    echo "  --policy-name <name>        Amplify policy name (default: MacroAiAmplifyDeploymentPolicy)"
    echo "  --enhanced-policy           Use enhanced policy with all permissions"
    echo "  --dry-run                   Show what would be done without executing"
    echo "  --validate-only             Only validate existing permissions"
    echo "  --help                      Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0                          # Update with default settings"
    echo "  $0 --enhanced-policy        # Use comprehensive enhanced policy"
    echo "  $0 --dry-run                # Preview changes without applying"
    echo "  $0 --validate-only          # Check current permissions"
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

# Function to check if role exists
check_role_exists() {
    local role_name="$1"
    
    print_info "Checking if IAM role exists: $role_name"
    
    if aws iam get-role --role-name "$role_name" &> /dev/null; then
        print_status "IAM role found: $role_name"
        return 0
    else
        print_error "IAM role not found: $role_name"
        print_info "Please create the role first using the CI/CD setup guide"
        return 1
    fi
}

# Function to get current role policies
get_current_policies() {
    local role_name="$1"
    
    print_info "Getting current attached policies for role: $role_name"
    
    # Get managed policies
    local managed_policies=$(aws iam list-attached-role-policies \
        --role-name "$role_name" \
        --query 'AttachedPolicies[].PolicyName' \
        --output text 2>/dev/null || echo "")
    
    # Get inline policies
    local inline_policies=$(aws iam list-role-policies \
        --role-name "$role_name" \
        --query 'PolicyNames' \
        --output text 2>/dev/null || echo "")
    
    echo "Current managed policies: $managed_policies"
    echo "Current inline policies: $inline_policies"
    
    return 0
}

# Function to create or update IAM policy
create_or_update_policy() {
    local policy_name="$1"
    local policy_file="$2"
    local description="$3"
    local dry_run="$4"
    
    print_info "Creating or updating IAM policy: $policy_name"
    
    if [[ ! -f "$policy_file" ]]; then
        print_error "Policy file not found: $policy_file"
        return 1
    fi
    
    # Validate JSON
    if ! jq . "$policy_file" > /dev/null 2>&1; then
        print_error "Invalid JSON in policy file: $policy_file"
        return 1
    fi
    
    print_status "Policy file validated: $policy_file"
    
    # Get AWS account ID
    local account_id=$(aws sts get-caller-identity --query Account --output text)
    local policy_arn="arn:aws:iam::${account_id}:policy/${policy_name}"
    
    if [[ "$dry_run" == "true" ]]; then
        print_info "[DRY RUN] Would create/update policy: $policy_name"
        print_info "[DRY RUN] Policy ARN: $policy_arn"
        return 0
    fi
    
    # Check if policy exists
    if aws iam get-policy --policy-arn "$policy_arn" &> /dev/null; then
        print_info "Policy exists, creating new version: $policy_name"
        
        # Create new policy version
        local version_id=$(aws iam create-policy-version \
            --policy-arn "$policy_arn" \
            --policy-document "file://$policy_file" \
            --set-as-default \
            --query 'PolicyVersion.VersionId' \
            --output text)
        
        print_status "Policy updated with new version: $version_id"
    else
        print_info "Creating new policy: $policy_name"
        
        # Create new policy
        aws iam create-policy \
            --policy-name "$policy_name" \
            --policy-document "file://$policy_file" \
            --description "$description" \
            > /dev/null
        
        print_status "Policy created: $policy_name"
    fi
    
    echo "$policy_arn"
}

# Function to attach policy to role
attach_policy_to_role() {
    local role_name="$1"
    local policy_arn="$2"
    local dry_run="$3"
    
    print_info "Attaching policy to role: $role_name"
    
    if [[ "$dry_run" == "true" ]]; then
        print_info "[DRY RUN] Would attach policy: $policy_arn"
        return 0
    fi
    
    # Check if policy is already attached
    if aws iam list-attached-role-policies \
        --role-name "$role_name" \
        --query "AttachedPolicies[?PolicyArn=='$policy_arn'].PolicyArn" \
        --output text | grep -q "$policy_arn"; then
        print_status "Policy already attached to role"
    else
        aws iam attach-role-policy \
            --role-name "$role_name" \
            --policy-arn "$policy_arn"
        
        print_status "Policy attached to role successfully"
    fi
}

# Function to validate permissions
validate_permissions() {
    local role_name="$1"
    
    print_info "Validating current permissions for role: $role_name"
    
    # Test basic AWS access
    print_info "Testing basic AWS access..."
    if aws sts get-caller-identity &> /dev/null; then
        print_status "Basic AWS access: OK"
    else
        print_error "Basic AWS access: FAILED"
        return 1
    fi
    
    # Test CloudFormation access
    print_info "Testing CloudFormation access..."
    if aws cloudformation list-stacks --max-items 1 &> /dev/null; then
        print_status "CloudFormation access: OK"
    else
        print_warning "CloudFormation access: LIMITED"
    fi
    
    # Test Amplify access
    print_info "Testing Amplify access..."
    if aws amplify list-apps --max-results 1 &> /dev/null; then
        print_status "Amplify access: OK"
    else
        print_warning "Amplify access: NOT AVAILABLE (expected if policy not yet applied)"
    fi
    
    # Get role details
    print_info "Role details:"
    aws iam get-role --role-name "$role_name" --query 'Role.{RoleName:RoleName,CreateDate:CreateDate,Description:Description}' --output table
    
    # List attached policies
    print_info "Attached managed policies:"
    aws iam list-attached-role-policies --role-name "$role_name" --query 'AttachedPolicies[].{PolicyName:PolicyName,PolicyArn:PolicyArn}' --output table
    
    return 0
}

# Main function
main() {
    local dry_run="false"
    local validate_only="false"
    local use_enhanced_policy="false"
    
    # Parse command line arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --role-name)
                ROLE_NAME="$2"
                shift 2
                ;;
            --policy-name)
                POLICY_NAME="$2"
                shift 2
                ;;
            --enhanced-policy)
                use_enhanced_policy="true"
                shift
                ;;
            --dry-run)
                dry_run="true"
                shift
                ;;
            --validate-only)
                validate_only="true"
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
    
    print_info "🔐 GitHub Actions IAM Role Update for Amplify"
    echo "=============================================="
    echo "Role Name: $ROLE_NAME"
    echo "Policy Name: $POLICY_NAME"
    echo "Enhanced Policy: $use_enhanced_policy"
    echo "Dry Run: $dry_run"
    echo ""
    
    # Validate AWS setup
    validate_aws
    
    # Check if role exists
    if ! check_role_exists "$ROLE_NAME"; then
        exit 1
    fi
    
    # Get current policies
    get_current_policies "$ROLE_NAME"
    echo ""
    
    # If validate-only mode, exit after validation
    if [[ "$validate_only" == "true" ]]; then
        validate_permissions "$ROLE_NAME"
        exit 0
    fi
    
    # Determine which policy to use
    local policy_file
    local policy_description
    
    if [[ "$use_enhanced_policy" == "true" ]]; then
        policy_file="$POLICIES_DIR/enhanced-github-actions-policy.json"
        policy_description="Enhanced GitHub Actions policy with CDK and Amplify permissions for Macro AI"
        POLICY_NAME="$ENHANCED_POLICY_NAME"
    else
        policy_file="$POLICIES_DIR/amplify-github-actions-policy.json"
        policy_description="Amplify-specific permissions for GitHub Actions in Macro AI project"
    fi
    
    print_info "Using policy file: $policy_file"
    
    # Create or update the policy
    local policy_arn
    if policy_arn=$(create_or_update_policy "$POLICY_NAME" "$policy_file" "$policy_description" "$dry_run"); then
        print_status "Policy operation completed"
        
        if [[ "$dry_run" != "true" ]]; then
            # Attach policy to role
            attach_policy_to_role "$ROLE_NAME" "$policy_arn" "$dry_run"
            
            # Validate permissions
            echo ""
            print_info "Validating updated permissions..."
            validate_permissions "$ROLE_NAME"
        fi
    else
        print_error "Policy operation failed"
        exit 1
    fi
    
    echo ""
    if [[ "$dry_run" == "true" ]]; then
        print_info "🎯 Dry run completed successfully"
        print_info "Run without --dry-run to apply changes"
    else
        print_status "🎉 IAM role update completed successfully!"
        print_info "GitHub Actions workflows now have Amplify permissions"
        print_info "Policy ARN: $policy_arn"
    fi
}

# Run main function
main "$@"
