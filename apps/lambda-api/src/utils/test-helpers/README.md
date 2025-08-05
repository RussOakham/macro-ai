# Lambda API Test Helpers

This directory contains comprehensive reusable test utilities for the Lambda API, providing
type-safe mocking patterns for AWS services, middleware testing, observability tools, and error handling.

## Overview

The test helpers follow established patterns using `aws-sdk-client-mock` for better type safety and
more reliable AWS SDK mocking. The lambda-api primarily uses **AWS Systems Manager Parameter Store**
for configuration management, AWS X-Ray for tracing, and comprehensive middleware patterns with
observability integration.

## New Features ✨

### Middleware Test Helpers

- **Complete test suite factory** for middleware testing
- **Mock API Gateway events and Lambda contexts** with sensible defaults
- **Middleware chain testing utilities** for complex middleware compositions
- **Pre-defined test scenarios** for common middleware testing patterns

### Powertools Test Helpers

- **Comprehensive Powertools mocking** with proper TypeScript types
- **Observability configuration integration** with test-specific settings
- **Assertion helpers** for verifying Powertools interactions
- **Test scenarios** for different observability configurations

### Error Handling Test Helpers

- **Go-style error handling mocks** with Result pattern support
- **AppError factory** for creating consistent test errors
- **Result assertion helpers** for testing success/error outcomes
- **Error classification testing utilities**

## Quick Start

### Middleware Testing

```typescript
import {
	createMiddlewareTestSuite,
	setupPowertoolsMocks,
} from '../utils/test-helpers/index.js'

describe('My Middleware', () => {
	beforeEach(() => {
		setupPowertoolsMocks()
	})

	it('should handle requests correctly', async () => {
		const suite = createMiddlewareTestSuite()
		const middleware = myMiddleware()
		const wrappedHandler = middleware(suite.mockHandler)

		const result = await wrappedHandler(suite.mockEvent, suite.mockContext)

		expect(result.statusCode).toBe(200)
	})
})
```

### Parameter Store Testing

```typescript
import { mockParameterStoreService } from '../utils/test-helpers/parameter-store.mock.js'

// AWS SDK Client Mock (for service-level tests)
describe('ParameterStoreService', () => {
	const ssmMock = mockParameterStoreService.createAwsMock()

	it('should retrieve parameter', async () => {
		const mockResponse = mockParameterStoreService.createParameter({
			Parameter: { Name: 'test-param', Value: 'test-value' },
		})
		ssmMock.on(GetParameterCommand).resolves(mockResponse)

		const result = await service.getParameter('test-param')
		expect(result).toBe('test-value')
	})
})

// Service Method Mock (for controller tests)
vi.mock('../services/parameter-store.service.js', () =>
	mockParameterStoreService.createModule(),
)

describe('Lambda Config', () => {
	const mocks = mockParameterStoreService.setup()

	it('should initialize config', async () => {
		const params = mockParameterStoreService.createMacroAiParameters()
		mocks.initializeParameters.mockResolvedValue(params)
		// Test logic...
	})
})
```

### X-Ray Tracing Testing

```typescript
import { mockTracingUtils } from '../utils/test-helpers/tracing.mock.js'

vi.mock('../utils/powertools-tracer.js', () => mockTracingUtils.createModule())

describe('Service with Tracing', () => {
	const tracingMocks = mockTracingUtils.setup()

	it('should create subsegment', async () => {
		await powertoolsTracer.withSubsegment('test-op', async () => 'result')

		expect(tracingMocks.withSubsegment).toHaveBeenCalledWith(
			'test-op',
			expect.any(Function),
		)
	})
})
```

## Available Helpers

### Parameter Store Mock (`parameter-store.mock.ts`)

Provides comprehensive mocking utilities for AWS Systems Manager Parameter Store operations.

**Key Features:**

- Type-safe AWS SDK mocking using `aws-sdk-client-mock`
- Service method mocking for middleware/controller tests
- Realistic mock data generators for Parameter Store responses
- Macro AI specific parameter sets for consistent testing

**Mock Data Generators:**

```typescript
// Create single parameter
const param = mockParameterStoreService.createParameter({
	Parameter: { Name: 'my-param', Value: 'my-value', Type: 'SecureString' },
})

// Create multiple parameters
const params = mockParameterStoreService.createParameters({
	param1: 'value1',
	param2: 'value2',
})

// Create Macro AI parameter set
const macroAiParams = mockParameterStoreService.createMacroAiParameters()
// Returns: { 'macro-ai-openai-key': 'sk-test-...', 'macro-ai-database-url': '...', ... }
```

### X-Ray Tracing Mock (`tracing.mock.ts`)

Provides mocking utilities for AWS Lambda Powertools X-Ray tracing integration.

**Key Features:**

- Type-safe tracing mocks for Powertools Tracer utilities
- Subsegment verification helpers
- Error capture testing with contextual metadata
- Expectation helpers for cleaner test assertions

**Mock Utilities:**

```typescript
// Create complete mock module
vi.mock('../utils/powertools-tracer.js', () => mockTracingUtils.createModule())

// Setup tracer mocks
const tracingMocks = mockTracingUtils.setup()

// Expectation helpers
const expectation = mockTracingUtils.expectSubsegment('test-op', {
	key: 'value',
})
const errorExpectation = mockTracingUtils.expectErrorCapture(
	error,
	'DependencyError',
)
```

## Advanced Usage

### Error Testing

```typescript
// Test Parameter Store errors
ssmMock.on(GetParameterCommand).rejects(new Error('Parameter not found'))

// Test X-Ray error capture
powertoolsTracer.captureError(testError, 'DependencyError', {
	operation: 'test',
})
expect(tracingMocks.captureError).toHaveBeenCalledWith(
	testError,
	'DependencyError',
	expect.any(Object),
)
```

### Command Verification

```typescript
// Verify AWS SDK command calls
expect(ssmMock.commandCalls(GetParameterCommand)).toHaveLength(1)
expect(ssmMock.commandCalls(GetParameterCommand)[0].args[0].input).toEqual({
	Name: 'expected-parameter-name',
})
```

## Migration & Benefits

**Migration Status**: ✅ All lambda-api tests now use `aws-sdk-client-mock`

The lambda-api has been fully migrated from manual `vi.mock()` approaches to type-safe `aws-sdk-client-mock` patterns,
achieving consistency with express-api patterns.

**Key Benefits:**

- **Type Safety**: Compile-time validation of mock setups with IntelliSense support
- **Better Testing**: Command call verification and realistic response structures
- **Maintainability**: Consistent patterns and reusable mock helpers across the monorepo
- **Developer Experience**: Auto-completion for AWS SDK mocking and easier updates

**Migration Example:**

```typescript
// ❌ Old approach - manual mocking
vi.mock('@aws-sdk/client-ssm', () => ({
	SSMClient: vi.fn(() => ({ send: vi.fn() })),
	GetParameterCommand: vi.fn(),
}))

// ✅ New approach - type-safe mocking
const ssmMock = mockParameterStoreService.createAwsMock()
```

## Reference

### Testing Best Practices

1. Use realistic mock data matching production formats
2. Verify command calls to ensure correct AWS SDK usage
3. Test error scenarios with proper AWS SDK error types
4. Reset mocks between tests using `ssmMock.reset()`
5. Follow established patterns from express-api test helpers

### Example Test File

See `__tests__/parameter-store.mock.example.test.ts` for comprehensive examples of all mocking patterns and best practices.
