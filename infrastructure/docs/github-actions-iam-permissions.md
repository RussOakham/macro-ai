# GitHub Actions IAM Permissions

## Overview

The CI/CD pipeline requires specific IAM permissions for the GitHub Actions deployment role to access AWS resources
during deployment and health check operations.

## Configuration Requirements

The enhanced IAM policy file (`infrastructure/iam-policies/enhanced-github-actions-policy.json`) must be applied
to the AWS IAM role `GitHubActionsDeploymentRole` to ensure proper functionality.

## Required Permissions

The missing permissions are defined in the `ECSHealthCheckPermissions` section:

```json
{
	"Sid": "ECSHealthCheckPermissions",
	"Effect": "Allow",
	"Action": [
		"ecs:DescribeServices",
		"ecs:DescribeTasks",
		"autoscaling:DescribeAutoScalingGroups",
		"elasticloadbalancing:DescribeTargetHealth",
		"elasticloadbalancing:DescribeTargetGroups"
	],
	"Resource": "*"
}
```

## Solution Options

### Option 1: Automated Script (Recommended)

Use the provided script to apply the permissions:

```bash
# From the repository root
./infrastructure/scripts/update-github-actions-iam-policy.sh
```

**Script Features:**

- ✅ Validates AWS CLI configuration
- ✅ Checks policy file syntax
- ✅ Verifies IAM role exists
- ✅ Shows current policy before changes
- ✅ Applies enhanced policy
- ✅ Verifies permissions were applied correctly

**Script Options:**

```bash
# Dry run (show what would be done)
./infrastructure/scripts/update-github-actions-iam-policy.sh --dry-run

# Apply without confirmation
./infrastructure/scripts/update-github-actions-iam-policy.sh --force

# Show help
./infrastructure/scripts/update-github-actions-iam-policy.sh --help
```

### Option 2: Manual AWS Console

1. **Navigate to IAM Console**
   - Go to AWS Console → IAM → Roles
   - Search for `GitHubActionsDeploymentRole`

2. **Update Inline Policy**
   - Click on the role
   - Go to "Permissions" tab
   - Find the inline policy (likely named `GitHubActionsDeploymentPolicy`)
   - Click "Edit policy"

3. **Add Missing Permissions**
   - Switch to JSON view
   - Add the `ECSHealthCheckPermissions` statement from `enhanced-github-actions-policy.json`
   - Save the policy

### Option 3: AWS CLI Manual Commands

```bash
# Apply the policy directly
aws iam put-role-policy \
    --role-name GitHubActionsDeploymentRole \
    --policy-name GitHubActionsDeploymentPolicy \
    --policy-document file://infrastructure/iam-policies/enhanced-github-actions-policy.json

# Verify the policy was applied
aws iam get-role-policy \
    --role-name GitHubActionsDeploymentRole \
    --policy-name GitHubActionsDeploymentPolicy \
    --query "PolicyDocument" \
    --output json | jq .
```

## Verification Steps

After applying the permissions, verify they work:

1. **Check Policy Contains Required Permissions:**

   ```bash
   aws iam get-role-policy \
       --role-name GitHubActionsDeploymentRole \
       --policy-name GitHubActionsDeploymentPolicy \
       --query "PolicyDocument.Statement[?Sid=='ECSHealthCheckPermissions'].Action" \
       --output json
   ```

2. **Test ASG Access:**

   ```bash
   # This should work without AccessDenied errors
   aws autoscaling describe-auto-scaling-groups --max-items 1
   ```

3. **Trigger New CI Deployment:**
   - Push a small change to trigger GitHub Actions
   - Monitor the CI logs for successful ASG verification

## Expected Results

After applying the IAM permissions, the CI logs should show:

```text
[INFO] 🔍 ASG verification attempt 1/10...
[INFO] ✅ Auto Scaling Group verified: macro-ai-preview-asg
[INFO] 🔄 Phase 1: Waiting for instances to reach running state (timeout: 300s)...
```

Instead of the previous AccessDenied error.

## Troubleshooting

### Permission Propagation Delay

- IAM changes typically take effect immediately
- If issues persist, wait 1-2 minutes and retry

### Wrong Role Name

- Verify the exact role name in the error message
- Update the script if the role name differs

### Policy Conflicts

- Check for conflicting deny statements in other policies
- Ensure the role has the necessary trust relationships

### AWS CLI Configuration

- Ensure AWS CLI is configured with appropriate permissions
- The user applying the policy needs `iam:PutRolePolicy` permission

## Related Files

- **Policy Definition:** `infrastructure/iam-policies/enhanced-github-actions-policy.json`
- **Update Script:** `infrastructure/scripts/update-github-actions-iam-policy.sh`
- **Original Issue:** Commit `7d8d7fd` added permissions to file but didn't apply to AWS
- **Detection:** Commit `aa6f955` enhanced debugging revealed the AccessDenied error
