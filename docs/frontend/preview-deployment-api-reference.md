# Frontend Preview Deployment API Reference

Complete API reference for scripts, actions, and integration points in the frontend preview deployment system.

## 📋 Overview

This reference covers all programmatic interfaces for the frontend preview deployment system, including shell
scripts, GitHub Actions, and configuration APIs.

## 🔧 Shell Scripts API

### 1. Backend Discovery Service

**Script**: `apps/client-ui/scripts/backend-discovery-service.sh`

**Purpose**: Discovers backend CloudFormation stacks and extracts API endpoints

#### Commands

##### `discover <environment>`

Discovers backend for specified environment.

**Syntax**:

```bash
./backend-discovery-service.sh discover <environment> [options]
```

**Parameters**:

- `environment` (required): Target environment name (e.g., `pr-123`, `staging`)

**Options**:

- `--pr-number <number>`: PR number for preview environments
- `--region <region>`: AWS region (default: `us-east-1`)
- `--cache-ttl <seconds>`: Cache TTL in seconds (default: `300`)
- `--output-format <format>`: Output format: `json|env|url` (default: `json`)
- `--validate-connectivity`: Enable connectivity validation
- `--debug`: Enable debug output

**Output** (JSON format):

```json
{
	"environment": "pr-123",
	"pr_number": "123",
	"discovered_at": "2025-08-09 10:30:00 UTC",
	"region": "us-east-1",
	"backend_found": true,
	"api_endpoint": "https://api-pr123.example.com/api",
	"stack_name": "MacroAiPr123Stack",
	"stack_status": "CREATE_COMPLETE",
	"resolution_method": "direct_stack_discovery",
	"fallback_url": null,
	"validation": {
		"connectivity_checked": true,
		"connectivity_status": "accessible",
		"response_time_ms": 245
	}
}
```

**Exit Codes**:

- `0`: Success
- `1`: General error
- `2`: Invalid arguments
- `3`: AWS credentials error

##### `validate <api-url>`

Validates API endpoint connectivity.

**Syntax**:

```bash
./backend-discovery-service.sh validate <api-url>
```

**Output**:

```json
{
	"connectivity_checked": true,
	"connectivity_status": "accessible",
	"http_status": "200",
	"response_time_ms": 156
}
```

##### `list-stacks`

Lists available backend CloudFormation stacks.

**Syntax**:

```bash
./backend-discovery-service.sh list-stacks [--region <region>]
```

**Output**:

```text
MacroAiPr123Stack (CREATE_COMPLETE) - Created: 2025-08-09T10:15:00Z
MacroAiDevelopmentStack (UPDATE_COMPLETE) - Created: 2025-08-08T14:30:00Z
MacroAiStagingStack (CREATE_COMPLETE) - Created: 2025-08-07T09:45:00Z
```

##### `cache-clear`

Clears discovery cache.

**Syntax**:

```bash
./backend-discovery-service.sh cache-clear
```

### 2. API Resolution Service

**Script**: `apps/client-ui/scripts/api-resolution-service.sh`

**Purpose**: High-level orchestration of backend discovery and API resolution

#### Main Command

**Syntax**:

```bash
./api-resolution-service.sh [options]
```

**Options**:

- `--environment <env>` (required): Target environment
- `--pr-number <number>`: PR number for preview environments
- `--output-format <format>`: Output format: `json|env|url` (default: `env`)
- `--validate-connectivity`: Enable API connectivity validation
- `--force-refresh`: Force refresh of cached results
- `--fallback-only`: Skip backend discovery, use fallback only
- `--region <region>`: AWS region (default: `us-east-1`)
- `--timeout <seconds>`: API validation timeout (default: `10`)
- `--debug`: Enable debug output

**Output** (env format):

```bash
# API Resolution Results
# Generated on: 2025-08-09 10:30:00 UTC
# Environment: pr-123
# Resolution method: direct_stack_discovery
# Fallback used: false

VITE_API_URL=https://api-pr123.example.com/api
VITE_API_RESOLUTION_METHOD=direct_stack_discovery
VITE_BACKEND_STACK_NAME=MacroAiPr123Stack
VITE_API_FALLBACK_USED=false
VITE_API_RESOLVED_AT=2025-08-09 10:30:00 UTC
```

**Output** (JSON format):

```json
{
	"environment": "pr-123",
	"pr_number": "123",
	"resolved_at": "2025-08-09 10:30:00 UTC",
	"strategies_attempted": ["backend_discovery"],
	"final_api_url": "https://api-pr123.example.com/api",
	"resolution_method": "direct_stack_discovery",
	"backend_stack": "MacroAiPr123Stack",
	"validation": {
		"performed": true,
		"status": "accessible",
		"response_time_ms": 234
	},
	"fallback_used": false,
	"success": true
}
```

### 3. Environment Injection Script

**Script**: `apps/client-ui/scripts/inject-preview-env.sh`

**Purpose**: Generates environment variables for frontend builds

#### Main Command

**Syntax**:

```bash
./inject-preview-env.sh [options]
```

**Options**:

- `--environment <env>` (required): Target environment
- `--pr-number <number>`: PR number for preview environments
- `--build-mode <mode>`: Build mode: `preview|staging|production`
- `--output-file <file>`: Output file path (default: `.env.preview`)
- `--api-url <url>`: Override API URL
- `--debug`: Enable debug output

**Environment Variables** (input):

- `ENVIRONMENT_NAME`: Target environment name
- `PR_NUMBER`: Pull request number
- `BUILD_MODE`: Build mode
- `VITE_API_KEY`: API authentication key
- `GITHUB_SHA`: Git commit hash
- `GITHUB_REF_NAME`: Git branch name

**Output File** (`.env.preview`):

```bash
# Generated environment variables for pr-123
# Generated on: 2025-08-09 10:30:00 UTC

VITE_API_URL=https://api-pr123.example.com/api
VITE_API_KEY=your-api-key
VITE_APP_ENV=pr-123
VITE_APP_NAME=Macro AI (Preview)
VITE_PREVIEW_MODE=true
VITE_PR_NUMBER=123
VITE_BUILD_TIMESTAMP=2025-08-09 10:30:00 UTC
VITE_BUILD_COMMIT=abc123def456
VITE_BUILD_BRANCH=feature/my-feature
VITE_BACKEND_STACK_NAME=MacroAiPr123Stack
VITE_API_RESOLUTION_METHOD=direct_stack_discovery
```

### 4. Amplify Configuration Generator

**Script**: `apps/client-ui/scripts/generate-amplify-config.sh`

**Purpose**: Generates environment-specific Amplify configurations

#### Main Command

**Syntax**:

```bash
./generate-amplify-config.sh [options]
```

**Options**:

- `--environment <env>`: Target environment: `preview|staging|production` (default: `preview`)
- `--pr-number <number>`: PR number for preview environments
- `--output-file <file>`: Output file name (default: `amplify.yml`)
- `--validate-only`: Only validate template, don't generate file
- `--list-templates`: List available templates
- `--debug`: Enable debug output

**Templates**:

- `amplify.base.yml`: Base template with common settings
- `amplify.preview.yml`: Preview environment template
- `amplify.staging.yml`: Staging environment template
- `amplify.production.yml`: Production environment template

### 5. Configuration Validator

**Script**: `apps/client-ui/scripts/validate-amplify-config.sh`

**Purpose**: Validates Amplify configuration files

#### Main Command

**Syntax**:

```bash
./validate-amplify-config.sh [options]
```

**Options**:

- `--config-file <file>`: Amplify configuration file to validate (default: `amplify.yml`)
- `--environment <env>`: Expected environment (`preview|staging|production`)
- `--strict`: Enable strict validation mode
- `--all-templates`: Validate all template files

**Validation Checks**:

- YAML syntax validation
- Required sections validation
- Frontend configuration validation
- Environment-specific settings validation
- Security headers validation
- Build commands validation

### 6. Integration Test Suite

**Script**: `apps/client-ui/scripts/test-backend-integration.sh`

**Purpose**: Tests the complete backend discovery and API resolution system

#### Main Command

**Syntax**:

```bash
./test-backend-integration.sh [options]
```

**Options**:

- `--test-suite <suite>`: Test suite: `all|discovery|resolution|integration` (default: `all`)
- `--environment <env>`: Test specific environment
- `--pr-number <number>`: Test specific PR number
- `--skip-aws-tests`: Skip tests requiring AWS credentials
- `--output-format <format>`: Output format: `text|json|junit` (default: `text`)
- `--save-results`: Save test results to file
- `--verbose`: Enable verbose output

## 🎬 GitHub Actions API

### 1. Backend Discovery Action

**Action**: `.github/actions/discover-backend/action.yml`

#### Inputs

| Input                   | Description                       | Required | Default     |
| ----------------------- | --------------------------------- | -------- | ----------- |
| `environment`           | Target environment name           | Yes      | -           |
| `pr-number`             | Pull request number               | No       | -           |
| `validate-connectivity` | Enable API endpoint validation    | No       | `false`     |
| `force-refresh`         | Force refresh of cached results   | No       | `false`     |
| `fallback-only`         | Skip discovery, use fallback only | No       | `false`     |
| `aws-region`            | AWS region for discovery          | No       | `us-east-1` |
| `timeout`               | Discovery timeout in seconds      | No       | `30`        |
| `debug`                 | Enable debug output               | No       | `false`     |

#### Outputs

| Output                | Description                       |
| --------------------- | --------------------------------- |
| `backend-found`       | Whether backend was discovered    |
| `api-endpoint`        | Resolved API endpoint URL         |
| `stack-name`          | CloudFormation stack name         |
| `resolution-method`   | Resolution method used            |
| `fallback-used`       | Whether fallback was used         |
| `connectivity-status` | API connectivity status           |
| `response-time`       | API response time in milliseconds |
| `discovery-result`    | Complete discovery result as JSON |

#### Usage Example

```yaml
- name: Discover backend environment
  id: discover
  uses: ./.github/actions/discover-backend
  with:
    environment: ${{ needs.validate-access.outputs.env-name }}
    pr-number: ${{ github.event.pull_request.number }}
    validate-connectivity: 'true'
    aws-region: ${{ env.AWS_REGION }}
    debug: 'false'
```

### 2. Frontend Environment Generation Action

**Action**: `.github/actions/generate-frontend-env/action.yml`

#### Inputs

| Input                    | Description                            | Required | Default        |
| ------------------------ | -------------------------------------- | -------- | -------------- |
| `environment`            | Target environment name                | Yes      | -              |
| `pr-number`              | Pull request number                    | No       | -              |
| `build-mode`             | Build mode                             | No       | `preview`      |
| `api-endpoint`           | API endpoint URL (overrides discovery) | No       | -              |
| `api-key`                | API authentication key                 | Yes      | -              |
| `backend-stack-name`     | Backend stack name                     | No       | -              |
| `resolution-method`      | Backend resolution method              | No       | -              |
| `output-file`            | Output file for environment variables  | No       | `.env.preview` |
| `include-build-metadata` | Include build metadata                 | No       | `true`         |
| `validate-variables`     | Validate generated variables           | No       | `true`         |
| `debug`                  | Enable debug output                    | No       | `false`        |

#### Outputs

| Output              | Description                        |
| ------------------- | ---------------------------------- |
| `env-file`          | Path to generated environment file |
| `api-url`           | Final API URL used                 |
| `variables-count`   | Number of variables generated      |
| `validation-result` | Validation result                  |

#### Usage Example

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
    include-build-metadata: 'true'
    validate-variables: 'true'
```

## 📊 Configuration API

### 1. Environment Mapping Configuration

**File**: `apps/client-ui/scripts/env-mapping.json`

#### Schema

```typescript
interface EnvironmentMapping {
	environments: {
		[key: string]: {
			pattern: string
			backend_stack_pattern: string
			fallback_api_url: string
			variables: Record<string, string>
		}
	}
	backend_resolution: {
		cache_ttl_seconds: number
		default_timeout_seconds: number
		max_retry_attempts: number
		strategies: Array<{
			name: string
			description: string
			priority: number
			enabled: boolean
			timeout_seconds?: number
			patterns?: string[]
			validate_connectivity?: boolean
		}>
		stack_output_keys: string[]
		health_check: {
			enabled: boolean
			endpoint_path: string
			timeout_seconds: number
			expected_status_codes: number[]
		}
	}
}
```

### 2. Amplify Configuration Templates

**Location**: `apps/client-ui/amplify-templates/`

#### Template Variables

Templates support environment variable substitution using `${VARIABLE_NAME:-default}` syntax:

| Variable                   | Description      | Example                             |
| -------------------------- | ---------------- | ----------------------------------- |
| `AMPLIFY_ENVIRONMENT_NAME` | Environment name | `pr-123`                            |
| `VITE_API_URL`             | API endpoint URL | `https://api-pr123.example.com/api` |
| `VITE_PR_NUMBER`           | PR number        | `123`                               |
| `VITE_BUILD_TIMESTAMP`     | Build timestamp  | `2025-08-09 10:30:00 UTC`           |
| `VITE_BUILD_COMMIT`        | Git commit hash  | `abc123def456`                      |
| `VITE_BUILD_BRANCH`        | Git branch name  | `feature/my-feature`                |

## 🔌 Integration Points

### 1. AWS Services Integration

**CloudFormation**:

- Stack discovery and status checking
- Output extraction for API endpoints
- Multi-region support

**Amplify**:

- App creation and management
- Deployment triggering
- Build configuration

**IAM**:

- Role-based access control
- OIDC integration for GitHub Actions
- Least privilege permissions

### 2. GitHub Integration

**Actions**:

- Workflow triggers and inputs
- Reusable action composition
- Output passing between jobs

**API**:

- PR comment updates
- Status check integration
- Workflow dispatch

### 3. External Service Integration

**Monitoring**:

- CloudWatch Logs integration
- Custom metrics and alarms
- Performance monitoring

**Notifications**:

- Slack webhook integration
- Email notifications
- Custom webhook support

## 📚 Error Codes and Responses

### Common Exit Codes

| Code | Description                |
| ---- | -------------------------- |
| `0`  | Success                    |
| `1`  | General error              |
| `2`  | Invalid arguments          |
| `3`  | AWS credentials error      |
| `4`  | Network/connectivity error |
| `5`  | Configuration error        |
| `6`  | Validation error           |

### Error Response Format

```json
{
	"success": false,
	"error": {
		"code": "BACKEND_DISCOVERY_FAILED",
		"message": "No backend stack found for environment pr-123",
		"details": {
			"environment": "pr-123",
			"patterns_tried": ["MacroAiPr123Stack", "MacroAiPreview123Stack"],
			"region": "us-east-1"
		},
		"timestamp": "2025-08-09T10:30:00Z"
	}
}
```

## 📖 Related Documentation

- [Getting Started Guide](./getting-started-preview-deployments.md)
- [User Manual](./preview-deployment-user-manual.md)
- [Configuration Reference](./preview-deployment-configuration.md)
- [Troubleshooting Guide](./troubleshooting-preview-deployments.md)
- [Best Practices](./preview-deployment-best-practices.md)
