# CI/CD Pipeline Setup Guide

This guide covers the complete setup and configuration of the GitHub Actions CI/CD pipeline for automated deployment of
both backend (Lambda/CDK) and frontend (AWS Amplify) components.

## 🎯 Overview

The CI/CD pipeline provides:

- **Automated Testing**: Quality gates with build, lint, and test validation
- **Ephemeral PR Environments**: Automatic preview environments for every pull request
- **Multi-Environment Deployment**: Development (ephemeral), staging, and production environments
- **Full-Stack Deployment**: Backend infrastructure and frontend hosting
- **Integration Testing**: End-to-end validation after deployment
- **Rollback Capabilities**: Emergency rollback for both components
- **Branch-Based Workflows**: Different strategies for different branches
- **Security-First Access Control**: CODEOWNERS-based deployment restrictions

## 🚀 Workflow Architecture

### Core Workflows

#### Ephemeral PR Environment Workflows

1. **`deploy-preview.yml`** - Automatic PR preview deployment
2. **`destroy-preview.yml`** - Automatic PR environment cleanup
3. **`deploy-forked-pr-preview.yml`** - Manual forked PR preview deployment

#### Persistent Environment Workflows

Current EC2-based deployment workflows:

- Infrastructure deployment via CDK
- Manual environment management workflows

#### Manual Teardown Workflows

1. **`teardown-dev.yml`** - Manual development environment cleanup
2. **`teardown-staging.yml`** - Manual staging environment teardown
3. **`teardown-production.yml`** - Manual production environment teardown

#### Quality & Emergency Workflows

1. **`rollback.yml`** - Emergency rollback workflow
2. **`hygiene-checks.yml`** - Quality gates (existing)

### Deployment Strategy

```text
Pull Request ──► Ephemeral Environment (pr-123)
     │                    │
     │                    └──► Auto-cleanup on PR close
     │
develop branch ──► Staging Environment
     │
     └──► PR to main ──► Production Environment
```

#### Environment Lifecycle

- **Ephemeral (pr-{number})**: Created on PR open, destroyed on PR close
- **Staging**: Persistent, updated on develop branch pushes
- **Production**: Persistent, updated on main branch pushes

#### Access Control Requirements

- **Ephemeral deployments**: Same-repo PRs by code owners only
- **Forked PR deployments**: Manual override by code owners using trusted base code
- **Persistent deployments**: Code owners only
- **Manual teardowns**: Code owners with confirmation requirements

## 🔧 Setup Requirements

### 1. AWS IAM Configuration

Create an IAM role for GitHub Actions with OIDC:

```bash
# Create trust policy for GitHub OIDC
cat > github-actions-trust-policy.json << EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "arn:aws:iam::YOUR_ACCOUNT_ID:oidc-provider/token.actions.githubusercontent.com"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
        },
        "StringLike": {
          "token.actions.githubusercontent.com:sub": "repo:YOUR_GITHUB_USERNAME/macro-ai:*"
        }
      }
    }
  ]
}
EOF

# Create the role
aws iam create-role \
  --role-name GitHubActionsRole \
  --assume-role-policy-document file://github-actions-trust-policy.json

# Create custom IAM policy for CDK deployment
cat > cdk-deployment-policy.json << 'EOF'
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "CloudFormationAccess",
      "Effect": "Allow",
      "Action": [
        "cloudformation:CreateStack",
        "cloudformation:UpdateStack",
        "cloudformation:DeleteStack",
        "cloudformation:DescribeStacks",
        "cloudformation:DescribeStackEvents",
        "cloudformation:DescribeStackResources",
        "cloudformation:GetTemplate",
        "cloudformation:ListStacks",
        "cloudformation:ValidateTemplate",
        "cloudformation:CreateChangeSet",
        "cloudformation:DescribeChangeSet",
        "cloudformation:ExecuteChangeSet",
        "cloudformation:DeleteChangeSet",
        "cloudformation:ListChangeSets"
      ],
      "Resource": "*"
    },
    {
      "Sid": "LambdaManagement",
      "Effect": "Allow",
      "Action": [
        "lambda:CreateFunction",
        "lambda:UpdateFunctionCode",
        "lambda:UpdateFunctionConfiguration",
        "lambda:DeleteFunction",
        "lambda:GetFunction",
        "lambda:ListFunctions",
        "lambda:AddPermission",
        "lambda:RemovePermission",
        "lambda:GetPolicy",
        "lambda:TagResource",
        "lambda:UntagResource",
        "lambda:ListTags"
      ],
      "Resource": [
        "arn:aws:lambda:*:*:function:macro-ai-*"
      ]
    },
    {
      "Sid": "APIGatewayManagement",
      "Effect": "Allow",
      "Action": [
        "apigateway:GET",
        "apigateway:POST",
        "apigateway:PUT",
        "apigateway:DELETE",
        "apigateway:PATCH"
      ],
      "Resource": [
        "arn:aws:apigateway:*::/restapis",
        "arn:aws:apigateway:*::/restapis/*"
      ]
    },
    {
      "Sid": "IAMRoleManagement",
      "Effect": "Allow",
      "Action": [
        "iam:CreateRole",
        "iam:UpdateRole",
        "iam:DeleteRole",
        "iam:GetRole",
        "iam:PassRole",
        "iam:AttachRolePolicy",
        "iam:DetachRolePolicy",
        "iam:PutRolePolicy",
        "iam:DeleteRolePolicy",
        "iam:GetRolePolicy",
        "iam:ListRolePolicies",
        "iam:ListAttachedRolePolicies",
        "iam:TagRole",
        "iam:UntagRole"
      ],
      "Resource": [
        "arn:aws:iam::*:role/macro-ai-*",
        "arn:aws:iam::*:role/cdk-*"
      ]
    },
    {
      "Sid": "IAMPolicyManagement",
      "Effect": "Allow",
      "Action": [
        "iam:CreatePolicy",
        "iam:DeletePolicy",
        "iam:GetPolicy",
        "iam:GetPolicyVersion",
        "iam:ListPolicyVersions",
        "iam:CreatePolicyVersion",
        "iam:DeletePolicyVersion"
      ],
      "Resource": [
        "arn:aws:iam::*:policy/macro-ai-*",
        "arn:aws:iam::*:policy/cdk-*"
      ]
    },
    {
      "Sid": "ParameterStoreAccess",
      "Effect": "Allow",
      "Action": [
        "ssm:GetParameter",
        "ssm:GetParameters",
        "ssm:PutParameter",
        "ssm:DeleteParameter",
        "ssm:DescribeParameters",
        "ssm:GetParameterHistory",
        "ssm:AddTagsToResource",
        "ssm:RemoveTagsFromResource"
      ],
      "Resource": [
        "arn:aws:ssm:*:*:parameter/macro-ai/*"
      ]
    },
    {
      "Sid": "CloudWatchLogsAccess",
      "Effect": "Allow",
      "Action": [
        "logs:CreateLogGroup",
        "logs:DeleteLogGroup",
        "logs:DescribeLogGroups",
        "logs:PutRetentionPolicy",
        "logs:TagLogGroup",
        "logs:UntagLogGroup"
      ],
      "Resource": [
        "arn:aws:logs:*:*:log-group:/aws/lambda/macro-ai-*",
        "arn:aws:logs:*:*:log-group:/aws/apigateway/macro-ai-*"
      ]
    },
    {
      "Sid": "S3CDKAssets",
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:PutObject",
        "s3:DeleteObject",
        "s3:ListBucket",
        "s3:GetBucketLocation",
        "s3:GetBucketVersioning"
      ],
      "Resource": [
        "arn:aws:s3:::cdk-*",
        "arn:aws:s3:::cdk-*/*"
      ]
    },
    {
      "Sid": "STSAssumeRole",
      "Effect": "Allow",
      "Action": [
        "sts:AssumeRole"
      ],
      "Resource": [
        "arn:aws:iam::*:role/cdk-*"
      ]
    },
    {
      "Sid": "ECRAccess",
      "Effect": "Allow",
      "Action": [
        "ecr:GetAuthorizationToken",
        "ecr:BatchCheckLayerAvailability",
        "ecr:GetDownloadUrlForLayer",
        "ecr:BatchGetImage"
      ],
      "Resource": "*"
    }
  ]
}
EOF

# Create the custom policy
aws iam create-policy \
  --policy-name MacroAiCDKDeploymentPolicy \
  --policy-document file://cdk-deployment-policy.json \
  --description "Custom policy for Macro AI CDK deployment with minimal required permissions"

# Attach the custom policy to the role
aws iam attach-role-policy \
  --role-name GitHubActionsRole \
  --policy-arn arn:aws:iam::$(aws sts get-caller-identity --query Account --output text):policy/MacroAiCDKDeploymentPolicy
```

### 2. GitHub Secrets Configuration

Set up the following secrets in your GitHub repository:

#### Required Secrets

```bash
# AWS Configuration
AWS_ROLE_ARN=arn:aws:iam::YOUR_ACCOUNT_ID:role/GitHubActionsRole
AWS_ACCOUNT_ID=123456789012
AWS_REGION=us-east-1

# Doppler Authentication Tokens (Environment-Specific)
DOPPLER_TOKEN_DEV=dp.st.dev.xxxxxxxxxxxxxxxxxxxx
DOPPLER_TOKEN_STAGING=dp.st.stg.xxxxxxxxxxxxxxxxxxxx
DOPPLER_TOKEN_PROD=dp.st.prd.xxxxxxxxxxxxxxxxxxxx

# Frontend Configuration (Vite-specific, not in Doppler)
VITE_API_KEY=your-api-key-32-characters-long
```

> **Note**:
>
> - The `AWS_ACCOUNT_ID` and `AWS_REGION` secrets are required for CDK synthesis and deployment
> - **All application environment variables** (API keys, database URLs, AWS Cognito config, rate
>   limiting, cookies, etc.) are now managed via **Doppler** and automatically injected during
>   CI/CD workflows
> - The `DOPPLER_TOKEN_*` secrets authenticate GitHub Actions with Doppler to fetch environment-specific configuration
> - Each token corresponds to a specific Doppler config: `dev`, `stg`, or `prd`
> - `VITE_*` variables are frontend-specific and managed separately via the `generate-frontend-env` action

#### Doppler Configuration Structure

The Doppler integration uses the following structure:

- **Project**: `macro-ai`
- **Configs**:
  - `dev` - For PR previews and development deployments
  - `dev_personal` - Local development (sub-config of `dev` with `localhost` overrides)
  - `stg` - For staging/develop branch deployments
  - `prd` - For production/main branch deployments

#### Environment Variables Managed by Doppler

All of the following are **automatically injected** via Doppler and do **NOT** need to be added as GitHub Secrets:

```bash
# Application Core
API_KEY
SERVER_PORT
NODE_ENV
APP_ENV

# AWS Cognito
AWS_COGNITO_REGION
AWS_COGNITO_USER_POOL_ID
AWS_COGNITO_USER_POOL_CLIENT_ID
AWS_COGNITO_REFRESH_TOKEN_EXPIRY

# Databases
REDIS_URL
RELATIONAL_DATABASE_URL

# External Services
OPENAI_API_KEY

# Cookies & Security
COOKIE_DOMAIN
COOKIE_ENCRYPTION_KEY
CORS_ALLOWED_ORIGINS

# Rate Limiting
RATE_LIMIT_WINDOW_MS
RATE_LIMIT_MAX_REQUESTS
AUTH_RATE_LIMIT_WINDOW_MS
AUTH_RATE_LIMIT_MAX_REQUESTS
API_RATE_LIMIT_WINDOW_MS
API_RATE_LIMIT_MAX_REQUESTS
```

#### Optional Secrets (for enhanced features)

```bash
# Slack/Discord notifications (if implementing)
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/...
```

### 3. GitHub Environments

Create the following environments in GitHub:

- `production`
- `staging`

Each environment should have:

- **Protection rules**: Require review for production (2 approvals), staging (1 approval)
- **Environment secrets**: Environment-specific values
- **Deployment branches**: Restrict to appropriate branches (`main` for production, `develop` for staging)

## 📋 Workflow Details

### Full-Stack Deployment (`deploy-full-stack.yml`)

**Triggers:**

- Manual dispatch with environment selection
- Push to `main` branch (auto-detects changes)

**Features:**

- Quality gates (tests, linting, type checking)
- Change detection (only deploy what changed)
- Backend and frontend deployment
- Integration testing
- Deployment summary with links

**Usage:**

```bash
# Manual deployment
# Go to Actions tab → Deploy Full-Stack Application → Run workflow
# Select environment and components to deploy

# Automatic deployment
git push origin main  # Deploys to production environment
```

### Emergency Rollback (`rollback.yml`)

**Triggers:**

- Manual dispatch only (for safety)

**Features:**

- Rollback validation
- Target commit selection
- Backend and frontend rollback
- Post-rollback validation

**Usage:**

```bash
# Emergency rollback
# Go to Actions tab → Emergency Rollback → Run workflow
# Select environment, components, and provide reason
```

## 🔍 Monitoring and Debugging

### Workflow Status

Monitor deployments through:

- **GitHub Actions tab**: Real-time workflow status
- **Deployment summaries**: Links to AWS consoles
- **Integration test results**: API health checks

### Common Issues

#### 1. AWS Permissions

```bash
# Check IAM role permissions
aws sts get-caller-identity
aws iam get-role --role-name GitHubActionsRole
```

#### 2. Environment Variables

```bash
# Verify Doppler authentication
doppler secrets --project macro-ai --config dev

# Verify GitHub secrets are set correctly
# Check GitHub repository settings → Secrets and variables
# Required: DOPPLER_TOKEN_DEV, DOPPLER_TOKEN_STAGING, DOPPLER_TOKEN_PROD

# Test Doppler CLI authentication in workflow context
gh workflow run test-local.yml  # Should successfully authenticate with Doppler
```

#### 3. Build Failures

```bash
# Check workflow logs for specific error messages
# Common issues: dependency conflicts, environment variable mismatches
```

### Debugging Commands

```bash
# Test AWS credentials locally
aws sts get-caller-identity

# Test CDK deployment locally
cd infrastructure
pnpm deploy

# Test Amplify deployment locally
cd apps/client-ui
./scripts/deploy-amplify.sh
```

## 🔄 Branch Strategy

### Development Flow

1. **Feature Development**

   ```bash
   git checkout -b feature/new-feature
   # Make changes
   git push origin feature/new-feature
   # Create PR to develop
   ```

2. **Staging Deployment** (Legacy - Removed)

   ```bash
   git checkout develop
   git merge feature/new-feature
   git push origin develop  # Previously triggered staging deployment (now removed)
   ```

3. **Production Deployment** (Legacy - Removed)

   ```bash
   git checkout main
   git merge develop
   git push origin main  # Previously triggered production deployment (now removed)
   ```

### Hotfix Flow

1. **Emergency Fix**

   ```bash
   git checkout -b hotfix/critical-fix main
   # Make critical changes
   git push origin hotfix/critical-fix
   # Create PR to main for immediate deployment
   ```

2. **Rollback if Needed**

   ```bash
   # Use Emergency Rollback workflow
   # Select target commit and reason
   ```

## 📊 Performance Optimization

### Build Optimization

- **Dependency Caching**: pnpm cache for faster installs
- **Artifact Reuse**: Lambda packages cached between jobs
- **Parallel Execution**: Backend and frontend builds run in parallel
- **Change Detection**: Only deploy components that changed

### Cost Optimization

- **Conditional Deployment**: Skip unchanged components
- **Artifact Retention**: 7-day retention for build artifacts
- **Efficient Resource Usage**: ARM64 Lambda, optimized build processes

## 🔐 Access Control Matrix

### Workflow Permissions

| Workflow                         | Trigger      | Who Can Run           | Requirements    | Confirmations       |
| -------------------------------- | ------------ | --------------------- | --------------- | ------------------- |
| **deploy-preview.yml**           | PR open/sync | Same-repo code owners | Auto            | None                |
| **destroy-preview.yml**          | PR close     | Same-repo code owners | Auto            | None                |
| **deploy-forked-pr-preview.yml** | Manual       | Code owners           | Manual dispatch | "I UNDERSTAND"      |
| **teardown-dev.yml**             | Manual       | Code owners           | Manual dispatch | "I UNDERSTAND"      |
| **teardown-staging.yml**         | Manual       | Code owners           | Manual dispatch | Double confirmation |
| **teardown-production.yml**      | Manual       | Code owners           | Manual dispatch | Triple confirmation |
| **deploy-infrastructure.yml**    | Push/Manual  | Code owners           | Branch/Manual   | None                |

### Code Owner Management

#### Adding New Code Owners

1. Edit `.github/CODEOWNERS`:

   ```bash
   # Infrastructure and deployment code
   infrastructure/ @RussOakham @NewOwner

   # GitHub Actions workflows
   .github/workflows/ @RussOakham @NewOwner

   # Default ownership
   * @RussOakham @NewOwner
   ```

2. Test access with a test PR or manual workflow

#### Code Owner Validation Process

All deployment workflows use the `.github/actions/check-codeowner` composite action:

- Reads `.github/CODEOWNERS` from trusted base repository
- Normalizes usernames to lowercase for comparison
- Validates either PR author or workflow actor
- Outputs `is-owner: true/false` for workflow decisions

## 📋 Operational Runbooks

### Ephemeral PR Environment Operations

#### Deploying Preview for Forked PR

1. **Navigate to Actions tab** in GitHub repository
2. **Select "Deploy Forked PR Preview (Manual)" workflow**
3. **Click "Run workflow"**
4. **Fill inputs**:
   - `pr_number`: The PR number (e.g., 123)
   - `confirm`: Type exactly "I UNDERSTAND"
5. **Review security warning**: Preview uses trusted base code, not forked changes
6. **Run workflow** - only code owners can execute
7. **Check PR comment** for deployment status and endpoints

#### Manual Cleanup of PR Environment

1. **Navigate to Actions tab**
2. **Select "Manual Teardown - Development Environment" workflow**
3. **Click "Run workflow"**
4. **Fill inputs**:
   - `pr_number`: The PR number to clean up
   - `confirm`: Type exactly "I UNDERSTAND"
5. **Run workflow** - only code owners can execute
6. **Verify cleanup** in workflow summary

#### Troubleshooting Preview Deployments

**Preview not deploying automatically:**

- Verify PR is from same repository (not a fork)
- Check if PR author is listed in `.github/CODEOWNERS`
- Review workflow logs for validation failures

**Preview deployment failed:**

- Check AWS credentials and permissions
- Verify `/macro-ai/development/` Parameter Store values exist
- Check for resource naming conflicts
- Review CloudFormation events in AWS Console

**Preview not cleaning up:**

- Verify PR was from same-repo code owner
- Use manual teardown workflow with PR number
- Check CloudFormation stack status in AWS Console

### Staging Environment Operations

#### Manual Staging Teardown

⚠️ **CRITICAL**: This destroys the staging environment completely

1. **Navigate to Actions tab**
2. **Select "Manual Teardown - Staging Environment" workflow**
3. **Click "Run workflow"**
4. **Fill inputs**:
   - `confirm`: Type exactly "I UNDERSTAND STAGING TEARDOWN"
   - `additional_confirm`: Type exactly "STAGING"
5. **Review impact**: All staging data will be lost
6. **Run workflow** - only code owners can execute
7. **Monitor progress** and verify completion

#### Staging Recovery

After staging teardown, to restore:

> **⚠️ Note**: Legacy deployment workflows have been removed. Staging recovery
> will require new EC2-based deployment workflows once the migration is complete.

1. **Push to develop branch** (previously triggered automatic staging deployment)
2. **Manual deployment**: Legacy "Deploy Full-Stack" workflow has been removed
3. **Update Parameter Store** values if needed
4. **Redeploy frontend** to staging environment

### Production Environment Operations

#### Manual Production Teardown

🚨 **EXTREME CAUTION**: This destroys the live production environment

1. **Notify all stakeholders** before proceeding
2. **Navigate to Actions tab**
3. **Select "Manual Teardown - Production Environment" workflow**
4. **Click "Run workflow"**
5. **Fill all three confirmations**:
   - `confirm`: "I UNDERSTAND PRODUCTION TEARDOWN"
   - `additional_confirm`: "PRODUCTION"
   - `final_confirm`: "DESTROY PRODUCTION NOW"
6. **Review critical warnings** about business impact
7. **Run workflow** - only code owners can execute
8. **Monitor 30-second countdown** (last chance to abort)
9. **Verify completion** and begin recovery procedures

#### Production Recovery

After production teardown:

1. **Activate disaster recovery** procedures
2. **Restore from backups** if available
3. **Deploy production** from main branch
4. **Restore Parameter Store** production values
5. **Redeploy frontend** to production
6. **Communicate with customers** about service restoration
7. **Conduct post-incident review**

## 🔐 Security Considerations

### Secrets Management

- **Doppler**: Centralized secret management for application environment variables across all environments
  - Single source of truth for API keys, database URLs, AWS Cognito config, etc.
  - Environment-specific configs (`dev`, `stg`, `prd`) with automatic injection
  - Branch-based config selection in CI/CD workflows
  - Sub-configs for local development (`dev_personal`) with environment-specific overrides
- **GitHub Secrets**: Encrypted storage for CI/CD-specific values
  - Doppler authentication tokens (`DOPPLER_TOKEN_*`)
  - AWS credentials and configuration
  - Vite frontend environment variables
- **Environment Separation**: Different Doppler configs for dev/staging/production
- **Least Privilege**: IAM roles with minimal required permissions
- **Parameter Store**: Legacy shared development secrets (being migrated to Doppler)

### Access Control

- **CODEOWNERS Enforcement**: All deployments require code owner approval
- **Branch Protection**: Require reviews for main branch
- **Environment Protection**: Manual approval for production
- **Audit Trail**: All deployments logged and traceable
- **Forked PR Protection**: Never uses pull_request_target for deployments

## 📞 Support and Troubleshooting

### Workflow Failures

1. **Check workflow logs** in GitHub Actions tab
2. **Review deployment summaries** for specific error details
3. **Validate AWS permissions** and resource availability
4. **Test locally** using the same commands as the workflow

### Emergency Procedures

1. **Use rollback workflow** for immediate issues
2. **Check AWS service status** for regional issues
3. **Monitor CloudWatch logs** for runtime errors
4. **Contact team** for complex issues requiring investigation

---

**Next Steps**: After setting up CI/CD, configure monitoring alerts and implement comprehensive end-to-end testing for
production readiness.
