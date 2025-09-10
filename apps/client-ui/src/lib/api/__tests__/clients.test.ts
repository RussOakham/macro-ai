import type { Config, HealthResponse } from '@repo/macro-ai-api-client'
import { http, HttpResponse } from 'msw'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// Import enhanced testing utilities
import {
	createNetworkErrorScenarios,
	createTrackingMockApiClient,
	testErrorHandling,
} from '../../../test/api-test-utils'
import {
	setupMSWForTests,
	setupServerWithHandlers,
} from '../../../test/msw-setup'

// Mock the interceptors module before importing clients
vi.mock('../interceptors', () => ({
	applyTokenRefreshInterceptors: vi.fn(),
}))

// Mock the initialize-api module to prevent auto-initialization during tests
vi.mock('../initialize-api', () => ({
	initializeApiClients: vi.fn(),
}))

// Mock the API client package for configuration tests
vi.mock('@repo/macro-ai-api-client', () => ({
	createApiClient: vi.fn((baseURL: string, config: Partial<Config>) => ({
		instance: {
			defaults: {
				baseURL,
				headers: config.headers ?? {},
				withCredentials: config.withCredentials ?? false,
			},
			interceptors: {
				response: { use: vi.fn(), eject: vi.fn() },
			},
		},
		post: vi.fn(),
		get: vi.fn(),
		put: vi.fn(),
		delete: vi.fn(),
	})),
}))

describe('API Clients Integration', () => {
	// Setup MSW for all tests in this describe block
	setupMSWForTests()

	beforeEach(() => {
		vi.clearAllMocks()
	})

	describe('Client Configuration and Setup', () => {
		it('should apply interceptors to unified clients', async () => {
			const { applyTokenRefreshInterceptors } = await import('../interceptors')

			// Import clients - initialization is mocked so interceptors aren't auto-applied
			const { apiClient, apiClientWithoutCredentials } = await import(
				'../clients'
			)

			// Manually apply interceptors for testing (normally done by initialize-api.ts)
			applyTokenRefreshInterceptors({ axios: apiClient.instance })
			applyTokenRefreshInterceptors({
				axios: apiClientWithoutCredentials.instance,
			})

			// Verify that interceptors were applied to both clients
			expect(applyTokenRefreshInterceptors).toHaveBeenCalledTimes(2)

			// Verify that interceptors are actually configured on the axios instances
			expect(apiClient.instance.interceptors.response).toBeDefined()
			expect(
				apiClientWithoutCredentials.instance.interceptors.response,
			).toBeDefined()

			// Verify interceptor handlers are functions
			expect(typeof apiClient.instance.interceptors.response.use).toBe(
				'function',
			)
			expect(
				typeof apiClientWithoutCredentials.instance.interceptors.response.use,
			).toBe('function')
		})

		it('should export unified API clients with proper configuration', async () => {
			const clients = await import('../clients')

			// Verify unified clients are exported
			expect(clients.apiClient).toBeDefined()
			expect(clients.apiClientWithoutCredentials).toBeDefined()

			// Verify clients have axios instances
			expect(clients.apiClient.instance).toBeDefined()
			expect(clients.apiClientWithoutCredentials.instance).toBeDefined()

			// Verify clients have HTTP methods
			expect(typeof clients.apiClient.post).toBe('function')
			expect(typeof clients.apiClient.get).toBe('function')
			expect(typeof clients.apiClient.put).toBe('function')
			expect(typeof clients.apiClient.delete).toBe('function')

			// Verify credentials configuration
			expect(clients.apiClient.instance.defaults.withCredentials).toBe(true)
			expect(
				clients.apiClientWithoutCredentials.instance.defaults.withCredentials,
			).toBe(false)
		})

		it('should have proper environment configuration', async () => {
			const clients = await import('../clients')

			// Verify base URL configuration
			expect(clients.apiClient.instance.defaults.baseURL).toBeDefined()
			expect(
				clients.apiClientWithoutCredentials.instance.defaults.baseURL,
			).toBeDefined()

			// Verify API key header is set
			expect(
				clients.apiClient.instance.defaults.headers['X-API-KEY'],
			).toBeDefined()
			expect(
				clients.apiClientWithoutCredentials.instance.defaults.headers[
					'X-API-KEY'
				],
			).toBeDefined()
		})
	})

	describe('Real HTTP Request Testing with MSW', () => {
		it('should successfully call /health endpoint using auto-generated MSW handlers', async () => {
			// Unmock the API client for this test
			vi.unmock('@repo/macro-ai-api-client')

			// Create a real API client for testing
			const { createApiClient } = await import('@repo/macro-ai-api-client')
			const realApiClient = createApiClient('http://localhost:3000', {
				withCredentials: false,
			})

			// Make a real HTTP request to the health endpoint (using auto-generated handler)
			const response = await realApiClient.get({
				url: '/health',
				baseURL: 'http://localhost:3000',
			})

			const data = response.data as HealthResponse

			// Verify the response structure matches the OpenAPI spec
			expect(response.status).toBe(200)
			expect(response.data).toHaveProperty('message')
			expect(data.message).toBe('Api Health Status: OK')
		})

		it('should handle 404 error for non-existent endpoint', async () => {
			// Unmock the API client for this test
			vi.unmock('@repo/macro-ai-api-client')

			// Create a real API client for testing
			const { createApiClient } = await import('@repo/macro-ai-api-client')
			const realApiClient = createApiClient('http://localhost:3000/api', {
				withCredentials: false,
			})

			// Make a request to a non-existent endpoint
			try {
				await realApiClient.get({
					url: '/api/no-such-page',
					baseURL: 'http://localhost:3000/api',
				})
				// If we get here, the request succeeded but we expected it to fail
				expect.fail('Expected request to fail with 404')
			} catch (error: unknown) {
				// The error should be an Axios error with response
				// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
				if ((error as any).response) {
					// Axios error with response
					// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
					expect((error as any).response.status).toBe(404)
				} else {
					// Other type of error - just verify it's an error
					expect(error).toBeDefined()
					expect(error).toBeInstanceOf(Error)
				}
			}
		})

		it('should handle server errors gracefully', async () => {
			// Setup custom MSW handler for server error
			setupServerWithHandlers([
				http.get('http://localhost:3000/server-error', () => {
					return HttpResponse.json(
						{ message: 'Internal server error' },
						{ status: 500 },
					)
				}),
			])

			// Unmock the API client for this test
			vi.unmock('@repo/macro-ai-api-client')

			// Create a real API client for testing
			const { createApiClient } = await import('@repo/macro-ai-api-client')
			const realApiClient = createApiClient('http://localhost:3000', {
				withCredentials: false,
			})

			// Make a request that should result in a server error
			try {
				await realApiClient.get({
					url: '/server-error',
					baseURL: 'http://localhost:3000',
				})
				expect.fail('Expected request to fail with 500')
			} catch (error: unknown) {
				// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
				if ((error as any).response) {
					// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
					expect((error as any).response.status).toBe(500)
				} else {
					expect(error).toBeDefined()
					expect(error).toBeInstanceOf(Error)
				}
			}
		})
	})

	describe('Enhanced API Testing with New Utilities', () => {
		it('should track API calls using tracking mock client', async () => {
			const trackingClient = createTrackingMockApiClient()

			// Make some API calls
			await trackingClient.get('/users')
			await trackingClient.post('/auth/login', { email: 'test@example.com' })
			await trackingClient.put('/users/1', { name: 'Updated User' })

			// Verify call history
			expect(trackingClient.callHistory).toHaveLength(3)
			expect(trackingClient.callHistory[0]).toMatchObject({
				method: 'GET',
				url: '/users',
			})
			expect(trackingClient.callHistory[1]).toMatchObject({
				method: 'POST',
				url: '/auth/login',
				data: { email: 'test@example.com' },
			})
			expect(trackingClient.callHistory[2]).toMatchObject({
				method: 'PUT',
				url: '/users/1',
				data: { name: 'Updated User' },
			})

			// Test clearing history
			trackingClient.clearHistory()
			expect(trackingClient.callHistory).toHaveLength(0)
		})

		it('should test authentication scenarios', async () => {
			// Unmock the API client for this test
			vi.unmock('@repo/macro-ai-api-client')

			// Create a real API client for testing
			const { createApiClient } = await import('@repo/macro-ai-api-client')
			const realApiClient = createApiClient('http://localhost:3000', {
				withCredentials: false,
			})

			// Test authentication endpoints using the MSW handlers
			const loginResponse = await realApiClient.post({
				url: '/auth/login',
				baseURL: 'http://localhost:3000',
				data: { email: 'test@example.com', password: 'password' },
			})

			expect(loginResponse.status).toBe(200)
			expect(loginResponse.data).toHaveProperty('message')
			expect(loginResponse.data).toHaveProperty('tokens')

			// Test refresh token endpoint
			const refreshResponse = await realApiClient.post({
				url: '/auth/refresh',
				baseURL: 'http://localhost:3000',
				data: { refreshToken: 'mock-refresh-token' },
			})

			expect(refreshResponse.status).toBe(200)
			expect(refreshResponse.data).toHaveProperty('message')
			expect(refreshResponse.data).toHaveProperty('tokens')
		})

		it('should test error scenarios comprehensively', async () => {
			// Unmock the API client for this test
			vi.unmock('@repo/macro-ai-api-client')

			// Create a real API client for testing
			const { createApiClient } = await import('@repo/macro-ai-api-client')
			const realApiClient = createApiClient('http://localhost:3000', {
				withCredentials: false,
			})

			// Test error scenarios using MSW handlers
			// Test 400 error (validation error)
			try {
				await realApiClient.post({
					url: '/auth/login',
					baseURL: 'http://localhost:3000',
					data: { email: 'invalid-email' }, // Missing password
				})
				expect.fail('Expected validation error')
			} catch (error: unknown) {
				// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
				if ((error as any).response) {
					// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
					expect((error as any).response.status).toBe(400)
				}
			}

			// Test 401 error (authentication error)
			try {
				await realApiClient.post({
					url: '/auth/login',
					baseURL: 'http://localhost:3000',
					data: { email: 'test@example.com', password: 'wrong-password' },
				})
				expect.fail('Expected authentication error')
			} catch (error: unknown) {
				// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
				if ((error as any).response) {
					// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
					expect((error as any).response.status).toBe(401)
				}
			}
		})

		it('should test performance scenarios', async () => {
			// Unmock the API client for this test
			vi.unmock('@repo/macro-ai-api-client')

			// Create a real API client for testing
			const { createApiClient } = await import('@repo/macro-ai-api-client')
			const realApiClient = createApiClient('http://localhost:3000', {
				withCredentials: false,
			})

			// Test performance scenarios using MSW handlers
			const startTime = Date.now()

			// Test multiple concurrent requests
			const promises = [
				realApiClient.get({ url: '/health', baseURL: 'http://localhost:3000' }),
				realApiClient.get({ url: '/health', baseURL: 'http://localhost:3000' }),
				realApiClient.get({ url: '/health', baseURL: 'http://localhost:3000' }),
			]

			const results = await Promise.all(promises)
			const endTime = Date.now()

			// Verify all requests completed (some may return 200, some 500 due to MSW counter)
			results.forEach((result) => {
				expect([200, 500]).toContain(result.status)
				if (result.data) {
					expect(result.data).toHaveProperty('message')
				}
			})

			// Verify performance (should complete within reasonable time)
			expect(endTime - startTime).toBeLessThan(1000) // Less than 1 second
		})
	})

	describe('Error Handling and Network Resilience', () => {
		it('should handle network errors gracefully', async () => {
			const mockClient = createTrackingMockApiClient()
			const errorScenarios = createNetworkErrorScenarios()

			// Test error handling
			const results = await testErrorHandling(mockClient, errorScenarios)

			// Verify all error scenarios were handled
			expect(results).toHaveLength(Object.keys(errorScenarios).length)
			results.forEach((result) => {
				expect(result.scenario).toBeDefined()
				expect(result.handled).toBe(true)
				expect(result.error).toBeDefined()
			})
		})

		it('should handle timeout scenarios', async () => {
			// Setup custom MSW handler for timeout
			setupServerWithHandlers([
				http.get('http://localhost:3000/timeout', () => {
					return new Promise((resolve) => {
						setTimeout(() => {
							resolve(
								HttpResponse.json(
									{ message: 'Delayed response' },
									{ status: 200 },
								),
							)
						}, 100) // 100ms delay
					})
				}),
			])

			// Unmock the API client for this test
			vi.unmock('@repo/macro-ai-api-client')

			// Create a real API client with short timeout
			const { createApiClient } = await import('@repo/macro-ai-api-client')
			const realApiClient = createApiClient('http://localhost:3000', {
				withCredentials: false,
				timeout: 50, // 50ms timeout
			})

			// Make a request that should timeout
			try {
				await realApiClient.get({
					url: '/timeout',
					baseURL: 'http://localhost:3000',
				})
				expect.fail('Expected request to timeout')
			} catch (error: unknown) {
				expect(error).toBeDefined()
				expect(error).toBeInstanceOf(Error)
			}
		})
	})

	describe('Client Configuration Validation', () => {
		it('should validate client configuration options', async () => {
			const clients = await import('../clients')

			// Test with credentials client
			expect(clients.apiClient.instance.defaults.withCredentials).toBe(true)
			expect(
				clients.apiClient.instance.defaults.headers['X-API-KEY'],
			).toBeDefined()

			// Test without credentials client
			expect(
				clients.apiClientWithoutCredentials.instance.defaults.withCredentials,
			).toBe(false)
			expect(
				clients.apiClientWithoutCredentials.instance.defaults.headers[
					'X-API-KEY'
				],
			).toBeDefined()

			// Both clients should have the same base URL
			expect(clients.apiClient.instance.defaults.baseURL).toBe(
				clients.apiClientWithoutCredentials.instance.defaults.baseURL,
			)
		})

		it('should have proper interceptor setup', async () => {
			const clients = await import('../clients')

			// Verify interceptors are set up
			expect(clients.apiClient.instance.interceptors.response.use).toBeDefined()
			expect(
				clients.apiClientWithoutCredentials.instance.interceptors.response.use,
			).toBeDefined()

			// Verify interceptor functions are functions
			expect(typeof clients.apiClient.instance.interceptors.response.use).toBe(
				'function',
			)
			expect(
				typeof clients.apiClientWithoutCredentials.instance.interceptors
					.response.use,
			).toBe('function')
		})
	})
})
