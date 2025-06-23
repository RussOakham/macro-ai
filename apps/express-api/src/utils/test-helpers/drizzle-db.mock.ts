import { type MockedFunction, vi } from 'vitest'

/**
 * Mock interfaces for Drizzle ORM database operations
 * These interfaces provide type-safe mocking for database queries and operations
 */

/**
 * Mock interface for Drizzle query builder methods
 * Supports method chaining with proper return types
 * Each method is a mock function that can be configured to return this or a promise
 */
interface MockQueryBuilder {
	from: MockedFunction<(...args: unknown[]) => unknown>
	where: MockedFunction<(...args: unknown[]) => unknown>
	limit: MockedFunction<(...args: unknown[]) => unknown>
	values: MockedFunction<(...args: unknown[]) => unknown>
	returning: MockedFunction<(...args: unknown[]) => unknown>
	set: MockedFunction<(...args: unknown[]) => unknown>
	orderBy: MockedFunction<(...args: unknown[]) => unknown>
	offset: MockedFunction<(...args: unknown[]) => unknown>
	execute: MockedFunction<(...args: unknown[]) => unknown>
}

/**
 * Mock interface for the main database instance
 * Provides the core CRUD operation methods
 */
interface MockDatabase {
	select: MockedFunction<() => MockQueryBuilder>
	insert: MockedFunction<() => MockQueryBuilder>
	update: MockedFunction<() => MockQueryBuilder>
	delete: MockedFunction<() => MockQueryBuilder>
}

/**
 * Factory function to create a mock query builder with chainable methods
 * All methods return 'this' to support Drizzle's fluent interface pattern
 * @returns MockQueryBuilder with all methods as vi.fn() that return this
 */
export const createQueryBuilderMock = (): MockQueryBuilder => ({
	from: vi.fn().mockReturnThis(),
	where: vi.fn().mockReturnThis(),
	limit: vi.fn().mockReturnThis(),
	values: vi.fn().mockReturnThis(),
	returning: vi.fn().mockReturnThis(),
	set: vi.fn().mockReturnThis(),
	orderBy: vi.fn().mockReturnThis(),
	offset: vi.fn().mockReturnThis(),
	execute: vi.fn().mockReturnThis(),
})

/**
 * Factory function to create a mock database instance
 * Each method returns a fresh query builder mock to support chaining
 * @returns MockDatabase with methods that return query builders
 */
export const createDatabaseMock = (): MockDatabase => {
	const createQueryBuilder = () => createQueryBuilderMock()

	return {
		select: vi.fn(() => createQueryBuilder()),
		insert: vi.fn(() => createQueryBuilder()),
		update: vi.fn(() => createQueryBuilder()),
		delete: vi.fn(() => createQueryBuilder()),
	}
}

/**
 * Mock factory for vi.mock() calls
 * Creates the complete module mock structure expected by the database module
 * @returns Object with db mock for module mocking
 */
export const createDatabaseModuleMock = () => ({
	db: createDatabaseMock(),
})

/**
 * Setup function for beforeEach hooks
 * Clears all mocks and returns a fresh database mock
 * @returns Fresh MockDatabase instance
 */
export const setupDatabaseMock = (): MockDatabase => {
	vi.clearAllMocks()
	return createDatabaseMock()
}

/**
 * Helper function to create a query builder mock that resolves with specific data
 * Useful for testing successful query scenarios
 * @param data - The data that the query should resolve with
 * @returns Configured query builder mock
 */
export const mockQueryResult = (data: unknown[]): MockQueryBuilder => {
	const queryBuilder = createQueryBuilderMock()

	// Configure all methods to resolve with the provided data
	// This handles the final query execution
	const methods = [
		queryBuilder.from,
		queryBuilder.where,
		queryBuilder.limit,
		queryBuilder.values,
		queryBuilder.returning,
		queryBuilder.set,
		queryBuilder.orderBy,
		queryBuilder.offset,
		queryBuilder.execute,
	]

	methods.forEach((method) => {
		method.mockImplementation(() => Promise.resolve(data))
	})

	return queryBuilder
}

/**
 * Helper function to create a query builder mock that rejects with an error
 * Useful for testing error scenarios
 * @param error - The error that the query should reject with
 * @returns Configured query builder mock
 */
export const mockQueryError = (error: Error): MockQueryBuilder => {
	const queryBuilder = createQueryBuilderMock()

	// Configure all methods to reject with the provided error
	const methods = [
		queryBuilder.from,
		queryBuilder.where,
		queryBuilder.limit,
		queryBuilder.values,
		queryBuilder.returning,
		queryBuilder.set,
		queryBuilder.orderBy,
		queryBuilder.offset,
		queryBuilder.execute,
	]

	methods.forEach((method) => {
		method.mockImplementation(() => Promise.reject(error))
	})

	return queryBuilder
}

/**
 * Helper function to create a query builder mock that resolves with an empty array
 * Useful for testing "not found" scenarios
 * @returns Configured query builder mock
 */
export const mockEmptyResult = (): MockQueryBuilder => {
	return mockQueryResult([])
}

/**
 * Helper function to create a database mock with pre-configured query results
 * Allows setting up different results for different operations
 * @param config - Configuration object for different query types
 * @returns Configured database mock
 */
export const createDatabaseMockWithResults = (config: {
	selectResult?: unknown[]
	insertResult?: unknown[]
	updateResult?: unknown[]
	deleteResult?: unknown[]
	selectError?: Error
	insertError?: Error
	updateError?: Error
	deleteError?: Error
}) => {
	const db = createDatabaseMock()

	// Configure select queries
	if (config.selectResult !== undefined) {
		db.select.mockReturnValue(mockQueryResult(config.selectResult))
	} else if (config.selectError) {
		db.select.mockReturnValue(mockQueryError(config.selectError))
	}

	// Configure insert queries
	if (config.insertResult !== undefined) {
		db.insert.mockReturnValue(mockQueryResult(config.insertResult))
	} else if (config.insertError) {
		db.insert.mockReturnValue(mockQueryError(config.insertError))
	}

	// Configure update queries
	if (config.updateResult !== undefined) {
		db.update.mockReturnValue(mockQueryResult(config.updateResult))
	} else if (config.updateError) {
		db.update.mockReturnValue(mockQueryError(config.updateError))
	}

	// Configure delete queries
	if (config.deleteResult !== undefined) {
		db.delete.mockReturnValue(mockQueryResult(config.deleteResult))
	} else if (config.deleteError) {
		db.delete.mockReturnValue(mockQueryError(config.deleteError))
	}

	return db
}

/**
 * Mock data creators for common database entities
 * These provide consistent test data across different test files
 */

/**
 * Create mock user data for testing
 * @param overrides - Properties to override in the mock user
 * @returns Mock user object with default values
 */
export const createMockUser = (overrides: Record<string, unknown> = {}) => ({
	id: '123e4567-e89b-12d3-a456-426614174000',
	email: 'test@example.com',
	emailVerified: true,
	firstName: 'John',
	lastName: 'Doe',
	createdAt: new Date('2023-01-01'),
	updatedAt: new Date('2023-01-01'),
	lastLogin: new Date('2023-01-01'),
	...overrides,
})

/**
 * Create mock insert user data for testing
 * @param overrides - Properties to override in the mock insert user
 * @returns Mock insert user object with default values
 */
export const createMockInsertUser = (
	overrides: Record<string, unknown> = {},
) => ({
	id: '123e4567-e89b-12d3-a456-426614174000',
	email: 'test@example.com',
	emailVerified: true,
	firstName: 'John',
	lastName: 'Doe',
	...overrides,
})

/**
 * Helper function to create multiple mock users
 * @param count - Number of users to create
 * @param baseOverrides - Base properties to apply to all users
 * @returns Array of mock users with unique IDs
 */
export const createMockUsers = (
	count: number,
	baseOverrides: Record<string, unknown> = {},
) => {
	return Array.from({ length: count }, (_, index) =>
		createMockUser({
			...baseOverrides,
			id: `user-${(index + 1).toString()}`,
			email: `user${(index + 1).toString()}@example.com`,
		}),
	)
}

/**
 * Helper function to create a database mock configured for specific user scenarios
 * @param scenario - The test scenario to configure
 * @returns Configured database mock
 */
export const createUserScenarioMock = (scenario: {
	findUserResult?: unknown[]
	createUserResult?: unknown[]
	updateUserResult?: unknown[]
	error?: Error
}) => {
	if (scenario.error) {
		return createDatabaseMockWithResults({
			selectError: scenario.error,
			insertError: scenario.error,
			updateError: scenario.error,
		})
	}

	return createDatabaseMockWithResults({
		selectResult: scenario.findUserResult ?? [],
		insertResult: scenario.createUserResult ?? [],
		updateResult: scenario.updateUserResult ?? [],
	})
}

/**
 * Unified export object providing all database mock utilities
 * Follows the pattern established by logger.mock.ts and express-mocks.ts
 */
export const mockDatabase = {
	/** Create a basic database mock with all methods */
	create: createDatabaseMock,
	/** Create module mock for vi.mock() calls */
	createModule: createDatabaseModuleMock,
	/** Create query builder mock with chainable methods */
	createQueryBuilder: createQueryBuilderMock,
	/** Setup database mock for beforeEach hooks */
	setup: setupDatabaseMock,
	/** Create database mock with pre-configured results */
	withResults: createDatabaseMockWithResults,
	/** Create database mock for user-specific scenarios */
	userScenario: createUserScenarioMock,

	// Query result helpers
	/** Create query builder that resolves with specific data */
	mockResult: mockQueryResult,
	/** Create query builder that rejects with error */
	mockError: mockQueryError,
	/** Create query builder that resolves with empty array */
	mockEmpty: mockEmptyResult,

	// Data creators
	/** Create mock user data */
	createUser: createMockUser,
	/** Create mock insert user data */
	createInsertUser: createMockInsertUser,
	/** Create multiple mock users */
	createUsers: createMockUsers,
}

// Export types for use in test files
export type { MockDatabase, MockQueryBuilder }
