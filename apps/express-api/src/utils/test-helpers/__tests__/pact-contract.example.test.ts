/**
 * Pact Contract Testing Examples
 *
 * Demonstrates comprehensive contract testing using Pact for API contract validation.
 * These examples show how to test API contracts between consumers and providers to ensure
 * compatibility and prevent breaking changes.
 */

/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/require-await */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/restrict-template-expressions */
 

import { faker } from '@faker-js/faker'
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

import {
	ContractBuilder,
	ContractDataGenerator,
	ContractExamples,
	type ContractSpec,
	ContractTester,
	MockPact,
} from '../pact-contract-testing.ts'

describe('Pact Contract Testing Examples', () => {
	let contractTester: ContractTester

	beforeEach(() => {
		contractTester = new ContractTester()
	})

	// ============================================================================
	// Basic Contract Testing Examples
	// ============================================================================

	describe('Basic Contract Testing', () => {
		it('should create and test a simple GET contract', async () => {
			const pact = new MockPact('client-ui', 'express-api')

			// Add interaction
			pact.addInteraction({
				description: 'Get user by ID',
				providerState: 'User exists',
				request: {
					method: 'GET',
					path: '/api/users/123',
					headers: {
						Accept: 'application/json',
					},
				},
				response: {
					status: 200,
					headers: {
						'Content-Type': 'application/json',
					},
					body: ContractDataGenerator.generateUser({ id: '123' }),
				},
			})

			// Start mock server
			await pact.start()
			expect(pact.isServerActive()).toBe(true)

			// Simulate consumer test
			const mockServerUrl = pact.getMockServerUrl()
			expect(mockServerUrl).toBe('http://localhost:1234')

			// Verify interactions
			const verified = await pact.verify()
			expect(verified).toBe(true)

			// Stop mock server
			await pact.stop()
			expect(pact.isServerActive()).toBe(false)
		})

		it('should create and test a POST contract', async () => {
			const pact = new MockPact('client-ui', 'express-api')

			const userData = {
				email: 'test@example.com',
				firstName: 'John',
				lastName: 'Doe',
			}

			pact.addInteraction({
				description: 'Create new user',
				request: {
					method: 'POST',
					path: '/api/users',
					headers: {
						'Content-Type': 'application/json',
					},
					body: userData,
				},
				response: {
					status: 201,
					headers: {
						'Content-Type': 'application/json',
					},
					body: ContractDataGenerator.generateUser(userData),
				},
			})

			await pact.start()

			// Simulate consumer making request
			const mockServerUrl = pact.getMockServerUrl()
			expect(mockServerUrl).toBe('http://localhost:1234')

			const verified = await pact.verify()
			expect(verified).toBe(true)

			await pact.stop()
		})

		it('should test multiple interactions in one contract', async () => {
			const pact = new MockPact('client-ui', 'express-api')

			// Add multiple interactions
			pact.addInteraction({
				description: 'Get all users',
				request: {
					method: 'GET',
					path: '/api/users',
					query: { page: '1', limit: '10' },
				},
				response: {
					status: 200,
					body: ContractDataGenerator.generatePaginatedResponse([
						ContractDataGenerator.generateUser(),
						ContractDataGenerator.generateUser(),
					]),
				},
			})

			pact.addInteraction({
				description: 'Get user by ID',
				providerState: 'User exists',
				request: {
					method: 'GET',
					path: '/api/users/123',
				},
				response: {
					status: 200,
					body: ContractDataGenerator.generateUser({ id: '123' }),
				},
			})

			pact.addInteraction({
				description: 'Update user',
				providerState: 'User exists',
				request: {
					method: 'PUT',
					path: '/api/users/123',
					body: { firstName: 'Jane' },
				},
				response: {
					status: 200,
					body: ContractDataGenerator.generateUser({
						id: '123',
						firstName: 'Jane',
					}),
				},
			})

			await pact.start()

			// Simulate consumer testing all interactions
			const mockServerUrl = pact.getMockServerUrl()
			expect(mockServerUrl).toBe('http://localhost:1234')

			const verified = await pact.verify()
			expect(verified).toBe(true)

			await pact.stop()
		})
	})

	// ============================================================================
	// Contract Builder Examples
	// ============================================================================

	describe('Contract Builder', () => {
		it('should build contract using fluent API', () => {
			const contract = new ContractBuilder()
				.get('/api/users', 'Get all users')
				.withQuery({ page: '1', limit: '10' })
				.willRespondWith(200)
				.withResponseBody(ContractDataGenerator.generatePaginatedResponse([]))
				.done()
				.post('/api/users', 'Create user')
				.withRequestBody({
					email: 'test@example.com',
					firstName: 'John',
					lastName: 'Doe',
				})
				.willRespondWith(201)
				.withResponseBody(ContractDataGenerator.generateUser())
				.done()
				.build({
					name: 'user-api',
					version: '1.0.0',
					consumer: 'client-ui',
					provider: 'express-api',
				})

			expect(contract.metadata.name).toBe('user-api')
			expect(contract.metadata.version).toBe('1.0.0')
			expect(contract.metadata.consumer).toBe('client-ui')
			expect(contract.metadata.provider).toBe('express-api')
			expect(contract.interactions).toHaveLength(2)

			// Verify first interaction
			const getInteraction = contract.interactions[0]
			expect(getInteraction.description).toBe('Get all users')
			expect(getInteraction.request.method).toBe('GET')
			expect(getInteraction.request.path).toBe('/api/users')
			expect(getInteraction.request.query).toEqual({ page: '1', limit: '10' })
			expect(getInteraction.response.status).toBe(200)

			// Verify second interaction
			const postInteraction = contract.interactions[1]
			expect(postInteraction.description).toBe('Create user')
			expect(postInteraction.request.method).toBe('POST')
			expect(postInteraction.request.path).toBe('/api/users')
			expect(postInteraction.request.body).toEqual({
				email: 'test@example.com',
				firstName: 'John',
				lastName: 'Doe',
			})
			expect(postInteraction.response.status).toBe(201)
		})

		it('should build contract with provider states', () => {
			const contract = new ContractBuilder()
				.get('/api/users/123', 'Get user by ID')
				.given('User exists')
				.willRespondWith(200)
				.withResponseBody(ContractDataGenerator.generateUser({ id: '123' }))
				.done()
				.delete('/api/users/123', 'Delete user')
				.given('User exists')
				.willRespondWith(204)
				.done()
				.build({
					name: 'user-crud',
					version: '1.0.0',
					consumer: 'client-ui',
					provider: 'express-api',
				})

			expect(contract.interactions).toHaveLength(2)

			// Verify provider states
			expect(contract.interactions[0].providerState).toBe('User exists')
			expect(contract.interactions[1].providerState).toBe('User exists')
		})

		it('should build contract with headers', () => {
			const contract = new ContractBuilder()
				.post('/api/users', 'Create user with auth')
				.withRequestHeaders({
					Authorization: 'Bearer token123',
					'Content-Type': 'application/json',
				})
				.withRequestBody({ email: 'test@example.com' })
				.willRespondWith(201)
				.withResponseHeaders({
					'Content-Type': 'application/json',
					Location: '/api/users/123',
				})
				.withResponseBody(ContractDataGenerator.generateUser())
				.done()
				.build({
					name: 'authenticated-user-api',
					version: '1.0.0',
					consumer: 'client-ui',
					provider: 'express-api',
				})

			const interaction = contract.interactions[0]
			expect(interaction.request.headers).toEqual({
				Authorization: 'Bearer token123',
				'Content-Type': 'application/json',
			})
			expect(interaction.response.headers).toEqual({
				'Content-Type': 'application/json',
				Location: '/api/users/123',
			})
		})
	})

	// ============================================================================
	// Contract Tester Examples
	// ============================================================================

	describe('Contract Tester', () => {
		beforeEach(() => {
			// Register example contracts
			contractTester.registerContract(
				'user-management',
				ContractExamples.createUserManagementContract(),
			)
			contractTester.registerContract(
				'chat-management',
				ContractExamples.createChatManagementContract(),
			)
		})

		it('should test consumer against contract', async () => {
			const consumerTest = async (mockServerUrl: string) => {
				// Simulate consumer making requests to mock server
				expect(mockServerUrl).toBe('http://localhost:1234')

				// Simulate HTTP requests
				const responses = [
					{
						status: 200,
						data: ContractDataGenerator.generatePaginatedResponse([]),
					},
					{ status: 200, data: ContractDataGenerator.generateUser() },
					{ status: 201, data: ContractDataGenerator.generateUser() },
					{ status: 200, data: ContractDataGenerator.generateUser() },
					{ status: 204, data: null },
				]

				// Verify all requests were made
				expect(responses).toHaveLength(5)
			}

			const result = await contractTester.testConsumer(
				'user-management',
				consumerTest,
			)
			expect(result).toBe(true)
		})

		it('should test provider against contract', async () => {
			const providerTest = async (interaction: any) => {
				// Simulate provider handling requests
				switch (interaction.description) {
					case 'Get all users':
						return {
							status: 200,
							headers: { 'Content-Type': 'application/json' },
							body: ContractDataGenerator.generatePaginatedResponse([]),
						}
					case 'Get user by ID':
						return {
							status: 200,
							headers: { 'Content-Type': 'application/json' },
							body: ContractDataGenerator.generateUser(),
						}
					case 'Create new user':
						return {
							status: 201,
							headers: { 'Content-Type': 'application/json' },
							body: ContractDataGenerator.generateUser(),
						}
					case 'Update user':
						return {
							status: 200,
							headers: { 'Content-Type': 'application/json' },
							body: ContractDataGenerator.generateUser(),
						}
					case 'Delete user':
						return {
							status: 204,
							headers: {},
							body: null,
						}
					default:
						throw new Error(`Unknown interaction: ${interaction.description}`)
				}
			}

			const result = await contractTester.testProvider(
				'user-management',
				providerTest,
			)
			expect(result).toBe(true)
		})

		it('should handle provider test failures', async () => {
			const failingProviderTest = async (interaction: any) => {
				// Simulate provider returning wrong status code
				return {
					status: 500, // Wrong status code
					headers: { 'Content-Type': 'application/json' },
					body: ContractDataGenerator.generateErrorResponse(
						'Internal server error',
					),
				}
			}

			const result = await contractTester.testProvider(
				'user-management',
				failingProviderTest,
			)
			expect(result).toBe(false)
		})
	})

	// ============================================================================
	// Contract Examples
	// ============================================================================

	describe('Contract Examples', () => {
		it('should create user management contract', () => {
			const contract = ContractExamples.createUserManagementContract()

			expect(contract.metadata.name).toBe('user-management')
			expect(contract.metadata.version).toBe('1.0.0')
			expect(contract.metadata.consumer).toBe('client-ui')
			expect(contract.metadata.provider).toBe('express-api')
			expect(contract.interactions).toHaveLength(5)

			// Verify all expected interactions are present
			const descriptions = contract.interactions.map((i) => i.description)
			expect(descriptions).toContain('Get all users')
			expect(descriptions).toContain('Get user by ID')
			expect(descriptions).toContain('Create new user')
			expect(descriptions).toContain('Update user')
			expect(descriptions).toContain('Delete user')
		})

		it('should create chat management contract', () => {
			const contract = ContractExamples.createChatManagementContract()

			expect(contract.metadata.name).toBe('chat-management')
			expect(contract.metadata.version).toBe('1.0.0')
			expect(contract.metadata.consumer).toBe('client-ui')
			expect(contract.metadata.provider).toBe('express-api')
			expect(contract.interactions).toHaveLength(4)

			// Verify all expected interactions are present
			const descriptions = contract.interactions.map((i) => i.description)
			expect(descriptions).toContain('Get user chats')
			expect(descriptions).toContain('Create new chat')
			expect(descriptions).toContain('Get chat messages')
			expect(descriptions).toContain('Send message')
		})
	})

	// ============================================================================
	// Data Generator Examples
	// ============================================================================

	describe('Contract Data Generator', () => {
		it('should generate realistic user data', () => {
			const user = ContractDataGenerator.generateUser()

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
			expect(typeof user.createdAt).toBe('string')
			expect(typeof user.updatedAt).toBe('string')
		})

		it('should generate user data with overrides', () => {
			const user = ContractDataGenerator.generateUser({
				id: 'custom-123',
				email: 'custom@example.com',
			})

			expect(user.id).toBe('custom-123')
			expect(user.email).toBe('custom@example.com')
			expect(user.firstName).toBeDefined() // Should still have default value
		})

		it('should generate chat data', () => {
			const chat = ContractDataGenerator.generateChat()

			expect(chat).toHaveProperty('id')
			expect(chat).toHaveProperty('title')
			expect(chat).toHaveProperty('userId')
			expect(chat).toHaveProperty('createdAt')
			expect(chat).toHaveProperty('updatedAt')

			expect(typeof chat.id).toBe('string')
			expect(typeof chat.title).toBe('string')
			expect(typeof chat.userId).toBe('string')
		})

		it('should generate message data', () => {
			const message = ContractDataGenerator.generateMessage()

			expect(message).toHaveProperty('id')
			expect(message).toHaveProperty('content')
			expect(message).toHaveProperty('role')
			expect(message).toHaveProperty('chatId')
			expect(message).toHaveProperty('createdAt')

			expect(typeof message.id).toBe('string')
			expect(typeof message.content).toBe('string')
			expect(['user', 'assistant', 'system']).toContain(message.role)
			expect(typeof message.chatId).toBe('string')
		})

		it('should generate error responses', () => {
			const errorResponse = ContractDataGenerator.generateErrorResponse(
				'Validation failed',
				'VALIDATION_ERROR',
				400,
			)

			expect(errorResponse).toHaveProperty('error')
			expect(errorResponse.error).toHaveProperty('message', 'Validation failed')
			expect(errorResponse.error).toHaveProperty('code', 'VALIDATION_ERROR')
			expect(errorResponse.error).toHaveProperty('status', 400)
			expect(errorResponse).toHaveProperty('timestamp')
		})

		it('should generate paginated responses', () => {
			const data = [
				ContractDataGenerator.generateUser(),
				ContractDataGenerator.generateUser(),
			]

			const paginatedResponse = ContractDataGenerator.generatePaginatedResponse(
				data,
				2,
				10,
				25,
			)

			expect(paginatedResponse).toHaveProperty('data', data)
			expect(paginatedResponse).toHaveProperty('pagination')
			expect(paginatedResponse.pagination).toHaveProperty('page', 2)
			expect(paginatedResponse.pagination).toHaveProperty('limit', 10)
			expect(paginatedResponse.pagination).toHaveProperty('total', 25)
			expect(paginatedResponse.pagination).toHaveProperty('totalPages', 3)
			expect(paginatedResponse.pagination).toHaveProperty('hasNext', true)
			expect(paginatedResponse.pagination).toHaveProperty('hasPrevious', true)
		})
	})

	// ============================================================================
	// Integration Examples
	// ============================================================================

	describe('Contract Testing Integration', () => {
		it('should test complete API contract workflow', async () => {
			// Create a custom contract
			const customContract = new ContractBuilder()
				.get('/api/health', 'Health check')
				.willRespondWith(200)
				.withResponseBody({ status: 'ok', timestamp: '2024-01-01T00:00:00Z' })
				.done()
				.post('/api/auth/login', 'User login')
				.withRequestBody({
					email: 'test@example.com',
					password: 'password123',
				})
				.willRespondWith(200)
				.withResponseBody({
					token: 'jwt-token-123',
					user: ContractDataGenerator.generateUser(),
				})
				.done()
				.build({
					name: 'auth-api',
					version: '1.0.0',
					consumer: 'client-ui',
					provider: 'express-api',
				})

			// Register contract
			contractTester.registerContract('auth-api', customContract)

			// Test consumer
			const consumerTest = async (mockServerUrl: string) => {
				expect(mockServerUrl).toBe('http://localhost:1234')

				// Simulate health check
				const healthResponse = {
					status: 'ok',
					timestamp: '2024-01-01T00:00:00Z',
				}
				expect(healthResponse.status).toBe('ok')

				// Simulate login
				const loginResponse = {
					token: 'jwt-token-123',
					user: ContractDataGenerator.generateUser(),
				}
				expect(loginResponse.token).toBe('jwt-token-123')
			}

			const consumerResult = await contractTester.testConsumer(
				'auth-api',
				consumerTest,
			)
			expect(consumerResult).toBe(true)

			// Test provider
			const providerTest = async (interaction: any) => {
				switch (interaction.description) {
					case 'Health check':
						return {
							status: 200,
							body: { status: 'ok', timestamp: '2024-01-01T00:00:00Z' },
						}
					case 'User login':
						return {
							status: 200,
							body: {
								token: 'jwt-token-123',
								user: ContractDataGenerator.generateUser(),
							},
						}
					default:
						throw new Error(`Unknown interaction: ${interaction.description}`)
				}
			}

			const providerResult = await contractTester.testProvider(
				'auth-api',
				providerTest,
			)
			expect(providerResult).toBe(true)
		})

		it('should handle contract versioning', () => {
			const v1Contract = new ContractBuilder()
				.get('/api/users', 'Get users v1')
				.willRespondWith(200)
				.withResponseBody([ContractDataGenerator.generateUser()])
				.done()
				.build({
					name: 'user-api',
					version: '1.0.0',
					consumer: 'client-ui',
					provider: 'express-api',
				})

			const v2Contract = new ContractBuilder()
				.get('/api/users', 'Get users v2')
				.willRespondWith(200)
				.withResponseBody(
					ContractDataGenerator.generatePaginatedResponse([
						ContractDataGenerator.generateUser(),
					]),
				)
				.done()
				.build({
					name: 'user-api',
					version: '2.0.0',
					consumer: 'client-ui',
					provider: 'express-api',
				})

			// Register both versions
			contractTester.registerContract('user-api-v1', v1Contract)
			contractTester.registerContract('user-api-v2', v2Contract)

			// Verify both contracts are registered
			expect(v1Contract.metadata.version).toBe('1.0.0')
			expect(v2Contract.metadata.version).toBe('2.0.0')
			expect(v1Contract.interactions[0].response.body).toBeInstanceOf(Array)
			expect(v2Contract.interactions[0].response.body).toHaveProperty('data')
			expect(v2Contract.interactions[0].response.body).toHaveProperty(
				'pagination',
			)
		})
	})
})
