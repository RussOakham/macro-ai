# Comparison: Custom tryCatch Utility vs Neverthrow

## Overview

This document compares our custom `tryCatch` utility with the [neverthrow](https://github.com/supermacro/neverthrow) npm package for handling errors in a functional way.

## Comparison Summary

| Feature                | Custom tryCatch/tryCatchSync | Neverthrow                 |
| ---------------------- | ---------------------------- | -------------------------- |
| **Approach**           | Go-style tuple wrapper       | Comprehensive Result monad |
| **Learning Curve**     | Low - familiar Go pattern    | Medium - new concepts      |
| **Type Safety**        | Excellent with AppError      | Excellent                  |
| **Error Standardization** | Built-in with AppError    | Manual implementation      |
| **Logging**            | Automatic with context       | Manual implementation      |
| **Composability**      | Limited (manual chaining)    | Extensive with combinators |
| **Bundle Size**        | Zero additional              | Small (~4KB)               |
| **Sync/Async Support** | Both tryCatch & tryCatchSync | ResultAsync for async      |
| **Integration Effort** | Minimal changes              | Moderate refactoring       |
| **Context Tracking**   | Built-in service context     | Manual implementation      |

## Custom tryCatch Utility

Our custom utility provides a Go-style error handling wrapper around try/catch blocks:

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

### Advantages - Custom tryCatch

- **Go-style error handling**: Familiar tuple pattern `[data, error]` for developers coming from Go
- **Automatic error standardization**: All errors are converted to `AppError` instances with consistent structure
- **Built-in logging**: Automatic error logging with context information
- **Type safety**: Strong TypeScript typing with `Result<T>` tuple type
- **No external dependencies**: Zero additional bundle size
- **Incremental adoption**: Can be adopted gradually across the codebase
- **Context awareness**: Built-in service/context tracking for better debugging

### Disadvantages - Custom tryCatch

- **Limited composability**: No built-in combinators for chaining operations
- **Manual error checking**: Each result requires explicit error checking with `if (error)`
- **Tuple destructuring**: Requires array destructuring which may be less readable than object properties
- **No advanced error handling**: Limited compared to full Result monad implementations

## Neverthrow

Neverthrow is a robust library that implements the Result monad pattern:

```typescript
import { Result, ok, err } from 'neverthrow'

// Function that returns a Result
function divide(a: number, b: number): Result<number, string> {
	if (b === 0) {
		return err('Cannot divide by zero')
	}
	return ok(a / b)
}
```

### Advantages - Neverthrow

- Strong type safety
- Rich API for composition (map, mapErr, andThen, etc.)
- Encourages explicit error handling
- Prevents runtime exceptions
- Chainable operations

### Disadvantages - Neverthrow

- Steeper learning curve
- Requires more upfront refactoring
- External dependency
- Different programming paradigm

## Code Examples: Registration Flow

### Current Implementation with tryCatch

#### 1. Route Handler

```typescript
// auth.routes.ts
router.post(
	'/register',
	validateRequest(registerUserRequestSchema),
	authController.register,
)
```

#### 2. Controller

```typescript
// auth.controller.ts
register: async (req: Request, res: Response) => {
	const { email, password, confirmPassword } = req.body as TRegisterUserRequest

	// Using tuple destructuring with tryCatch
	const [response, error] = await tryCatch(
		cognito.signUpUser({ email, password, confirmPassword }),
		'authController - register'
	)

	if (error) {
		// Error is already logged and standardized by tryCatch
		handleError(res, error, 'authController')
		return
	}

	if (!response.UserSub) {
		const validationError = AppError.validation('User not created - no user ID returned')
		handleError(res, validationError, 'authController')
		return
	}

	const [user, userError] = await tryCatch(
		createUser({ id: response.UserSub, email }),
		'authController - createUser'
	)

	if (userError) {
		// Error is already logged and standardized by tryCatch
		handleError(res, userError, 'authController')
		return
	}

	logger.info(`[authController]: User created: ${user.id}`)

	const authResponse: TRegisterUserResponse = {
		message:
			'Registration successful. Please check your email for verification code.',
		user: {
			id: response.UserSub,
			email,
		},
	}

	res.status(StatusCodes.CREATED).json(authResponse)
}
```

#### 3. Service

```typescript
// auth.services.ts
public async signUpUser({
  email,
  password,
  confirmPassword,
}: TRegisterUserRequest): Promise<SignUpCommandOutput> {
  if (password !== confirmPassword) {
    throw AppError.validation('Passwords do not match', undefined, 'authService')
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

  // Service throws errors - tryCatch handles them in the controller
  return this.client.send(command)
}
```

#### 4. Data Access

```typescript
// user.data-access.ts
const createUser = async (userData: TInsertUser): Promise<TUser> => {
	try {
		const validatedData = insertUserSchema.parse(userData)

		const [user] = await db.insert(usersTable).values(validatedData).returning()

		return selectUserSchema.parse(user)
	} catch (error) {
		logger.error(`[userDataAccess]: Error creating user: ${error}`)
		throw AppError.from(error, 'userDataAccess')
	}
}
```

**Note**: In this pattern, the data access layer throws errors, and the controller uses `tryCatch` to handle them. This keeps the data access layer simple while providing consistent error handling at the controller level.

### Refactored with Neverthrow

#### 1. Route Handler (unchanged)

```typescript
// auth.routes.ts
router.post(
	'/register',
	validateRequest(registerUserRequestSchema),
	authController.register,
)
```

#### 2. Controller - Refactored with Neverthrow

```typescript
// auth.controller.ts
register: async (req: Request, res: Response) => {
	const { email, password, confirmPassword } = req.body as TRegisterUserRequest

	const result = await cognito
		.signUpUser({ email, password, confirmPassword })
		.andThen((response) => {
			if (!response.UserSub) {
				return err(
					AppError.validation('User not created - no user ID returned'),
				)
			}
			return ok(response)
		})
		.andThen((response) =>
			createUser({ id: response.UserSub, email }).map((user) => ({
				user,
				response,
			})),
		)

	result.match(
		// Success case
		({ user, response }) => {
			logger.info(`[authController]: User created: ${user.id}`)

			const authResponse: TRegisterUserResponse = {
				message:
					'Registration successful. Please check your email for verification code.',
				user: {
					id: response.UserSub,
					email,
				},
			}

			res.status(StatusCodes.CREATED).json(authResponse)
		},
		// Error case
		(error) => {
			logger.error(`[authController]: Error registering user: ${error}`)
			const err = standardizeError(error)
			handleError(res, err, 'authController')
		},
	)
}
```

#### 3. Service - Refactored with Neverthrow

```typescript
// auth.services.ts
public signUpUser({
  email,
  password,
  confirmPassword,
}: TRegisterUserRequest): ResultAsync<SignUpCommandOutput, AppError> {
  if (password !== confirmPassword) {
    return errAsync(AppError.validation('Passwords do not match', undefined, 'authService'))
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

  return ResultAsync.fromPromise(
    this.client.send(command),
    error => AppError.from(error, 'authService')
  )
}
```

#### 4. Data Access - Refactored with Neverthrow

```typescript
// user.data-access.ts
const createUser = (userData: TInsertUser): ResultAsync<TUser, AppError> => {
	return ResultAsync.fromPromise(
		Promise.resolve().then(() => {
			const validatedData = insertUserSchema.parse(userData)

			return db
				.insert(usersTable)
				.values(validatedData)
				.returning()
				.then(([user]) => selectUserSchema.parse(user))
		}),
		(error) => {
			logger.error(`[userDataAccess]: Error creating user: ${error}`)
			return AppError.from(error, 'userDataAccess')
		},
	)
}
```

## Key Features of Our Implementation

### Built-in Error Standardization

Our `tryCatch` and `tryCatchSync` utilities automatically standardize all errors using `AppError.from()`:

```typescript
// All errors are converted to AppError instances
const [data, error] = await tryCatch(someAsyncOperation(), 'myService')

if (error) {
  // error is guaranteed to be an AppError with:
  // - Consistent structure (type, status, message, service, etc.)
  // - Proper logging already handled
  // - Context information included
  console.log(error.type)     // ErrorType enum value
  console.log(error.status)   // HTTP status code
  console.log(error.service)  // Service context
}
```

### Automatic Logging

Both utilities include built-in error logging with context:

```typescript
// This automatically logs: "[userService]: User not found"
const [user, error] = await tryCatch(
  findUserById(id),
  'userService'
)
```

### Type Safety with Result Tuples

The `Result<T>` type provides strong typing for both success and error cases:

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

## Practical Usage Examples

### Using tryCatch for Async Operations

```typescript
// API calls
const [response, error] = await tryCatch(
  fetch('/api/users'),
  'userService - fetchUsers'
)

// Database operations
const [user, dbError] = await tryCatch(
  db.select().from(users).where(eq(users.id, userId)),
  'userRepository - findById'
)

// File operations
const [fileContent, fileError] = await tryCatch(
  fs.readFile('config.json', 'utf8'),
  'configService - readFile'
)
```

### Using tryCatchSync for Synchronous Operations

```typescript
// JSON parsing
const [config, parseError] = tryCatchSync(
  () => JSON.parse(configString),
  'configService - parseJSON'
)

// Data validation
const [validatedData, validationError] = tryCatchSync(
  () => userSchema.parse(userData),
  'userService - validateUser'
)

// Cryptographic operations
const [hash, hashError] = tryCatchSync(
  () => {
    const hmac = createHmac('sha256', secret)
    hmac.update(data)
    return hmac.digest('hex')
  },
  'authService - generateHash'
)
```

### Error Handling Patterns

```typescript
// Early return pattern
const [user, error] = await tryCatch(getUserById(id), 'userController')
if (error) {
  return handleError(res, error)
}

// Multiple operations with error accumulation
const [user, userError] = await tryCatch(getUserById(id), 'userService')
if (userError) return [null, userError]

const [profile, profileError] = await tryCatch(
  getProfileById(user.profileId),
  'userService'
)
if (profileError) return [null, profileError]

return [{ user, profile }, null]
```

### Neverthrow's Type-Safe Error Handling

Neverthrow provides excellent type safety for errors through its `Result` type. You can define specific error types for each function, allowing for precise error handling:

```typescript
// Define domain-specific error types
type AuthError =
  | { type: 'PasswordMismatch'; message: string }
  | { type: 'UserExists'; message: string }
  | { type: 'ServiceUnavailable'; message: string }

type DatabaseError =
  | { type: 'ConnectionFailed'; message: string }
  | { type: 'QueryFailed'; message: string }
  | { type: 'ValidationFailed'; message: string; details: unknown }

// Service with specific error type
public signUpUser({
  email,
  password,
  confirmPassword,
}: TRegisterUserRequest): ResultAsync<SignUpCommandOutput, AuthError> {
  if (password !== confirmPassword) {
    return errAsync({
      type: 'PasswordMismatch',
      message: 'Passwords do not match'
    })
  }

  // Rest of the function...

  return ResultAsync.fromPromise(
    this.client.send(command),
    (error): AuthError => {
      if (isCognitoError(error) && error.__type === 'UsernameExistsException') {
        return { type: 'UserExists', message: 'User already exists' }
      }
      return { type: 'ServiceUnavailable', message: 'Service unavailable' }
    }
  )
}
```

This allows for precise error handling in the controller:

```typescript
// Controller with type-safe error handling
register: async (req: Request, res: Response) => {
	const { email, password, confirmPassword } = req.body as TRegisterUserRequest

	const result = await cognito
		.signUpUser({ email, password, confirmPassword })
		.andThen((response) => {
			if (!response.UserSub) {
				return err({
					type: 'ValidationFailed',
					message: 'User not created - no user ID returned',
					details: null,
				})
			}
			return ok(response)
		})
		.andThen((response) =>
			createUser({ id: response.UserSub, email }).map((user) => ({
				user,
				response,
			})),
		)

	result.match(
		// Success case
		({ user, response }) => {
			// Success handling...
		},
		// Error case with type discrimination
		(error) => {
			switch (error.type) {
				case 'PasswordMismatch':
					res.status(StatusCodes.BAD_REQUEST).json({ message: error.message })
					break
				case 'UserExists':
					res.status(StatusCodes.CONFLICT).json({ message: error.message })
					break
				case 'ValidationFailed':
					res.status(StatusCodes.BAD_REQUEST).json({
						message: error.message,
						details: error.details,
					})
					break
				case 'ConnectionFailed':
				case 'QueryFailed':
				case 'ServiceUnavailable':
					res
						.status(StatusCodes.INTERNAL_SERVER_ERROR)
						.json({ message: error.message })
					break
				default:
					// Exhaustive type checking - TypeScript will error if we miss a case
					const _exhaustiveCheck: never = error
					res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
						message: 'Unknown error occurred',
					})
			}
		},
	)
}
```

### Combining Results with Different Error Types

Neverthrow provides utilities for combining results with different error types:

```typescript
import { Result, ResultAsync, ok, err, fromPromise } from 'neverthrow'

// Function that returns a Result with AuthError
function validateUser(user: UserInput): Result<User, AuthError> {
	// Validation logic...
}

// Function that returns a Result with DatabaseError
function saveUser(user: User): ResultAsync<User, DatabaseError> {
	// Database logic...
}

// Combining results with different error types
function createUser(
	input: UserInput,
): ResultAsync<User, AuthError | DatabaseError> {
	return validateUser(input).asyncAndThen((validUser) => saveUser(validUser))
}

// Using the combined result
createUser(input).match(
	(user) => {
		// Success case
	},
	(error) => {
		// Type narrowing with discriminated union
		if (error.type === 'PasswordMismatch' || error.type === 'UserExists') {
			// Handle AuthError
		} else {
			// Handle DatabaseError
		}
	},
)
```

## Conclusion

### When to Use Our Custom tryCatch Implementation

**Recommended for:**

- Applications that need consistent error handling with minimal complexity
- Teams familiar with Go-style error handling patterns
- Projects requiring zero external dependencies
- Codebases that benefit from automatic error standardization and logging
- Incremental adoption of functional error handling patterns

**Key Benefits:**

- **Built-in error standardization**: All errors automatically converted to `AppError` instances
- **Automatic logging**: Context-aware error logging included
- **Type safety**: Strong TypeScript support with tuple destructuring
- **Go-style familiarity**: `[data, error]` pattern familiar to many developers
- **Zero dependencies**: No additional bundle size

### When to Use Neverthrow

**Recommended for:**

- Complex applications requiring sophisticated error composition
- Teams comfortable with functional programming and monadic patterns
- Projects needing advanced error chaining and transformation
- Applications built from scratch with functional-first architecture

**Key Benefits:**

- **Rich composition API**: Extensive combinators for chaining operations
- **Advanced type safety**: Comprehensive error type discrimination
- **Functional paradigm**: Full Result monad implementation
- **Chainable operations**: Elegant error handling flows

### Current Implementation Status

Our current `tryCatch` and `tryCatchSync` utilities already include many advanced features:

✅ **Automatic error standardization** - All errors converted to `AppError`
✅ **Built-in logging** - Context-aware error logging
✅ **Type safety** - Strong TypeScript typing with `Result<T>` tuples
✅ **Context tracking** - Service/context information for debugging
✅ **Go-style syntax** - Familiar `[data, error]` tuple pattern

This implementation provides an excellent balance of simplicity, type safety, and functionality for most use cases without requiring external dependencies or extensive refactoring.
