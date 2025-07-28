# Error Handling Implementation

## Current Implementation Status ✅ PRODUCTION-READY

This document provides comprehensive guidelines for error handling in the Macro AI application. The error handling
system is **fully implemented and production-ready** with Go-style error patterns, comprehensive type safety,
automatic error standardization, and consistent logging.

## Error Handling Architecture Overview

### Core Features ✅ COMPLETE

- **Go-Style Error Handling** - `[data, error]` tuple patterns with `tryCatch` and `tryCatchSync`
- **Automatic Error Standardization** - All errors converted to `AppError` instances
- **Built-in Logging** - Context-aware error logging with structured JSON format
- **Type Safety** - Full TypeScript integration with `Result<T>` types
- **Comprehensive Validation** - Zod integration for all inputs and outputs
- **Global Error Middleware** - Centralized error handling with environment-specific responses

## Core Utilities ✅ COMPLETE

### tryCatch and tryCatchSync Implementation

**Location**: `apps/express-api/src/utils/error-handling/try-catch.ts`

#### tryCatch for Async Operations

```typescript
import { tryCatch } from '../utils/error-handling/try-catch.ts'

// AWS Cognito operations
const [user, error] = await tryCatch(
	cognito.signUpUser({ email, password }),
	'authService - signUpUser',
)

if (error) {
	return [null, error]
}

// Database operations
const [users, dbError] = await tryCatch(
	db.select().from(usersTable).where(eq(usersTable.email, email)),
	'userRepository - findUserByEmail',
)
```

#### tryCatchSync for Synchronous Operations

```typescript
import { tryCatchSync } from '../utils/error-handling/try-catch.ts'

// Cryptographic operations
const [hash, hashError] = tryCatchSync(() => {
	const hmac = createHmac('sha256', clientSecret)
	hmac.update(username + clientId)
	return hmac.digest('base64')
}, 'authService - generateHash')

// Validation operations
const [validData, validationError] = tryCatchSync(
	() => schema.parse(inputData),
	'serviceName - validation',
)
```

### Error Types and Standardization

#### AppError Class

```typescript
import { AppError } from '../utils/errors.ts'

// Create specific error types
const validationError = AppError.validation(
	'Invalid input data',
	{ field: 'email', value: 'invalid-email' },
	'authService - signUpUser',
)

const notFoundError = AppError.notFound(
	'User not found',
	{ userId: '123' },
	'userService - getUserById',
)

const unauthorizedError = AppError.unauthorized(
	'Invalid credentials',
	undefined,
	'authService - signInUser',
)
```

#### Result Type Pattern

```typescript
type Result<T, E = AppError> = [T, null] | [null, E]

// Service method signature
public async getUserById(id: string): Promise<Result<TUser>> {
  // Implementation returns [user, null] or [null, error]
}

// Usage pattern
const [user, error] = await userService.getUserById('123')
if (error) {
  // Handle error
  return [null, error]
}
// Use user safely
```

## Implementation Patterns

### Service Layer Pattern ✅ COMPLETE

```typescript
// Service method with comprehensive error handling
public async signUpUser({
  email,
  password,
  confirmPassword,
}: TRegisterUserRequest): Promise<Result<SignUpCommandOutput>> {
  // 1. Input validation
  if (password !== confirmPassword) {
    return [
      null,
      AppError.validation(
        'Passwords do not match',
        undefined,
        'authService - signUpUser'
      ),
    ]
  }

  // 2. Generate required data with tryCatchSync
  const [secretHash, hashError] = this.generateHash(userId)
  if (hashError) {
    return [null, hashError]
  }

  // 3. External service call with tryCatch
  const command = new SignUpCommand({
    ClientId: this.clientId,
    Username: userId,
    Password: password,
    UserAttributes: [{ Name: 'email', Value: email }],
    SecretHash: secretHash,
  })

  return tryCatch(
    this.client.send(command),
    'authService - signUpUser'
  )
}
```

### Repository Pattern ✅ COMPLETE

```typescript
// Data access layer with comprehensive error handling
class UserRepository implements IUserRepository {
	public async findUserByEmail({
		email,
	}: {
		email: string
	}): Promise<Result<TUser | undefined>> {
		// 1. Database query with tryCatch
		const [users, error] = await tryCatch(
			this.db
				.select()
				.from(usersTable)
				.where(eq(usersTable.email, email))
				.limit(1),
			'userRepository - findUserByEmail',
		)

		if (error) {
			return [null, error]
		}

		// 2. Handle empty results
		if (!users.length) return [undefined, null]

		// 3. Validate returned data with Zod
		const [validationResult, validationError] = safeValidateSchema(
			users[0],
			selectUserSchema,
			'userRepository - findUserByEmail',
		)

		if (validationError) {
			return [null, validationError]
		}

		return [validationResult, null]
	}
}
```

### Controller Pattern ✅ COMPLETE

```typescript
// Controller with Go-style error handling
register: async (req: Request, res: Response) => {
	const { email, password, confirmPassword } = req.body as TRegisterUserRequest

	// 1. Service call with tryCatch
	const [response, error] = await tryCatch(
		cognito.signUpUser({ email, password, confirmPassword }),
		'authController - register',
	)

	if (error) {
		// Error is already logged and standardized by tryCatch
		handleError(res, error, 'authController')
		return
	}

	// 2. Validate service response
	if (!response.UserSub) {
		const validationError = AppError.validation(
			'User not created - no user ID returned',
		)
		handleError(res, validationError, 'authController')
		return
	}

	// 3. Additional operations with error handling
	const [user, userError] = await tryCatch(
		userService.registerOrLoginUserById({
			id: response.UserSub,
			email,
		}),
		'authController - createUser',
	)

	if (userError) {
		handleError(res, userError, 'authController')
		return
	}

	// 4. Success response
	const authResponse: TRegisterUserResponse = {
		message:
			'Registration successful. Please check your email for verification code.',
		user: {
			id: response.UserSub,
			email,
		},
	}

	sendSuccess(res, authResponse, StatusCodes.CREATED)
}
```

## Usage Guidelines

### When to Use tryCatch vs tryCatchSync

#### Use tryCatch for Async Operations

- **AWS Cognito operations** - Authentication, user management
- **Database operations** - All Drizzle ORM queries and mutations
- **API calls** - External service calls and HTTP requests
- **File system operations** - Reading/writing files
- **Any Promise-based operation** - Operations that return promises

#### Use tryCatchSync for Synchronous Operations

- **Cryptographic operations** - Encryption, decryption, hashing
- **Data validation** - Zod schema parsing and validation
- **JSON operations** - Parsing and serialization
- **Data transformation** - Type conversions and formatting
- **Configuration parsing** - Environment variable processing
- **String manipulation** - Operations that might throw errors

### Error Context Guidelines

Always provide meaningful context strings that include:

1. **Service/Component Name** - Where the error occurred
2. **Method Name** - Which operation failed
3. **Operation Type** - What was being attempted

```typescript
// Good context examples
'authService - signUpUser'
'userRepository - findUserByEmail'
'authController - register'
'crypto - encrypt'
'validation - userSchema'

// Poor context examples
'error'
'failed'
'auth'
```

### Validation Patterns

#### Service-Level Validation

```typescript
// Validate at service entry points
public async createUser(input: TCreateUserInput): Promise<Result<TUser>> {
  // 1. Validate input schema
  const [validInput, validationError] = safeValidateSchema(
    input,
    createUserSchema,
    'userService - createUser'
  )

  if (validationError) {
    return [null, validationError]
  }

  // 2. Business logic validation
  if (validInput.password !== validInput.confirmPassword) {
    return [
      null,
      AppError.validation(
        'Passwords do not match',
        { field: 'confirmPassword' },
        'userService - createUser'
      ),
    ]
  }

  // 3. Proceed with operation
  return tryCatch(
    this.repository.createUser(validInput),
    'userService - createUser'
  )
}
```

#### Repository-Level Validation

```typescript
// Validate database results
public async findUserById(id: string): Promise<Result<TUser | undefined>> {
  const [users, error] = await tryCatch(
    this.db.select().from(usersTable).where(eq(usersTable.id, id)),
    'userRepository - findUserById'
  )

  if (error) return [null, error]
  if (!users.length) return [undefined, null]

  // Validate returned data matches expected schema
  const [validUser, validationError] = safeValidateSchema(
    users[0],
    selectUserSchema,
    'userRepository - findUserById'
  )

  return validationError ? [null, validationError] : [validUser, null]
}
```

## Advanced Error Handling

### Crypto Operations ✅ COMPLETE

```typescript
// Encryption with error handling
export const encrypt = (text: string): Result<string> => {
	return tryCatchSync(() => {
		const cipher = createCipher('aes-256-gcm', config.encryptionKey)
		let encrypted = cipher.update(text, 'utf8', 'hex')
		encrypted += cipher.final('hex')
		return encrypted
	}, 'crypto - encrypt')
}

// Decryption with error handling
export const decrypt = (encryptedText: string): Result<string> => {
	return tryCatchSync(() => {
		const decipher = createDecipher('aes-256-gcm', config.encryptionKey)
		let decrypted = decipher.update(encryptedText, 'hex', 'utf8')
		decrypted += decipher.final('utf8')
		return decrypted
	}, 'crypto - decrypt')
}

// Usage in services
const [encryptedData, encryptError] = encrypt(sensitiveData)
if (encryptError) {
	return [null, encryptError]
}
```

### Configuration Loading ✅ COMPLETE

```typescript
// Environment configuration with error handling
export const loadConfig = (): Result<TEnv> => {
	return tryCatchSync(() => {
		const parsed = envSchema.parse(process.env)
		return parsed
	}, 'config - loadConfig')
}

// Usage in application bootstrap
const [config, configError] = loadConfig()
if (configError) {
	console.error('Failed to load configuration:', configError.message)
	process.exit(1)
}
```

## Global Error Handling

### Error Middleware ✅ COMPLETE

**Location**: `apps/express-api/src/middleware/error.middleware.ts`

```typescript
export const errorHandler = (
	error: Error,
	req: Request,
	res: Response,
	next: NextFunction,
) => {
	// Standardize all errors to AppError
	const standardizedError = AppError.from(error)

	// Log error with context
	logger.error('Request failed', {
		error: standardizedError.message,
		statusCode: standardizedError.statusCode,
		path: req.path,
		method: req.method,
		stack:
			process.env.NODE_ENV === 'development'
				? standardizedError.stack
				: undefined,
	})

	// Send appropriate response
	if (!res.headersSent) {
		res.status(standardizedError.statusCode).json({
			message: standardizedError.message,
			details:
				process.env.NODE_ENV === 'development'
					? standardizedError.details
					: undefined,
		})
	}
}
```

### Response Handlers ✅ COMPLETE

```typescript
// Success response handler
export const sendSuccess = <T>(
	res: Response,
	data: T,
	statusCode: number = StatusCodes.OK,
) => {
	res.status(statusCode).json(data)
}

// Error response handler
export const handleError = (
	res: Response,
	error: AppError,
	context: string,
) => {
	// Error is already logged by tryCatch, just send response
	if (!res.headersSent) {
		res.status(error.statusCode).json({
			message: error.message,
			details:
				process.env.NODE_ENV === 'development' ? error.details : undefined,
		})
	}
}
```

## Testing Error Handling

### Unit Testing Patterns

```typescript
import { vi } from 'vitest'
import { tryCatch, tryCatchSync } from '../utils/error-handling/try-catch.ts'

describe('Error Handling', () => {
	it('should handle async errors with tryCatch', async () => {
		const mockAsyncOperation = vi
			.fn()
			.mockRejectedValue(new Error('Async error'))

		const [result, error] = await tryCatch(
			mockAsyncOperation(),
			'test - asyncOperation',
		)

		expect(result).toBeNull()
		expect(error).toBeInstanceOf(AppError)
		expect(error?.message).toBe('Async error')
	})

	it('should handle sync errors with tryCatchSync', () => {
		const [result, error] = tryCatchSync(() => {
			throw new Error('Sync error')
		}, 'test - syncOperation')

		expect(result).toBeNull()
		expect(error).toBeInstanceOf(AppError)
		expect(error?.message).toBe('Sync error')
	})
})
```

### Integration Testing

```typescript
describe('Service Error Propagation', () => {
	it('should propagate errors through service layers', async () => {
		// Mock repository to return error
		vi.mocked(userRepository.findUserById).mockResolvedValue([
			null,
			AppError.notFound('User not found'),
		])

		// Call service method
		const [user, error] = await userService.getUserById('invalid-id')

		// Verify error propagation
		expect(user).toBeNull()
		expect(error).toBeInstanceOf(AppError)
		expect(error?.type).toBe(ErrorType.NOT_FOUND)
	})
})
```

## Implementation Status Summary

### ✅ **Production-Ready Features**

1. **Complete Go-Style Error Handling**

   - `tryCatch` and `tryCatchSync` utilities fully implemented
   - Automatic error standardization with `AppError.from()`
   - Context-aware logging throughout the application
   - Type-safe `Result<T>` patterns across all layers

2. **Comprehensive Error Architecture**

   - Unified `AppError` class with domain-specific error types
   - Global error middleware with environment-specific responses
   - Structured JSON logging with Pino integration
   - Complete OpenAPI error documentation

3. **Service Layer Excellence**

   - Repository pattern with dependency injection
   - Interface-based architecture for testability
   - Comprehensive validation with Zod integration
   - Error propagation through all application layers

4. **Client-Side Integration**
   - Error standardization in client-ui
   - Axios interceptor error handling
   - Automatic token refresh with error handling
   - User-friendly error display

### ⚠️ **Areas for Enhancement**

1. **Testing Infrastructure** (High Priority)

   - Unit tests for error handling utilities
   - Integration tests for error propagation
   - Error scenario testing

2. **Monitoring Enhancements** (Medium Priority)

   - Request ID tracking for correlation
   - User ID logging for context
   - Error analytics and alerting

3. **Advanced Features** (Low Priority)
   - Error recovery mechanisms
   - Circuit breaker patterns
   - Error aggregation and deduplication

## Related Documentation

- **[Error Handling Strategy ADR](../../adr/001-error-handling-strategy.md)** - Architectural decision rationale
- **[Testing Strategy](./testing-strategy.md)** - Error handling testing patterns
- **[API Development Guidelines](./api-development.md)** - API error handling standards
- **[Authentication System](../../features/authentication/README.md)** - Auth-specific error handling
