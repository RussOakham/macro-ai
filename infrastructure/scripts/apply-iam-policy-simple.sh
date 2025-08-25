#!/bin/bash

# Simple script to apply the GitHub Actions IAM policy without external dependencies
# This script applies the enhanced-github-actions-policy.json to the actual AWS IAM role

set -e

# Configuration
ROLE_NAME="GitHubActionsDeploymentRole"
POLICY_FILE="../iam-policies/enhanced-github-actions-policy.json"
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
log_info "🚀 Starting GitHub Actions IAM policy update..."
log_info "Checking AWS CLI configuration..."

if ! command -v aws &> /dev/null; then
    log_error "AWS CLI is not installed"
    exit 1
fi

if ! aws sts get-caller-identity &> /dev/null; then
    log_error "AWS CLI is not configured or credentials are invalid"
    exit 1
fi

log_success "AWS CLI configured and working"

# Check if policy file exists
log_info "Checking policy file: $POLICY_FILE"

if [[ ! -f "$POLICY_FILE" ]]; then
    log_error "Policy file not found: $POLICY_FILE"
    exit 1
fi

log_success "Policy file found"

# Check if IAM role exists
log_info "Checking if IAM role exists: $ROLE_NAME"

if aws iam get-role --role-name "$ROLE_NAME" &> /dev/null; then
    log_success "IAM role found: $ROLE_NAME"
else
    log_error "IAM role not found: $ROLE_NAME"
    log_error "Please ensure the role exists before running this script"
    exit 1
fi

# Show current policies
log_info "Getting current inline policies for role: $ROLE_NAME"
policies=$(aws iam list-role-policies --role-name "$ROLE_NAME" --query "PolicyNames" --output text)

if [[ -n "$policies" ]]; then
    log_info "Current inline policies: $policies"
else
    log_warning "No inline policies found for role: $ROLE_NAME"
fi

# Confirm before applying
log_warning "⚠️  This will update the IAM policy for $ROLE_NAME"
log_warning "⚠️  The policy will include permissions for:"
log_warning "    - ECR access (Docker image push/pull)"
log_warning "    - ECS deployment and management"
log_warning "    - Service health checking (ECS/EC2)"
log_warning "    - Amplify deployment and management"

read -p "Do you want to continue? (y/N): " -n 1 -r
echo

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    log_info "Operation cancelled"
    exit 0
fi

# Apply the policy
log_info "Applying enhanced policy to role: $ROLE_NAME"

if aws iam put-role-policy \
    --role-name "$ROLE_NAME" \
    --policy-name "$POLICY_NAME" \
    --policy-document "file://$POLICY_FILE"; then
    log_success "Policy applied successfully!"
else
    log_error "Failed to apply policy"
    exit 1
fi

# Verify the policy was applied
log_info "Verifying policy was applied correctly..."

# Get the applied policy
applied_policy=$(aws iam get-role-policy --role-name "$ROLE_NAME" --policy-name "$POLICY_NAME" --query "PolicyDocument" --output json)

# Check if it contains the required permissions
if echo "$applied_policy" | grep -q "ServiceHealthCheckPermissions" && echo "$applied_policy" | grep -q "ecr:GetAuthorizationToken"; then
    log_success "✅ ServiceHealthCheckPermissions found in applied policy"
    log_success "✅ ECR permissions confirmed"
else
    log_error "❌ Required permissions not found in applied policy"
    exit 1
fi

log_success "🎉 IAM policy update completed successfully!"
log_info "The GitHub Actions role now has the required permissions for EC2 health checking"
log_info "You can now trigger a new CI deployment to test the fix"

echo
log_info "Next steps:"
log_info "1. Push a commit or re-run the GitHub Actions workflow"
log_info "2. Monitor the CI logs for successful ASG verification"
log_info "3. The deployment should now proceed through all 3 phases successfully"
