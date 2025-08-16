# CI/CD Deployment Troubleshooting Guide

## Issue: CI Deployment Timeouts During Health Checks

### Problem Description

GitHub Actions deployments were timing out during the health checking phase, appearing to hang indefinitely while waiting
for deployment validation.

### Root Cause Analysis

The issue was caused by **missing AWS IAM permissions** in the GitHub Actions role. The deployment script was calling AWS
APIs for health checking, but the IAM policy didn't include the required permissions:

1. **Script Location**: `infrastructure/scripts/deploy-ec2-preview.sh`
2. **Health Check Functions**: 3-phase AWS API-driven validation
3. **Missing Permissions**: EC2, Auto Scaling, and ELB describe operations

### Required AWS Permissions

The health checking script requires these AWS API permissions:

```json
{
	"Sid": "EC2HealthCheckPermissions",
	"Effect": "Allow",
	"Action": [
		"ec2:DescribeInstances",
		"ec2:DescribeInstanceStatus",
		"autoscaling:DescribeAutoScalingGroups",
		"elasticloadbalancing:DescribeTargetHealth",
		"elasticloadbalancing:DescribeTargetGroups"
	],
	"Resource": "*"
}
```

### Health Check Process

The deployment script performs 3-phase health validation:

1. **Phase 1 (5 min)**: `autoscaling:DescribeAutoScalingGroups`
   - Monitor ASG instances reaching 'InService' state
   - 15-second intervals with detailed instance state reporting

2. **Phase 2 (15 min)**: `ec2:DescribeInstanceStatus`
   - Check EC2 instance and system status via describe-instance-status
   - Wait for both statuses to be 'ok' (indicates user data scripts completed)
   - 30-second intervals with per-instance status tracking

3. **Phase 3 (10 min)**: `elasticloadbalancing:DescribeTargetHealth`
   - Monitor target health via describe-target-health API
   - Wait for all targets to be 'healthy' in Application Load Balancer
   - Detailed unhealthy target troubleshooting information

### Symptoms

- CI deployment appears to hang during "Verifying deployment health..." step
- No error messages in GitHub Actions logs
- AWS CLI commands fail silently with access denied errors
- Deployment times out after GitHub Actions job limit (typically 6 hours)

### Resolution

1. **Updated IAM Policy**: Added `EC2HealthCheckPermissions` to `infrastructure/iam-policies/enhanced-github-actions-policy.json`
2. **Policy Location**: The policy is applied to the GitHub Actions OIDC role
3. **Immediate Effect**: Changes take effect on next deployment

### Prevention

- Always verify IAM permissions when adding new AWS API calls to deployment scripts
- Test deployment scripts locally with appropriate AWS credentials
- Monitor CloudTrail for access denied errors during CI runs
- Include permission requirements in script documentation

### Related Files

- `infrastructure/iam-policies/enhanced-github-actions-policy.json` - IAM permissions
- `infrastructure/scripts/deploy-ec2-preview.sh` - Deployment script with health checks
- `.github/workflows/deploy-preview.yml` - GitHub Actions workflow

### Verification

After applying the fix, successful deployments will show detailed progress logs:

```bash
🚀 Starting robust deployment health check with progressive timeout stages...
📋 Extracting deployment configuration from stack: MacroAiPr-37Stack
✅ Found Auto Scaling Group: macro-ai-preview-asg
✅ Environment: pr-37
✅ Found target group: arn:aws:elasticloadbalancing:...

🔄 Phase 1: Waiting for instances to reach running state (timeout: 300s)...
📊 Phase 1 - Attempt 1/20: Checking instance states...
📋 Found 1 instance(s): i-0eb2dc64b2f8aa39a
📈 Instance states: 1 running, 0 pending, 0 other
✅ Phase 1 complete: All 1 instance(s) are running!
```

This provides much better visibility into the deployment process and eliminates silent permission failures.
