/**
 * Advanced Mocking & Stubbing Test Examples
 *
 * Demonstrates comprehensive usage of advanced mocking utilities including:
 * - Time-based testing with controllable timers
 * - Database transaction testing with rollback capabilities
 * - Advanced error simulation and injection
 * - Contract testing with request/response validation
 * - Mock data factories with realistic patterns
 * - Performance testing with controlled delays
 */

/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/require-await */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-floating-promises */
/* eslint-disable @typescript-eslint/restrict-template-expressions */

import { faker } from '@faker-js/faker'
import { eq } from 'drizzle-orm'
import {
	afterAll,
	afterEach,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
	vi,
} from 'vitest'

import * as schema from '../../../data-access/schema.ts'
import {
	ContractTester,
	ErrorSimulator,
	MockDataFactory,
	PerformanceTester,
	TimeController,
	TransactionTester,
} from '../advanced-mocking.ts'
import {
	cleanupGlobalResources,
	type DatabaseTestContext,
	setupDatabaseIntegration,
} from '../database-integration.ts'

describe('Advanced Mocking & Stubbing Examples', () => {
	let dbContext: DatabaseTestContext
	let timeController: TimeController
	let transactionTester: TransactionTester
	let errorSimulator: ErrorSimulator
	let contractTester: ContractTester
	let performanceTester: PerformanceTester

	beforeAll(async () => {
		dbContext = await setupDatabaseIntegration()
		transactionTester = new TransactionTester(dbContext.db, dbContext.pool)
		performanceTester = new PerformanceTester()
	})

	afterAll(async () => {
		await cleanupGlobalResources()
	})

	beforeEach(() => {
		timeController = new TimeController()
		errorSimulator = new ErrorSimulator()
		contractTester = new ContractTester()
	})

	afterEach(() => {
		timeController.stop()
		errorSimulator.stop()
		performanceTester.clearResults()
	})

	// ============================================================================
	// Time-Based Testing Examples
	// ============================================================================

	describe('Time-Based Testing', () => {
		it('should control time for scheduled operations', async () => {
			timeController.start()

			const startTime = timeController.getTime()
			const scheduledTime = new Date(startTime.getTime() + 5000) // 5 seconds later

			// Simulate a scheduled operation
			const operation = vi.fn()
			setTimeout(operation, 5000)

			// Verify operation hasn't run yet
			expect(operation).not.toHaveBeenCalled()

			// Advance time by 5 seconds
			timeController.advance(5000)

			// Verify operation has run
			expect(operation).toHaveBeenCalledOnce()
		})

		it('should handle recurring timers', async () => {
			timeController.start()

			const recurringOperation = vi.fn()
			const interval = setInterval(recurringOperation, 1000)

			// Advance time by 3 seconds
			timeController.advance(3000)

			// Verify operation ran 3 times
			expect(recurringOperation).toHaveBeenCalledTimes(3)

			clearInterval(interval)
		})

		it('should test time-dependent business logic', async () => {
			timeController.start()

			// Mock a service that depends on time
			const timeService = {
				getCurrentTime: () => timeController.getTime(),
				isBusinessHours: () => {
					const hour = timeController.getTime().getHours()
					return hour >= 9 && hour < 17
				},
			}

			// Set time to business hours
			timeController.setTime(new Date('2024-01-15T10:00:00Z'))
			expect(timeService.isBusinessHours()).toBe(true)

			// Set time to after hours
			timeController.setTime(new Date('2024-01-15T18:00:00Z'))
			expect(timeService.isBusinessHours()).toBe(false)
		})

		it('should test expiration logic', async () => {
			timeController.start()

			const expirationTime = 30000 // 30 seconds
			const startTime = timeController.getTime()

			const isExpired = () => {
				const now = timeController.getTime()
				return now.getTime() - startTime.getTime() > expirationTime
			}

			// Initially not expired
			expect(isExpired()).toBe(false)

			// Advance time by 25 seconds - still not expired
			timeController.advance(25000)
			expect(isExpired()).toBe(false)

			// Advance time by 10 more seconds - now expired
			timeController.advance(10000)
			expect(isExpired()).toBe(true)
		})
	})

	// ============================================================================
	// Database Transaction Testing Examples
	// ============================================================================

	describe('Database Transaction Testing', () => {
		it('should test transaction rollback on error', async () => {
			await transactionTester.withTransaction(async (client) => {
				// Create a user within transaction
				const user = MockDataFactory.createUser()
				await dbContext.db.insert(schema.usersTable).values(user)

				// Verify user exists within transaction
				const [createdUser] = await dbContext.db
					.select()
					.from(schema.usersTable)
					.where(eq(schema.usersTable.id, user.id))

				expect(createdUser).toBeDefined()
				expect(createdUser?.id).toBe(user.id)

				// Simulate an error to trigger rollback
				throw new Error('Simulated transaction error')
			})

			// Verify user was not persisted after rollback
			const [rolledBackUser] = await dbContext.db
				.select()
				.from(schema.usersTable)
				.where(eq(schema.usersTable.id, MockDataFactory.createUser().id))

			expect(rolledBackUser).toBeUndefined()
		})

		it('should test concurrent transactions', async () => {
			const user1 = MockDataFactory.createUser()
			const user2 = MockDataFactory.createUser()

			const results = await transactionTester.testConcurrentTransactions([
				async (client) => {
					await dbContext.db.insert(schema.usersTable).values(user1)
					return user1.id
				},
				async (client) => {
					await dbContext.db.insert(schema.usersTable).values(user2)
					return user2.id
				},
			])

			expect(results).toHaveLength(2)
			expect(results[0]).toBe(user1.id)
			expect(results[1]).toBe(user2.id)

			// Verify both users were created
			const [createdUser1] = await dbContext.db
				.select()
				.from(schema.usersTable)
				.where(eq(schema.usersTable.id, user1.id))

			const [createdUser2] = await dbContext.db
				.select()
				.from(schema.usersTable)
				.where(eq(schema.usersTable.id, user2.id))

			expect(createdUser1).toBeDefined()
			expect(createdUser2).toBeDefined()
		})

		it('should test transaction isolation', async () => {
			const user = MockDataFactory.createUser()

			// Start first transaction
			const transaction1 = transactionTester.withTransaction(
				async (client1) => {
					await dbContext.db.insert(schema.usersTable).values(user)

					// Start second transaction in parallel
					const transaction2 = transactionTester.withTransaction(
						async (client2) => {
							// This should not see the user from transaction1 due to isolation
							const [userInTxn2] = await dbContext.db
								.select()
								.from(schema.usersTable)
								.where(eq(schema.usersTable.id, user.id))

							return userInTxn2
						},
					)

					const userInTxn2 = await transaction2
					expect(userInTxn2).toBeUndefined()

					return user
				},
			)

			const result = await transaction1
			expect(result).toBeDefined()
		})
	})

	// ============================================================================
	// Error Simulation Examples
	// ============================================================================

	describe('Error Simulation', () => {
		it('should simulate network errors', () => {
			errorSimulator.start()

			const networkService = {
				fetchData: errorSimulator.wrapWithErrorSimulation(
					async () => ({ data: 'success' }),
					'network',
				),
			}

			// Test with high error probability
			errorSimulator.options.probability = 1.0

			expect(async () => {
				await networkService.fetchData()
			}).rejects.toThrow('Network connection failed')
		})

		it('should simulate database errors', () => {
			errorSimulator.start()

			const dbService = {
				query: errorSimulator.wrapWithErrorSimulation(
					async () => ({ rows: [] }),
					'database',
				),
			}

			// Test with high error probability
			errorSimulator.options.probability = 1.0

			expect(async () => {
				await dbService.query()
			}).rejects.toThrow('Database operation failed')
		})

		it('should simulate validation errors', () => {
			errorSimulator.start()

			const validationService = {
				validate: errorSimulator.wrapWithErrorSimulation(
					(data: any) => ({ valid: true, data }),
					'validation',
				),
			}

			// Test with high error probability
			errorSimulator.options.probability = 1.0

			expect(() => {
				validationService.validate({})
			}).toThrow('Validation error occurred')
		})

		it('should test error recovery mechanisms', async () => {
			errorSimulator.start()

			let attemptCount = 0
			const maxRetries = 3

			const resilientService = {
				operation: async () => {
					attemptCount++

					// Simulate error on first two attempts
					if (attemptCount <= 2) {
						errorSimulator.simulateError('network', 'Temporary network issue')
					}

					return { success: true, attempt: attemptCount }
				},
			}

			// Test retry logic
			let result
			for (let i = 0; i < maxRetries; i++) {
				try {
					result = await resilientService.operation()
					break
				} catch (error) {
					if (i === maxRetries - 1) throw error
					// Wait before retry (simulated)
					await new Promise((resolve) => setTimeout(resolve, 100))
				}
			}

			expect(result).toBeDefined()
			expect(result?.attempt).toBe(3)
		})
	})

	// ============================================================================
	// Contract Testing Examples
	// ============================================================================

	describe('Contract Testing', () => {
		beforeEach(() => {
			// Register API contracts
			contractTester.registerContract({
				name: 'createUser',
				requestSchema: {
					type: 'object',
					required: ['email', 'firstName', 'lastName'],
					properties: {
						email: { type: 'string', format: 'email' },
						firstName: { type: 'string' },
						lastName: { type: 'string' },
					},
				},
				responseSchema: {
					type: 'object',
					required: ['id', 'email', 'firstName', 'lastName'],
					properties: {
						id: { type: 'string' },
						email: { type: 'string' },
						firstName: { type: 'string' },
						lastName: { type: 'string' },
					},
				},
				expectedStatusCodes: [201],
			})

			contractTester.registerContract({
				name: 'getUser',
				responseSchema: {
					type: 'object',
					required: ['id', 'email'],
					properties: {
						id: { type: 'string' },
						email: { type: 'string' },
					},
				},
				expectedStatusCodes: [200, 404],
			})
		})

		it('should validate request contracts', () => {
			const validRequest = {
				email: 'test@example.com',
				firstName: 'John',
				lastName: 'Doe',
			}

			const invalidRequest = {
				email: 'invalid-email',
				// Missing required fields
			}

			expect(contractTester.validateRequest('createUser', validRequest)).toBe(
				true,
			)
			expect(contractTester.validateRequest('createUser', invalidRequest)).toBe(
				false,
			)
		})

		it('should validate response contracts', () => {
			const validResponse = {
				status: 201,
				data: {
					id: 'user-123',
					email: 'test@example.com',
					firstName: 'John',
					lastName: 'Doe',
				},
			}

			const invalidResponse = {
				status: 500,
				data: {
					// Missing required fields
				},
			}

			expect(contractTester.validateResponse('createUser', validResponse)).toBe(
				true,
			)
			expect(
				contractTester.validateResponse('createUser', invalidResponse),
			).toBe(false)
		})

		it('should test complete contract validation', async () => {
			const request = {
				email: 'test@example.com',
				firstName: 'John',
				lastName: 'Doe',
			}

			const response = {
				status: 201,
				data: {
					id: 'user-123',
					email: 'test@example.com',
					firstName: 'John',
					lastName: 'Doe',
				},
			}

			const isValid = await contractTester.testContract(
				'createUser',
				request,
				response,
			)
			expect(isValid).toBe(true)
		})

		it('should test custom validation logic', async () => {
			contractTester.registerContract({
				name: 'customValidation',
				customValidation: (request, response) => {
					// Custom business logic validation
					return request.email === response.data.email
				},
			})

			const request = { email: 'test@example.com' }
			const response = { data: { email: 'test@example.com' } }

			const isValid = await contractTester.testContract(
				'customValidation',
				request,
				response,
			)
			expect(isValid).toBe(true)
		})
	})

	// ============================================================================
	// Mock Data Factory Examples
	// ============================================================================

	describe('Mock Data Factory', () => {
		it('should create realistic user data', () => {
			const user = MockDataFactory.createUser()

			expect(user).toHaveProperty('id')
			expect(user).toHaveProperty('email')
			expect(user).toHaveProperty('firstName')
			expect(user).toHaveProperty('lastName')
			expect(user).toHaveProperty('createdAt')
			expect(user).toHaveProperty('updatedAt')

			expect(typeof user.id).toBe('string')
			expect(user.email).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)
			expect(typeof user.firstName).toBe('string')
			expect(typeof user.lastName).toBe('string')
		})

		it('should create data with custom overrides', () => {
			const customUser = MockDataFactory.createUser({
				email: 'custom@example.com',
				firstName: 'Custom',
			})

			expect(customUser.email).toBe('custom@example.com')
			expect(customUser.firstName).toBe('Custom')
			expect(customUser.lastName).toBeDefined() // Should still have default value
		})

		it('should create arrays of mock data', () => {
			const users = MockDataFactory.createArray(
				() => MockDataFactory.createUser(),
				5,
				{ firstName: 'Batch' },
			)

			expect(users).toHaveLength(5)
			users.forEach((user) => {
				expect(user.firstName).toBe('Batch')
				expect(user.email).toBeDefined()
			})
		})

		it('should create realistic chat data', () => {
			const chat = MockDataFactory.createChat()

			expect(chat).toHaveProperty('id')
			expect(chat).toHaveProperty('title')
			expect(chat).toHaveProperty('userId')
			expect(chat).toHaveProperty('createdAt')
			expect(chat).toHaveProperty('updatedAt')

			expect(typeof chat.id).toBe('string')
			expect(typeof chat.title).toBe('string')
			expect(typeof chat.userId).toBe('string')
		})

		it('should create realistic message data', () => {
			const message = MockDataFactory.createMessage()

			expect(message).toHaveProperty('id')
			expect(message).toHaveProperty('content')
			expect(message).toHaveProperty('role')
			expect(message).toHaveProperty('chatId')
			expect(message).toHaveProperty('createdAt')

			expect(typeof message.id).toBe('string')
			expect(typeof message.content).toBe('string')
			expect(['user', 'assistant', 'system']).toContain(message.role)
		})

		it('should create API responses', () => {
			const data = { id: '123', name: 'Test' }
			const response = MockDataFactory.createApiResponse(data)

			expect(response).toHaveProperty('success', true)
			expect(response).toHaveProperty('data', data)
			expect(response).toHaveProperty('timestamp')
		})

		it('should create error responses', () => {
			const errorResponse = MockDataFactory.createErrorResponse(
				'Test error',
				'TEST_ERROR',
				400,
			)

			expect(errorResponse).toHaveProperty('success', false)
			expect(errorResponse).toHaveProperty('error')
			expect(errorResponse.error).toHaveProperty('message', 'Test error')
			expect(errorResponse.error).toHaveProperty('code', 'TEST_ERROR')
			expect(errorResponse.error).toHaveProperty('status', 400)
		})
	})

	// ============================================================================
	// Performance Testing Examples
	// ============================================================================

	describe('Performance Testing', () => {
		it('should measure operation performance', async () => {
			const operation = async () => {
				// Simulate some work
				await new Promise((resolve) => setTimeout(resolve, 10))
				return { result: 'success' }
			}

			const results = await performanceTester.runPerformanceTest(
				'testOperation',
				operation,
				{ iterations: 10, warmup: 2 },
			)

			expect(results.results).toHaveLength(10)
			expect(results.summary.avgDuration).toBeGreaterThan(0)
			expect(results.summary.minDuration).toBeGreaterThan(0)
			expect(results.summary.maxDuration).toBeGreaterThan(0)
			expect(results.summary.throughput).toBeGreaterThan(0)
		})

		it('should measure memory usage', async () => {
			const memoryIntensiveOperation = async () => {
				// Create some objects to use memory
				const data = Array.from({ length: 1000 }, (_, i) => ({
					id: i,
					data: faker.lorem.paragraph(),
				}))
				return data
			}

			const results = await performanceTester.runPerformanceTest(
				'memoryTest',
				memoryIntensiveOperation,
				{ iterations: 5, warmup: 1, measureMemory: true },
			)

			expect(results.results).toHaveLength(5)
			expect(results.summary.avgMemory).toBeDefined()
			expect(results.summary.avgMemory).toBeGreaterThan(0)
		})

		it('should compare performance of different implementations', async () => {
			const implementation1 = async () => {
				// Simulate slower implementation
				await new Promise((resolve) => setTimeout(resolve, 20))
				return 'implementation1'
			}

			const implementation2 = async () => {
				// Simulate faster implementation
				await new Promise((resolve) => setTimeout(resolve, 5))
				return 'implementation2'
			}

			const results1 = await performanceTester.runPerformanceTest(
				'implementation1',
				implementation1,
				{ iterations: 5 },
			)

			const results2 = await performanceTester.runPerformanceTest(
				'implementation2',
				implementation2,
				{ iterations: 5 },
			)

			expect(results1.summary.avgDuration).toBeGreaterThan(
				results2.summary.avgDuration,
			)
			expect(results2.summary.throughput).toBeGreaterThan(
				results1.summary.throughput,
			)
		})

		it('should track performance over time', async () => {
			const operation = async () => {
				// Simulate operation with varying performance
				const delay = Math.random() * 20 + 5
				await new Promise((resolve) => setTimeout(resolve, delay))
				return { delay }
			}

			const results = await performanceTester.runPerformanceTest(
				'timeSeriesTest',
				operation,
				{ iterations: 10 },
			)

			expect(results.results).toHaveLength(10)

			// Verify results are ordered by timestamp
			const timestamps = results.results.map((r) => r.timestamp.getTime())
			for (let i = 1; i < timestamps.length; i++) {
				expect(timestamps[i]).toBeGreaterThanOrEqual(timestamps[i - 1])
			}
		})
	})

	// ============================================================================
	// Integration Examples
	// ============================================================================

	describe('Advanced Mocking Integration', () => {
		it('should combine time control with error simulation', async () => {
			timeController.start()
			errorSimulator.start()

			const service = {
				retryOperation: async () => {
					const maxRetries = 3
					let attempt = 0

					while (attempt < maxRetries) {
						try {
							// Simulate operation that might fail
							if (errorSimulator.shouldSimulateError()) {
								errorSimulator.simulateError('network')
							}

							return { success: true, attempt: attempt + 1 }
						} catch (error) {
							attempt++
							if (attempt >= maxRetries) throw error

							// Wait before retry - use fake timers
							await new Promise((resolve) => setTimeout(resolve, 1000))
							timeController.advance(1000) // Fast-forward time
						}
					}
				},
			}

			// Set high error probability
			errorSimulator.options.probability = 0.8

			// Test retry logic with time control
			const result = await service.retryOperation()
			expect(result.success).toBe(true)
			expect(result.attempt).toBeGreaterThan(1)
		}, 10000)

		it('should test complex business logic with multiple mocking utilities', async () => {
			timeController.start()
			errorSimulator.start()

			// Register contract
			contractTester.registerContract({
				name: 'userRegistration',
				requestSchema: { type: 'object', required: ['email'] },
				responseSchema: { type: 'object', required: ['id', 'email'] },
				expectedStatusCodes: [201],
			})

			const userService = {
				registerUser: async (userData: any) => {
					// Simulate validation
					if (errorSimulator.shouldSimulateError()) {
						errorSimulator.simulateError('validation')
					}

					// Simulate network delay - use fake timers
					await new Promise((resolve) => setTimeout(resolve, 100))
					timeController.advance(100)

					// Simulate database operation
					if (errorSimulator.shouldSimulateError()) {
						errorSimulator.simulateError('database')
					}

					const user = MockDataFactory.createUser(userData)

					// Simulate email sending
					setTimeout(() => {
						console.log(`Email sent to ${user.email}`)
					}, 5000)

					return user
				},
			}

			// Set low error probability for successful test
			errorSimulator.options.probability = 0.1

			const userData = { email: 'test@example.com' }
			const result = await userService.registerUser(userData)

			// Verify contract compliance
			const contractValid = await contractTester.testContract(
				'userRegistration',
				userData,
				{ status: 201, data: result },
			)
			expect(contractValid).toBe(true)

			// Advance time to trigger email sending
			timeController.advance(5000)
			await timeController.waitForTimers()

			expect(result).toBeDefined()
			expect(result.email).toBe(userData.email)
		}, 10000)
	})
})
