/**
 * API Integration Testing Examples
 *
 * Demonstrates comprehensive API integration testing using real database and HTTP requests.
 * These tests verify the complete request/response cycle including middleware, validation,
 * database operations, and error handling.
 *
 * Features demonstrated:
 * - Full HTTP request/response testing with SuperTest
 * - Real database integration with test containers
 * - Authentication and authorization testing
 * - Input validation testing
 * - Error scenario testing
 * - Performance testing for API endpoints
 * - Concurrent request handling
 */

/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-non-null-assertion */

import { faker } from '@faker-js/faker'
import { eq } from 'drizzle-orm'
import { Express } from 'express'
import request from 'supertest'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import * as schema from '../../../data-access/schema.ts'
import { createServer } from '../../server.ts'
import {
	cleanupGlobalResources,
	type DatabaseTestContext,
	setupDatabaseIntegration,
} from '../database-integration.ts'

// Test context
let app: Express
let dbContext: DatabaseTestContext

describe('API Integration Testing Examples', () => {
	// Setup real database and Express app
	beforeAll(async () => {
		// Setup database
		dbContext = await setupDatabaseIntegration({
			enableLogging: false,
			runMigrations: true,
			seedTestData: false, // We'll create specific test data per test
		})

		// Create Express app with real database
		// Note: You may need to inject the test database connection
		// This depends on your app's configuration system
		app = createServer()

		console.log('✅ API integration test environment ready')
	}, 30000)

	// Clean up after all tests
	afterAll(async () => {
		await dbContext.cleanup()
		await cleanupGlobalResources()
	}, 10000)

	// Reset database state before each test
	beforeEach(async () => {
		await dbContext.resetDatabase()
	})

	describe('Health Check Endpoints', () => {
		it('should return health status', async () => {
			const response = await request(app).get('/health').expect(200)

			expect(response.body).toMatchObject({
				status: 'healthy',
				timestamp: expect.any(String),
				uptime: expect.any(Number),
			})
		})

		it('should return detailed health check', async () => {
			const response = await request(app).get('/health/detailed').expect(200)

			expect(response.body).toMatchObject({
				status: 'healthy',
				checks: expect.objectContaining({
					database: expect.any(String),
					memory: expect.any(Object),
					uptime: expect.any(Number),
				}),
			})
		})
	})

	describe('User Management API', () => {
		it('should create a new user', async () => {
			const newUser = {
				email: 'api.test@example.com',
				firstName: 'API',
				lastName: 'Test',
			}

			const response = await request(app)
				.post('/api/users')
				.send(newUser)
				.expect(201)

			expect(response.body).toMatchObject({
				success: true,
				data: {
					id: expect.any(String),
					email: newUser.email,
					firstName: newUser.firstName,
					lastName: newUser.lastName,
					emailVerified: false,
					createdAt: expect.any(String),
					updatedAt: expect.any(String),
				},
			})

			// Verify user was actually created in database
			const [dbUser] = await dbContext.db
				.select()
				.from(schema.usersTable)
				.where(eq(schema.usersTable.email, newUser.email))

			expect(dbUser).toBeDefined()
			expect(dbUser?.email).toBe(newUser.email)
		})

		it('should validate user input', async () => {
			const invalidUser = {
				email: 'not-an-email', // Invalid email
				firstName: '', // Empty first name
				// Missing lastName
			}

			const response = await request(app)
				.post('/api/users')
				.send(invalidUser)
				.expect(400)

			expect(response.body).toMatchObject({
				success: false,
				error: {
					code: 'VALIDATION_ERROR',
					message: expect.any(String),
					details: expect.any(Array),
				},
			})

			// Verify no user was created
			const dbUsers = await dbContext.db
				.select()
				.from(schema.usersTable)
				.where(eq(schema.usersTable.email, invalidUser.email))

			expect(dbUsers).toHaveLength(0)
		})

		it('should handle duplicate email addresses', async () => {
			const userData = {
				email: 'duplicate@example.com',
				firstName: 'First',
				lastName: 'User',
			}

			// Create first user
			await request(app).post('/api/users').send(userData).expect(201)

			// Attempt to create duplicate
			const response = await request(app)
				.post('/api/users')
				.send({
					...userData,
					firstName: 'Second', // Different name, same email
				})
				.expect(409)

			expect(response.body).toMatchObject({
				success: false,
				error: {
					code: 'CONFLICT',
					message: expect.stringContaining('email'),
				},
			})
		})

		it('should retrieve user by ID', async () => {
			// Create test user
			const [testUser] = await dbContext.db
				.insert(schema.usersTable)
				.values({
					id: faker.string.uuid(),
					email: 'retrieve.test@example.com',
					emailVerified: true,
					firstName: 'Retrieve',
					lastName: 'Test',
				})
				.returning()

			const response = await request(app)
				.get(`/api/users/${testUser!.id}`)
				.expect(200)

			expect(response.body).toMatchObject({
				success: true,
				data: {
					id: testUser?.id,
					email: testUser?.email,
					firstName: testUser?.firstName,
					lastName: testUser?.lastName,
					emailVerified: testUser?.emailVerified,
				},
			})
		})

		it('should handle user not found', async () => {
			const nonExistentId = faker.string.uuid()

			const response = await request(app)
				.get(`/api/users/${nonExistentId}`)
				.expect(404)

			expect(response.body).toMatchObject({
				success: false,
				error: {
					code: 'NOT_FOUND',
					message: expect.stringContaining('User'),
				},
			})
		})

		it('should update user information', async () => {
			// Create test user
			const [testUser] = await dbContext.db
				.insert(schema.usersTable)
				.values({
					id: faker.string.uuid(),
					email: 'update.test@example.com',
					emailVerified: false,
					firstName: 'Original',
					lastName: 'Name',
				})
				.returning()

			const updates = {
				firstName: 'Updated',
				lastName: 'Name',
				emailVerified: true,
			}

			const response = await request(app)
				.put(`/api/users/${testUser?.id ?? ''}`)
				.send(updates)
				.expect(200)

			expect(response.body).toMatchObject({
				success: true,
				data: {
					id: testUser?.id,
					firstName: updates.firstName,
					lastName: updates.lastName,
					emailVerified: updates.emailVerified,
				},
			})

			// Verify database was updated
			const [updatedUser] = await dbContext.db
				.select()
				.from(schema.usersTable)
				.where(eq(schema.usersTable.id, testUser!.id))

			expect(updatedUser?.firstName).toBe(updates.firstName)
			expect(updatedUser?.emailVerified).toBe(updates.emailVerified)
		})
	})

	describe('Chat Management API', () => {
		let testUser: typeof schema.usersTable.$inferSelect

		beforeEach(async () => {
			// Create test user for chat operations
			const [user] = await dbContext.db
				.insert(schema.usersTable)
				.values({
					id: faker.string.uuid(),
					email: 'chat.test@example.com',
					emailVerified: true,
					firstName: 'Chat',
					lastName: 'Test',
				})
				.returning()

			testUser = user!
		})

		it('should create a new chat', async () => {
			const newChat = {
				title: 'Integration Test Chat',
				userId: testUser.id,
			}

			const response = await request(app)
				.post('/api/chats')
				.send(newChat)
				.expect(201)

			expect(response.body).toMatchObject({
				success: true,
				data: {
					id: expect.any(String),
					title: newChat.title,
					userId: newChat.userId,
					createdAt: expect.any(String),
				},
			})

			// Verify chat was created in database
			const [dbChat] = await dbContext.db
				.select()
				.from(schema.chatsTable)
				.where(eq(schema.chatsTable.title, newChat.title))

			expect(dbChat).toBeDefined()
			expect(dbChat?.userId).toBe(testUser.id)
		})

		it('should retrieve user chats', async () => {
			// Create multiple chats for the user
			const chatTitles = ['Chat 1', 'Chat 2', 'Chat 3']

			for (const title of chatTitles) {
				await dbContext.db.insert(schema.chatsTable).values({
					id: faker.string.uuid(),
					userId: testUser.id,
					title,
				})
			}

			const response = await request(app)
				.get(`/api/users/${testUser.id}/chats`)
				.expect(200)

			expect(response.body).toMatchObject({
				success: true,
				data: expect.arrayContaining([
					expect.objectContaining({
						title: expect.any(String),
						userId: testUser.id,
					}),
				]),
			})

			expect(response.body.data).toHaveLength(3)
		})

		it('should add messages to chat', async () => {
			// Create test chat
			const [testChat] = await dbContext.db
				.insert(schema.chatsTable)
				.values({
					id: faker.string.uuid(),
					userId: testUser.id,
					title: 'Message Test Chat',
				})
				.returning()

			const newMessage = {
				role: 'user' as const,
				content: 'Hello, this is a test message',
			}

			const response = await request(app)
				.post(`/api/chats/${testChat!.id}/messages`)
				.send(newMessage)
				.expect(201)

			expect(response.body).toMatchObject({
				success: true,
				data: {
					id: expect.any(String),
					chatId: testChat?.id,
					role: newMessage.role,
					content: newMessage.content,
					createdAt: expect.any(String),
				},
			})

			// Verify message was created in database
			const [dbMessage] = await dbContext.db
				.select()
				.from(schema.chatMessagesTable)
				.where(eq(schema.chatMessagesTable.chatId, testChat?.id ?? ''))

			expect(dbMessage).toBeDefined()
			expect(dbMessage?.content).toBe(newMessage.content)
		})

		it('should retrieve chat messages', async () => {
			// Create test chat
			const [testChat] = await dbContext.db
				.insert(schema.chatsTable)
				.values({
					id: faker.string.uuid(),
					userId: testUser.id,
					title: 'Messages Test Chat',
				})
				.returning()

			// Create multiple messages
			const messages = [
				{ role: 'user' as const, content: 'First message' },
				{ role: 'assistant' as const, content: 'First response' },
				{ role: 'user' as const, content: 'Second message' },
			]

			for (const message of messages) {
				await dbContext.db.insert(schema.chatMessagesTable).values({
					chatId: testChat?.id ?? '',
					...message,
				})
			}

			const response = await request(app)
				.get(`/api/chats/${testChat?.id ?? ''}/messages`)
				.expect(200)

			expect(response.body).toMatchObject({
				success: true,
				data: expect.arrayContaining([
					expect.objectContaining({
						chatId: testChat?.id,
						role: expect.any(String),
						content: expect.any(String),
					}),
				]),
			})

			expect(response.body.data).toHaveLength(3)

			// Verify messages are in chronological order
			const messageContents = response.body.data.map((m: any) => m.content)
			expect(messageContents).toEqual([
				'First message',
				'First response',
				'Second message',
			])
		})
	})

	describe('Error Handling', () => {
		it('should handle malformed JSON', async () => {
			const response = await request(app)
				.post('/api/users')
				.set('Content-Type', 'application/json')
				.send('{ invalid json }')
				.expect(400)

			expect(response.body).toMatchObject({
				success: false,
				error: {
					code: 'INVALID_JSON',
					message: expect.any(String),
				},
			})
		})

		it('should handle missing Content-Type', async () => {
			const response = await request(app)
				.post('/api/users')
				.send('some text data')
				.expect(400)

			expect(response.body).toMatchObject({
				success: false,
				error: expect.any(Object),
			})
		})

		it('should handle database connection errors', async () => {
			// This test would require mocking database failures
			// or temporarily breaking the database connection
			// Implementation depends on your error handling strategy
			// Example approach: temporarily close the database connection
			// await dbContext.pool.end()
			// const response = await request(app)
			// 	.get('/api/users/123')
			// 	.expect(503)
			// expect(response.body).toMatchObject({
			// 	success: false,
			// 	error: {
			// 		code: 'SERVICE_UNAVAILABLE',
			// 		message: expect.stringContaining('database')
			// 	}
			// })
		})

		it('should handle rate limiting', async () => {
			// Test rate limiting by making multiple rapid requests
			const requests = Array.from({ length: 10 }, () =>
				request(app).get('/health'),
			)

			const responses = await Promise.all(requests)

			// Depending on your rate limiting configuration,
			// some requests should succeed and some might be rate limited
			const successCount = responses.filter((r) => r.status === 200).length

			expect(successCount).toBeGreaterThan(0)
			// Note: Rate limiting behavior depends on your configuration
		})
	})

	describe('Performance Testing', () => {
		it('should handle concurrent requests', async () => {
			const concurrentRequests = 20
			const startTime = performance.now()

			// Create concurrent requests to different endpoints
			const requests = Array.from({ length: concurrentRequests }, (_, i) => {
				if (i % 3 === 0) {
					return request(app).get('/health')
				} else if (i % 3 === 1) {
					return request(app)
						.post('/api/users')
						.send({
							email: `concurrent${i.toString()}@example.com`,
							firstName: `User${i.toString()}`,
							lastName: 'Test',
						})
				} else {
					return request(app).get('/api/users')
				}
			})

			const responses = await Promise.all(requests)
			const endTime = performance.now()
			const totalTime = endTime - startTime

			// Verify all requests completed
			expect(responses).toHaveLength(concurrentRequests)

			// Verify reasonable performance (adjust thresholds as needed)
			expect(totalTime).toBeLessThan(5000) // Should complete within 5 seconds

			// Verify success rates
			const successfulResponses = responses.filter((r) => r.status < 400)
			const successRate = successfulResponses.length / concurrentRequests

			expect(successRate).toBeGreaterThan(0.8) // At least 80% success rate

			console.log(
				`✅ Concurrent test: ${concurrentRequests.toString()} requests in ${totalTime.toFixed(2)}ms`,
			)
			console.log(`   Success rate: ${(successRate * 100).toFixed(1)}%`)
		})

		it('should handle large payloads', async () => {
			const largeContent = 'x'.repeat(10000) // 10KB string

			const startTime = performance.now()

			const response = await request(app).post('/api/chats').send({
				title: largeContent,
				userId: faker.string.uuid(),
			})

			const endTime = performance.now()
			const responseTime = endTime - startTime

			// Should handle large payloads reasonably quickly
			expect(responseTime).toBeLessThan(1000) // Within 1 second

			// Response should indicate success or appropriate error
			expect([200, 201, 400, 413]).toContain(response.status) // Success or expected errors
		})

		it('should measure API response times', async () => {
			const endpoints = [
				{ method: 'GET', path: '/health', expectedStatus: 200 },
				{ method: 'GET', path: '/api/users', expectedStatus: 200 },
				{ method: 'GET', path: '/health/detailed', expectedStatus: 200 },
			]

			const performanceResults = []

			for (const endpoint of endpoints) {
				const iterations = 10
				const times = []

				for (let i = 0; i < iterations; i++) {
					const startTime = performance.now()

					const response = await request(app)[
						endpoint.method.toLowerCase() as 'get'
					](endpoint.path)

					const endTime = performance.now()
					const responseTime = endTime - startTime

					times.push(responseTime)
					expect(response.status).toBe(endpoint.expectedStatus)
				}

				const averageTime =
					times.reduce((sum, time) => sum + time, 0) / times.length
				const minTime = Math.min(...times)
				const maxTime = Math.max(...times)

				performanceResults.push({
					endpoint: `${endpoint.method} ${endpoint.path}`,
					averageTime,
					minTime,
					maxTime,
					iterations,
				})

				// Performance assertions (adjust thresholds as needed)
				expect(averageTime).toBeLessThan(500) // Average under 500ms
				expect(maxTime).toBeLessThan(1000) // Max under 1 second
			}

			console.log('📊 API Performance Results:')
			performanceResults.forEach((result) => {
				console.log(`   ${result.endpoint}:`)
				console.log(`     Average: ${result.averageTime.toFixed(2)}ms`)
				console.log(`     Min: ${result.minTime.toFixed(2)}ms`)
				console.log(`     Max: ${result.maxTime.toFixed(2)}ms`)
			})
		})
	})

	describe('Authentication and Authorization', () => {
		// Note: These tests assume you have authentication middleware
		// Adjust based on your actual authentication implementation

		it('should require authentication for protected endpoints', async () => {
			const response = await request(app)
				.get('/api/users/profile') // Assuming this requires auth
				.expect(401)

			expect(response.body).toMatchObject({
				success: false,
				error: {
					code: 'UNAUTHORIZED',
					message: expect.any(String),
				},
			})
		})

		it('should accept valid authentication tokens', async () => {
			// This test would require creating a valid token
			// Implementation depends on your auth system
			// const validToken = await createTestAuthToken(testUser.id)
			// const response = await request(app)
			// 	.get('/api/users/profile')
			// 	.set('Authorization', `Bearer ${validToken}`)
			// 	.expect(200)
			// expect(response.body).toMatchObject({
			// 	success: true,
			// 	data: expect.objectContaining({
			// 		id: testUser.id
			// 	})
			// })
		})

		it('should reject invalid authentication tokens', async () => {
			const invalidToken = 'invalid.token.here'

			const response = await request(app)
				.get('/api/users/profile')
				.set('Authorization', `Bearer ${invalidToken}`)
				.expect(401)

			expect(response.body).toMatchObject({
				success: false,
				error: {
					code: 'INVALID_TOKEN',
					message: expect.any(String),
				},
			})
		})
	})
})
