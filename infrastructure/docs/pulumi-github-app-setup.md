# Pulumi GitHub App Setup Guide

## Overview

The Pulumi GitHub App integration enables automatic Review Stacks deployment for pull requests.
When you open a PR, Pulumi will automatically create a preview environment and post a comment
with the deployment details.

## Prerequisites

- GitHub repository: `RussOakham/macro-ai`
- Pulumi Cloud account
- Admin access to the GitHub repository

## Installation Steps

### Step 1: Install Pulumi GitHub App

1. **Visit the Pulumi GitHub App**: <https://github.com/apps/pulumi>
2. **Click "Install"** on the Pulumi GitHub App page
3. **Configure Installation**:
   - Select your GitHub organization or personal account
   - Choose repositories: Select `macro-ai` (or all repositories)
   - **Required Permissions**:
     - ✅ **Repository permissions**:
       - Contents: Read
       - Metadata: Read
       - Pull requests: Write (for commenting on PRs)
     - ✅ **Organization permissions**:
       - Members: Read (if installing on organization)

### Step 2: Configure Repository Settings

1. **Go to Repository Settings** → **Integrations** → **GitHub Apps**
2. **Find the Pulumi App** and click **Configure**
3. **Verify Permissions**:
   - Repository contents: ✅ Read
   - Repository metadata: ✅ Read
   - Pull requests: ✅ Write

### Step 3: Connect to Pulumi Cloud

1. **Open Pulumi Cloud**: <https://app.pulumi.com>
2. **Go to your organization**: `RussOakham`
3. **Navigate to**: Settings → Integrations → GitHub
4. **Click "Connect GitHub"** if not already connected
5. **Authorize** the GitHub integration

## What This Enables

### ✅ **Automatic Review Stacks**

- New stack created for each PR: `pr-123`
- Environment deployed automatically
- PR comment with deployment details
- Auto-cleanup when PR closes/merges

### ✅ **PR Comments**

The app will automatically post comments like:

```markdown
## 🚀 PR Preview Environment Deployed

✅ Infrastructure deployed successfully!

- **API Endpoint**: https://pr-123.api.macro-ai.russoakham.dev
- **Pulumi Stack**: \`pr-123\`
- **Health Status**: ✅ Service is ready!

You can test your changes at the API endpoint above.
```

### ✅ **Cost Optimization**

- Review Stacks use your existing cost-optimized configuration
- Automatic cleanup prevents resource waste
- No manual intervention required

## Troubleshooting

### App Not Posting Comments

1. **Check App Installation**: Go to Settings → GitHub Apps
2. **Verify Permissions**: Ensure Pull requests: Write is enabled
3. **Check Repository Access**: App must be installed on the repository

### Review Stacks Not Creating

1. **Verify Configuration**: Run the setup script: `./scripts/setup-pr-stack.sh`
2. **Check Stack Settings**: Ensure `github:pullRequestTemplate` is set to `true`
3. **Review Permissions**: App needs repository access

### Deployment Failures

1. **Check Workflow Logs**: Review the PR deployment workflow logs
2. **Verify Secrets**: Ensure all required GitHub secrets are set
3. **Check Doppler Configuration**: Verify Doppler token is valid

## Manual Verification

### Check App Installation

```bash
gh api repos/RussOakham/macro-ai/installation
```

### List Installed Apps

```bash
gh api repos/RussOakham/macro-ai/installations
```

### Test PR Comment Functionality

```bash
gh api repos/RussOakham/macro-ai/issues/123/comments -f body="Test comment from setup"
```

## Security Considerations

- The app only reads repository contents and metadata
- Pull request write access is needed for commenting
- No access to repository administration or security settings
- All deployments are isolated to the PR environment

## Next Steps

1. ✅ **Install Pulumi GitHub App** (this guide)
2. ✅ **Configure PR Stack** (already done)
3. 🔐 **Configure Doppler** for PR environments
4. 🧪 **Test the setup** using the test script
5. 🔄 **Test with a PR** to verify automatic deployment
6. 📊 **Monitor costs** to ensure cleanup is working properly

### Quick Setup (Automated)

For the fastest setup, run the complete setup script:

```bash
cd infrastructure
./scripts/setup-complete-pr-environment.sh
```

This will:

- Configure PR stack with Review Stacks
- Set up Doppler for PR environments
- Verify GitHub App integration
- Test connectivity to all services
- Run comprehensive verification tests

### Testing Your Setup

Before creating actual PRs, you can test your setup:

```bash
cd infrastructure
./scripts/test-pr-deployment.sh
```

This script will:

- ✅ Check all prerequisites (CLI tools, authentication)
- ✅ Verify configuration files exist
- ✅ Test Pulumi stack configuration
- ✅ Verify Doppler connectivity
- ✅ Check ECR access
- ✅ Validate GitHub App installation and permissions
- ✅ Provide detailed troubleshooting if issues found

## Support

- **Pulumi Documentation**: <https://www.pulumi.com/docs/using-pulumi/continuous-delivery/github-app/>
- **GitHub App Setup**: <https://github.com/apps/pulumi>
- **Community Slack**: <https://slack.pulumi.com/>
