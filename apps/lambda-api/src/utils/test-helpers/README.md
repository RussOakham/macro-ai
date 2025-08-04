# Lambda API Test Helpers

This directory contains reusable test utilities for the Lambda API, providing type-safe mocking patterns for AWS
services and Lambda functionality.

## Overview

The test helpers follow the established patterns from the express-api, using `aws-sdk-client-mock` for better type
safety and more reliable AWS SDK mocking compared to manual `vi.mock()` approaches.

**Lambda API AWS Services**: The lambda-api currently uses only **AWS Systems Manager Parameter Store** for
configuration management. All AWS SDK mocking in lambda-api is focused on SSM Parameter Store operations.

## Available Helpers

### Parameter Store Mock (`parameter-store.mock.ts`)

Provides comprehensive mocking utilities for AWS Systems Manager Parameter Store operations - the only AWS service
used by lambda-api.

#### Features

- **Type-safe AWS SDK mocking** using `aws-sdk-client-mock`
- **Service method mocking** for middleware/controller tests
- **Realistic mock data generators** for Parameter Store responses
- **Macro AI specific parameter sets** for consistent testing

#### Usage Examples

##### AWS SDK Client Mock (for service-level tests)

```typescript
import { GetParameterCommand, SSMClient } from '@aws-sdk/client-ssm'
import { AwsClientStub } from 'aws-sdk-client-mock'
import { mockParameterStoreService } from '../utils/test-helpers/parameter-store.mock.js'

describe('ParameterStoreService', () => {
	let ssmMock: AwsClientStub<SSMClient>

	beforeEach(() => {
		ssmMock = mockParameterStoreService.createAwsMock()
	})

	it('should retrieve parameter successfully', async () => {
		// Arrange
		const mockResponse = mockParameterStoreService.createParameter({
			Parameter: {
				Name: 'test-param',
				Value: 'test-value',
			},
		})
		ssmMock.on(GetParameterCommand).resolves(mockResponse)

		// Act
		const result = await service.getParameter('test-param')

		// Assert
		expect(result).toBe('test-value')
		expect(ssmMock.commandCalls(GetParameterCommand)).toHaveLength(1)
	})
})
```

##### Service Method Mock (for middleware/controller tests)

```typescript
import { mockParameterStoreService } from '../utils/test-helpers/parameter-store.mock.js'

// Mock the service module
vi.mock('../services/parameter-store.service.js', () =>
	mockParameterStoreService.createModule(),
)

describe('Lambda Config Service', () => {
	let parameterStoreMocks: ReturnType<typeof mockParameterStoreService.setup>

	beforeEach(() => {
		parameterStoreMocks = mockParameterStoreService.setup()
	})

	it('should initialize configuration', async () => {
		// Arrange
		const mockParameters = mockParameterStoreService.createMacroAiParameters()
		parameterStoreMocks.initializeParameters.mockResolvedValue(mockParameters)

		// Act & Assert
		// Your test logic here...
	})
})
```

#### Mock Data Generators

##### `createParameter(overrides?)`

Creates a mock `GetParameterCommandOutput` with realistic defaults:

```typescript
const mockParameter = mockParameterStoreService.createParameter({
	Parameter: {
		Name: 'my-param',
		Value: 'my-value',
		Type: 'SecureString',
	},
})
```

##### `createParameters(parameters, overrides?)`

Creates a mock `GetParametersCommandOutput` from a key-value object:

```typescript
const mockParameters = mockParameterStoreService.createParameters({
	param1: 'value1',
	param2: 'value2',
})
```

##### `createMacroAiParameters()`

Creates the standard set of Macro AI configuration parameters:

```typescript
const macroAiParams = mockParameterStoreService.createMacroAiParameters()
// Returns:
// {
//   'macro-ai-openai-key': 'sk-test-openai-key-1234567890',
//   'macro-ai-database-url': 'postgresql://user:pass@localhost:5432/testdb',
//   'macro-ai-redis-url': 'redis://localhost:6379',
//   'macro-ai-cognito-user-pool-id': 'us-east-1_ABC123DEF',
//   'macro-ai-cognito-user-pool-client-id': 'abcdefghijklmnopqrstuvwxyz',
// }
```

## Benefits of aws-sdk-client-mock

### Type Safety

- **Compile-time validation** of mock setups
- **IntelliSense support** for AWS SDK commands and responses
- **Automatic type inference** from real AWS SDK types

### Better Testing Experience

- **Command call verification** with `ssmMock.commandCalls(Command)`
- **Input parameter validation** through `args[0].input`
- **Realistic response structures** that match AWS SDK exactly

### Maintainability

- **Consistent patterns** across all AWS service mocking
- **Reusable mock helpers** reduce test boilerplate
- **Easy to update** when AWS SDK types change

## Migration from Manual Mocking

The old manual `vi.mock()` approach:

```typescript
// ❌ Old approach - manual mocking
vi.mock('@aws-sdk/client-ssm', () => ({
	SSMClient: vi.fn(() => ({
		send: vi.fn(),
	})),
	GetParameterCommand: vi.fn(),
}))
```

The new `aws-sdk-client-mock` approach:

```typescript
// ✅ New approach - type-safe mocking
import { mockClient } from 'aws-sdk-client-mock'
import { SSMClient } from '@aws-sdk/client-ssm'

const ssmMock = mockClient(SSMClient)
```

## Testing Best Practices

1. **Use realistic mock data** that matches production parameter formats
2. **Verify command calls** to ensure correct AWS SDK usage
3. **Test error scenarios** with proper AWS SDK error types
4. **Reset mocks** between tests using `ssmMock.reset()`
5. **Follow established patterns** from express-api test helpers

## Example Test File

See `__tests__/parameter-store.mock.example.test.ts` for comprehensive examples of all mocking patterns and best practices.

## Complete Migration Status

✅ **All lambda-api tests now use aws-sdk-client-mock**

The lambda-api has been fully migrated to use type-safe `aws-sdk-client-mock` patterns:

- **Parameter Store Service Tests**: `parameter-store.service.test.ts` - Uses AWS SDK client mocking
- **Lambda Config Service Tests**: `lambda-config.service.test.ts` - Uses service method mocking
- **Test Setup**: `test/setup.ts` - Uses aws-sdk-client-mock instead of manual vi.mock()

### AWS Services Coverage

| Service             | Status      | Mock Helper               | Usage                    |
| ------------------- | ----------- | ------------------------- | ------------------------ |
| SSM Parameter Store | ✅ Complete | `parameter-store.mock.ts` | Configuration management |

### Test Files Updated

| Test File                         | Previous Approach  | New Approach                               | Status      |
| --------------------------------- | ------------------ | ------------------------------------------ | ----------- |
| `parameter-store.service.test.ts` | Manual `vi.mock()` | `aws-sdk-client-mock`                      | ✅ Complete |
| `lambda-config.service.test.ts`   | Manual `vi.mock()` | `mockParameterStoreService.createModule()` | ✅ Complete |
| `test/setup.ts`                   | Manual `vi.mock()` | `mockClient(SSMClient)`                    | ✅ Complete |

### Benefits Achieved

- **Type Safety**: All AWS SDK mocking is now type-safe with compile-time validation
- **Consistency**: Same patterns as express-api for easier maintenance across the monorepo
- **Reliability**: More robust tests that catch real AWS SDK usage issues
- **Developer Experience**: IntelliSense and auto-completion for AWS SDK mocking
- **Maintainability**: Easier to update when AWS SDK types change

The lambda-api now has complete consistency in AWS SDK mocking patterns with the express-api.
