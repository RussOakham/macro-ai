# Enhanced Error Handling Implementation Plan

## Overview

This document outlines the implementation steps for enhancing error handling across the application using our `tryCatch` and `tryCatchSync` utilities, ensuring type safety, consistent logging, and comprehensive validation.

## Implementation Steps

### 1. Refactor Service and Data Access Layers

- [ ] Create interfaces for all services and repositories

  - [x] Define `ICognitoService` interface in `auth.services.ts`
  - [x] Define `IUserService` interface in `user.services.ts`
  - [x] Define `IUserRepository` interface in `user.data-access.ts`
  - [ ] Ensure all methods have proper return types using `EnhancedResult<T, E>`

- [ ] Refactor service classes to implement interfaces

  - [x] Update `CognitoService` to implement `ICognitoService`
  - [x] Update `UserService` to implement `IUserService`
  - [x] Create `UserRepository` class implementing `IUserRepository`

- [x] Standardize constructor patterns for dependency injection
  - [x] Add constructor parameters for dependencies
  - [x] Provide default implementations for backward compatibility

### 2. Implement tryCatch and tryCatchSync Utilities Across Codebase

#### 2.1 Async Operations with tryCatch

- [x] Refactor Auth Service methods

  - [x] Update `signUpUser` to use `tryCatch` and `tryCatchSync`
  - [x] Update `confirmSignUp` to use `tryCatch` and `tryCatchSync`
  - [x] Update `signInUser` to use `tryCatch` and `tryCatchSync`
  - [x] Update `refreshToken` to use `tryCatch` and `tryCatchSync`
  - [x] Update `forgotPassword` to use `tryCatch` and `tryCatchSync`
  - [x] Update `confirmForgotPassword` to use `tryCatch` and `tryCatchSync`
  - [x] Update `getAuthUser` to use `tryCatch` and `tryCatchSync`
  - [x] Update `generateHash` to use `tryCatchSync`

- [x] Refactor User Service methods

  - [x] Update `getUserById` to use `tryCatch`
  - [x] Update `getUserByEmail` to use `tryCatch`
  - [x] Update `getUserByAccessToken` to use `tryCatch`
  - [x] Update `registerOrLoginUserById` to use `tryCatch`

- [x] Refactor User Repository methods

  - [x] Update `findByEmail` to use `tryCatch`
  - [x] Update `findById` to use `tryCatch`
  - [x] Update `create` to use `tryCatch`
  - [x] Update `updateLastLogin` to use `tryCatch`
  - [x] Update `update` to use `tryCatch`

- [x] Refactor Auth Controller methods
  - [x] Simplify error handling using `tryCatch` results
  - [x] Remove redundant try/catch blocks
  - [x] Standardize response patterns

#### 2.2 Synchronous Operations with tryCatchSync

- [x] Create `tryCatchSync` utility function

  - [x] Implement in `utils/error-handling/try-catch.ts`
  - [x] Add proper type definitions
  - [x] Add error standardization
  - [x] Add context logging

- [ ] Refactor configuration loading functions

  - [ ] Update `loadConfig` in `utils/load-config.ts` to use `tryCatchSync`
  - [ ] Update `parseEnvFile` in `utils/load-config.ts` to use `tryCatchSync`

- [x] Refactor crypto utility functions

  - [x] Update `encrypt` in `utils/crypto.ts` to use `tryCatchSync`
  - [x] Update `decrypt` in `utils/crypto.ts` to use `tryCatchSync`
  - [x] Update `generateHash` in `auth.services.ts` to use `tryCatchSync`
  - [x] Update consumers of crypto functions to handle `EnhancedResult` return type

- [x] Refactor validation functions

  - [x] Update schema parsing in `validateData` in `utils/response-handlers.ts`
  - [x] Update schema parsing in data access layer functions

### 3. Implement Type-Safe Error Handling

- [x] Create unified error handling approach

  - [x] Consolidate `AppError` and `standardizeError` in `utils/errors.ts`
  - [x] Update imports to use the unified error module
  - [x] Add deprecation notice to `standardize-error.ts`

- [x] Create domain-specific error types

  - [x] Define error type enum in `utils/errors.ts`
  - [x] Add support for Cognito errors
  - [x] Add support for Zod validation errors
  - [x] Add support for API errors

- [x] Update `tryCatch` and `tryCatchSync` utilities to support specific error types

  - [x] Add generic type parameter for error type
  - [x] Ensure error standardization preserves type information

- [ ] Implement error type guards
  - [ ] Add `isAuthError` type guard
  - [ ] Add `isUserError` type guard
  - [x] Add `isValidationError` type guard
  - [ ] Add `isDatabaseError` type guard

### 4. Enhance Error Logging

- [x] Standardize logging format across the application

  - [x] Include error origin (service/component name)
  - [x] Include error status code
  - [x] Include error message
  - [x] Include stack trace in development environment

- [ ] Add context information to logs

  - [ ] Include request ID where available
  - [ ] Include user ID where available
  - [ ] Include relevant operation details

- [x] Implement structured logging
  - [x] Use JSON format for logs
  - [x] Add severity levels (error, warn, info)
  - [x] Add timestamps to all logs

### 5. Implement Zod Validation for All Inputs

- [x] Set up Zod validation infrastructure

  - [x] Add `zod-validation-error` for improved error messages
  - [x] Integrate with OpenAPI documentation
  - [x] Create validation middleware

- [ ] Create validation schemas for all function inputs

  - [ ] Define schemas for Auth Service inputs
  - [ ] Define schemas for User Service inputs
  - [ ] Define schemas for Repository inputs

- [ ] Implement validation in service methods

  - [ ] Add validation at the beginning of each method
  - [ ] Return appropriate error for validation failures
  - [ ] Log validation errors with details

- [x] Update controller validation
  - [x] Ensure all request bodies are validated
  - [x] Ensure all path and query parameters are validated
  - [x] Return consistent validation error responses

### 6. Identify and Handle Edge Cases

- [ ] Auth Service edge cases

  - [x] Handle expired tokens
  - [x] Handle invalid credentials
  - [ ] Handle account lockouts
  - [ ] Handle service unavailability

- [ ] User Service edge cases

  - [x] Handle non-existent users
  - [ ] Handle duplicate emails
  - [ ] Handle incomplete user profiles
  - [ ] Handle permission issues

- [ ] Database edge cases
  - [ ] Handle connection failures
  - [ ] Handle transaction failures
  - [ ] Handle constraint violations
  - [ ] Handle timeout issues

### 7. Update OpenAPI Specification

- [x] Update error responses in OpenAPI schemas

  - [x] Add specific error types to each endpoint
  - [x] Document error status codes
  - [x] Document error response formats

- [x] Add examples for error responses

  - [x] Include validation error examples
  - [x] Include authentication error examples
  - [x] Include not found error examples
  - [x] Include server error examples

- [x] Update request validation schemas
  - [x] Ensure all input validation rules are reflected in OpenAPI schemas
  - [x] Add descriptions for validation requirements

### 8. Enhance Global Error Handler

- [x] Enhance global error handler

  - [x] Update existing error handler in `middleware/error.middleware.ts`
  - [x] Add environment-specific error details
  - [x] Ensure proper handling of headers already sent
  - [x] Improve error logging with context

### 9. Testing and Validation

- [x] Create unit tests for error handling
- [x] Create integration tests for error propagation
- [x] Create end-to-end tests for error responses
- [x] Validate error responses in the UI

## Code Examples

### Example: Refactored Auth Service Method with tryCatch

```typescript
// Before
public async signUpUser({
  email,
  password,
  confirmPassword,
}: TRegisterUserRequest) {
  if (password !== confirmPassword) {
    throw AppError.validation(
      'Passwords do not match',
      undefined,
      'authService',
    )
  }

  const userId = crypto.randomUUID()

  const command = new SignUpCommand({
    ClientId: this.clientId,
    Username: userId,
    Password: password,
    UserAttributes: [
      {
        Name: 'email',
        Value: email,
      },
    ],
    SecretHash: this.generateHash(userId),
  })

  return this.client.send(command)
}

// After
public async signUpUser({
  email,
  password,
  confirmPassword,
}: TRegisterUserRequest): Promise<EnhancedResult<SignUpCommandOutput, AuthError>> {
  // Validate input with Zod
  const validationResult = registerUserRequestSchema.safeParse({
    email,
    password,
    confirmPassword,
  })

  if (!validationResult.success) {
    const validationError = fromError(validationResult.error)
    return {
      data: null,
      error: {
        type: ErrorType.ValidationError,
        name: 'ValidationError',
        status: 400,
        message: `Invalid registration data: ${validationError.message}`,
        service: 'authService',
        details: validationError.details,
      },
    }
  }

  if (password !== confirmPassword) {
    return {
      data: null,
      error: {
        type: ErrorType.ValidationError,
        name: 'ValidationError',
        status: 400,
        message: 'Passwords do not match',
        service: 'authService',
      },
    }
  }

  const userId = crypto.randomUUID()

  const command = new SignUpCommand({
    ClientId: this.clientId,
    Username: userId,
    Password: password,
    UserAttributes: [
      {
        Name: 'email',
        Value: email,
      },
    ],
    SecretHash: this.generateHash(userId),
  })

  return tryCatch(
    this.client.send(command),
    'authService'
  )
}
```

### Example: Using tryCatchSync for Synchronous Operations

```typescript
// Before
public generateHash(username: string): string {
  try {
    const hmac = createHmac('sha256', this.clientSecret)
    hmac.update(username + this.clientId)
    return hmac.digest('base64')
  } catch (error) {
    logger.error(`[authService]: Error generating hash: ${error}`)
    throw AppError.from(error, 'authService')
  }
}

// After
public generateHash(username: string): EnhancedResult<string, AuthError> {
  return tryCatchSync(
    () => {
      const hmac = createHmac('sha256', this.clientSecret)
      hmac.update(username + this.clientId)
      return hmac.digest('base64')
    },
    'authService - generateHash'
  )
}
```

### Example: Refactored Controller Method

```typescript
// Before
register: async (req: Request, res: Response) => {
	try {
		const { email, password, confirmPassword } =
			req.body as TRegisterUserRequest

		const response = await cognito.signUpUser({
			email,
			password,
			confirmPassword,
		})

		if (
			response.$metadata.httpStatusCode !== undefined &&
			response.$metadata.httpStatusCode !== 200
		) {
			logger.error(
				`[authController]: Error registering user: ${response.$metadata.httpStatusCode.toString()}`,
			)
			const error = AppError.validation(
				`Registration failed: ${response.$metadata.httpStatusCode.toString()}`,
			)
			handleError(res, standardizeError(error), 'authController')
			return
		}

		// Rest of the function...
	} catch (error: unknown) {
		const err = standardizeError(error)
		logger.error(
			`[authController]: Error registering user: ${err.status.toString()} ${err.message}`,
		)
		handleError(res, err, 'authController')
	}
}

// After
register: async (req: Request, res: Response) => {
	const { email, password, confirmPassword } = req.body as TRegisterUserRequest

	const { data: response, error } = await cognito.signUpUser({
		email,
		password,
		confirmPassword,
	})

	if (error) {
		handleError(res, error, 'authController')
		return
	}

	if (!response.UserSub) {
		const validationError = AppError.validation(
			'User not created - no user ID returned',
		)
		handleError(res, standardizeError(validationError), 'authController')
		return
	}

	// Rest of the function...
}
```

## When to Use tryCatch vs tryCatchSync

### Use tryCatch for

- API calls and network requests
- Database operations
- File system operations
- Any function that returns a Promise
- Operations that might take time to complete

### Use tryCatchSync for

- Configuration parsing and validation
- Data transformation and formatting
- Input validation with synchronous schema validation
- Cryptographic operations (encryption, hashing)
- JSON parsing and serialization
- Date formatting and parsing
- String manipulation and validation
- Object property access that might throw
- Type conversions that could fail

## Testing Strategy

1. **Unit Tests**

   - Test each service method with various inputs
   - Test error handling for each possible error type
   - Test validation for both valid and invalid inputs
   - Test both tryCatch and tryCatchSync with success and failure cases

2. **Integration Tests**

   - Test the interaction between controllers and services
   - Test the interaction between services and repositories
   - Test error propagation across layers

3. **End-to-End Tests**
   - Test complete user flows
   - Verify correct error responses from API endpoints
   - Test error handling in the UI

## Monitoring and Observability

1. **Error Tracking**

   - Integrate with error tracking service (e.g., Sentry)
   - Set up alerts for critical errors
   - Track error rates and patterns

2. **Logging**

   - Implement centralized log collection
   - Set up log analysis and visualization
   - Create dashboards for error monitoring

3. **Performance Monitoring**
   - Track error impact on performance
   - Monitor error resolution times
   - Identify bottlenecks in error handling
