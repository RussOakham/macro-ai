# Parameter Store Migration Guide

## Overview

This document describes the migration from the `PARAMETER_STORE_PREFIX` environment variable to a new 
programmatic approach that automatically determines the parameter store prefix based on the deployment 
environment.

## What Changed

### Before (Deprecated)

- Applications required the `PARAMETER_STORE_PREFIX` environment variable to be set
- Manual configuration was needed for each environment
- Risk of misconfiguration leading to permission errors

### After (New Approach)

- Parameter store prefix is automatically determined from the `APP_ENV` environment variable
- No manual configuration required
- Consistent behavior across all environments

## Environment Mapping

The new system automatically maps environments to parameter store prefixes:

| Environment   | Branch Pattern | Parameter Store Prefix   | Description                                       |
| ------------- | -------------- | ------------------------ | ------------------------------------------------- |
| `development` | `develop`      | `/macro-ai/development/` | Development environment                           |
| `staging`     | `develop`      | `/macro-ai/staging/`     | Staging environment                               |
| `production`  | `main`         | `/macro-ai/production/`  | Production environment                            |
| `pr-*`        | `pr/*`         | `/macro-ai/development/` | Preview environments (use development parameters) |

## Migration Steps

### 1. Remove PARAMETER_STORE_PREFIX Environment Variable

**From your deployment scripts and environment files, remove:**

```bash
# OLD - Remove this
PARAMETER_STORE_PREFIX=/macro-ai/development/

# NEW - This is now automatic
# No environment variable needed
```

**From your Docker Compose files, remove:**

```yaml
# OLD - Remove this
environment:
  - PARAMETER_STORE_PREFIX=/macro-ai/development/
# NEW - This is now automatic
# No environment variable needed
```

**From your Kubernetes manifests, remove:**

```yaml
# OLD - Remove this
env:
  - name: PARAMETER_STORE_PREFIX
    value: '/macro-ai/development/'
# NEW - This is now automatic
# No environment variable needed
```

### 2. Ensure APP_ENV is Set

The new system requires the `APP_ENV` environment variable to be set:

```bash
# For development
APP_ENV=development

# For staging
APP_ENV=staging

# For production
APP_ENV=production

# For preview environments (PRs)
APP_ENV=pr-123
```

### 3. Update Infrastructure (if applicable)

If you're using the CDK infrastructure, the ECS task roles have been updated to automatically grant 
the correct permissions for preview environments.

## Code Changes

### Parameter Store Service

The `createParameterStoreService()` function now automatically determines the prefix:

```typescript
// OLD - Required manual configuration
export const createParameterStoreService = (): ParameterStoreService => {
	const parameterStorePrefix = process.env.PARAMETER_STORE_PREFIX

	if (!parameterStorePrefix) {
		throw new Error('PARAMETER_STORE_PREFIX environment variable is required')
	}

	return new ParameterStoreService({
		parameterStorePrefix,
		region: process.env.AWS_REGION,
	})
}

// NEW - Automatic prefix resolution
export const createParameterStoreService = (): ParameterStoreService => {
	const parameterStorePrefix = getCurrentParameterStorePrefix()

	return new ParameterStoreService({
		parameterStorePrefix,
		region: process.env.AWS_REGION,
	})
}
```

### Environment Utilities

New utility functions are available for environment detection:

```typescript
import {
	getCurrentEnvironment,
	getCurrentParameterStorePrefix,
	isPreviewEnvironment,
	getEnvironmentDisplayName,
} from '../utils/environment-utils.ts'

// Get current environment
const env = getCurrentEnvironment() // 'development', 'staging', 'production', or 'pr-123'

// Get parameter store prefix automatically
const prefix = getCurrentParameterStorePrefix() // '/macro-ai/development/', etc.

// Check if it's a preview environment
if (isPreviewEnvironment(env)) {
	console.log('This is a preview environment')
}

// Get human-readable environment name
const displayName = getEnvironmentDisplayName(env) // 'Development', 'Preview (pr-123)', etc.
```

## Benefits

1. **Eliminates Configuration Errors**: No more manual prefix configuration
2. **Consistent Behavior**: All preview environments automatically use development parameters
3. **Easier Deployment**: One less environment variable to manage
4. **Better Debugging**: Clear logging shows which prefix is being used
5. **Type Safety**: TypeScript support for environment detection

## Testing

The new system includes comprehensive tests:

```bash
# Run the new environment utilities tests
npm test -- environment-utils.test.ts

# Run all tests to ensure nothing is broken
npm test
```

## Troubleshooting

### Common Issues

1. **"APP_ENV environment variable is required"**
   - Ensure `APP_ENV` is set in your environment
   - Check your deployment scripts and configuration

2. **"Unknown environment, falling back to development parameters"**
   - This is a warning, not an error
   - The system will use development parameters as a fallback
   - Check that `APP_ENV` has a valid value

3. **Permission errors still occurring**
   - Ensure your infrastructure has been redeployed with the updated IAM policies
   - Check that the ECS task role has access to the correct parameter store prefixes

### Debugging

The new system provides detailed logging:

```bash
🔧 Parameter Store Service initialized for Preview (pr-123)
📋 Using parameter store prefix: /macro-ai/development/
```

### Fallback Behavior

- **Unknown environments**: Automatically fall back to development parameters
- **Missing APP_ENV**: Application will fail to start (fail-fast approach)
- **Invalid APP_ENV**: Warning logged, development parameters used

## Rollback Plan

If you need to rollback to the old system:

1. Restore the `PARAMETER_STORE_PREFIX` environment variable
2. Revert the parameter store service changes
3. Remove the new environment utilities

However, this is not recommended as the new system is more robust and maintainable.

## Support

For questions or issues with the migration:

1. Check this documentation
2. Review the test files for examples
3. Check the console logs for debugging information
4. Ensure `APP_ENV` is correctly set in your environment
