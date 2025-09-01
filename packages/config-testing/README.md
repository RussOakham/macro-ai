# @repo/config-testing

Shared testing configuration for the Macro AI monorepo.

## Purpose

This package provides standardized Vitest configuration objects that can be shared across all packages in the monorepo.
It eliminates duplication and ensures consistent testing behavior without the complexity of Vitest-dependent utilities.

## Features

### Configuration Objects

- `commonTestConfig` - Base test configuration with common settings
- `integrationTestTimeouts` - Timeout settings for integration tests
- `unitTestTimeouts` - Timeout settings for unit tests

## Usage

### Basic Import

```typescript
import { commonTestConfig, unitTestTimeouts } from '@repo/config-testing'
```

### Vitest Configuration

```typescript
import { defineConfig } from 'vitest/config'
import { commonTestConfig, unitTestTimeouts } from '@repo/config-testing'

export default defineConfig({
	test: {
		...commonTestConfig,
		...unitTestTimeouts,
		name: 'my-package',
		// Additional test-specific configuration
		coverage: {
			...commonTestConfig.coverage,
			include: ['src/**/*.ts'],
			exclude: ['src/**/*.test.ts', 'src/**/*.spec.ts'],
		},
	},
})
```

### Available Configuration

#### `commonTestConfig`

Provides standard test settings:

- `globals: true` - Enable global test functions
- `environment: 'node'` - Node.js test environment
- `include` patterns for test files
- `exclude` patterns for non-test files
- Coverage configuration with V8 provider
- Silent mode for passed tests only

#### `unitTestTimeouts`

Standard timeout settings for unit tests:

- `testTimeout: 30000` - 30 seconds for individual tests
- `hookTimeout: 30000` - 30 seconds for setup/teardown hooks
- `teardownTimeout: 30000` - 30 seconds for cleanup

#### `integrationTestTimeouts`

Extended timeout settings for integration tests:

- `testTimeout: 60000` - 60 seconds for integration tests
- `hookTimeout: 30000` - 30 seconds for setup/teardown
- `teardownTimeout: 30000` - 30 seconds for cleanup

## Installation

This package is automatically available to all packages in the monorepo. Add it to your `devDependencies`:

```json
{
	"devDependencies": {
		"@repo/config-testing": "workspace:*"
	}
}
```

## Dependencies

- `vitest` - For testing configuration types
- `typescript` - For type definitions (dev dependency)

## Design Philosophy

This package intentionally provides **configuration objects only**, not utility functions. This approach:

- Avoids Vitest import issues during module loading
- Provides clean, composable configuration
- Maintains separation of concerns
- Ensures reliable package consumption

## Contributing

When adding new configuration options:

1. Follow the existing patterns for consistency
2. Add proper TypeScript types
3. Include JSDoc comments explaining usage
4. Update this README with examples
5. Ensure the configuration is exported from `src/index.ts`
