# Data Access Patterns

This document provides detailed information about the repository pattern implementation and data access
strategies used in the Macro AI user management system.

## 🔧 Current Implementation Status: ✅ COMPLETE

The data access layer is fully implemented and production-ready with repository pattern, Go-style error
handling, and comprehensive Zod validation.

## 🏗️ Repository Pattern Architecture

### Design Principles

The user management data access layer follows these core principles:

- **Repository Pattern** - Clean separation between business logic and data access
- **Dependency Injection** - Testable architecture with injectable dependencies
- **Go-Style Error Handling** - Consistent `[data, error]` tuple patterns
- **Type Safety** - Full TypeScript integration with runtime validation
- **Schema Validation** - Zod schemas for all database operations

### Repository Interface

```typescript
// User repository interface for clean contracts
interface IUserRepository {
	findUserByEmail(params: { email: string }): Promise<Result<TUser | undefined>>
	findUserById(params: { id: string }): Promise<Result<TUser | undefined>>
	createUser(params: { userData: TInsertUser }): Promise<Result<TUser>>
	updateLastLogin(params: { id: string }): Promise<Result<TUser>>
	updateUser(params: {
		id: string
		userData: Partial<TInsertUser>
	}): Promise<Result<TUser>>
}
```

## 📊 Repository Implementation

### Core Repository Class ✅ COMPLETE

```typescript
import { eq } from 'drizzle-orm'
import { db } from '../../data-access/db.ts'
import { tryCatch } from '../../utils/error-handling/try-catch.ts'
import { safeValidateSchema } from '../../utils/response-handlers.ts'
import { selectUserSchema, usersTable } from './user.schemas.ts'
import { IUserRepository, TInsertUser, TUser } from './user.types.ts'

class UserRepository implements IUserRepository {
	private readonly db: typeof db

	constructor(database: typeof db = db) {
		this.db = database
	}

	/**
	 * Find user by email with comprehensive validation
	 */
	public async findUserByEmail({
		email,
	}: {
		email: string
	}): Promise<Result<TUser | undefined>> {
		// Execute database query with error handling
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

		// Handle no results case
		if (!users.length) return [undefined, null]

		// Validate result with Zod schema
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

	/**
	 * Create new user with validation
	 */
	public async createUser({
		userData,
	}: {
		userData: TInsertUser
	}): Promise<Result<TUser>> {
		const [user, error] = await tryCatch(
			this.db.insert(usersTable).values(userData).returning(),
			'userRepository - createUser',
		)

		if (error) {
			return [null, error]
		}

		// Validate returned user
		const [validationResult, validationError] = safeValidateSchema(
			user[0],
			selectUserSchema,
			'userRepository - createUser',
		)

		if (validationError) {
			return [null, validationError]
		}

		return [validationResult, null]
	}

	/**
	 * Update user's last login timestamp
	 */
	public async updateLastLogin({ id }: { id: string }): Promise<Result<TUser>> {
		const [user, error] = await tryCatch(
			this.db
				.update(usersTable)
				.set({ lastLogin: new Date(), updatedAt: new Date() })
				.where(eq(usersTable.id, id))
				.returning(),
			'userRepository - updateLastLogin',
		)

		if (error) {
			return [null, error]
		}

		if (!user.length) {
			return [null, AppError.notFound('User not found')]
		}

		const [validationResult, validationError] = safeValidateSchema(
			user[0],
			selectUserSchema,
			'userRepository - updateLastLogin',
		)

		if (validationError) {
			return [null, validationError]
		}

		return [validationResult, null]
	}
}

// Export singleton instance
const userRepository = new UserRepository()
export { userRepository }
```

## 🔍 Schema Integration

### Drizzle-Zod Integration ✅ COMPLETE

```typescript
// Schema definition with Drizzle
const usersTable = pgTable(
	'users',
	{
		id: uuid('id').primaryKey(),
		email: varchar('email', { length: 255 }).notNull().unique(),
		emailVerified: boolean('email_verified').default(false),
		firstName: varchar('first_name', { length: 255 }),
		lastName: varchar('last_name', { length: 255 }),
		createdAt: timestamp('created_at').defaultNow(),
		updatedAt: timestamp('updated_at').defaultNow(),
		lastLogin: timestamp('last_login'),
	},
	(users) => [uniqueIndex('email_idx').on(users.email)],
)

// Automatic Zod schema generation
const insertUserSchema = createInsertSchema(usersTable)
const selectUserSchema = createSelectSchema(usersTable)

// OpenAPI integration
const userProfileSchema = registerZodSchema(
	'UserProfile',
	selectUserSchema.openapi({ description: 'User profile information' }),
)
```

### Type Definitions ✅ COMPLETE

```typescript
// Generated types from Drizzle schemas
type TUser = typeof usersTable.$inferSelect
type TInsertUser = typeof usersTable.$inferInsert

// Custom types for API responses
type TUserProfile = {
	id: string
	email: string
	emailVerified: boolean
	firstName?: string
	lastName?: string
	createdAt: Date
	updatedAt: Date
	lastLogin?: Date
}
```

## 🔄 Service Layer Integration

### Business Logic Layer ✅ COMPLETE

```typescript
import { userRepository } from './user.data-access.ts'
import { tryCatch } from '../../utils/error-handling/try-catch.ts'

class UserService {
	/**
	 * Register or login user with comprehensive error handling
	 */
	public async registerOrLoginUserById({
		id,
		email,
	}: {
		id: string
		email: string
	}): Promise<Result<TUser>> {
		// Try to find existing user
		const [existingUser, findError] = await userRepository.findUserById({ id })

		if (findError) {
			return [null, findError]
		}

		if (existingUser) {
			// Update last login for existing user
			const [updatedUser, updateError] = await userRepository.updateLastLogin({
				id,
			})
			if (updateError) {
				return [null, updateError]
			}
			return [updatedUser, null]
		}

		// Create new user
		const [newUser, createError] = await userRepository.createUser({
			userData: { id, email },
		})

		if (createError) {
			return [null, createError]
		}

		return [newUser, null]
	}

	/**
	 * Get user profile by ID
	 */
	public async getUserById({ id }: { id: string }): Promise<Result<TUser>> {
		const [user, error] = await userRepository.findUserById({ id })

		if (error) {
			return [null, error]
		}

		if (!user) {
			return [null, AppError.notFound('User not found')]
		}

		return [user, null]
	}
}

// Export singleton instance
const userService = new UserService()
export { userService }
```

## 🛡️ Error Handling Patterns

### Go-Style Error Handling ✅ COMPLETE

All data access operations use consistent error handling patterns:

```typescript
// Repository method with error handling
public async findUserById({ id }: { id: string }): Promise<Result<TUser | undefined>> {
  const [users, error] = await tryCatch(
    this.db.select().from(usersTable).where(eq(usersTable.id, id)).limit(1),
    'userRepository - findUserById',
  )

  if (error) {
    // Error is automatically logged with context
    return [null, error]
  }

  // Handle empty results
  if (!users.length) return [undefined, null]

  // Validate with schema
  const [validationResult, validationError] = safeValidateSchema(
    users[0],
    selectUserSchema,
    'userRepository - findUserById',
  )

  if (validationError) {
    return [null, validationError]
  }

  return [validationResult, null]
}
```

### Error Propagation ✅ COMPLETE

Errors bubble up through service layers with context preservation:

```typescript
// Service layer error handling
const [user, error] = await userRepository.findUserById({ id })

if (error) {
	// Error context is preserved from repository layer
	return [null, error]
}

// Continue with business logic
return [user, null]
```

## 🧪 Testing Patterns

### Repository Testing Strategy 📋 PLANNED

```typescript
// Planned test structure
describe('UserRepository', () => {
	let testDb: typeof db

	beforeAll(async () => {
		// Set up test database connection
		testDb = createTestDatabase()
	})

	afterAll(async () => {
		// Clean up test database
		await cleanupTestDatabase(testDb)
	})

	it('should create and retrieve user with valid schema', async () => {
		const repository = new UserRepository(testDb)

		// Create user
		const userData = {
			id: 'test-id',
			email: 'test@example.com',
		}
		const [created, createError] = await repository.createUser({ userData })

		expect(createError).toBeNull()
		expect(created).toBeDefined()
		expect(created?.id).toEqual(userData.id)

		// Retrieve user
		const [found, findError] = await repository.findUserById({
			id: 'test-id',
		})

		expect(findError).toBeNull()
		expect(found).toBeDefined()
		expect(found?.id).toEqual(userData.id)
	})

	it('should handle validation errors properly', async () => {
		const repository = new UserRepository(testDb)

		// Attempt to create user with invalid data
		const invalidData = { email: 'invalid-email' }
		const [result, error] = await repository.createUser({
			userData: invalidData as TInsertUser,
		})

		expect(result).toBeNull()
		expect(error).toBeInstanceOf(AppError)
		expect(error?.type).toBe('VALIDATION_ERROR')
	})
})
```

### Mock Strategy ✅ COMPLETE

```typescript
// Mock repository for service testing
const mockUserRepository = {
	findUserById: vi.fn(),
	findUserByEmail: vi.fn(),
	createUser: vi.fn(),
	updateLastLogin: vi.fn(),
	updateUser: vi.fn(),
} satisfies Partial<IUserRepository>

// Service testing with mocked repository
describe('UserService', () => {
	it('should handle user registration flow', async () => {
		// Mock repository responses
		mockUserRepository.findUserById.mockResolvedValue([undefined, null])
		mockUserRepository.createUser.mockResolvedValue([mockUser, null])

		const service = new UserService(mockUserRepository as IUserRepository)
		const [result, error] = await service.registerOrLoginUserById({
			id: 'test-id',
			email: 'test@example.com',
		})

		expect(error).toBeNull()
		expect(result).toEqual(mockUser)
		expect(mockUserRepository.createUser).toHaveBeenCalledWith({
			userData: { id: 'test-id', email: 'test@example.com' },
		})
	})
})
```

## 🎯 Best Practices

### Repository Design Principles

- **Single Responsibility** - Each repository handles one entity
- **Interface Segregation** - Clean interfaces for testability
- **Dependency Injection** - Constructor injection for flexibility
- **Error Consistency** - Go-style error handling throughout
- **Type Safety** - Full TypeScript integration with validation

### Performance Optimization

- **Connection Pooling** - Efficient database connection management
- **Query Optimization** - Use Drizzle's query builder efficiently
- **Batch Operations** - Group related operations when possible
- **Index Usage** - Leverage database indexes for performance
- **Validation Caching** - Cache Zod schema validation where appropriate

## 🔗 Related Documentation

- **[Database Design](../../architecture/database-design.md)** - Overall database architecture
- **[User Management Overview](./README.md)** - Complete user management system
- **[Profile Management](./profile-management.md)** - User profile operations
- **[Testing Strategy](../../development/testing-strategy.md)** - Testing approaches

---

**Implementation Status**: ✅ Complete and Production Ready  
**Last Updated**: July 2025
