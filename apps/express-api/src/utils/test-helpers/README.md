# Test Helpers

This directory contains reusable test helpers and mocking utilities to reduce code duplication and improve test maintainability across the express-api project.

## Available Helpers

### Logger Mock (`logger.mock.ts`)

A comprehensive mock helper for the pino logger used throughout the application.

#### Basic Usage

```typescript
import { mockLogger } from '../utils/test-helpers/logger.mock.ts'

// Mock the logger module
vi.mock('../../utils/logger.ts', () => mockLogger.createModule())

describe('Your Test', () => {
	beforeEach(() => {
		// Clear all mocks before each test
		vi.clearAllMocks()
	})

	it('should log an error', async () => {
		// Arrange
		const { pino } = await import('../../utils/logger.ts')

		// Act
		pino.logger.error('Test error message')

		// Assert
		expect(pino.logger.error).toHaveBeenCalledWith('Test error message')
	})
})
```

#### Advanced Usage

```typescript
describe('Advanced Logger Usage', () => {
	let logger: ReturnType<typeof mockLogger.create>

	beforeEach(() => {
		// Setup fresh logger mock for each test
		logger = mockLogger.setup()
	})

	it('should create logger with custom behavior', () => {
		// Create logger with custom error behavior
		const customLogger = mockLogger.withBehavior({
			error: vi.fn(() => 'custom error response'),
			info: vi.fn(() => 'custom info response'),
		})

		const errorResult = customLogger.error('test')
		expect(errorResult).toBe('custom error response')
	})
})
```

#### Available Methods

- `mockLogger.create()` - Creates a basic logger mock
- `mockLogger.createModule()` - Creates complete module mock for vi.mock()
- `mockLogger.setup()` - Clears mocks and returns fresh logger
- `mockLogger.withBehavior(behavior)` - Creates logger with custom behavior

### Cognito Service Mock (`cognito-service.mock.ts`)

Comprehensive mock helper for AWS Cognito service operations.

#### Basic Usage

```typescript
import { mockCognitoService } from '../utils/test-helpers/cognito-service.mock.ts'

// Mock the Cognito service
vi.mock('../../features/auth/auth.services.ts', () =>
	mockCognitoService.createServiceMock(),
)

describe('Your Test', () => {
	let cognitoMocks: ReturnType<typeof mockCognitoService.setupServiceMock>

	beforeEach(() => {
		cognitoMocks = mockCognitoService.setupServiceMock()
	})

	it('should handle successful user authentication', async () => {
		// Arrange
		const mockUser = mockCognitoService.createUser({
			Username: 'test-user-123',
		})
		cognitoMocks.mockGetAuthUser.mockResolvedValue([mockUser, null])

		// Your test logic here...
	})
})
```

## Migration Guide

### Replacing Manual Logger Mocks

**Before:**

```typescript
vi.mock('../../utils/logger.ts', () => ({
	pino: {
		logger: {
			error: vi.fn(),
			info: vi.fn(),
			warn: vi.fn(),
			debug: vi.fn(),
		},
	},
	configureLogger: vi.fn(),
}))
```

**After:**

```typescript
import { mockLogger } from '../../utils/test-helpers/logger.mock.ts'

vi.mock('../../utils/logger.ts', () => mockLogger.createModule())
```

### Benefits

1. **Reduced Boilerplate**: ~70% reduction in mock setup code
2. **Consistency**: Standardized mocking patterns across all tests
3. **Type Safety**: Full TypeScript support with proper typing
4. **Maintainability**: Centralized mock logic, easier to update
5. **Reusability**: Same helpers can be used across multiple test files

## Best Practices

1. **Always use helpers**: Prefer test helpers over manual mocking
2. **Clear mocks**: Use `vi.clearAllMocks()` or helper setup functions in `beforeEach`
3. **Import helpers**: Import helpers at the top of test files for consistency
4. **Follow patterns**: Use the same patterns established by existing helpers

## Contributing

When adding new test helpers:

1. Follow the pattern established by `cognito-service.mock.ts`
2. Include comprehensive TypeScript types
3. Provide factory functions for flexibility
4. Add JSDoc comments for all exported functions
5. Create example test files demonstrating usage
6. Update this README with usage examples
