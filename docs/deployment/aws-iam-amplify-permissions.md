# AWS IAM Permissions for Amplify Frontend Deployments

This guide covers the AWS IAM permissions required for GitHub Actions workflows to manage AWS Amplify applications for
frontend preview deployments.

## 📋 Overview

The frontend preview deployment system requires specific AWS IAM permissions to:

- **Create and manage Amplify applications** for PR preview environments
- **Discover backend CloudFormation stacks** for API endpoint integration
- **Access S3 buckets** for deployment artifacts
- **Manage service-linked roles** for Amplify operations
- **Access CloudWatch Logs** for deployment monitoring

## 🔐 Permission Categories

### 1. Amplify Application Management

```json
{
	"Sid": "AmplifyAppManagement",
	"Effect": "Allow",
	"Action": [
		"amplify:CreateApp",
		"amplify:DeleteApp",
		"amplify:GetApp",
		"amplify:ListApps",
		"amplify:UpdateApp",
		"amplify:TagResource",
		"amplify:UntagResource",
		"amplify:ListTagsForResource"
	],
	"Resource": "*",
	"Condition": {
		"StringLike": {
			"amplify:appName": [
				"macro-ai-frontend-pr-*",
				"macro-ai-frontend-staging",
				"macro-ai-frontend-production"
			]
		}
	}
}
```

**Purpose**: Allows creation, deletion, and management of Amplify apps with name restrictions for security.

### 2. Amplify Branch and Deployment Management

```json
{
	"Sid": "AmplifyBranchManagement",
	"Effect": "Allow",
	"Action": [
		"amplify:CreateBranch",
		"amplify:DeleteBranch",
		"amplify:GetBranch",
		"amplify:ListBranches",
		"amplify:UpdateBranch",
		"amplify:StartDeployment",
		"amplify:StartJob",
		"amplify:StopJob",
		"amplify:GetJob",
		"amplify:ListJobs"
	],
	"Resource": [
		"arn:aws:amplify:*:*:apps/*",
		"arn:aws:amplify:*:*:apps/*/branches/*",
		"arn:aws:amplify:*:*:apps/*/branches/*/jobs/*"
	]
}
```

**Purpose**: Manages Amplify branches and deployment jobs for preview environments.

### 3. CloudFormation Stack Discovery

```json
{
	"Sid": "CloudFormationStackAccess",
	"Effect": "Allow",
	"Action": [
		"cloudformation:DescribeStacks",
		"cloudformation:DescribeStackResources",
		"cloudformation:DescribeStackEvents",
		"cloudformation:GetTemplate",
		"cloudformation:ListStacks",
		"cloudformation:ListStackResources"
	],
	"Resource": [
		"arn:aws:cloudformation:*:*:stack/MacroAi*Stack/*",
		"arn:aws:cloudformation:*:*:stack/macro-ai-*/*"
	]
}
```

**Purpose**: Discovers backend CloudFormation stacks to extract API endpoints for frontend integration.

### 4. S3 Deployment Artifacts

```json
{
	"Sid": "S3AmplifyDeploymentBuckets",
	"Effect": "Allow",
	"Action": [
		"s3:GetObject",
		"s3:PutObject",
		"s3:DeleteObject",
		"s3:ListBucket"
	],
	"Resource": ["arn:aws:s3:::amplify-*", "arn:aws:s3:::amplify-*/*"]
}
```

**Purpose**: Access to Amplify-managed S3 buckets for deployment artifacts.

### 5. Service-Linked Role Management

```json
{
	"Sid": "IAMServiceLinkedRoles",
	"Effect": "Allow",
	"Action": ["iam:CreateServiceLinkedRole"],
	"Resource": "arn:aws:iam::*:role/aws-service-role/amplify.amazonaws.com/AWSServiceRoleForAmplifyBackend",
	"Condition": {
		"StringEquals": {
			"iam:AWSServiceName": "amplify.amazonaws.com"
		}
	}
}
```

**Purpose**: Allows creation of AWS service-linked roles required by Amplify.

## 🛠️ Setup Instructions

### Option 1: Automated Setup (Recommended)

Use the provided script to update your existing GitHub Actions role:

```bash
# Update existing role with Amplify permissions
cd infrastructure
./scripts/update-github-actions-permissions.sh

# Use enhanced policy with all permissions
./scripts/update-github-actions-permissions.sh --enhanced-policy

# Preview changes without applying
./scripts/update-github-actions-permissions.sh --dry-run
```

### Option 2: Manual Setup

#### Step 1: Create the Amplify Policy

```bash
# Create the Amplify-specific policy
aws iam create-policy \
  --policy-name MacroAiAmplifyDeploymentPolicy \
  --policy-document file://infrastructure/iam-policies/amplify-github-actions-policy.json \
  --description "Amplify permissions for GitHub Actions in Macro AI project"
```

#### Step 2: Attach to Existing Role

```bash
# Get your AWS account ID
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)

# Attach the policy to your GitHub Actions role
aws iam attach-role-policy \
  --role-name GitHubActionsRole \
  --policy-arn "arn:aws:iam::${ACCOUNT_ID}:policy/MacroAiAmplifyDeploymentPolicy"
```

### Option 3: CDK Integration

Add the Amplify permissions construct to your CDK stack:

```typescript
import { AmplifyPermissionsConstruct } from './constructs/amplify-permissions-construct'

// In your stack constructor
const amplifyPermissions = new AmplifyPermissionsConstruct(
	this,
	'AmplifyPermissions',
	{
		environmentName: 'hobby',
		createGitHubActionsRole: true,
		gitHubRepository: 'your-username/macro-ai',
		allowedAppNamePatterns: [
			'macro-ai-frontend-pr-*',
			'macro-ai-frontend-staging',
			'macro-ai-frontend-production',
		],
	},
)
```

## ✅ Validation

### Automated Validation

Use the validation script to test all permissions:

```bash
# Test with current credentials
./infrastructure/scripts/validate-amplify-permissions.sh

# Test with specific role
./infrastructure/scripts/validate-amplify-permissions.sh \
  --role-arn arn:aws:iam::123456789012:role/GitHubActionsRole

# Skip destructive tests (no create/delete operations)
./infrastructure/scripts/validate-amplify-permissions.sh --skip-destructive
```

### Manual Validation

Test key permissions manually:

```bash
# Test Amplify access
aws amplify list-apps

# Test CloudFormation access
aws cloudformation list-stacks --query 'StackSummaries[?starts_with(StackName, `MacroAi`)].StackName'

# Test STS access
aws sts get-caller-identity
```

## 🔒 Security Considerations

### Principle of Least Privilege

The permissions are designed with security in mind:

- **App Name Restrictions**: Amplify operations are limited to apps with specific naming patterns
- **Resource Scoping**: CloudFormation access is limited to MacroAi stacks
- **Conditional Access**: Service-linked role creation is restricted to specific AWS services
- **Time-Limited Sessions**: OIDC tokens have limited session duration

### Naming Convention Security

The app naming restrictions prevent unauthorized access:

```json
"Condition": {
  "StringLike": {
    "amplify:appName": [
      "macro-ai-frontend-pr-*",
      "macro-ai-frontend-staging",
      "macro-ai-frontend-production"
    ]
  }
}
```

This ensures GitHub Actions can only manage Amplify apps that follow the project's naming convention.

### OIDC Trust Policy

The GitHub Actions role uses OIDC for secure authentication:

```json
{
	"StringEquals": {
		"token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
	},
	"StringLike": {
		"token.actions.githubusercontent.com:sub": "repo:your-username/macro-ai:*"
	}
}
```

This restricts access to workflows from the specific GitHub repository.

## 🚨 Troubleshooting

### Common Permission Issues

#### 1. "Access Denied" on Amplify Operations

**Symptom**: `AccessDeniedException` when creating/managing Amplify apps

**Solution**:

- Verify the Amplify policy is attached to the role
- Check app naming follows the allowed patterns
- Ensure the role has the correct trust policy

#### 2. "Stack Not Found" for Backend Integration

**Symptom**: Cannot find CloudFormation stacks for API endpoint discovery

**Solution**:

- Verify CloudFormation permissions are attached
- Check stack naming follows MacroAi\*Stack pattern
- Ensure backend deployment completed successfully

#### 3. "Service-Linked Role" Creation Errors

**Symptom**: Errors creating AWS service-linked roles for Amplify

**Solution**:

- Verify IAM service-linked role permissions
- Check if the role already exists in the account
- Ensure the condition restricts to amplify.amazonaws.com service

### Debugging Commands

```bash
# Check current identity
aws sts get-caller-identity

# List attached policies for role
aws iam list-attached-role-policies --role-name GitHubActionsRole

# Test specific permission
aws amplify list-apps --max-results 1

# Check CloudFormation access
aws cloudformation describe-stacks --stack-name MacroAiHobbyStack
```

## 📚 Related Documentation

- [CI/CD Setup Guide](./ci-cd-setup-guide.md) - Complete GitHub Actions setup
- [Frontend Preview Deployment Guide](../frontend/amplify-preview-deployment.md) - Frontend deployment process
- [AWS Amplify Documentation](https://docs.aws.amazon.com/amplify/) - Official AWS documentation
- [GitHub OIDC Documentation](https://docs.github.com/en/actions/deployment/security-hardening-your-deployments/about-security-hardening-with-openid-connect)
- OIDC setup guide
