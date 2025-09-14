# Coding Standards

## Current Implementation Status ✅ PRODUCTION-READY

This document establishes comprehensive coding standards for the Macro AI project, including code style conventions,
linting rules, and development best practices. The coding standards are **fully implemented and enforced** through
automated tooling, CI/CD pipelines, and code review processes.

## 🎯 Code Quality Philosophy

### Core Principles ✅ IMPLEMENTED

1. **Consistency**: Uniform code style across the entire codebase
2. **Readability**: Code should be self-documenting and easy to understand
3. **Maintainability**: Write code that is easy to modify and extend
4. **Type Safety**: Leverage TypeScript for compile-time error prevention
5. **Performance**: Consider performance implications in code design
6. **Security**: Follow secure coding practices and patterns

### Quality Metrics ✅ TRACKED

- **Test Coverage**: 92.34% (997 tests passing)
- **TypeScript Coverage**: 100% strict mode compliance
- **ESLint Compliance**: Zero linting errors in CI/CD
- **Code Review Coverage**: 100% of changes reviewed

## 📝 TypeScript Standards

### Type Definitions ✅ ENFORCED

#### Strict TypeScript Configuration

```json
// tsconfig.json
{
	"compilerOptions": {
		"strict": true,
		"noImplicitAny": true,
		"noImplicitReturns": true,
		"noImplicitThis": true,
		"noUnusedLocals": true,
		"noUnusedParameters": true,
		"exactOptionalPropertyTypes": true,
		"noUncheckedIndexedAccess": true
	}
}
```

#### Interface and Type Conventions

```typescript
// ✅ Good: Descriptive interface names with 'I' prefix for interfaces
interface IUserService {
	createUser(userData: CreateUserRequest): Promise<Result<User>>
	getUserById(id: string): Promise<Result<User | null>>
}

// ✅ Good: Type aliases for complex types
type Result<T> = [T, null] | [null, IStandardizedError]
type ChatRole = 'user' | 'assistant' | 'system'

// ✅ Good: Generic constraints
interface Repository<T extends { id: string }> {
	findById(id: string): Promise<T | null>
	create(data: Omit<T, 'id'>): Promise<T>
}

// ❌ Bad: Any types
function processData(data: any): any {
	return data
}

// ✅ Good: Proper typing
function processUserData(data: UserData): ProcessedUserData {
	return {
		id: data.id,
		name: data.name.trim(),
		email: data.email.toLowerCase(),
	}
}
```

#### Utility Types Usage

```typescript
// ✅ Good: Use built-in utility types
type CreateUserRequest = Omit<User, 'id' | 'createdAt' | 'updatedAt'>
type UpdateUserRequest = Partial<Pick<User, 'name' | 'email'>>
type UserResponse = Pick<User, 'id' | 'name' | 'email'>

// ✅ Good: Custom utility types for domain-specific needs
type WithTimestamps<T> = T & {
	createdAt: Date
	updatedAt: Date
}

type ApiResponse<T> = {
	data: T
	success: boolean
	message?: string
}
```

### Error Handling Standards ✅ IMPLEMENTED

#### Go-Style Error Handling

```typescript
// ✅ Good: Go-style error handling with Result tuples
import { tryCatch } from '@/lib/utils/error-handling/try-catch'

async function createUser(userData: CreateUserRequest): Promise<Result<User>> {
	const [user, error] = await tryCatch(
		userService.create(userData),
		'UserController.createUser',
	)

	if (error) {
		logger.error(
			{ error, userData: sanitize(userData) },
			'Failed to create user',
		)
		return [null, error]
	}

	return [user, null]
}

// ❌ Bad: Traditional try/catch blocks
async function createUserBad(userData: CreateUserRequest): Promise<User> {
	try {
		return await userService.create(userData)
	} catch (error) {
		throw error // Loses context and makes error handling inconsistent
	}
}
```

#### Error Type Definitions

```typescript
// ✅ Good: Standardized error interfaces
interface IStandardizedError {
	code: string
	message: string
	statusCode: number
	context?: Record<string, unknown>
	originalError?: Error
}

// ✅ Good: Domain-specific error types
class ValidationError extends Error implements IStandardizedError {
	code = 'VALIDATION_ERROR'
	statusCode = 400

	constructor(
		message: string,
		public context?: Record<string, unknown>,
	) {
		super(message)
		this.name = 'ValidationError'
	}
}
```

## 🎨 Code Style Standards

### Naming Conventions ✅ ENFORCED

#### Variables and Functions

```typescript
// ✅ Good: camelCase for variables and functions
const userCount = 10
const isAuthenticated = true
const getUserById = (id: string) => {
	/* ... */
}

// ✅ Good: Descriptive boolean names
const hasPermission = checkUserPermission(user, 'read')
const isLoading = false
const canEdit = user.role === 'admin'

// ❌ Bad: Unclear or abbreviated names
const u = 10
const auth = true
const get = (id: string) => {
	/* ... */
}
```

#### Constants and Enums

```typescript
// ✅ Good: SCREAMING_SNAKE_CASE for constants
const MAX_RETRY_ATTEMPTS = 3
const DEFAULT_PAGE_SIZE = 20
const API_ENDPOINTS = {
	USERS: '/api/users',
	CHATS: '/api/chats',
} as const

// ✅ Good: PascalCase for enums
enum UserRole {
	ADMIN = 'admin',
	USER = 'user',
	MODERATOR = 'moderator',
}

// ✅ Good: Const assertions for literal types
const CHAT_ROLES = ['user', 'assistant', 'system'] as const
type ChatRole = (typeof CHAT_ROLES)[number]
```

#### Classes and Interfaces

```typescript
// ✅ Good: PascalCase for classes
class UserService {
	constructor(private userRepository: IUserRepository) {}

	async createUser(userData: CreateUserRequest): Promise<Result<User>> {
		// Implementation
	}
}

// ✅ Good: Interface naming with 'I' prefix
interface IUserRepository {
	findById(id: string): Promise<User | null>
	create(userData: CreateUserRequest): Promise<User>
}

// ✅ Good: Abstract class naming
abstract class BaseController {
	protected abstract handleRequest(): Promise<void>
}
```

### File and Directory Naming ✅ ENFORCED

```bash
# ✅ Good: kebab-case for files and directories
src/
├── components/
│   ├── chat-interface/
│   │   ├── chat-interface.tsx
│   │   ├── chat-interface.test.tsx
│   │   └── chat-interface.types.ts
│   └── user-profile/
│       ├── user-profile.tsx
│       └── user-profile.module.css
├── services/
│   ├── auth-service.ts
│   ├── chat-service.ts
│   └── user-service.ts
└── utils/
    ├── error-handling/
    │   ├── try-catch.ts
    │   └── standardize-error.ts
    └── validation/
        └── zod-schemas.ts

# ✅ Good: Consistent file suffixes
component.tsx          # React components
component.test.tsx     # Component tests
component.types.ts     # Type definitions
service.ts            # Service classes
utils.ts              # Utility functions
constants.ts          # Constants and enums
```

### Import/Export Standards ✅ ENFORCED

```typescript
// ✅ Good: Organized imports with consistent ordering
// 1. Node modules
import React from 'react'
import { z } from 'zod'

// 2. Internal modules (absolute imports)
import { tryCatch } from '@/lib/utils/error-handling/try-catch'
import { logger } from '@/lib/logger'

// 3. Relative imports
import { UserService } from './user-service'
import type { User, CreateUserRequest } from './user.types'

// ✅ Good: Named exports preferred over default exports
export const userService = new UserService()
export { UserService }
export type { User, CreateUserRequest }

// ✅ Good: Default exports only for React components
export default function UserProfile({ user }: { user: User }) {
	return <div>{user.name}</div>
}
```

## 🧪 Testing Standards

### Test Structure ✅ IMPLEMENTED

#### Test Organization

```typescript
// ✅ Good: Descriptive test structure with nested describe blocks
describe('UserService', () => {
	let userService: UserService
	let mockUserRepository: MockUserRepository

	beforeEach(() => {
		mockUserRepository = createMockUserRepository()
		userService = new UserService(mockUserRepository)
		vi.clearAllMocks()
	})

	describe('createUser', () => {
		describe('when user data is valid', () => {
			it('should create user successfully', async () => {
				// Arrange
				const userData: CreateUserRequest = {
					name: 'John Doe',
					email: 'john@example.com',
				}
				const expectedUser: User = {
					id: '123',
					...userData,
					createdAt: new Date(),
					updatedAt: new Date(),
				}
				mockUserRepository.create.mockResolvedValue(expectedUser)

				// Act
				const [result, error] = await userService.createUser(userData)

				// Assert
				expect(error).toBeNull()
				expect(result).toEqual(expectedUser)
				expect(mockUserRepository.create).toHaveBeenCalledWith(userData)
			})
		})

		describe('when repository throws error', () => {
			it('should return standardized error', async () => {
				// Arrange
				const userData: CreateUserRequest = {
					name: 'John Doe',
					email: 'john@example.com',
				}
				const repositoryError = new Error('Database connection failed')
				mockUserRepository.create.mockRejectedValue(repositoryError)

				// Act
				const [result, error] = await userService.createUser(userData)

				// Assert
				expect(result).toBeNull()
				expect(error).toBeDefined()
				expect(error?.code).toBe('INTERNAL_SERVER_ERROR')
			})
		})
	})
})
```

#### Mock Standards

```typescript
// ✅ Good: Type-safe mocks using satisfies
const mockUserRepository = {
	findById: vi.fn(),
	create: vi.fn(),
	update: vi.fn(),
	delete: vi.fn(),
} satisfies Partial<IUserRepository>

// ✅ Good: Mock factory functions
function createMockUser(overrides: Partial<User> = {}): User {
	return {
		id: '123',
		name: 'John Doe',
		email: 'john@example.com',
		createdAt: new Date('2024-01-01'),
		updatedAt: new Date('2024-01-01'),
		...overrides,
	}
}

// ✅ Good: Reusable test helpers
export const testHelpers = {
	createMockUser,
	createMockUserRepository: () => mockUserRepository,
	setupTestDatabase: async () => {
		// Database setup logic
	},
}
```

### Test Coverage Standards ✅ ENFORCED

```typescript
// Coverage thresholds in vitest.config.ts
export default defineConfig({
	test: {
		coverage: {
			provider: 'v8',
			reporter: ['text', 'json', 'html'],
			thresholds: {
				global: {
					branches: 80,
					functions: 80,
					lines: 80,
					statements: 80,
				},
			},
			exclude: [
				'node_modules/',
				'dist/',
				'**/*.test.ts',
				'**/*.spec.ts',
				'**/*.d.ts',
				'coverage/',
			],
		},
	},
})
```

## 🔧 Linting and Formatting

### Oxlint + ESLint Configuration ✅ ENFORCED

Our project uses a **dual-linter approach** with Oxlint as the primary linter and ESLint for type-aware rules:

#### Oxlint (Primary Linter)

- **Fast**: 10-100x faster than ESLint
- **Comprehensive**: Handles most code quality and style rules
- **Zero-config**: Works out of the box with sensible defaults

```bash
# Run Oxlint
pnpm lint:oxlint

# Fix issues automatically
pnpm lint:fix:oxlint
```

#### ESLint (Type-Aware Rules)

- **TypeScript Integration**: Handles type-aware rules that require TypeScript analysis
- **Specialized Rules**: Security, testing, and framework-specific rules
- **Complementary**: Works alongside Oxlint without duplication

```javascript
// eslint.config.js
import * as repoConfig from '@repo/config-eslint'

export default repoConfig.config(
	// Global ignores - must be first
	{
		ignores: ['dist/**', 'node_modules/**', 'coverage/**', '*.lcov'],
	},
	// Use shared base config with modular approach
	...repoConfig.configs.base,
	// Add project-specific configurations
	{
		languageOptions: {
			parserOptions: {
				project: './tsconfig.json',
				tsconfigRootDir: import.meta.dirname,
			},
		},
		rules: {
			// Project-specific rule overrides
			'@typescript-eslint/no-unused-vars': 'error',
			'@typescript-eslint/explicit-function-return-type': 'warn',
		},
	},
)
```

#### Linting Workflow

```bash
# Run both linters
pnpm lint

# Fix issues with both linters
pnpm lint:fix

# CI mode (strict, no warnings)
pnpm lint:ci
```

### Prettier Configuration ✅ ENFORCED

```json
// .prettierrc
{
	"semi": false,
	"singleQuote": true,
	"tabWidth": 2,
	"trailingComma": "es5",
	"printWidth": 100,
	"bracketSpacing": true,
	"arrowParens": "avoid"
}
```

### Pre-commit Hooks ✅ IMPLEMENTED

```json
// package.json
{
	"lint-staged": {
		"*.{ts,tsx}": ["eslint --fix", "prettier --write"],
		"*.{json,md}": ["prettier --write"]
	}
}
```

## 📚 Documentation Standards

### Code Documentation ✅ IMPLEMENTED

#### JSDoc Comments

````typescript
/**
 * Creates a new user in the system
 *
 * @param userData - The user data for creation
 * @returns Promise resolving to Result tuple with User or error
 *
 * @example
 * ```typescript
 * const [user, error] = await createUser({
 *   name: 'John Doe',
 *   email: 'john@example.com'
 * })
 *
 * if (error) {
 *   console.error('Failed to create user:', error.message)
 *   return
 * }
 *
 * console.log('User created:', user.id)
 * ```
 */
async function createUser(userData: CreateUserRequest): Promise<Result<User>> {
	// Implementation
}

/**
 * Configuration options for the chat service
 */
interface ChatServiceConfig {
	/** Maximum number of messages to load per request */
	maxMessagesPerPage: number
	/** Timeout for AI response generation in milliseconds */
	aiResponseTimeout: number
	/** Whether to enable message encryption */
	enableEncryption: boolean
}
````

#### README Standards

````markdown
# Component/Service Name

## Overview

Brief description of the component's purpose and functionality.

## Usage

```typescript
// Basic usage example
import { ComponentName } from './component-name'

const component = new ComponentName(config)
const result = await component.method()
```
````

## API Reference

### Methods

#### `methodName(param: Type): ReturnType`

Description of what the method does.

**Parameters:**

- `param` (Type): Description of the parameter

**Returns:**

- `ReturnType`: Description of the return value

**Example:**

```typescript
const result = await methodName('example')
```

## Configuration

Description of configuration options.

## Error Handling

Description of error handling patterns used.

### Inline Comments ✅ RECOMMENDED

```typescript
// ✅ Good: Explain complex business logic
function calculateUserScore(user: User, activities: Activity[]): number {
	// Base score starts at 100 for all users
	let score = 100

	// Reduce score for inactive users (no activity in 30 days)
	const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
	const recentActivities = activities.filter((a) => a.createdAt > thirtyDaysAgo)

	if (recentActivities.length === 0) {
		score -= 50 // Penalty for inactivity
	}

	// Bonus points for premium users
	if (user.isPremium) {
		score += 25
	}

	return Math.max(0, score) // Ensure score never goes below 0
}

// ❌ Bad: Obvious comments
const userCount = users.length // Get the length of users array
```

## 🚀 Performance Standards

### Code Performance ✅ IMPLEMENTED

#### Async/Await Best Practices

```typescript
// ✅ Good: Parallel execution when possible
async function loadUserData(userId: string) {
	const [user, chats, preferences] = await Promise.all([
		userService.getUserById(userId),
		chatService.getChatsByUserId(userId),
		userService.getUserPreferences(userId),
	])

	return { user, chats, preferences }
}

// ❌ Bad: Sequential execution when parallel is possible
async function loadUserDataBad(userId: string) {
	const user = await userService.getUserById(userId)
	const chats = await chatService.getChatsByUserId(userId)
	const preferences = await userService.getUserPreferences(userId)

	return { user, chats, preferences }
}
```

#### Memory Management

```typescript
// ✅ Good: Proper cleanup and resource management
class DatabaseConnection {
	private connection: Connection | null = null

	async connect(): Promise<void> {
		this.connection = await createConnection()
	}

	async disconnect(): Promise<void> {
		if (this.connection) {
			await this.connection.close()
			this.connection = null
		}
	}

	// Ensure cleanup on process exit
	setupCleanup(): void {
		process.on('SIGINT', () => this.disconnect())
		process.on('SIGTERM', () => this.disconnect())
	}
}
```

### Bundle Size Optimization ✅ IMPLEMENTED

```typescript
// ✅ Good: Tree-shakable imports
import { debounce } from 'lodash-es/debounce'
import { format } from 'date-fns/format'

// ❌ Bad: Full library imports
import _ from 'lodash'
import * as dateFns from 'date-fns'

// ✅ Good: Dynamic imports for code splitting
const LazyComponent = React.lazy(() => import('./heavy-component'))

// ✅ Good: Conditional imports
async function loadAnalytics() {
	if (process.env.NODE_ENV === 'production') {
		const { analytics } = await import('./analytics')
		return analytics
	}
	return null
}
```

## 🔒 Security Standards

### Input Validation ✅ ENFORCED

```typescript
// ✅ Good: Zod schema validation
const createUserSchema = z.object({
	name: z.string().min(1).max(100),
	email: z.email(),
	age: z.number().int().min(13).max(120),
})

async function createUser(input: unknown): Promise<Result<User>> {
	const [validatedInput, validationError] = await tryCatch(
		createUserSchema.parseAsync(input),
		'createUser.validation',
	)

	if (validationError) {
		return [null, new ValidationError('Invalid user data', { input })]
	}

	// Proceed with validated input
	return userService.create(validatedInput)
}
```

### Data Sanitization ✅ IMPLEMENTED

```typescript
// ✅ Good: Sanitize sensitive data in logs
function sanitizeUserData(user: User): Partial<User> {
	return {
		id: user.id,
		name: user.name,
		// Exclude sensitive fields like email, phone, etc.
	}
}

logger.info({ user: sanitizeUserData(user) }, 'User created successfully')
```

## 📚 Related Documentation

- **[Testing Strategy](./testing-strategy.md)** - Comprehensive testing approaches and patterns
- **[Error Handling](./error-handling.md)** - Go-style error handling implementation
- **[API Development](./api-development.md)** - API design and development standards
- **[Monorepo Management](./monorepo-management.md)** - Workspace and dependency management
- **[Merge Strategy](../operations/merge-strategy.md)** - Code review and merge processes
