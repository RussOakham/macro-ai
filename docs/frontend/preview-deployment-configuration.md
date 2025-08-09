# Frontend Preview Deployment Configuration Reference

Complete reference for configuring the frontend preview deployment system.

## 📋 Overview

The frontend preview deployment system uses multiple configuration sources to customize behavior for different
environments and use cases.

### Configuration Hierarchy

Configuration is applied in the following order (later sources override earlier ones):

1. **Default Values**: Hardcoded defaults in scripts and workflows
2. **Environment Mapping**: Configuration from `env-mapping.json`
3. **Repository Secrets**: GitHub repository secrets
4. **Workflow Inputs**: Manual workflow parameters
5. **Environment Variables**: Runtime environment variables

## 📁 Configuration Files

### 1. Environment Mapping Configuration

**File**: `apps/client-ui/scripts/env-mapping.json`

**Purpose**: Defines environment-specific settings and backend resolution strategies

**Structure**:

```json
{
	"environments": {
		"preview": {
			"pattern": "pr-*",
			"backend_stack_pattern": "MacroAiPr{number}Stack",
			"fallback_api_url": "https://api-development.macro-ai.com/api",
			"variables": {
				"VITE_PREVIEW_MODE": "true",
				"VITE_ENABLE_DEBUG_LOGGING": "true",
				"VITE_ENABLE_DEVTOOLS": "true",
				"VITE_SHOW_BUILD_INFO": "true"
			}
		},
		"development": {
			"pattern": "dev*",
			"backend_stack_pattern": "MacroAiDevelopmentStack",
			"fallback_api_url": "https://api-development.macro-ai.com/api",
			"variables": {
				"VITE_ENABLE_DEBUG_LOGGING": "true",
				"VITE_ENABLE_DEVTOOLS": "true"
			}
		},
		"staging": {
			"pattern": "staging",
			"backend_stack_pattern": "MacroAiStagingStack",
			"fallback_api_url": "https://api-staging.macro-ai.com/api",
			"variables": {
				"VITE_ENABLE_PERFORMANCE_MONITORING": "true",
				"VITE_ENABLE_ERROR_REPORTING": "true"
			}
		},
		"production": {
			"pattern": "prod*",
			"backend_stack_pattern": "MacroAiProductionStack",
			"fallback_api_url": "https://api.macro-ai.com/api",
			"variables": {
				"VITE_ENABLE_ANALYTICS": "true",
				"VITE_ENABLE_ERROR_REPORTING": "true",
				"VITE_ENABLE_DEVTOOLS": "false",
				"VITE_ENABLE_DEBUG_LOGGING": "false"
			}
		}
	},
	"backend_resolution": {
		"cache_ttl_seconds": 300,
		"default_timeout_seconds": 10,
		"max_retry_attempts": 3,
		"strategies": [
			{
				"name": "direct_stack",
				"description": "Direct CloudFormation stack lookup",
				"priority": 1,
				"enabled": true,
				"timeout_seconds": 5
			},
			{
				"name": "alternative_patterns",
				"description": "Try alternative stack naming patterns",
				"priority": 2,
				"enabled": true,
				"timeout_seconds": 10,
				"patterns": [
					"MacroAiPr{number}Stack",
					"MacroAiPreview{number}Stack",
					"MacroAiDev{number}Stack",
					"macro-ai-pr-{number}",
					"MacroAi{environment}Stack"
				]
			},
			{
				"name": "environment_fallback",
				"description": "Use environment-specific fallback URLs",
				"priority": 3,
				"enabled": true,
				"validate_connectivity": true
			},
			{
				"name": "generic_fallback",
				"description": "Use generic fallback URL",
				"priority": 4,
				"enabled": true,
				"validate_connectivity": false
			}
		],
		"stack_output_keys": [
			"ApiEndpoint",
			"ApiGatewayUrl",
			"RestApiUrl",
			"ApiUrl",
			"BackendApiUrl"
		],
		"health_check": {
			"enabled": true,
			"endpoint_path": "/health",
			"timeout_seconds": 10,
			"expected_status_codes": [200, 404, 401, 403]
		}
	}
}
```

### 2. Amplify Configuration Templates

**Location**: `apps/client-ui/amplify-templates/`

**Files**:

- `amplify.base.yml`: Base template with common settings
- `amplify.preview.yml`: Preview environment optimizations
- `amplify.staging.yml`: Staging environment configuration
- `amplify.production.yml`: Production environment configuration

**Preview Template Example**:

```yaml
version: 1

frontend:
  phases:
    preBuild:
      commands:
        - npm install -g pnpm@10.14.0
        - pnpm install --frozen-lockfile
        - echo "VITE_API_URL: ${VITE_API_URL:-not-set}"
        - echo "VITE_PREVIEW_MODE: ${VITE_PREVIEW_MODE:-true}"

    build:
      commands:
        - pnpm type-check
        - pnpm build
        - |
          cat > dist/build-info.json << EOF
          {
            "environment": "${VITE_APP_ENV:-preview}",
            "pr_number": "${VITE_PR_NUMBER:-unknown}",
            "build_timestamp": "${VITE_BUILD_TIMESTAMP:-unknown}",
            "commit": "${VITE_BUILD_COMMIT:-unknown}",
            "api_url": "${VITE_API_URL:-unknown}"
          }
          EOF

  artifacts:
    baseDirectory: dist
    files:
      - '**/*'
    name: macro-ai-frontend-preview-pr${VITE_PR_NUMBER:-unknown}-$(date +%Y%m%d-%H%M%S)

  cache:
    paths:
      - node_modules/**/*
      - .pnpm-store/**/*

customHeaders:
  - pattern: '**/*'
    headers:
      - key: 'X-Preview-Environment'
        value: 'true'
      - key: 'X-PR-Number'
        value: '${VITE_PR_NUMBER:-unknown}'
      - key: 'Access-Control-Allow-Origin'
        value: '*'
```

## 🔐 Repository Secrets

### Required Secrets

| Secret Name        | Description                     | Example Value                                      |
| ------------------ | ------------------------------- | -------------------------------------------------- |
| `AWS_ROLE_ARN`     | AWS IAM role for GitHub Actions | `arn:aws:iam::123456789012:role/GitHubActionsRole` |
| `FRONTEND_API_KEY` | API authentication key          | `your-api-key-here`                                |

### Optional Secrets

| Secret Name         | Description                    | Default        |
| ------------------- | ------------------------------ | -------------- |
| `AMPLIFY_DOMAIN`    | Custom domain for Amplify apps | Auto-generated |
| `SLACK_WEBHOOK_URL` | Slack notifications webhook    | None           |
| `DATADOG_API_KEY`   | DataDog monitoring integration | None           |

### Adding Secrets

1. Go to repository **Settings** → **Secrets and variables** → **Actions**
2. Click **New repository secret**
3. Enter secret name and value
4. Click **Add secret**

## ⚙️ Workflow Configuration

### Deploy Frontend Preview Workflow

**File**: `.github/workflows/deploy-frontend-preview.yml`

**Trigger Configuration**:

```yaml
on:
  pull_request:
    types: [opened, synchronize, reopened]
    branches: [main, develop]
    paths:
      - 'apps/client-ui/**'
      - '.github/workflows/deploy-frontend-preview.yml'

  workflow_dispatch:
    inputs:
      environment:
        description: 'Environment name override'
        required: false
        default: 'auto'
        type: string

      pr-number:
        description: 'PR number override'
        required: false
        type: string

      force-rebuild:
        description: 'Force rebuild ignoring cache'
        required: false
        default: false
        type: boolean

      debug-mode:
        description: 'Enable debug logging'
        required: false
        default: false
        type: boolean
```

**Environment Variables**:

```yaml
env:
  AWS_REGION: us-east-1
  NODE_VERSION: '18'
  PNPM_VERSION: '10.14.0'
```

### Reusable Action Configuration

**Backend Discovery Action**:

```yaml
- name: Discover backend environment
  id: discover
  uses: ./.github/actions/discover-backend
  with:
    environment: ${{ needs.validate-access.outputs.env-name }}
    pr-number: ${{ github.event.pull_request.number }}
    validate-connectivity: 'true'
    force-refresh: 'false'
    fallback-only: 'false'
    aws-region: ${{ env.AWS_REGION }}
    timeout: '30'
    debug: 'false'
```

**Environment Generation Action**:

```yaml
- name: Generate environment configuration
  id: generate-env
  uses: ./.github/actions/generate-frontend-env
  with:
    environment: ${{ needs.validate-access.outputs.env-name }}
    pr-number: ${{ github.event.pull_request.number }}
    build-mode: 'preview'
    api-endpoint: ${{ needs.check-backend-environment.outputs.api-endpoint }}
    api-key: ${{ secrets.FRONTEND_API_KEY }}
    backend-stack-name: ${{ needs.check-backend-environment.outputs.stack-name }}
    resolution-method: ${{ needs.check-backend-environment.outputs.resolution-method }}
    output-file: '.env.preview'
    include-build-metadata: 'true'
    validate-variables: 'true'
    debug: 'false'
```

## 🌍 Environment Variables

### Core Environment Variables

| Variable        | Description              | Example                             | Required |
| --------------- | ------------------------ | ----------------------------------- | -------- |
| `VITE_API_URL`  | Backend API endpoint     | `https://api-pr123.example.com/api` | Yes      |
| `VITE_API_KEY`  | API authentication key   | `your-api-key`                      | Yes      |
| `VITE_APP_ENV`  | Application environment  | `pr-123`                            | Yes      |
| `VITE_APP_NAME` | Application display name | `Macro AI (Preview)`                | No       |

### Preview-Specific Variables

| Variable                    | Description                  | Default       | Environment  |
| --------------------------- | ---------------------------- | ------------- | ------------ |
| `VITE_PREVIEW_MODE`         | Enable preview mode features | `true`        | Preview only |
| `VITE_PR_NUMBER`            | Pull request number          | Auto-detected | Preview only |
| `VITE_ENABLE_DEVTOOLS`      | Enable React DevTools        | `true`        | Preview/Dev  |
| `VITE_ENABLE_DEBUG_LOGGING` | Enable debug logging         | `true`        | Preview/Dev  |
| `VITE_SHOW_BUILD_INFO`      | Show build information       | `true`        | Preview only |

### Build Metadata Variables

| Variable               | Description     | Source             |
| ---------------------- | --------------- | ------------------ |
| `VITE_BUILD_TIMESTAMP` | Build timestamp | Auto-generated     |
| `VITE_BUILD_COMMIT`    | Git commit hash | `$GITHUB_SHA`      |
| `VITE_BUILD_BRANCH`    | Git branch name | `$GITHUB_REF_NAME` |
| `VITE_BUILD_WORKFLOW`  | Workflow name   | `$GITHUB_WORKFLOW` |
| `VITE_BUILD_RUN_ID`    | Workflow run ID | `$GITHUB_RUN_ID`   |

### Backend Integration Variables

| Variable                     | Description               | Source            |
| ---------------------------- | ------------------------- | ----------------- |
| `VITE_BACKEND_STACK_NAME`    | CloudFormation stack name | Backend discovery |
| `VITE_API_RESOLUTION_METHOD` | How API was resolved      | Backend discovery |
| `VITE_API_FALLBACK_USED`     | Whether fallback was used | Backend discovery |
| `VITE_API_RESOLVED_AT`       | Resolution timestamp      | Backend discovery |

## 🎛️ Script Configuration

### Backend Discovery Service

**Configuration Options**:

```bash
./scripts/backend-discovery-service.sh [command] [options]

Commands:
  discover <environment>      Discover backend for environment
  validate <api-url>          Validate API endpoint
  cache-clear                 Clear discovery cache
  list-stacks                 List available backend stacks
  health-check <api-url>      Perform health check

Options:
  --pr-number <number>        PR number for preview environments
  --region <region>           AWS region (default: us-east-1)
  --cache-ttl <seconds>       Cache TTL in seconds (default: 300)
  --output-format <format>    Output format: json|env|url (default: json)
  --validate-connectivity     Enable connectivity validation
  --debug                     Enable debug output
```

### API Resolution Service

**Configuration Options**:

```bash
./scripts/api-resolution-service.sh [options]

Options:
  --environment <env>         Target environment (required)
  --pr-number <number>        PR number for preview environments
  --output-format <format>    Output format: json|env|url (default: env)
  --validate-connectivity     Enable API connectivity validation
  --force-refresh             Force refresh of cached results
  --fallback-only             Skip backend discovery, use fallback only
  --region <region>           AWS region (default: us-east-1)
  --timeout <seconds>         API validation timeout (default: 10)
  --debug                     Enable debug output
```

### Environment Injection Script

**Configuration Options**:

```bash
./scripts/inject-preview-env.sh [options]

Options:
  --environment <env>         Target environment (required)
  --pr-number <number>        PR number for preview environments
  --build-mode <mode>         Build mode: preview|staging|production
  --output-file <file>        Output file path (default: .env.preview)
  --api-url <url>             Override API URL
  --debug                     Enable debug output
```

## 🔧 Customization Examples

### Adding Custom Environment Variables

**1. Repository Level** (affects all deployments):

```bash
# Add to repository secrets
CUSTOM_FEATURE_FLAG=enabled
ANALYTICS_ENDPOINT=https://analytics.example.com
```

**2. Environment Level** (affects specific environments):

```json
{
	"environments": {
		"preview": {
			"variables": {
				"VITE_CUSTOM_FEATURE": "beta-mode",
				"VITE_LOG_LEVEL": "debug"
			}
		}
	}
}
```

**3. Workflow Level** (manual overrides):

```yaml
- name: Generate environment configuration
  uses: ./.github/actions/generate-frontend-env
  with:
    # ... other inputs
  env:
    VITE_CUSTOM_OVERRIDE: 'workflow-value'
```

### Custom Backend Stack Patterns

**Adding New Patterns**:

```json
{
	"backend_resolution": {
		"strategies": [
			{
				"name": "alternative_patterns",
				"patterns": [
					"MacroAiPr{number}Stack",
					"MacroAi-PR-{number}-Stack",
					"macro-ai-preview-{number}",
					"YourCustomPattern{number}"
				]
			}
		]
	}
}
```

### Custom Amplify Configuration

**Creating Environment-Specific Template**:

```yaml
# amplify-templates/amplify.custom.yml
version: 1

frontend:
  phases:
    preBuild:
      commands:
        - echo "Custom pre-build steps"
        - npm install -g pnpm@10.14.0
        - pnpm install --frozen-lockfile

    build:
      commands:
        - echo "Custom build steps"
        - pnpm type-check
        - pnpm lint
        - pnpm build:custom

  artifacts:
    baseDirectory: dist
    files:
      - '**/*'

customHeaders:
  - pattern: '**/*'
    headers:
      - key: 'X-Custom-Header'
        value: 'custom-value'
```

### Performance Optimization

**Build Performance**:

```json
{
	"backend_resolution": {
		"cache_ttl_seconds": 600,
		"strategies": [
			{
				"name": "direct_stack",
				"timeout_seconds": 3
			}
		]
	}
}
```

**Runtime Performance**:

```yaml
# In Amplify template
customHeaders:
  - pattern: '/static/**'
    headers:
      - key: 'Cache-Control'
        value: 'public, max-age=31536000, immutable'
```

## 📚 Related Documentation

- [Getting Started Guide](./getting-started-preview-deployments.md)
- [User Manual](./preview-deployment-user-manual.md)
- [Troubleshooting Guide](./troubleshooting-preview-deployments.md)
- [Best Practices](./preview-deployment-best-practices.md)
- [API Reference](./preview-deployment-api-reference.md)
