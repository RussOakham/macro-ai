# Frontend Preview Deployment User Manual

Complete guide for using the frontend preview deployment system in the Macro AI project.

## 📋 Table of Contents

- [Overview](#-overview)
- [Deployment Workflows](#-deployment-workflows)
- [Environment Management](#-environment-management)
- [Backend Integration](#-backend-integration)
- [Configuration Options](#️-configuration-options)
- [Monitoring and Debugging](#-monitoring-and-debugging)
- [Advanced Usage](#-advanced-usage)

## 🎯 Overview

The frontend preview deployment system provides automated, isolated preview environments for every pull
request, enabling safe testing and collaboration.

### Key Features

- ✅ **Automatic Deployment**: Triggered by PR creation and updates
- ✅ **Backend Integration**: Automatic discovery and connection to backend APIs
- ✅ **Environment Isolation**: Each PR gets its own isolated environment
- ✅ **Cleanup Automation**: Automatic cleanup when PRs are closed
- ✅ **Performance Optimization**: Caching and build optimizations
- ✅ **Security**: Secure credential handling and access controls

### System Architecture

```text
┌─────────────────────────────────────────────────────────────┐
│                    Preview Deployment System               │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  GitHub PR ──► Workflow ──► Backend Discovery ──► Build    │
│      │             │              │                │       │
│      │             │              ▼                ▼       │
│      │             │         API Resolution    Amplify     │
│      │             │              │           Deployment   │
│      │             ▼              ▼                │       │
│      └──► Environment Generation ──────────────────┘       │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## 🔄 Deployment Workflows

### Automatic Deployment

**Trigger Conditions**:

- Pull request created against `main` or `develop` branch
- New commits pushed to existing pull request
- Manual workflow dispatch

**Deployment Process**:

1. **Access Validation**
   - Verifies PR author permissions
   - Checks branch protection rules
   - Validates deployment conditions

2. **Backend Discovery**
   - Searches for PR-specific backend stacks
   - Falls back to shared development backend
   - Validates API endpoint connectivity

3. **Environment Generation**
   - Creates environment-specific configuration
   - Injects build metadata and API endpoints
   - Validates all required variables

4. **Build and Deploy**
   - Generates Amplify configuration
   - Builds React application
   - Deploys to AWS Amplify
   - Updates PR with preview URL

### Manual Deployment

**When to Use Manual Deployment**:

- Deployment failed and you want to retry
- Testing configuration changes
- Deploying from a specific commit

**How to Trigger**:

1. **Via GitHub Actions UI**:

   ```text
   Actions → Deploy Frontend Preview → Run workflow
   ├── Select branch
   ├── Optional: Override environment name
   └── Run workflow
   ```

2. **Via GitHub CLI** (if configured):

   ```bash
   gh workflow run "Deploy Frontend Preview" \
     --ref feature/my-branch \
     --field environment="pr-123"
   ```

### Deployment Status

**Monitoring Deployment Progress**:

1. **GitHub Actions Tab**
   - Real-time logs and status
   - Step-by-step progress
   - Error messages and debugging info

2. **PR Comments**
   - Automated status updates
   - Preview URL when ready
   - Links to deployment logs

3. **PR Checks**
   - Green checkmark when successful
   - Red X with error details if failed
   - Yellow circle while in progress

## 🌍 Environment Management

### Environment Types

| Environment     | Pattern       | Backend Stack             | API Endpoint                   |
| --------------- | ------------- | ------------------------- | ------------------------------ |
| **Preview**     | `pr-{number}` | `MacroAiPr{number}Stack`  | Auto-discovered                |
| **Development** | `development` | `MacroAiDevelopmentStack` | `api-development.macro-ai.com` |
| **Staging**     | `staging`     | `MacroAiStagingStack`     | `api-staging.macro-ai.com`     |
| **Production**  | `production`  | `MacroAiProductionStack`  | `api.macro-ai.com`             |

### Environment Variables

**Automatically Generated Variables**:

```bash
# API Configuration
VITE_API_URL=https://api-pr123.example.com/api
VITE_API_KEY=***
VITE_API_RESOLUTION_METHOD=direct_stack_discovery

# Environment Identification
VITE_APP_ENV=pr-123
VITE_APP_NAME=Macro AI (Preview)
VITE_PREVIEW_MODE=true

# Build Metadata
VITE_BUILD_TIMESTAMP=2025-08-09 10:30:00 UTC
VITE_BUILD_COMMIT=abc123def456
VITE_BUILD_BRANCH=feature/my-feature
VITE_PR_NUMBER=123

# Backend Integration
VITE_BACKEND_STACK_NAME=MacroAiPr123Stack
VITE_API_FALLBACK_USED=false

# Debug Configuration
VITE_ENABLE_DEVTOOLS=true
VITE_ENABLE_DEBUG_LOGGING=true
VITE_SHOW_BUILD_INFO=true
```

### Environment Configuration

**Configuration Sources** (in order of precedence):

1. **Manual Overrides**: Explicitly set in workflow inputs
2. **Backend Discovery**: API endpoints from CloudFormation stacks
3. **Environment Mapping**: Configuration from `env-mapping.json`
4. **Default Fallbacks**: Hardcoded fallback values

**Customizing Environment Variables**:

Edit `apps/client-ui/scripts/env-mapping.json`:

```json
{
	"environments": {
		"preview": {
			"variables": {
				"VITE_CUSTOM_FEATURE": "enabled",
				"VITE_DEBUG_LEVEL": "verbose"
			}
		}
	}
}
```

## 🔗 Backend Integration

### Backend Discovery Process

**Discovery Strategy** (in priority order):

1. **Direct Stack Discovery**
   - Searches for `MacroAiPr{number}Stack`
   - Validates stack status and outputs
   - Extracts API endpoint from stack outputs

2. **Alternative Patterns**
   - Tries multiple naming conventions
   - Supports legacy stack names
   - Handles different deployment patterns

3. **Environment Fallback**
   - Uses environment-specific fallback URLs
   - Validates connectivity before use
   - Provides consistent API access

4. **Generic Fallback**
   - Last resort fallback URL
   - Ensures deployment never fails due to missing backend
   - Logs fallback usage for monitoring

### API Endpoint Resolution

**Stack Output Keys** (searched in order):

- `ApiEndpoint`
- `ApiGatewayUrl`
- `RestApiUrl`
- `ApiUrl`
- `BackendApiUrl`

**Connectivity Validation**:

- Tests `/health` endpoint
- Validates response time
- Checks for expected HTTP status codes (200, 404, 401, 403)

### Backend-Frontend Coordination

**Coordinated Deployments**:

1. **Backend First**: Deploy backend, then frontend automatically discovers it
2. **Frontend Only**: Frontend uses fallback API for development
3. **Full Stack**: Both deployed together with automatic integration

**Environment Matching**:

- PR 123 frontend → `MacroAiPr123Stack` backend
- Staging frontend → `MacroAiStagingStack` backend
- Production frontend → `MacroAiProductionStack` backend

## ⚙️ Configuration Options

### Workflow Configuration

**Input Parameters** (for manual deployment):

```yaml
inputs:
  environment:
    description: 'Environment name override'
    required: false
    default: 'auto'

  pr-number:
    description: 'PR number override'
    required: false

  force-rebuild:
    description: 'Force rebuild ignoring cache'
    required: false
    default: false

  debug-mode:
    description: 'Enable debug logging'
    required: false
    default: false
```

### Amplify Configuration

**Environment-Specific Templates**:

- `amplify.preview.yml`: Fast builds, debug features enabled
- `amplify.staging.yml`: Production-like, comprehensive testing
- `amplify.production.yml`: Maximum security and performance

**Build Configuration**:

```yaml
# Preview Environment
frontend:
  phases:
    preBuild:
      commands:
        - npm install -g pnpm@10.14.0
        - pnpm install --frozen-lockfile
    build:
      commands:
        - pnpm type-check
        - pnpm build
  artifacts:
    baseDirectory: dist
    files:
      - '**/*'
```

### Security Configuration

**Preview Environment Security**:

- Relaxed CORS for development
- Debug tools enabled
- Source maps included
- Permissive CSP for testing

**Production Environment Security**:

- Strict CORS policies
- Debug tools disabled
- No source maps
- Strict CSP headers

## 📊 Monitoring and Debugging

### Deployment Monitoring

**Key Metrics**:

- Deployment success rate
- Average deployment time
- Backend discovery success rate
- API response times

**Monitoring Tools**:

1. **GitHub Actions Logs**
   - Step-by-step execution logs
   - Error messages and stack traces
   - Performance timing information

2. **AWS Amplify Console**
   - Build logs and metrics
   - Performance monitoring
   - Access logs and analytics

3. **CloudWatch Logs** (if configured)
   - Application logs
   - Error tracking
   - Performance metrics

### Debug Mode

**Enabling Debug Mode**:

1. **Manual Workflow Trigger**:
   - Set `debug-mode: true` in workflow inputs
   - Enables verbose logging throughout deployment

2. **Environment Variable**:

   ```bash
   export DEBUG=true
   ./scripts/api-resolution-service.sh --environment pr-123 --debug
   ```

**Debug Information Includes**:

- Backend discovery attempts and results
- API resolution strategy details
- Environment variable generation process
- Build configuration details
- Deployment timing information

### Troubleshooting Tools

**Built-in Debugging**:

1. **Build Info Endpoint**:

   ```text
   https://pr123.d1234567890.amplifyapp.com/build-info.json
   ```

   Returns:

   ```json
   {
   	"environment": "pr-123",
   	"build_timestamp": "2025-08-09 10:30:00 UTC",
   	"commit": "abc123def456",
   	"api_url": "https://api-pr123.example.com/api",
   	"backend_stack": "MacroAiPr123Stack"
   }
   ```

2. **Health Check Endpoint**:

   ```text
   https://pr123.d1234567890.amplifyapp.com/health
   ```

3. **Local Testing Scripts**:

   ```bash
   # Test backend discovery
   cd apps/client-ui
   ./scripts/backend-discovery-service.sh discover pr-123 --pr-number 123 --debug

   # Test environment generation
   ./scripts/api-resolution-service.sh --environment pr-123 --debug

   # Run integration tests
   ./scripts/test-backend-integration.sh
   ```

## 🚀 Advanced Usage

### Custom Environment Variables

**Adding Custom Variables**:

1. **Repository Secrets**: Add to GitHub repository secrets
2. **Environment Mapping**: Configure in `env-mapping.json`
3. **Workflow Inputs**: Pass as workflow parameters

**Example Custom Configuration**:

```json
{
	"environments": {
		"preview": {
			"variables": {
				"VITE_FEATURE_FLAGS": "new-ui,beta-features",
				"VITE_ANALYTICS_ENABLED": "false",
				"VITE_LOG_LEVEL": "debug"
			}
		}
	}
}
```

### Performance Optimization

**Build Performance**:

- Aggressive caching for dependencies
- Parallel build steps where possible
- Optimized Docker images
- CDN integration for assets

**Runtime Performance**:

- Code splitting and lazy loading
- Asset optimization
- Service worker caching
- Performance monitoring

### Integration with External Services

**Supported Integrations**:

- **Analytics**: Google Analytics, Mixpanel
- **Error Tracking**: Sentry, Bugsnag
- **Feature Flags**: LaunchDarkly, Split
- **Authentication**: Auth0, Cognito
- **Monitoring**: DataDog, New Relic

**Configuration Example**:

```bash
# Analytics
VITE_GOOGLE_ANALYTICS_ID=GA-XXXXXXXXX
VITE_MIXPANEL_TOKEN=your-token

# Error Tracking
VITE_SENTRY_DSN=https://your-dsn@sentry.io/project

# Feature Flags
VITE_LAUNCHDARKLY_CLIENT_ID=your-client-id
```

### Multi-Environment Testing

**Testing Across Environments**:

1. **Local Development**:

   ```bash
   cd apps/client-ui
   pnpm dev
   ```

2. **Preview Environment**:
   - Automatic with PR creation
   - Manual trigger for specific testing

3. **Staging Environment**:
   - Deploy to staging for integration testing
   - Full production-like environment

4. **Production Environment**:
   - Final deployment target
   - Maximum security and performance

## 📚 Related Documentation

- [Getting Started Guide](./getting-started-preview-deployments.md)
- [Configuration Reference](./preview-deployment-configuration.md)
- [Troubleshooting Guide](./troubleshooting-preview-deployments.md)
- [Best Practices](./preview-deployment-best-practices.md)
- [API Reference](./preview-deployment-api-reference.md)
