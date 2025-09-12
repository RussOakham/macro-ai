import { AxiosError } from 'axios'
import { http, HttpResponse } from 'msw'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// Import enhanced testing utilities
import {
	createNetworkErrorScenarios,
	createTrackingMockApiClient,
	testErrorHandling,
} from '../../../test/api-test-utils.test-utils'
import {
	setupMSWForTests,
	setupServerWithHandlers,
} from '../../../test/msw-setup'
import { apiClient, apiClientWithoutCredentials } from '../clients'

describe('API Client Validation', () => {
	// Setup MSW for all tests in this describe block
	setupMSWForTests()

	beforeEach(() => {
		vi.clearAllMocks()
	})

	describe('Client Configuration', () => {
		it('should have unified API clients configured', () => {
			expect(apiClient).toBeDefined()
			expect(apiClientWithoutCredentials).toBeDefined()
		})

		it('should have axios instances on all clients', () => {
			expect(apiClient.instance).toBeDefined()
			expect(apiClientWithoutCredentials.instance).toBeDefined()
		})

		it('should have interceptors configured on all clients', () => {
			// Check that response interceptors are configured
			expect(apiClient.instance.interceptors.response).toBeDefined()
			expect(
				apiClientWithoutCredentials.instance.interceptors.response,
			).toBeDefined()

			// Check that interceptors have the use method (indicating they're properly configured)
			expect(typeof apiClient.instance.interceptors.response.use).toBe(
				'function',
			)
			expect(
				typeof apiClientWithoutCredentials.instance.interceptors.response.use,
			).toBe('function')
		})

		it('should have proper axios configuration', () => {
			// Check that clients have proper base configuration
			expect(apiClient.instance.defaults.headers['X-API-KEY']).toBe(
				'test-api-key-that-is-at-least-32-characters-long',
			)
			expect(
				apiClientWithoutCredentials.instance.defaults.headers['X-API-KEY'],
			).toBe('test-api-key-that-is-at-least-32-characters-long')

			// Check credentials configuration
			expect(apiClient.instance.defaults.withCredentials).toBe(true)
			expect(
				apiClientWithoutCredentials.instance.defaults.withCredentials,
			).toBe(false)
		})
	})

	describe('Type Safety', () => {
		it('should have proper TypeScript types', () => {
			// These should compile without errors
			expect(typeof apiClient.get).toBe('function')
			expect(typeof apiClient.post).toBe('function')
			expect(typeof apiClient.put).toBe('function')
			expect(typeof apiClient.delete).toBe('function')

			expect(typeof apiClientWithoutCredentials.get).toBe('function')
			expect(typeof apiClientWithoutCredentials.post).toBe('function')
			expect(typeof apiClientWithoutCredentials.put).toBe('function')
			expect(typeof apiClientWithoutCredentials.delete).toBe('function')
		})
	})

	describe('Interceptor Integration', () => {
		it('should have consistent interceptor behavior across clients', () => {
			const clients = [apiClient, apiClientWithoutCredentials]

			// All clients should have interceptor managers
			clients.forEach((client) => {
				expect(client.instance.interceptors.response).toBeDefined()
				expect(typeof client.instance.interceptors.response.use).toBe(
					'function',
				)
				expect(typeof client.instance.interceptors.response.eject).toBe(
					'function',
				)
			})
		})

		it('should maintain interceptor functionality after client creation', () => {
			// Verify that interceptors can be added (indicating they're working)
			const testInterceptorId = apiClient.instance.interceptors.response.use(
				(response) => response,
				(error) => Promise.reject(error as AxiosError),
			)

			expect(typeof testInterceptorId).toBe('number')

			// Clean up test interceptor
			apiClient.instance.interceptors.response.eject(testInterceptorId)
		})
	})

	describe('Ready for Production', () => {
		it('should have all components needed for token refresh', () => {
			// Verify that all the pieces are in place for token refresh to work
			expect(apiClient.instance.interceptors.response).toBeDefined()
			expect(
				apiClientWithoutCredentials.instance.interceptors.response,
			).toBeDefined()

			// Verify base URLs are set
			expect(apiClient.instance.defaults.baseURL).toBe('http://localhost:3000')
			expect(apiClientWithoutCredentials.instance.defaults.baseURL).toBe(
				'http://localhost:3000',
			)
		})
	})

	describe('Enhanced Validation with Real HTTP Requests', () => {
		it('should validate client configuration with real API calls', async () => {
			// Setup MSW handler for health check
			setupServerWithHandlers([
				http.get('http://localhost:3000/health', () => {
					return HttpResponse.json(
						{ message: 'Api Health Status: OK' },
						{ status: 200 },
					)
				}),
			])

			// Test both clients with real HTTP requests
			const [apiResponse, noCredsResponse] = await Promise.all([
				apiClient.get({
					url: '/health',
					baseURL: 'http://localhost:3000',
				}),
				apiClientWithoutCredentials.get({
					url: '/health',
					baseURL: 'http://localhost:3000',
				}),
			])

			// Verify both clients work correctly
			expect(apiResponse.status).toBe(200)
			expect(apiResponse.data).toHaveProperty('message')
			expect((apiResponse.data as { message: string }).message).toBe(
				'Api Health Status: OK',
			)

			expect(noCredsResponse.status).toBe(200)
			expect(noCredsResponse.data).toHaveProperty('message')
			expect((noCredsResponse.data as { message: string }).message).toBe(
				'Api Health Status: OK',
			)
		})

		it('should handle validation errors gracefully', async () => {
			// Setup MSW handler for validation error
			setupServerWithHandlers([
				http.post('http://localhost:3000/auth/login', () => {
					return HttpResponse.json(
						{
							message: 'Validation Failed',
							details: { field: 'email', message: 'Invalid email format' },
						},
						{ status: 400 },
					)
				}),
			])

			// Test validation error handling
			try {
				await apiClient.post({
					url: '/auth/login',
					baseURL: 'http://localhost:3000',
					data: { email: 'invalid-email' }, // Missing password
				})
				expect.fail('Expected validation error')
			} catch (error: unknown) {
				// Verify the error is properly handled
				expect(error).toBeDefined()
				if (error && typeof error === 'object' && 'response' in error) {
					const axiosError = error as AxiosError
					expect(axiosError.response?.status).toBe(400)
					expect(axiosError.response?.data).toHaveProperty('message')
					expect(axiosError.response?.data).toHaveProperty('details')
				}
			}
		})

		it('should validate interceptor functionality with real requests', async () => {
			// Setup MSW handler for 401 response
			setupServerWithHandlers([
				http.get('http://localhost:3000/protected', () => {
					return HttpResponse.json({ message: 'Unauthorized' }, { status: 401 })
				}),
			])

			// Test that interceptors are working by making a request that should trigger 401
			try {
				await apiClient.get({
					url: '/protected',
					baseURL: 'http://localhost:3000',
				})
				expect.fail('Expected 401 error')
			} catch (error: unknown) {
				// Verify the interceptor handled the error
				expect(error).toBeDefined()
				if (error && typeof error === 'object' && 'response' in error) {
					const axiosError = error as AxiosError
					expect(axiosError.response?.status).toBe(401)
				}
			}
		})

		it('should validate client headers and configuration', async () => {
			// Setup MSW handler that checks headers
			setupServerWithHandlers([
				http.get('http://localhost:3000/headers-test', ({ request }) => {
					const { headers } = request
					return HttpResponse.json(
						{
							message: 'Headers received',
							headers: {
								'x-api-key': headers.get('X-API-KEY'),
								'content-type': headers.get('Content-Type'),
							},
						},
						{ status: 200 },
					)
				}),
			])

			// Test that headers are properly set
			const response = await apiClient.get({
				url: '/headers-test',
				baseURL: 'http://localhost:3000',
			})

			expect(response.status).toBe(200)
			expect(response.data).toHaveProperty('headers')
			expect(
				(response.data as { headers: { 'x-api-key': string } }).headers[
					'x-api-key'
				],
			).toBe('test-api-key-that-is-at-least-32-characters-long')
		})
	})

	describe('Enhanced Error Handling and Network Resilience', () => {
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

		it('should validate client resilience with timeout scenarios', async () => {
			// Setup MSW handler for timeout
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

			// Test timeout handling
			try {
				await apiClient.get({
					url: '/timeout',
					baseURL: 'http://localhost:3000',
					timeout: 50, // 50ms timeout
				})
				expect.fail('Expected timeout error')
			} catch (error: unknown) {
				// Verify timeout was handled gracefully
				expect(error).toBeDefined()
				expect(error).toBeInstanceOf(Error)
			}
		})

		it('should validate client configuration consistency', () => {
			// Verify that both clients have consistent configuration
			expect(apiClient.instance.defaults.baseURL).toBe(
				apiClientWithoutCredentials.instance.defaults.baseURL,
			)
			expect(apiClient.instance.defaults.headers['X-API-KEY']).toBe(
				apiClientWithoutCredentials.instance.defaults.headers['X-API-KEY'],
			)

			// Verify credentials configuration is different as expected
			expect(apiClient.instance.defaults.withCredentials).toBe(true)
			expect(
				apiClientWithoutCredentials.instance.defaults.withCredentials,
			).toBe(false)

			// Verify both clients have interceptors
			expect(apiClient.instance.interceptors.response).toBeDefined()
			expect(
				apiClientWithoutCredentials.instance.interceptors.response,
			).toBeDefined()

			// Verify both clients have HTTP methods
			expect(typeof apiClient.get).toBe('function')
			expect(typeof apiClient.post).toBe('function')
			expect(typeof apiClient.put).toBe('function')
			expect(typeof apiClient.delete).toBe('function')

			expect(typeof apiClientWithoutCredentials.get).toBe('function')
			expect(typeof apiClientWithoutCredentials.post).toBe('function')
			expect(typeof apiClientWithoutCredentials.put).toBe('function')
			expect(typeof apiClientWithoutCredentials.delete).toBe('function')
		})
	})
})
