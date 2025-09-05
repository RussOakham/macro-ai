# Amplify Preview Environment Management Scripts

This directory contains comprehensive management scripts for AWS Amplify preview environments used in the Macro AI frontend
deployment pipeline.

## 📁 Script Overview

### Core Deployment Scripts

#### `deploy-amplify-preview.sh`

**Purpose**: Deploy React frontend to ephemeral Amplify preview environments

**Usage**:

```bash
# Set environment variables
export AMPLIFY_APP_NAME="macro-ai-frontend-pr-123"
export ENVIRONMENT_NAME="pr-123"
export PR_NUMBER="123"
export VITE_API_URL="https://api-endpoint.com/api"
export VITE_API_KEY="your-api-key"

# Run deployment
./deploy-amplify-preview.sh
```

**Features**:

- Creates or updates Amplify apps for PR previews
- Manages environment-specific configuration
- Monitors deployment progress with detailed logging
- Generates deployment metadata and URLs
- Handles build artifact packaging and deployment

#### `destroy-amplify-preview.sh`

**Purpose**: Clean up Amplify preview environments when PRs are closed

**Usage**:

```bash
# Set environment variables
export AMPLIFY_APP_ID="d1234567890"
export AMPLIFY_APP_NAME="macro-ai-frontend-pr-123"
export ENVIRONMENT_NAME="pr-123"
export PR_NUMBER="123"

# Run destruction
./destroy-amplify-preview.sh
```

**Features**:

- Safely deletes Amplify apps and branches
- Verifies app identity before deletion
- Provides detailed deletion progress
- Handles already-deleted apps gracefully

### Environment Variable Integration

#### `resolve-backend-api.sh`

**Purpose**: Dynamically resolve backend API endpoints for frontend preview environments

**Usage**:

```bash
# Resolve API URL for PR #123
./resolve-backend-api.sh --pr-number 123 --output-format url

# Get complete resolution information as JSON
./resolve-backend-api.sh --environment pr-123 --output-format json

# Generate environment variables
./resolve-backend-api.sh --pr-number 123 --output-format env
```

**Features**:

- Multiple resolution strategies (direct stack, alternative patterns, fallbacks)
- CloudFormation stack integration for backend discovery
- Environment-specific fallback URLs
- Comprehensive output formats (URL, JSON, environment variables)

#### `inject-preview-env.sh`

**Purpose**: Generate comprehensive environment variable configuration for preview builds

**Usage**:

```bash
# Generate environment configuration for PR #123
export VITE_API_KEY="your-api-key"
./inject-preview-env.sh --pr-number 123

# Generate with custom build mode
./inject-preview-env.sh --environment staging --build-mode staging

# Validate environment only
./inject-preview-env.sh --pr-number 123 --validate-only
```

**Features**:

- Dynamic backend API resolution integration
- Build metadata injection (commit, branch, timestamp)
- Environment-specific variable configuration
- Comprehensive validation system

#### `configure-preview-env.sh`

**Purpose**: Advanced configuration management for preview environments

**Usage**:

```bash
# Generate environment configuration file
./configure-preview-env.sh generate-env 123

# Update Amplify app environment variables
./configure-preview-env.sh update-app-env 123

# Show current configuration
./configure-preview-env.sh show-config 123
```

**Features**:

- Environment file generation with backend integration
- Amplify app environment variable management
- Configuration validation and display

### Management Utilities

#### `amplify-preview-manager.sh`

**Purpose**: Comprehensive management utility for all preview environments

**Commands**:

```bash
# List all preview environments
./amplify-preview-manager.sh list

# Show detailed status of specific preview
./amplify-preview-manager.sh status 123

# Clean up old preview environments
./amplify-preview-manager.sh cleanup-old 7

# Validate preview environment configuration
./amplify-preview-manager.sh validate 123
```

**Features**:

- Environment listing and status monitoring
- Automated cleanup of old environments
- Configuration validation
- Detailed environment information display

#### `health-check-preview.sh`

**Purpose**: Validate deployed preview environments are working correctly

**Usage**:

```bash
# Check health of PR #123 preview
./health-check-preview.sh 123
```

**Health Checks**:

- ✅ Basic connectivity (HTTP 200 response)
- ✅ Content validity (HTML structure, React indicators)
- ✅ API connectivity (backend endpoint accessibility)
- ✅ Performance metrics (response time, content size)

#### `configure-preview-env.sh`

**Purpose**: Manage environment-specific configuration for preview deployments

**Commands**:

```bash
# Generate environment configuration file
./configure-preview-env.sh generate-env 123

# Validate configuration
./configure-preview-env.sh validate-env 123

# Update Amplify app environment variables
./configure-preview-env.sh update-app-env 123

# Show current configuration
./configure-preview-env.sh show-config 123
```

**Features**:

- Environment file generation with backend integration
- Configuration validation and error checking
- Amplify app environment variable management
- Configuration display and debugging

## 🔧 Environment Variables

### Required Variables

| Variable           | Description             | Example                       |
| ------------------ | ----------------------- | ----------------------------- |
| `AMPLIFY_APP_NAME` | Name of the Amplify app | `macro-ai-frontend-pr-123`    |
| `ENVIRONMENT_NAME` | Environment identifier  | `pr-123`                      |
| `PR_NUMBER`        | Pull request number     | `123`                         |
| `VITE_API_URL`     | Backend API endpoint    | `https://api.example.com/api` |
| `VITE_API_KEY`     | API authentication key  | `your-32-char-api-key`        |

### Optional Variables

| Variable                    | Description             | Default       |
| --------------------------- | ----------------------- | ------------- |
| `AWS_REGION`                | AWS region              | `us-east-1`   |
| `VITE_APP_ENV`              | Application environment | `pr-{number}` |
| `VITE_ENABLE_DEVTOOLS`      | Enable dev tools        | `true`        |
| `VITE_ENABLE_DEBUG_LOGGING` | Enable debug logging    | `true`        |

## 🚀 Integration with GitHub Actions

These scripts are designed to integrate seamlessly with GitHub Actions workflows:

### Deployment Workflow Integration

```yaml
- name: Deploy to Amplify
  run: |
    cd apps/client-ui
    export AMPLIFY_APP_NAME="macro-ai-frontend-pr-${{ github.event.pull_request.number }}"
    export ENVIRONMENT_NAME="pr-${{ github.event.pull_request.number }}"
    export PR_NUMBER="${{ github.event.pull_request.number }}"
    export VITE_API_URL="${{ needs.backend.outputs.api-endpoint }}api"
    export VITE_API_KEY="${{ secrets.FRONTEND_API_KEY }}"
    ./scripts/deploy-amplify-preview.sh
```

### Teardown Workflow Integration

```yaml
- name: Destroy Amplify Preview
  run: |
    cd apps/client-ui
    export AMPLIFY_APP_ID="${{ needs.check-app.outputs.app-id }}"
    export AMPLIFY_APP_NAME="macro-ai-frontend-pr-${{ github.event.pull_request.number }}"
    export ENVIRONMENT_NAME="pr-${{ github.event.pull_request.number }}"
    export PR_NUMBER="${{ github.event.pull_request.number }}"
    ./scripts/destroy-amplify-preview.sh
```

## 🛠️ Prerequisites

### Required Tools

- **AWS CLI**: Version 2.x with configured credentials
- **jq**: JSON processor for parsing AWS responses
- **curl**: For health checks and API testing
- **zip**: For creating deployment packages
- **bc**: For mathematical calculations (performance metrics)

### AWS Permissions

The scripts require AWS credentials with the following permissions:

- `amplify:*` - Full Amplify service access
- `cloudformation:DescribeStacks` - For backend integration
- `sts:GetCallerIdentity` - For credential validation

## 📊 Monitoring and Debugging

### Log Files

Scripts generate various output files for debugging:

- `amplify-deployment-url.txt` - Deployed application URL
- `amplify-deployment-error.txt` - Error details from failed deployments
- `amplify-job-id.txt` - Deployment job ID for monitoring
- `amplify-app-id.txt` - App ID for reference

### Console Links

Scripts provide direct links to AWS Console for monitoring:

- Amplify app dashboard
- Deployment job details
- Build logs and metrics

### Health Check Reports

The health check script provides comprehensive reports:

- Connectivity status
- Content validation results
- API endpoint accessibility
- Performance metrics

## 🔒 Security Considerations

### Environment Variables

- Never commit API keys or sensitive data to version control
- Use GitHub Secrets for sensitive environment variables
- Validate all input parameters to prevent injection attacks

### App Naming

- Apps use predictable naming patterns for easy management
- PR numbers are validated to prevent unauthorized access
- Code ownership validation ensures only authorized users can deploy

### Cleanup

- Automatic cleanup prevents resource accumulation
- Manual cleanup options for edge cases
- Verification steps ensure complete resource removal

## 🚨 Troubleshooting

### Common Issues

**"AWS CLI not found"**

```bash
# Install AWS CLI
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
sudo ./aws/install
```

**"Deployment timeout"**

- Check Amplify console for detailed build logs
- Verify build artifacts are present in `dist/` directory
- Check environment variables are correctly set

**"App not found"**

- Verify PR number is correct
- Check if app was already deleted
- Ensure AWS credentials have proper permissions

**"Health check failures"**

- Wait for deployment to complete fully
- Check if backend API is accessible
- Verify environment variables are correctly configured

### Debug Mode

Enable verbose output for troubleshooting:

```bash
# Enable debug mode
set -x
./script-name.sh

# Or use the manager's verbose flag
./amplify-preview-manager.sh --verbose list
```

## 📚 Additional Resources

- [AWS Amplify Documentation](https://docs.aws.amazon.com/amplify/)
- [GitHub Actions Workflow Documentation](../../.github/workflows/)
- [Frontend Preview Deployment Guide](../docs/deployment/AMPLIFY_DEPLOYMENT.md)
- [Integration Guide](../docs/integration/INTEGRATION_GUIDE.md)
