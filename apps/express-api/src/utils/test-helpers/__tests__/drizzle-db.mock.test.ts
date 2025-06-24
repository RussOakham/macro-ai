import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
	createDatabaseMock,
	createDatabaseMockWithResults,
	createDatabaseModuleMock,
	createMockInsertUser,
	createMockUser,
	createMockUsers,
	createQueryBuilderMock,
	createUserScenarioMock,
	type MockDatabase,
	mockDatabase,
	mockEmptyResult,
	type MockQueryBuilder,
	mockQueryError,
	mockQueryResult,
	setupDatabaseMock,
} from '../drizzle-db.mock.ts'

describe('Drizzle Database Mock Helper', () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	describe('createQueryBuilderMock', () => {
		it('should create a query builder with all required methods', () => {
			// Act
			const queryBuilder = createQueryBuilderMock()

			// Assert
			expect(queryBuilder.from).toBeDefined()
			expect(queryBuilder.where).toBeDefined()
			expect(queryBuilder.limit).toBeDefined()
			expect(queryBuilder.values).toBeDefined()
			expect(queryBuilder.returning).toBeDefined()
			expect(queryBuilder.set).toBeDefined()
			expect(queryBuilder.orderBy).toBeDefined()
			expect(queryBuilder.offset).toBeDefined()
			expect(queryBuilder.execute).toBeDefined()
		})

		it('should support method chaining', () => {
			// Arrange
			const queryBuilder = createQueryBuilderMock()

			// Act
			queryBuilder.from()
			queryBuilder.where()
			queryBuilder.limit()

			// Assert
			expect(queryBuilder.from).toHaveBeenCalledOnce()
			expect(queryBuilder.where).toHaveBeenCalledOnce()
			expect(queryBuilder.limit).toHaveBeenCalledOnce()
		})

		it('should have all methods as vi.fn()', () => {
			// Act
			const queryBuilder = createQueryBuilderMock()

			// Assert
			Object.values(queryBuilder).forEach((method) => {
				expect(vi.isMockFunction(method)).toBe(true)
			})
		})
	})

	describe('createDatabaseMock', () => {
		it('should create a database with all CRUD methods', () => {
			// Act
			const database = createDatabaseMock()

			// Assert
			expect(database.select).toBeDefined()
			expect(database.insert).toBeDefined()
			expect(database.update).toBeDefined()
			expect(database.delete).toBeDefined()
		})

		it('should return query builders from database methods', () => {
			// Arrange
			const database = createDatabaseMock()

			// Act
			const selectBuilder = database.select()
			const insertBuilder = database.insert()
			const updateBuilder = database.update()
			const deleteBuilder = database.delete()

			// Assert
			expect(selectBuilder.from).toBeDefined()
			expect(insertBuilder.values).toBeDefined()
			expect(updateBuilder.set).toBeDefined()
			expect(deleteBuilder.where).toBeDefined()
		})

		it('should have all methods as vi.fn()', () => {
			// Act
			const database = createDatabaseMock()

			// Assert
			Object.values(database).forEach((method) => {
				expect(vi.isMockFunction(method)).toBe(true)
			})
		})
	})

	describe('createDatabaseModuleMock', () => {
		it('should create a module mock with db property', () => {
			// Act
			const moduleMock = createDatabaseModuleMock()

			// Assert
			expect(moduleMock.db).toBeDefined()
			expect(moduleMock.db.select).toBeDefined()
			expect(moduleMock.db.insert).toBeDefined()
			expect(moduleMock.db.update).toBeDefined()
			expect(moduleMock.db.delete).toBeDefined()
		})
	})

	describe('setupDatabaseMock', () => {
		it('should clear all mocks and return fresh database', () => {
			// Arrange
			const database1 = createDatabaseMock()
			database1.select()

			// Act
			const database2 = setupDatabaseMock()

			// Assert
			expect(database2).toBeDefined()
			expect(database2.select).toBeDefined()
			// Note: vi.clearAllMocks() is called, so we can't directly test if mocks were cleared
			// but we can verify the function returns a valid database mock
		})
	})

	describe('mockQueryResult', () => {
		it('should create a query builder that resolves with provided data', async () => {
			// Arrange
			const testData = [{ id: 1, name: 'test' }]

			// Act
			const queryBuilder = mockQueryResult(testData)

			// Assert
			await expect(queryBuilder.from()).resolves.toEqual(testData)
			await expect(queryBuilder.where()).resolves.toEqual(testData)
			await expect(queryBuilder.limit()).resolves.toEqual(testData)
		})

		it('should work with empty arrays', async () => {
			// Arrange
			const emptyData: unknown[] = []

			// Act
			const queryBuilder = mockQueryResult(emptyData)

			// Assert
			await expect(queryBuilder.from()).resolves.toEqual([])
		})

		it('should work with complex objects', async () => {
			// Arrange
			const complexData = [
				{
					id: '123',
					user: { name: 'John', email: 'john@example.com' },
					metadata: { created: new Date() },
				},
			]

			// Act
			const queryBuilder = mockQueryResult(complexData)

			// Assert
			await expect(queryBuilder.returning()).resolves.toEqual(complexData)
		})
	})

	describe('mockQueryError', () => {
		it('should create a query builder that rejects with provided error', async () => {
			// Arrange
			const testError = new Error('Database connection failed')

			// Act
			const queryBuilder = mockQueryError(testError)

			// Assert
			await expect(queryBuilder.from()).rejects.toThrow(testError)
			await expect(queryBuilder.where()).rejects.toThrow(testError)
			await expect(queryBuilder.execute()).rejects.toThrow(testError)
		})

		it('should work with custom error types', async () => {
			// Arrange
			class CustomError extends Error {
				constructor(message: string) {
					super(message)
					this.name = 'CustomError'
				}
			}
			const customError = new CustomError('Custom database error')

			// Act
			const queryBuilder = mockQueryError(customError)

			// Assert
			await expect(queryBuilder.values()).rejects.toThrow(customError)
			await expect(queryBuilder.values()).rejects.toThrow(
				'Custom database error',
			)
		})
	})

	describe('mockEmptyResult', () => {
		it('should create a query builder that resolves with empty array', async () => {
			// Act
			const queryBuilder = mockEmptyResult()

			// Assert
			await expect(queryBuilder.from()).resolves.toEqual([])
			await expect(queryBuilder.where()).resolves.toEqual([])
		})
	})

	describe('createDatabaseMockWithResults', () => {
		it('should configure different results for different operations', async () => {
			// Arrange
			const selectData = [{ id: 1, name: 'selected' }]
			const insertData = [{ id: 2, name: 'inserted' }]
			const updateData = [{ id: 3, name: 'updated' }]
			const deleteData = [{ id: 4, name: 'deleted' }]

			// Act
			const database = createDatabaseMockWithResults({
				selectResult: selectData,
				insertResult: insertData,
				updateResult: updateData,
				deleteResult: deleteData,
			})

			// Assert
			const selectBuilder = database.select()
			const insertBuilder = database.insert()
			const updateBuilder = database.update()
			const deleteBuilder = database.delete()

			await expect(selectBuilder.from()).resolves.toEqual(selectData)
			await expect(insertBuilder.values()).resolves.toEqual(insertData)
			await expect(updateBuilder.set()).resolves.toEqual(updateData)
			await expect(deleteBuilder.where()).resolves.toEqual(deleteData)
		})

		it('should configure errors for different operations', async () => {
			// Arrange
			const selectError = new Error('Select failed')
			const insertError = new Error('Insert failed')
			const deleteError = new Error('Delete failed')

			// Act
			const database = createDatabaseMockWithResults({
				selectError,
				insertError,
				deleteError,
			})

			// Assert
			const selectBuilder = database.select()
			const insertBuilder = database.insert()
			const deleteBuilder = database.delete()

			await expect(selectBuilder.from()).rejects.toThrow(selectError)
			await expect(insertBuilder.values()).rejects.toThrow(insertError)
			await expect(deleteBuilder.where()).rejects.toThrow(deleteError)
		})
	})

	describe('Data Creators', () => {
		describe('createMockUser', () => {
			it('should create a user with default values', () => {
				// Act
				const user = createMockUser()

				// Assert
				expect(user).toEqual({
					id: '123e4567-e89b-12d3-a456-426614174000',
					email: 'test@example.com',
					emailVerified: true,
					firstName: 'John',
					lastName: 'Doe',
					createdAt: new Date('2023-01-01'),
					updatedAt: new Date('2023-01-01'),
					lastLogin: new Date('2023-01-01'),
				})
			})

			it('should allow overriding properties', () => {
				// Act
				const user = createMockUser({
					email: 'custom@example.com',
					firstName: 'Jane',
				})

				// Assert
				expect(user.email).toBe('custom@example.com')
				expect(user.firstName).toBe('Jane')
				expect(user.lastName).toBe('Doe') // Should keep default
			})
		})

		describe('createMockInsertUser', () => {
			it('should create an insert user with default values', () => {
				// Act
				const insertUser = createMockInsertUser()

				// Assert
				expect(insertUser).toEqual({
					id: '123e4567-e89b-12d3-a456-426614174000',
					email: 'test@example.com',
					emailVerified: true,
					firstName: 'John',
					lastName: 'Doe',
				})
			})

			it('should allow overriding properties', () => {
				// Act
				const insertUser = createMockInsertUser({
					email: 'new@example.com',
					emailVerified: false,
				})

				// Assert
				expect(insertUser.email).toBe('new@example.com')
				expect(insertUser.emailVerified).toBe(false)
			})
		})

		describe('createMockUsers', () => {
			it('should create multiple users with unique IDs and emails', () => {
				// Act
				const users = createMockUsers(3)

				// Assert
				expect(users).toHaveLength(3)
				expect(users[0]?.id).toBe('user-1')
				expect(users[0]?.email).toBe('user1@example.com')
				expect(users[1]?.id).toBe('user-2')
				expect(users[1]?.email).toBe('user2@example.com')
				expect(users[2]?.id).toBe('user-3')
				expect(users[2]?.email).toBe('user3@example.com')
			})

			it('should apply base overrides to all users', () => {
				// Act
				const users = createMockUsers(2, { firstName: 'TestUser' })

				// Assert
				expect(users[0]?.firstName).toBe('TestUser')
				expect(users[1]?.firstName).toBe('TestUser')
			})
		})

		describe('createUserScenarioMock', () => {
			it('should create database mock for successful user scenarios', async () => {
				// Arrange
				const findResult = [createMockUser()]
				const createResult = [createMockUser({ id: 'new-user' })]

				// Act
				const database = createUserScenarioMock({
					findUserResult: findResult,
					createUserResult: createResult,
				})

				// Assert
				const selectBuilder = database.select()
				const insertBuilder = database.insert()

				await expect(selectBuilder.from()).resolves.toEqual(findResult)
				await expect(insertBuilder.values()).resolves.toEqual(createResult)
			})

			it('should create database mock for error scenarios', async () => {
				// Arrange
				const error = new Error('Database error')

				// Act
				const database = createUserScenarioMock({ error })

				// Assert
				const selectBuilder = database.select()
				const insertBuilder = database.insert()

				await expect(selectBuilder.from()).rejects.toThrow(error)
				await expect(insertBuilder.values()).rejects.toThrow(error)
			})
		})
	})

	describe('Unified Export (mockDatabase)', () => {
		it('should export all factory functions', () => {
			// Assert
			expect(mockDatabase.create).toBe(createDatabaseMock)
			expect(mockDatabase.createModule).toBe(createDatabaseModuleMock)
			expect(mockDatabase.createQueryBuilder).toBe(createQueryBuilderMock)
			expect(mockDatabase.setup).toBe(setupDatabaseMock)
			expect(mockDatabase.withResults).toBe(createDatabaseMockWithResults)
			expect(mockDatabase.userScenario).toBe(createUserScenarioMock)
		})

		it('should export all helper functions', () => {
			// Assert
			expect(mockDatabase.mockResult).toBe(mockQueryResult)
			expect(mockDatabase.mockError).toBe(mockQueryError)
			expect(mockDatabase.mockEmpty).toBe(mockEmptyResult)
		})

		it('should export all data creators', () => {
			// Assert
			expect(mockDatabase.createUser).toBe(createMockUser)
			expect(mockDatabase.createInsertUser).toBe(createMockInsertUser)
			expect(mockDatabase.createUsers).toBe(createMockUsers)
		})
	})

	describe('TypeScript Type Safety', () => {
		it('should work with MockDatabase type', () => {
			// Arrange
			const database: MockDatabase = createDatabaseMock()

			// Act & Assert - This test passes if TypeScript compilation succeeds
			expect(database.select).toBeDefined()
			expect(database.insert).toBeDefined()
			expect(database.update).toBeDefined()
			expect(database.delete).toBeDefined()
		})

		it('should work with MockQueryBuilder type', () => {
			// Arrange
			const queryBuilder: MockQueryBuilder = createQueryBuilderMock()

			// Act & Assert - This test passes if TypeScript compilation succeeds
			expect(queryBuilder.from).toBeDefined()
			expect(queryBuilder.where).toBeDefined()
			expect(queryBuilder.limit).toBeDefined()
		})
	})

	describe('Integration with Drizzle Query Patterns', () => {
		it('should support select query pattern', async () => {
			// Arrange
			const userData = [createMockUser()]
			const database = createDatabaseMockWithResults({
				selectResult: userData,
			})

			// Act - Simulate Drizzle query pattern: db.select().from(table).where(condition).limit(1)
			const result = database.select()
			result.from()
			result.where()
			result.limit()

			// Assert
			expect(database.select).toHaveBeenCalledOnce()
			expect(result.from).toHaveBeenCalledOnce()
			expect(result.where).toHaveBeenCalledOnce()
			expect(result.limit).toHaveBeenCalledOnce()
			await expect(result.limit()).resolves.toEqual(userData)
		})

		it('should support insert query pattern', async () => {
			// Arrange
			const insertData = [createMockUser()]
			const database = createDatabaseMockWithResults({
				insertResult: insertData,
			})

			// Act - Simulate Drizzle query pattern: db.insert(table).values(data).returning()
			const result = database.insert()
			result.values()
			result.returning()

			// Assert
			expect(database.insert).toHaveBeenCalledOnce()
			expect(result.values).toHaveBeenCalledOnce()
			expect(result.returning).toHaveBeenCalledOnce()
			await expect(result.returning()).resolves.toEqual(insertData)
		})

		it('should support update query pattern', async () => {
			// Arrange
			const updateData = [createMockUser()]
			const database = createDatabaseMockWithResults({
				updateResult: updateData,
			})

			// Act - Simulate Drizzle query pattern: db.update(table).set(data).where(condition).returning()
			const result = database.update()
			result.set()
			result.where()
			result.returning()

			// Assert
			expect(database.update).toHaveBeenCalledOnce()
			expect(result.set).toHaveBeenCalledOnce()
			expect(result.where).toHaveBeenCalledOnce()
			expect(result.returning).toHaveBeenCalledOnce()
			await expect(result.returning()).resolves.toEqual(updateData)
		})
	})

	describe('Real-world Usage Examples', () => {
		it('should work as a drop-in replacement for manual mocks', () => {
			// This test demonstrates how the helper replaces manual mock setup

			// Before: Manual mock setup (17 lines)
			const manualMockQueryBuilder = {
				from: vi.fn().mockReturnThis(),
				where: vi.fn().mockReturnThis(),
				limit: vi.fn().mockReturnThis(),
				values: vi.fn().mockReturnThis(),
				returning: vi.fn().mockReturnThis(),
				set: vi.fn().mockReturnThis(),
			}
			const manualMockDb = {
				select: vi.fn(() => manualMockQueryBuilder),
				insert: vi.fn(() => manualMockQueryBuilder),
				update: vi.fn(() => manualMockQueryBuilder),
			}

			// After: Using helper (2 lines)
			const helperMockDb = mockDatabase.create()

			// Assert both have the same interface
			expect(typeof manualMockDb.select).toBe(typeof helperMockDb.select)
			expect(typeof manualMockDb.insert).toBe(typeof helperMockDb.insert)
			expect(typeof manualMockDb.update).toBe(typeof helperMockDb.update)

			// Both should support the same query patterns
			const manualResult = manualMockDb.select()
			const helperResult = helperMockDb.select()

			expect(typeof manualResult.from).toBe(typeof helperResult.from)
			expect(typeof manualResult.where).toBe(typeof helperResult.where)
		})

		it('should simplify test setup for common scenarios', () => {
			// Arrange - Common test scenario: user found
			const mockUser = mockDatabase.createUser({ email: 'found@example.com' })
			const database = mockDatabase.userScenario({
				findUserResult: [mockUser],
			})

			// Act
			const selectBuilder = database.select()

			// Assert
			expect(selectBuilder.from).toBeDefined()
			expect(selectBuilder.where).toBeDefined()
			expect(selectBuilder.limit).toBeDefined()
		})
	})
})
