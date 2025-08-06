# CI/CD Pipeline Setup Guide

This guide covers the complete setup and configuration of the GitHub Actions CI/CD pipeline for automated deployment of
both backend (Lambda/CDK) and frontend (AWS Amplify) components.

## 🎯 Overview

The CI/CD pipeline provides:

- **Automated Testing**: Quality gates with build, lint, and test validation
- **Multi-Environment Deployment**: Staging and production environments
- **Full-Stack Deployment**: Backend infrastructure and frontend hosting
- **Integration Testing**: End-to-end validation after deployment
- **Rollback Capabilities**: Emergency rollback for both components
- **Branch-Based Workflows**: Different strategies for different branches

## 🚀 Workflow Architecture

### Core Workflows

1. **`deploy-full-stack.yml`** - Main deployment workflow
2. **`deploy-staging.yml`** - Staging environment deployment
3. **`rollback.yml`** - Emergency rollback workflow
4. **`hygiene-checks.yml`** - Quality gates (existing)

### Deployment Strategy

```text
develop branch ──► Staging Environment
     │
     └──► PR to main ──► Production Environment
```

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

# Attach necessary policies
aws iam attach-role-policy \
  --role-name GitHubActionsRole \
  --policy-arn arn:aws:iam::aws:policy/PowerUserAccess

aws iam attach-role-policy \
  --role-name GitHubActionsRole \
  --policy-arn arn:aws:iam::aws:policy/IAMFullAccess
```

### 2. GitHub Secrets Configuration

Set up the following secrets in your GitHub repository:

#### Required Secrets

```bash
# AWS Configuration
AWS_ROLE_ARN=arn:aws:iam::YOUR_ACCOUNT_ID:role/GitHubActionsRole

# Frontend Configuration
FRONTEND_API_KEY=your-production-api-key-32-characters-long
```

#### Optional Secrets (for enhanced features)

```bash
# Slack/Discord notifications (if implementing)
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/...
```

### 3. GitHub Environments

Create the following environments in GitHub:

- `hobby` (production)
- `staging`

Each environment should have:

- **Protection rules**: Require review for production
- **Environment secrets**: Environment-specific values
- **Deployment branches**: Restrict to appropriate branches

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
git push origin main  # Deploys to hobby environment
```

### Staging Deployment (`deploy-staging.yml`)

**Triggers:**

- Push to `develop` branch
- Manual dispatch with force option

**Features:**

- Automatic staging deployment
- Staging-specific tests
- Performance validation
- CORS testing

**Usage:**

```bash
# Automatic staging deployment
git push origin develop

# Manual staging deployment
# Go to Actions tab → Deploy to Staging → Run workflow
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
# Verify secrets are set correctly
# Check GitHub repository settings → Secrets and variables
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

2. **Staging Deployment**

   ```bash
   git checkout develop
   git merge feature/new-feature
   git push origin develop  # Triggers staging deployment
   ```

3. **Production Deployment**

   ```bash
   git checkout main
   git merge develop
   git push origin main  # Triggers production deployment
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

## 🔐 Security Considerations

### Secrets Management

- **GitHub Secrets**: Encrypted storage for sensitive values
- **Environment Separation**: Different secrets for staging/production
- **Least Privilege**: IAM roles with minimal required permissions

### Access Control

- **Branch Protection**: Require reviews for main branch
- **Environment Protection**: Manual approval for production
- **Audit Trail**: All deployments logged and traceable

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
