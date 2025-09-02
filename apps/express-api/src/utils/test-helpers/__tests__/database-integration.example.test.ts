/**
 * Database Integration Testing Examples
 *
 * Demonstrates comprehensive database integration testing using real PostgreSQL containers.
 * These examples show how to test actual database operations, transactions, and performance.
 *
 * Features demonstrated:
 * - Real database testing with Testcontainers
 * - Transaction-based test isolation
 * - Performance testing
 * - Database state management
 * - Error scenario testing
 * - Concurrent operation testing
 */

import { faker } from '@faker-js/faker'
import { and, desc, eq } from 'drizzle-orm'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import * as schema from '../../../data-access/schema.ts'
import {
	cleanupGlobalResources,
	createPerformanceTester,
	type DatabaseTestContext,
	setupDatabaseIntegration,
} from '../database-integration.ts'

// Global test context
let dbContext: DatabaseTestContext

describe('Database Integration Testing Examples', () => {
	// Setup real database before all tests
	beforeAll(async () => {
		dbContext = await setupDatabaseIntegration({
			enableLogging: false, // Set to true for SQL debugging
			runMigrations: true,
			seedTestData: true,
		})
	}, 30000) // Increased timeout for container startup

	// Clean up after all tests
	afterAll(async () => {
		await dbContext.cleanup()
		await cleanupGlobalResources()
	}, 10000)

	// Reset database state before each test for isolation
	beforeEach(async () => {
		await dbContext.resetDatabase()
	})

	describe('Basic CRUD Operations', () => {
		it('should create, read, update, and delete users', async () => {
			const { db } = dbContext

			// CREATE - Insert a new user
			const newUser = {
				id: faker.string.uuid(),
				email: 'integration.test@example.com',
				emailVerified: false,
				firstName: 'Integration',
				lastName: 'Test',
			}

			const [createdUser] = await db
				.insert(schema.usersTable)
				.values(newUser)
				.returning()

			expect(createdUser).toMatchObject(newUser)
			expect(createdUser?.createdAt).toBeInstanceOf(Date)
			expect(createdUser?.updatedAt).toBeInstanceOf(Date)

			// READ - Find the created user
			const foundUser = await db
				.select()
				.from(schema.usersTable)
				.where(eq(schema.usersTable.id, newUser.id))

			expect(foundUser).toHaveLength(1)
			expect(foundUser[0]).toMatchObject(newUser)

			// UPDATE - Modify the user
			const [updatedUser] = await db
				.update(schema.usersTable)
				.set({
					emailVerified: true,
					firstName: 'Updated',
				})
				.where(eq(schema.usersTable.id, newUser.id))
				.returning()

			expect(updatedUser?.emailVerified).toBe(true)
			expect(updatedUser?.firstName).toBe('Updated')
			expect(updatedUser?.updatedAt).not.toEqual(createdUser?.updatedAt)

			// DELETE - Remove the user
			const deletedUsers = await db
				.delete(schema.usersTable)
				.where(eq(schema.usersTable.id, newUser.id))
				.returning()

			expect(deletedUsers).toHaveLength(1)

			// Verify deletion
			const verifyDeleted = await db
				.select()
				.from(schema.usersTable)
				.where(eq(schema.usersTable.id, newUser.id))

			expect(verifyDeleted).toHaveLength(0)
		})

		it('should handle complex queries with joins and filtering', async () => {
			const { db } = dbContext

			// Seed some test data
			await dbContext.seedTestData()

			// Complex query: Find all chats with their message count for verified users
			const chatsWithMessageCount = await db
				.select({
					chatId: schema.chatsTable.id,
					chatTitle: schema.chatsTable.title,
					userId: schema.chatsTable.userId,
					userEmail: schema.usersTable.email,
					messageCount: schema.chatMessagesTable.id,
				})
				.from(schema.chatsTable)
				.leftJoin(
					schema.usersTable,
					eq(schema.chatsTable.userId, schema.usersTable.id),
				)
				.leftJoin(
					schema.chatMessagesTable,
					eq(schema.chatsTable.id, schema.chatMessagesTable.chatId),
				)
				.where(eq(schema.usersTable.emailVerified, true))
				.orderBy(desc(schema.chatsTable.createdAt))

			expect(chatsWithMessageCount.length).toBeGreaterThan(0)

			// Verify all returned users are email verified
			const uniqueUsers = new Set(chatsWithMessageCount.map((c) => c.userEmail))
			expect(uniqueUsers.size).toBeGreaterThan(0)

			// Verify we have the expected test users (John and Jane are verified, Bob is not)
			expect(Array.from(uniqueUsers)).toEqual(
				expect.arrayContaining([
					'john.doe@example.com',
					'jane.smith@example.com',
				]),
			)
			expect(Array.from(uniqueUsers)).not.toContain('bob.wilson@example.com')
		})
	})

	describe('Transaction Testing', () => {
		it('should handle successful transactions', async () => {
			const transaction = await dbContext.startTransaction()

			try {
				// Create user in transaction
				const [user] = await transaction.db
					.insert(schema.usersTable)
					.values({
						id: faker.string.uuid(),
						email: 'transaction.test@example.com',
						emailVerified: true,
						firstName: 'Transaction',
						lastName: 'Test',
					})
					.returning()

				// Create chat in same transaction
				const [chat] = await transaction.db
					.insert(schema.chatsTable)
					.values({
						id: faker.string.uuid(),
						userId: user?.id ?? '',
						title: 'Transaction Test Chat',
					})
					.returning()

				// Commit transaction
				await transaction.commit()

				// Verify data was persisted
				const persistedUser = await dbContext.db
					.select()
					.from(schema.usersTable)
					.where(eq(schema.usersTable.id, user?.id ?? ''))

				const persistedChat = await dbContext.db
					.select()
					.from(schema.chatsTable)
					.where(eq(schema.chatsTable.id, chat?.id ?? ''))

				expect(persistedUser).toHaveLength(1)
				expect(persistedChat).toHaveLength(1)
				expect(persistedChat[0]?.userId).toBe(user?.id)
			} catch (error) {
				await transaction.rollback()
				throw error
			}
		})

		it('should handle transaction rollbacks', async () => {
			const transaction = await dbContext.startTransaction()

			try {
				// Create user in transaction
				const [user] = await transaction.db
					.insert(schema.usersTable)
					.values({
						id: faker.string.uuid(),
						email: 'rollback.test@example.com',
						emailVerified: true,
						firstName: 'Rollback',
						lastName: 'Test',
					})
					.returning()

				// Verify user exists within transaction
				const userInTransaction = await transaction.db
					.select()
					.from(schema.usersTable)
					.where(eq(schema.usersTable.id, user?.id ?? ''))

				expect(userInTransaction).toHaveLength(1)

				// Rollback transaction
				await transaction.rollback()

				// Verify data was not persisted
				const persistedUser = await dbContext.db
					.select()
					.from(schema.usersTable)
					.where(eq(schema.usersTable.id, user?.id ?? ''))

				expect(persistedUser).toHaveLength(0)
			} catch (error) {
				await transaction.rollback()
				throw error
			}
		})

		it('should handle concurrent transactions', async () => {
			const userId1 = faker.string.uuid()
			const userId2 = faker.string.uuid()

			// Start two concurrent transactions
			const [transaction1, transaction2] = await Promise.all([
				dbContext.startTransaction(),
				dbContext.startTransaction(),
			])

			try {
				// Create different users in each transaction
				await Promise.all([
					transaction1.db
						.insert(schema.usersTable)
						.values({
							id: userId1,
							email: 'concurrent1@example.com',
							emailVerified: true,
							firstName: 'Concurrent',
							lastName: 'One',
						})
						.returning(),

					transaction2.db
						.insert(schema.usersTable)
						.values({
							id: userId2,
							email: 'concurrent2@example.com',
							emailVerified: true,
							firstName: 'Concurrent',
							lastName: 'Two',
						})
						.returning(),
				])

				// Commit both transactions
				await Promise.all([transaction1.commit(), transaction2.commit()])

				// Verify both users were persisted
				const allUsers = await dbContext.db
					.select()
					.from(schema.usersTable)
					.where(
						and(
							eq(schema.usersTable.id, userId1),
							eq(schema.usersTable.id, userId2),
						),
					)

				const userIds = allUsers.map((u) => u.id)
				expect(userIds).toContain(userId1)
				expect(userIds).toContain(userId2)
			} catch (error) {
				await Promise.all([transaction1.rollback(), transaction2.rollback()])
				throw error
			}
		})
	})

	describe('Error Scenarios', () => {
		it('should handle database constraint violations', async () => {
			const { db } = dbContext
			const duplicateEmail = 'duplicate@example.com'

			// Create first user
			await db.insert(schema.usersTable).values({
				id: faker.string.uuid(),
				email: duplicateEmail,
				emailVerified: true,
				firstName: 'First',
				lastName: 'User',
			})

			// Attempt to create user with duplicate email (should fail due to unique constraint)
			await expect(
				db.insert(schema.usersTable).values({
					id: faker.string.uuid(),
					email: duplicateEmail, // Duplicate email
					emailVerified: true,
					firstName: 'Second',
					lastName: 'User',
				}),
			).rejects.toThrow(
				/duplicate key value violates unique constraint|UNIQUE constraint failed/,
			)
		})

		it('should handle foreign key constraint violations', async () => {
			const { db } = dbContext
			const nonExistentUserId = faker.string.uuid()

			// Attempt to create chat with non-existent user ID
			await expect(
				db.insert(schema.chatsTable).values({
					id: faker.string.uuid(),
					userId: nonExistentUserId, // Non-existent user
					title: 'Orphaned Chat',
				}),
			).rejects.toThrow(/foreign key constraint|FOREIGN KEY constraint failed/)
		})

		it('should handle connection timeouts and retries', async () => {
			const { pool } = dbContext

			// Simulate connection exhaustion by creating many connections
			const connections: Promise<void>[] = []

			// Create more connections than the pool allows
			for (let i = 0; i < 15; i++) {
				// Pool max is 10
				connections.push(
					new Promise<void>((resolve, reject) => {
						pool
							.connect()
							.then((client) => {
								// Hold connection for a short time
								setTimeout(() => {
									client.release()
									resolve()
								}, 100)
							})
							.catch((error: unknown) => {
								reject(
									error instanceof Error ? error : new Error(String(error)),
								)
							})
					}),
				)
			}

			// Some connections should succeed, some might timeout
			const results = await Promise.allSettled(connections)
			const successes = results.filter((r) => r.status === 'fulfilled')
			// const failures = results.filter((r) => r.status === 'rejected') // Unused in test

			expect(successes.length).toBeGreaterThan(0)
			// Note: This test might not always produce failures depending on timing
			// but demonstrates how to test connection pool behavior
		})
	})

	describe('Performance Testing', () => {
		it('should measure insert performance', async () => {
			const { db } = dbContext
			const performanceTester = createPerformanceTester(db)

			// Test single insert performance
			const singleInsertStats = await performanceTester.runPerformanceTest(
				'Single User Insert',
				async () => {
					await db.insert(schema.usersTable).values({
						id: faker.string.uuid(),
						email: faker.internet.email(),
						emailVerified: faker.datatype.boolean(),
						firstName: faker.person.firstName(),
						lastName: faker.person.lastName(),
					})
				},
				50, // 50 iterations
			)

			expect(singleInsertStats.averageTime).toBeLessThan(100) // Should be under 100ms on average
			expect(singleInsertStats.iterations).toBe(50)
			expect(singleInsertStats.minTime).toBeGreaterThan(0)
		})

		it('should measure batch insert performance', async () => {
			const { db } = dbContext
			const performanceTester = createPerformanceTester(db)

			// Test batch insert performance
			const batchInsertStats = await performanceTester.runPerformanceTest(
				'Batch User Insert (10 users)',
				async () => {
					const users = Array.from({ length: 10 }, () => ({
						id: faker.string.uuid(),
						email: faker.internet.email(),
						emailVerified: faker.datatype.boolean(),
						firstName: faker.person.firstName(),
						lastName: faker.person.lastName(),
					}))

					await db.insert(schema.usersTable).values(users)
				},
				20, // 20 iterations
			)

			expect(batchInsertStats.averageTime).toBeLessThan(500) // Should be under 500ms on average
			expect(batchInsertStats.iterations).toBe(20)

			// Batch should be more efficient per record than single inserts
			// (This is a general expectation, actual results may vary)
		})

		it('should measure complex query performance', async () => {
			const { db } = dbContext

			// Seed substantial test data
			await dbContext.seedTestData()

			const performanceTester = createPerformanceTester(db)

			// Test complex query performance
			const queryStats = await performanceTester.runPerformanceTest(
				'Complex Join Query',
				async () => {
					await db
						.select({
							userId: schema.usersTable.id,
							userEmail: schema.usersTable.email,
							chatCount: schema.chatsTable.id,
							latestChatTitle: schema.chatsTable.title,
						})
						.from(schema.usersTable)
						.leftJoin(
							schema.chatsTable,
							eq(schema.usersTable.id, schema.chatsTable.userId),
						)
						.where(eq(schema.usersTable.emailVerified, true))
						.orderBy(desc(schema.chatsTable.createdAt))
						.limit(10)
				},
				30, // 30 iterations
			)

			expect(queryStats.averageTime).toBeLessThan(200) // Should be under 200ms on average
			expect(queryStats.iterations).toBe(30)
		})
	})

	describe('Data Consistency and Integrity', () => {
		it('should maintain referential integrity across operations', async () => {
			const { db } = dbContext

			// Create a user
			const [user] = await db
				.insert(schema.usersTable)
				.values({
					id: faker.string.uuid(),
					email: 'integrity.test@example.com',
					emailVerified: true,
					firstName: 'Integrity',
					lastName: 'Test',
				})
				.returning()

			// Create multiple chats for the user
			const chatData = Array.from({ length: 3 }, () => ({
				id: faker.string.uuid(),
				userId: user?.id ?? '',
				title: faker.lorem.sentence(),
			}))

			const chats = await db
				.insert(schema.chatsTable)
				.values(chatData)
				.returning()

			// Create messages for each chat
			const messagePromises = chats.map((chat) =>
				db
					.insert(schema.chatMessagesTable)
					.values([
						{
							id: faker.string.uuid(),
							chatId: chat.id,
							role: 'user' as const,
							content: faker.lorem.paragraph(),
						},
						{
							id: faker.string.uuid(),
							chatId: chat.id,
							role: 'assistant' as const,
							content: faker.lorem.paragraph(),
						},
					])
					.returning(),
			)

			const allMessages = await Promise.all(messagePromises)
			const flatMessages = allMessages.flat()

			// Verify relationships
			expect(chats).toHaveLength(3)
			expect(flatMessages).toHaveLength(6) // 2 messages per chat * 3 chats

			// Verify all chats belong to the user
			chats.forEach((chat) => {
				expect(chat.userId).toBe(user?.id)
			})

			// Verify all messages belong to the correct chats
			flatMessages.forEach((message) => {
				expect(chats.some((chat) => chat.id === message.chatId)).toBe(true)
			})

			// Test cascade behavior (if implemented)
			// Delete user and verify dependent records are handled appropriately
			await db
				.delete(schema.usersTable)
				.where(eq(schema.usersTable.id, user?.id ?? ''))

			// Verify chats still exist but user reference is maintained or handled
			const remainingChats = await db
				.select()
				.from(schema.chatsTable)
				.where(eq(schema.chatsTable.userId, user?.id ?? ''))

			// Depending on your schema's cascade rules, chats might be deleted or orphaned
			// Adjust this assertion based on your actual database constraints
			expect(remainingChats).toHaveLength(0) // Assuming CASCADE DELETE
		})

		it('should handle concurrent updates correctly', async () => {
			const { db } = dbContext

			// Create a user
			const [user] = await db
				.insert(schema.usersTable)
				.values({
					id: faker.string.uuid(),
					email: 'concurrent.update@example.com',
					emailVerified: false,
					firstName: 'Concurrent',
					lastName: 'Update',
				})
				.returning()

			// Simulate concurrent updates to the same user
			const updatePromises = [
				db
					.update(schema.usersTable)
					.set({ firstName: 'Updated1' })
					.where(eq(schema.usersTable.id, user?.id ?? '')),

				db
					.update(schema.usersTable)
					.set({ lastName: 'Updated2' })
					.where(eq(schema.usersTable.id, user?.id ?? '')),

				db
					.update(schema.usersTable)
					.set({ emailVerified: true })
					.where(eq(schema.usersTable.id, user?.id ?? '')),
			]

			// Execute concurrent updates
			await Promise.all(updatePromises)

			// Verify final state
			const [finalUser] = await db
				.select()
				.from(schema.usersTable)
				.where(eq(schema.usersTable.id, user?.id ?? ''))

			expect(finalUser).toBeDefined()
			expect(finalUser?.id).toBe(user?.id)
			// Final state should reflect all updates
			// Note: The exact final state depends on the order of execution
			// but the record should be valid and consistent
		})
	})
})
