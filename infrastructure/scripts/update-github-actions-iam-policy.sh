#!/bin/bash

# Script to update the GitHub Actions IAM role with enhanced permissions
# This applies the enhanced-github-actions-policy.json to the actual AWS IAM role

set -e

# Configuration
ROLE_NAME="GitHubActionsDeploymentRole"
POLICY_FILE="infrastructure/iam-policies/enhanced-github-actions-policy.json"
POLICY_NAME="GitHubActionsDeploymentPolicy"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if AWS CLI is configured
check_aws_cli() {
    log_info "Checking AWS CLI configuration..."
    
    if ! command -v aws &> /dev/null; then
        log_error "AWS CLI is not installed"
        exit 1
    fi
    
    if ! aws sts get-caller-identity &> /dev/null; then
        log_error "AWS CLI is not configured or credentials are invalid"
        exit 1
    fi
    
    local caller_identity
    caller_identity=$(aws sts get-caller-identity)
    log_success "AWS CLI configured. Current identity: $(echo "$caller_identity" | jq -r '.Arn')"
}

# Check if policy file exists
check_policy_file() {
    log_info "Checking policy file: $POLICY_FILE"
    
    if [[ ! -f "$POLICY_FILE" ]]; then
        log_error "Policy file not found: $POLICY_FILE"
        exit 1
    fi
    
    # Validate JSON syntax
    if ! jq empty "$POLICY_FILE" 2>/dev/null; then
        log_error "Policy file contains invalid JSON: $POLICY_FILE"
        exit 1
    fi
    
    log_success "Policy file found and valid"
}

# Check if IAM role exists
check_iam_role() {
    log_info "Checking if IAM role exists: $ROLE_NAME"
    
    if aws iam get-role --role-name "$ROLE_NAME" &> /dev/null; then
        log_success "IAM role found: $ROLE_NAME"
        return 0
    else
        log_error "IAM role not found: $ROLE_NAME"
        log_error "Please ensure the role exists before running this script"
        exit 1
    fi
}

# Get current policy version
get_current_policy() {
    log_info "Getting current inline policies for role: $ROLE_NAME"
    
    local policies
    policies=$(aws iam list-role-policies --role-name "$ROLE_NAME" --query "PolicyNames" --output text)
    
    if [[ -n "$policies" ]]; then
        log_info "Current inline policies: $policies"
        
        # Show current policy if it exists
        if echo "$policies" | grep -q "$POLICY_NAME"; then
            log_info "Current policy document for $POLICY_NAME:"
            aws iam get-role-policy --role-name "$ROLE_NAME" --policy-name "$POLICY_NAME" --query "PolicyDocument" --output json | jq .
        fi
    else
        log_warning "No inline policies found for role: $ROLE_NAME"
    fi
}

# Apply the enhanced policy
apply_policy() {
    log_info "Applying enhanced policy to role: $ROLE_NAME"
    
    # Apply the policy
    if aws iam put-role-policy \
        --role-name "$ROLE_NAME" \
        --policy-name "$POLICY_NAME" \
        --policy-document "file://$POLICY_FILE"; then
        log_success "Policy applied successfully!"
    else
        log_error "Failed to apply policy"
        exit 1
    fi
}

# Verify the policy was applied
verify_policy() {
    log_info "Verifying policy was applied correctly..."
    
    # Get the applied policy
    local applied_policy
    applied_policy=$(aws iam get-role-policy --role-name "$ROLE_NAME" --policy-name "$POLICY_NAME" --query "PolicyDocument" --output json)
    
    # Check if it contains the EC2HealthCheckPermissions
    if echo "$applied_policy" | jq -r '.Statement[] | select(.Sid == "EC2HealthCheckPermissions") | .Action[]' | grep -q "autoscaling:DescribeAutoScalingGroups"; then
        log_success "✅ EC2HealthCheckPermissions found in applied policy"
        log_success "✅ autoscaling:DescribeAutoScalingGroups permission confirmed"
    else
        log_error "❌ EC2HealthCheckPermissions not found in applied policy"
        exit 1
    fi
    
    log_info "Applied policy permissions:"
    echo "$applied_policy" | jq -r '.Statement[] | select(.Sid == "EC2HealthCheckPermissions") | .Action[]' | sed 's/^/  - /'
}

# Main execution
main() {
    log_info "🚀 Starting GitHub Actions IAM policy update..."
    log_info "This will apply enhanced permissions to: $ROLE_NAME"
    
    check_aws_cli
    check_policy_file
    check_iam_role
    get_current_policy
    
    log_warning "⚠️  This will update the IAM policy for $ROLE_NAME"
    read -p "Do you want to continue? (y/N): " -n 1 -r
    echo
    
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        apply_policy
        verify_policy
        
        log_success "🎉 IAM policy update completed successfully!"
        log_info "The GitHub Actions role now has the required permissions for EC2 health checking"
        log_info "You can now trigger a new CI deployment to test the fix"
    else
        log_info "Operation cancelled"
        exit 0
    fi
}

# Show help
show_help() {
    cat << EOF
GitHub Actions IAM Policy Update Script

This script applies the enhanced IAM policy to the GitHub Actions deployment role.

Usage: $0 [OPTIONS]

Options:
    -h, --help     Show this help message
    --dry-run      Show what would be done without making changes
    --force        Skip confirmation prompt

Environment Variables:
    AWS_PROFILE    AWS profile to use (optional)
    AWS_REGION     AWS region (optional, defaults to configured region)

Examples:
    $0                    # Interactive mode with confirmation
    $0 --force           # Apply without confirmation
    $0 --dry-run         # Show current policy without changes

EOF
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--help)
            show_help
            exit 0
            ;;
        --dry-run)
            log_info "🔍 DRY RUN MODE - No changes will be made"
            check_aws_cli
            check_policy_file
            check_iam_role
            get_current_policy
            log_info "Policy file that would be applied: $POLICY_FILE"
            jq . "$POLICY_FILE"
            exit 0
            ;;
        --force)
            FORCE=true
            shift
            ;;
        *)
            log_error "Unknown option: $1"
            show_help
            exit 1
            ;;
    esac
done

# Run main function
main
