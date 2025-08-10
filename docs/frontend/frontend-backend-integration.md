# Frontend-Backend Integration System

This guide covers the comprehensive frontend-backend integration system that dynamically connects frontend
preview deployments to their corresponding backend API endpoints.

## 📋 Overview

The frontend-backend integration system provides automatic discovery and connection between frontend preview
environments and their corresponding backend services. It implements multiple resolution strategies with
intelligent fallback mechanisms to ensure frontend deployments always have a valid API endpoint.

## 🏗️ Architecture

### System Components

```text
┌─────────────────────────────────────────────────────────────┐
│                Frontend-Backend Integration                 │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────┐    ┌─────────────────┐                │
│  │ GitHub Actions  │    │ Frontend Build  │                │
│  │ Workflow        │───▶│ Environment     │                │
│  └─────────────────┘    └─────────────────┘                │
│           │                       │                        │
│           ▼                       ▼                        │
│  ┌─────────────────┐    ┌─────────────────┐                │
│  │ Backend         │    │ API Resolution  │                │
│  │ Discovery       │───▶│ Service         │                │
│  │ Service         │    └─────────────────┘                │
│  └─────────────────┘             │                        │
│           │                       ▼                        │
│           ▼                ┌─────────────────┐             │
│  ┌─────────────────┐       │ Environment     │             │
│  │ CloudFormation  │       │ Variable        │             │
│  │ Stack Discovery │       │ Injection       │             │
│  └─────────────────┘       └─────────────────┘             │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Resolution Strategies

The system implements a multi-tier resolution strategy:

1. **Direct Stack Discovery**: CloudFormation stack lookup using standard naming
2. **Alternative Patterns**: Try multiple stack naming patterns
3. **Environment Fallback**: Use environment-specific fallback URLs
4. **Generic Fallback**: Use default fallback URL

## 🔧 Core Services

### 1. Backend Discovery Service

**File**: `apps/client-ui/scripts/backend-discovery-service.sh`

**Purpose**: Discovers backend CloudFormation stacks and extracts API endpoints

**Key Features**:

- ✅ **Multi-pattern Stack Discovery**: Supports multiple naming conventions
- ✅ **Caching System**: 5-minute TTL cache for performance
- ✅ **Connectivity Validation**: Optional API endpoint health checks
- ✅ **JSON/Environment Output**: Flexible output formats
- ✅ **Debug Mode**: Comprehensive debugging capabilities

**Usage Examples**:

```bash
# Discover backend for PR environment
./scripts/backend-discovery-service.sh discover pr-123 --pr-number 123

# List available backend stacks
./scripts/backend-discovery-service.sh list-stacks

# Validate API endpoint
./scripts/backend-discovery-service.sh validate https://api.example.com/api

# Clear discovery cache
./scripts/backend-discovery-service.sh cache-clear
```

### 2. API Resolution Service

**File**: `apps/client-ui/scripts/api-resolution-service.sh`

**Purpose**: High-level orchestration of backend discovery and API resolution

**Key Features**:

- ✅ **Strategy Orchestration**: Manages multiple resolution strategies
- ✅ **Fallback Management**: Intelligent fallback with validation
- ✅ **Output Formatting**: JSON, environment variables, or URL-only output
- ✅ **Force Refresh**: Bypass cache when needed
- ✅ **Connectivity Testing**: Optional API endpoint validation

**Usage Examples**:

```bash
# Resolve API for preview environment
./scripts/api-resolution-service.sh --environment pr-123 --pr-number 123

# Use fallback only (skip discovery)
./scripts/api-resolution-service.sh --environment staging --fallback-only

# Get JSON output with validation
./scripts/api-resolution-service.sh --environment production --output-format json --validate-connectivity
```

### 3. Enhanced Environment Injection

**File**: `apps/client-ui/scripts/inject-preview-env.sh`

**Purpose**: Integrates API resolution into environment variable generation

**Key Features**:

- ✅ **Automatic API Resolution**: Uses API resolution service
- ✅ **Legacy Fallback**: Falls back to legacy resolver if needed
- ✅ **Environment Configuration**: Loads from env-mapping.json
- ✅ **Build Metadata**: Includes git and build information

## 📊 Configuration System

### Environment Mapping Configuration

**File**: `apps/client-ui/scripts/env-mapping.json`

The configuration defines environment-specific settings and backend resolution strategies:

```json
{
	"environments": {
		"preview": {
			"pattern": "pr-*",
			"backend_stack_pattern": "MacroAiPr{number}Stack",
			"fallback_api_url": "https://api-development.macro-ai.com/api",
			"variables": {
				"VITE_PREVIEW_MODE": "true",
				"VITE_ENABLE_DEBUG_LOGGING": "true"
			}
		}
	},
	"backend_resolution": {
		"cache_ttl_seconds": 300,
		"strategies": [
			{
				"name": "direct_stack",
				"priority": 1,
				"enabled": true
			}
		]
	}
}
```

### Stack Naming Patterns

The system supports multiple CloudFormation stack naming patterns:

| Environment          | Primary Pattern           | Alternative Patterns                           |
| -------------------- | ------------------------- | ---------------------------------------------- |
| **Preview (PR-123)** | `MacroAiPr123Stack`       | `MacroAiPreview123Stack`, `MacroAiDev123Stack` |
| **Development**      | `MacroAiDevelopmentStack` | `MacroAiDevStack`                              |
| **Staging**          | `MacroAiStagingStack`     | `MacroAiStageStack`                            |
| **Production**       | `MacroAiProductionStack`  | `MacroAiProdStack`                             |

## 🔄 Integration Workflow

### GitHub Actions Integration

The system integrates seamlessly with GitHub Actions workflows:

```yaml
- name: Discover backend environment
  id: check-backend
  run: |
    cd apps/client-ui

    ENV_NAME="${{ needs.validate-access.outputs.env-name }}"
    PR_NUMBER="${{ github.event.pull_request.number }}"

    # Use enhanced backend discovery service
    DISCOVERY_RESULT=$(./scripts/backend-discovery-service.sh \
      discover "$ENV_NAME" \
      --pr-number "$PR_NUMBER" \
      --output-format json \
      --validate-connectivity)

    # Parse and set outputs
    BACKEND_FOUND=$(echo "$DISCOVERY_RESULT" | jq -r '.backend_found')
    API_ENDPOINT=$(echo "$DISCOVERY_RESULT" | jq -r '.api_endpoint')

    echo "backend-exists=$BACKEND_FOUND" >> $GITHUB_OUTPUT
    echo "api-endpoint=$API_ENDPOINT" >> $GITHUB_OUTPUT
```

### Environment Variable Generation

The system generates comprehensive environment variables:

```bash
# API Resolution Results
VITE_API_URL=https://api-pr123.example.com/api
VITE_API_RESOLUTION_METHOD=direct_stack_discovery
VITE_BACKEND_STACK_NAME=MacroAiPr123Stack
VITE_API_FALLBACK_USED=false
VITE_API_RESOLVED_AT=2025-08-09 10:30:00 UTC
```

## 🧪 Testing and Validation

### Integration Test Suite

**File**: `apps/client-ui/scripts/test-backend-integration.sh`

Comprehensive test suite covering all integration components:

```bash
# Run all integration tests
./scripts/test-backend-integration.sh

# Test specific components
./scripts/test-backend-integration.sh --test-suite discovery
./scripts/test-backend-integration.sh --test-suite resolution
./scripts/test-backend-integration.sh --test-suite integration

# Skip AWS-dependent tests
./scripts/test-backend-integration.sh --skip-aws-tests
```

### Test Coverage

The test suite validates:

- ✅ **Backend Discovery Service**: All commands and output formats
- ✅ **API Resolution Service**: Multiple strategies and fallback mechanisms
- ✅ **Environment Integration**: End-to-end environment variable generation
- ✅ **Configuration Validation**: JSON configuration file validation
- ✅ **Multiple Environments**: Testing across all environment types

## 🔒 Security and Performance

### Security Features

- **Restricted Stack Access**: Only discovers stacks with specific naming patterns
- **URL Validation**: Validates API URLs before use
- **Credential Isolation**: Uses AWS IAM roles with least privilege
- **Input Sanitization**: Validates all input parameters

### Performance Optimizations

- **Caching System**: 5-minute TTL cache for discovery results
- **Parallel Discovery**: Concurrent stack pattern checking
- **Timeout Management**: Configurable timeouts for all operations
- **Efficient Queries**: Optimized CloudFormation API calls

## 🚨 Troubleshooting

### Common Issues

#### 1. Backend Discovery Fails

**Symptoms**: No backend found, fallback URL used

**Debugging**:

```bash
# Enable debug mode
DEBUG=true ./scripts/backend-discovery-service.sh discover pr-123 --pr-number 123

# List available stacks
./scripts/backend-discovery-service.sh list-stacks

# Check specific stack
aws cloudformation describe-stacks --stack-name MacroAiPr123Stack
```

**Solutions**:

- Verify backend stack exists and is in `CREATE_COMPLETE` or `UPDATE_COMPLETE` state
- Check stack naming follows expected patterns
- Ensure AWS credentials have CloudFormation read permissions

#### 2. API Endpoint Not Found

**Symptoms**: Backend stack found but no API endpoint

**Debugging**:

```bash
# Check stack outputs
aws cloudformation describe-stacks \
  --stack-name MacroAiPr123Stack \
  --query 'Stacks[0].Outputs'
```

**Solutions**:

- Verify backend stack exports API endpoint in outputs
- Check output key matches expected names: `ApiEndpoint`, `ApiGatewayUrl`, etc.
- Ensure backend deployment completed successfully

#### 3. Connectivity Validation Fails

**Symptoms**: API endpoint found but connectivity test fails

**Debugging**:

```bash
# Test connectivity manually
curl -v https://api-pr123.example.com/api/health

# Check with validation
./scripts/backend-discovery-service.sh validate https://api-pr123.example.com/api
```

**Solutions**:

- Verify API is deployed and accessible
- Check security groups and network ACLs
- Ensure health endpoint exists and responds correctly

### Debug Commands

```bash
# Enable debug mode for all services
export DEBUG=true

# Clear all caches
./scripts/backend-discovery-service.sh cache-clear

# Test specific environment
./scripts/api-resolution-service.sh \
  --environment pr-123 \
  --pr-number 123 \
  --debug \
  --validate-connectivity

# Run integration tests with verbose output
./scripts/test-backend-integration.sh --verbose
```

## 📈 Monitoring and Metrics

### Resolution Metrics

The system tracks:

- **Resolution Success Rate**: Percentage of successful backend discoveries
- **Resolution Method Distribution**: Usage of different resolution strategies
- **Cache Hit Rate**: Effectiveness of caching system
- **API Response Times**: Performance of discovered endpoints

### Logging

Comprehensive logging includes:

- **Discovery Attempts**: All stack patterns tried
- **Resolution Results**: Final API URLs and methods used
- **Validation Results**: Connectivity test outcomes
- **Performance Metrics**: Response times and cache statistics

## 📚 Related Documentation

- [Frontend Preview Deployment Guide](./amplify-preview-deployment.md)
- [Amplify Configuration Templates](./amplify-configuration-templates.md)
- [Environment Variable Integration](./environment-variable-integration.md)
- [AWS IAM Permissions for Amplify](../deployment/aws-iam-amplify-permissions.md)
- [CI/CD Setup Guide](../deployment/ci-cd-setup-guide.md)
