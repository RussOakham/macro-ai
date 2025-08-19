# Route53 IAM Permissions

## Overview

Custom domain configuration requires specific Route53 permissions for the GitHub Actions IAM role to manage DNS
records and validate hosted zones during deployment.

## Required Permissions

The GitHub Actions IAM policies (`amplify-github-actions-policy.json` and `enhanced-github-actions-policy.json`)
must include Route53 permissions for custom domain configuration:

- `route53:GetHostedZone` - Required to validate hosted zone exists
- `route53:ListHostedZones` - Required for hosted zone discovery
- `route53:GetChange` - Required for DNS change tracking
- `route53:ListResourceRecordSets` - Required for domain record management

## Configuration

### Script Error Handling

The `apps/client-ui/scripts/configure-amplify-custom-domain.sh` includes comprehensive error handling:

- Shows detailed AWS CLI error messages
- Detects permission vs. zone existence issues
- Provides specific guidance for different error types
- Validates zone name matches root domain

### Route53 Permissions

Add the following permissions to both IAM policy files:

```json
{
	"Sid": "Route53CustomDomainPermissions",
	"Effect": "Allow",
	"Action": [
		"route53:GetHostedZone",
		"route53:ListHostedZones",
		"route53:GetChange",
		"route53:ListResourceRecordSets"
	],
	"Resource": "*",
	"Condition": {
		"StringLike": {
			"route53:HostedZoneId": ["Z10081873B648ARROPNER"]
		}
	}
}
```

### ACM Certificate Permissions

AWS Certificate Manager permissions for SSL certificate management:

```json
{
	"Sid": "ACMCertificatePermissions",
	"Effect": "Allow",
	"Action": [
		"acm:ListCertificates",
		"acm:DescribeCertificate",
		"acm:RequestCertificate",
		"acm:AddTagsToCertificate"
	],
	"Resource": "*",
	"Condition": {
		"StringEquals": {
			"aws:RequestedRegion": ["us-east-1", "us-west-2"]
		}
	}
}
```

## Deployment Instructions

### Option 1: Update Existing IAM Role (Recommended)

Use the existing update script with the enhanced policy:

```bash
cd infrastructure
./scripts/update-github-actions-iam-policy.sh --policy-file iam-policies/enhanced-github-actions-policy.json
```

### Option 2: Manual AWS CLI Update

```bash
# Get your AWS account ID
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)

# Update the existing role policy
aws iam put-role-policy \
  --role-name GitHubActionsDeploymentRole \
  --policy-name GitHubActionsDeploymentPolicy \
  --policy-document file://infrastructure/iam-policies/enhanced-github-actions-policy.json
```

### Option 3: AWS Console Update

1. Navigate to AWS IAM Console
2. Find the `GitHubActionsDeploymentRole` role
3. Update the inline policy with the enhanced policy content
4. Save changes

## Verification Steps

### 1. Test Route53 Access

```bash
# This should work without AccessDenied errors
aws route53 get-hosted-zone --id Z10081873B648ARROPNER
```

### 2. Test ACM Access

```bash
# This should list certificates without errors
aws acm list-certificates --region us-east-1
```

### 3. Trigger Custom Domain Deployment

- Push a change to trigger GitHub Actions
- Monitor the custom domain configuration step
- Verify hosted zone validation passes

## Security Considerations

### Least Privilege Access

The permissions are scoped to:

- **Specific Hosted Zone**: Only `Z10081873B648ARROPNER`
- **Specific Regions**: Only `us-east-1` and `us-west-2` for ACM
- **Read-Only Operations**: No destructive Route53 operations allowed

### Condition-Based Access

- Route53 permissions limited to specific hosted zone ID
- ACM permissions limited to specific AWS regions
- No wildcard permissions for sensitive operations

## Files Modified

1. `infrastructure/iam-policies/enhanced-github-actions-policy.json` - Added Route53 and ACM permissions
2. `infrastructure/iam-policies/amplify-github-actions-policy.json` - Added Route53 and ACM permissions
3. `apps/client-ui/scripts/configure-amplify-custom-domain.sh` - Enhanced error handling and validation
4. `infrastructure/docs/route53-iam-permissions.md` - This documentation

## Expected Results

With proper permissions configured:

1. ✅ **Hosted Zone Validation**: Script successfully validates hosted zone access
2. ✅ **Clear Error Messages**: Detailed guidance when issues occur
3. ✅ **Domain Association**: AWS Amplify domain configuration proceeds
4. ✅ **SSL Certificate**: ACM certificate management functions properly
5. ✅ **End-to-End Success**: Custom domain functionality completes successfully

## Rollback Procedure

If issues occur, revert to the previous policy:

```bash
# Restore previous policy (without Route53 permissions)
git checkout HEAD~1 -- infrastructure/iam-policies/enhanced-github-actions-policy.json
./scripts/update-github-actions-iam-policy.sh --policy-file iam-policies/enhanced-github-actions-policy.json
```
