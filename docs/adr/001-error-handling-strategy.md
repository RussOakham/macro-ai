# ADR-001: Error Handling Strategy

## Status

**Accepted** - Implemented and in production use

## Context

The Macro AI application requires a consistent, type-safe error handling strategy across all services, controllers, and data access layers. Traditional JavaScript try/catch blocks lead to inconsistent error handling, poor type safety, and scattered error logging throughout the codebase.

Key requirements identified:

- **Consistent Error Structure**: All errors should follow the same format
- **Type Safety**: Strong TypeScript support for error handling
- **Automatic Logging**: Context-aware error logging without manual intervention
- **Go-Style Familiarity**: Many team members prefer Go-style error handling patterns
- **Zero Dependencies**: Minimize external dependencies where possible
- **Incremental Adoption**: Allow gradual migration from existing error handling

## Decision

We have chosen to implement **custom tryCatch and tryCatchSync utilities** that provide Go-style error handling with automatic error standardization and logging, rather than adopting the neverthrow library.

### Implementation

```typescript
// Go-style Result type - tuple format
export type Result<T, E = AppError> = [T, null] | [null, E]

// Async wrapper function
const tryCatch = async <T>(
	promise: Promise<T>,
	context = 'unknown',
): Promise<Result<T>> => {
	try {
		const data = await promise
		return [data, null]
	} catch (error: unknown) {
		const appError = AppError.from(error, context)
		logger.error(`[${context}]: ${appError.message}`)
		return [null, appError]
	}
}

// Synchronous wrapper function
const tryCatchSync = <T>(func: () => T, context = 'unknown'): Result<T> => {
	try {
		const data = func()
		return [data, null]
	} catch (error: unknown) {
		const appError = AppError.from(error, context)
		logger.error(`[${context}]: ${appError.message}`)
		return [null, appError]
	}
}
```

### Usage Pattern

```typescript
// Controller usage
const [user, error] = await tryCatch(
	userService.createUser(userData),
	'userController - createUser',
)

if (error) {
	return handleError(res, error)
}

// Proceed with successful result
res.json({ user })
```

## Consequences

### Positive Consequences

✅ **Consistent Error Handling**: All errors are standardized through AppError.from()
✅ **Automatic Logging**: Built-in context-aware error logging
✅ **Type Safety**: Strong TypeScript support with Result\<T\> tuples
✅ **Zero Dependencies**: No additional bundle size or external dependencies
✅ **Go-Style Familiarity**: Familiar [data, error] tuple pattern
✅ **Incremental Adoption**: Can be adopted gradually across the codebase
✅ **Context Tracking**: Built-in service/context information for debugging

### Negative Consequences

⚠️ **Limited Composability**: No built-in combinators for chaining operations
⚠️ **Manual Error Checking**: Each result requires explicit error checking with if (error)
⚠️ **Tuple Destructuring**: Array destructuring may be less readable than object properties
⚠️ **No Advanced Error Handling**: Limited compared to full Result monad implementations

### Risk Mitigation

- **Training**: Team training on Go-style error handling patterns
- **Documentation**: Comprehensive documentation and examples
- **Linting Rules**: ESLint rules to enforce proper error handling patterns
- **Code Reviews**: Emphasis on proper error handling in code reviews

## Alternatives Considered

### Neverthrow Library

**Pros:**

- Rich composition API with extensive combinators
- Advanced type safety with error type discrimination
- Full Result monad implementation
- Chainable operations for elegant error flows

**Cons:**

- Steeper learning curve requiring functional programming knowledge
- External dependency adding ~4KB to bundle size
- Requires extensive refactoring of existing codebase
- Different programming paradigm from current team practices

**Decision Rationale:** While neverthrow provides more advanced features, our custom implementation better fits our team's experience level and provides the core benefits we need without external dependencies.

### Traditional Try/Catch

**Pros:**

- Familiar JavaScript pattern
- No additional abstractions
- Direct exception handling

**Cons:**

- Inconsistent error handling across services
- Poor type safety for error cases
- Manual error logging and standardization required
- Difficult to enforce consistent patterns

**Decision Rationale:** Traditional try/catch lacks the consistency and type safety required for our application architecture.

## References

- [Original comparison document](../documentation/ADR/try-catch-vs-neverthrow.md) - Detailed analysis
- [AppError implementation](../../apps/express-api/src/utils/errors/app-error.ts) - Error standardization
- [Go error handling patterns](https://blog.golang.org/error-handling-and-go) - Inspiration
- [Neverthrow library](https://github.com/supermacro/neverthrow) - Alternative considered

## Detailed Comparison

### Feature Comparison Matrix

| Feature                   | Custom tryCatch/tryCatchSync | Neverthrow                 |
| ------------------------- | ---------------------------- | -------------------------- |
| **Approach**              | Go-style tuple wrapper       | Comprehensive Result monad |
| **Learning Curve**        | Low - familiar Go pattern    | Medium - new concepts      |
| **Type Safety**           | Excellent with AppError      | Excellent                  |
| **Error Standardization** | Built-in with AppError       | Manual implementation      |
| **Logging**               | Automatic with context       | Manual implementation      |
| **Composability**         | Limited (manual chaining)    | Extensive with combinators |
| **Bundle Size**           | Zero additional              | Small (~4KB)               |
| **Sync/Async Support**    | Both tryCatch & tryCatchSync | ResultAsync for async      |
| **Integration Effort**    | Minimal changes              | Moderate refactoring       |
| **Context Tracking**      | Built-in service context     | Manual implementation      |

### Implementation Examples

#### Current tryCatch Usage

```typescript
// Service layer
const [user, error] = await tryCatch(
	cognito.signUpUser({ email, password, confirmPassword }),
	'authController - register',
)

if (error) {
	handleError(res, error, 'authController')
	return
}

// Proceed with success case
const authResponse = { message: 'Registration successful', user }
res.status(201).json(authResponse)
```

#### Neverthrow Alternative

```typescript
// Service layer with neverthrow
const result = await cognito
	.signUpUser({ email, password, confirmPassword })
	.andThen((response) => {
		if (!response.UserSub) {
			return err(AppError.validation('User not created'))
		}
		return ok(response)
	})

result.match(
	(response) => {
		const authResponse = { message: 'Registration successful', response }
		res.status(201).json(authResponse)
	},
	(error) => {
		handleError(res, error, 'authController')
	},
)
```

### Key Implementation Features

#### Built-in Error Standardization

All errors are automatically converted to AppError instances:

```typescript
const [data, error] = await tryCatch(someAsyncOperation(), 'myService')

if (error) {
	// error is guaranteed to be an AppError with:
	// - Consistent structure (type, status, message, service, etc.)
	// - Proper logging already handled
	// - Context information included
	console.log(error.type) // ErrorType enum value
	console.log(error.status) // HTTP status code
	console.log(error.service) // Service context
}
```

#### Automatic Context-Aware Logging

```typescript
// This automatically logs: "[userService]: User not found"
const [user, error] = await tryCatch(findUserById(id), 'userService')
```

#### Type Safety with Result Tuples

```typescript
// TypeScript knows the exact types
const [user, error]: Result<User> = await tryCatch(getUserById(id))

if (error) {
	// TypeScript knows this is AppError
	handleError(res, error)
	return
}

// TypeScript knows user is User type (not null)
console.log(user.email)
```

---

**Date**: July 2025
**Participants**: Development Team
**Status**: Accepted and Implemented
