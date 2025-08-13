# Parameter Store Service

This directory contains the Parameter Store integration service that provides secure configuration management for the Lambda
runtime environment.

## Overview

The Parameter Store service implements the `SecureHobbySecretsManager` pattern documented in the hobby deployment plan, providing:

- **5-minute TTL caching** for optimal Lambda performance
- **Automatic fallback** to environment variables
- **Parameter hierarchy support** (critical vs standard parameters)
- **Go-style error handling** consistent with the codebase
- **Comprehensive logging** for audit and debugging

## Core Components

### ParameterStoreService

The main service class that handles Parameter Store operations:

```typescript
import { parameterStoreService } from './services/parameter-store.service.ts'

// Get a single parameter
const [apiKey, error] =
	await parameterStoreService.getParameter('openai-api-key')
if (error) {
	// Handle error
	return
}
console.log('API Key:', apiKey)

// Get multiple parameters
const [params, error] = await parameterStoreService.getParameters([
	'openai-api-key',
	'neon-database-url',
])
```

### EnhancedConfigService

Integration layer that combines Parameter Store with environment variables:

```typescript
import { enhancedConfigService } from './services/enhanced-config.service.ts'

// Get configuration with automatic fallback
const [config, error] = await enhancedConfigService.getConfig(
	'OPENAI_API_KEY',
	{
		required: true,
	},
)

// In Lambda: tries Parameter Store first, falls back to environment
// In local dev: uses environment variables directly
```

## Parameter Hierarchy

The service supports two parameter tiers:

### Critical Parameters (Advanced Tier)

- `openai-api-key` → `/macro-ai/prod/critical/openai-api-key`
- `neon-database-url` → `/macro-ai/prod/critical/neon-database-url`
- `upstash-redis-url` → `/macro-ai/prod/critical/upstash-redis-url`

### Standard Parameters (Standard Tier)

- `cognito-user-pool-id` → `/macro-ai/prod/standard/cognito-user-pool-id`
- `cognito-user-pool-client-id` → `/macro-ai/prod/standard/cognito-user-pool-client-id`

## Lambda Integration

The service is integrated into the Lambda cold start process for optimal performance:

```typescript
// In application startup (e.g., index.ts)
import { enhancedConfigService } from './services/enhanced-config.service.ts'

// During application initialization
const [preloadResult, preloadError] =
	await enhancedConfigService.preloadParameters()
if (preloadError) {
	logger.warn('Parameter Store preload failed, continuing with fallbacks')
} else {
	logger.info('Parameters preloaded successfully')
}
```

## Caching Strategy

- **5-minute TTL** for all parameters
- **In-memory Map-based cache** for Lambda container reuse
- **Automatic expiration** with cache statistics
- **Manual cache clearing** for testing and debugging

```typescript
// Cache management
parameterStoreService.clearCache('openai-api-key') // Clear specific parameter
parameterStoreService.clearCache() // Clear all cache

// Cache statistics
const stats = parameterStoreService.getCacheStats()
console.log(`Active entries: ${stats.activeEntries}`)
console.log(`Expired entries: ${stats.expiredEntries}`)
```

## Error Handling

All methods return Go-style Result tuples:

```typescript
const [value, error] =
	await parameterStoreService.getParameter('openai-api-key')
if (error) {
	if (error instanceof NotFoundError) {
		// Parameter doesn't exist
	} else if (error instanceof InternalError) {
		// AWS service error or other issue
	}
	return
}
// Use value safely
```

## Testing

Comprehensive unit tests cover:

- Parameter retrieval (critical and standard)
- Caching behavior and TTL expiration
- Error scenarios (not found, access denied, etc.)
- Multiple parameter operations
- Cache management and statistics

```bash
# Run Parameter Store service tests
pnpm test src/services/__tests__/parameter-store.service.test.ts

# Run Enhanced Config service tests
pnpm test src/services/__tests__/enhanced-config.service.test.ts
```

## Environment Detection

The service automatically detects Lambda environment and adjusts behavior:

- **Lambda environment**: Uses Parameter Store with caching
- **Local development**: Falls back to environment variables
- **Testing**: Uses mocked services

## Security Considerations

- **Encryption in transit**: All Parameter Store calls use HTTPS
- **Encryption at rest**: SecureString parameters are automatically decrypted
- **Access control**: IAM roles control parameter access
- **Audit logging**: All parameter access is logged with context

## Performance Optimization

- **Cold start preloading**: Parameters loaded during Lambda initialization
- **Container reuse**: Cache persists across Lambda invocations
- **Batch operations**: Multiple parameters retrieved efficiently
- **TTL management**: Automatic cache expiration prevents stale data

## Configuration

The service can be configured with custom settings:

```typescript
const customService = new ParameterStoreService({
	region: 'eu-west-1',
	environment: 'staging',
	cacheEnabled: true,
	cacheTtlMs: 10 * 60 * 1000, // 10 minutes
})
```

## Monitoring

The service provides comprehensive logging and metrics:

- Parameter access events with timing
- Cache hit/miss ratios
- Error rates and types
- Performance metrics for monitoring

All logs include structured data for easy parsing and alerting in production environments.
