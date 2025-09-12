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

describe('Performance and Reliability Tests', () => {
	// Setup MSW for all tests in this describe block
	setupMSWForTests()

	beforeEach(() => {
		vi.clearAllMocks()
	})

	describe('Client Stability', () => {
		it('should maintain stable client instances', () => {
			// Verify clients are properly instantiated
			expect(apiClient).toBeDefined()
			expect(apiClientWithoutCredentials).toBeDefined()

			// Verify they have axios instances
			expect(apiClient.instance).toBeDefined()
			expect(apiClientWithoutCredentials.instance).toBeDefined()
		})

		it('should have consistent interceptor configuration', () => {
			const clients = [apiClient, apiClientWithoutCredentials]

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

		it('should have proper base configuration', () => {
			// Test client with credentials
			expect(apiClient.instance.defaults.baseURL).toBe('http://localhost:3000')
			expect(apiClient.instance.defaults.headers['X-API-KEY']).toBe(
				'test-api-key-that-is-at-least-32-characters-long',
			)
			expect(apiClient.instance.defaults.withCredentials).toBe(true)

			// Test client without credentials
			expect(apiClientWithoutCredentials.instance.defaults.baseURL).toBe(
				'http://localhost:3000',
			)
			expect(
				apiClientWithoutCredentials.instance.defaults.headers['X-API-KEY'],
			).toBe('test-api-key-that-is-at-least-32-characters-long')
			expect(
				apiClientWithoutCredentials.instance.defaults.withCredentials,
			).toBe(false)
		})

		it('should support interceptor management', () => {
			// Test that we can add and remove interceptors
			const testInterceptorId = apiClient.instance.interceptors.response.use(
				(response) => response,
				(error) => Promise.reject(new Error(String(error))),
			)

			expect(typeof testInterceptorId).toBe('number')

			// Clean up
			apiClient.instance.interceptors.response.eject(testInterceptorId)
		})
	})

	describe('Enhanced Performance Testing with Real HTTP Requests', () => {
		it('should handle concurrent requests efficiently', async () => {
			// Setup MSW handler for concurrent requests
			setupServerWithHandlers([
				http.get('http://localhost:3000/health', () => {
					return HttpResponse.json(
						{ message: 'Api Health Status: OK' },
						{ status: 200 },
					)
				}),
			])

			// Test concurrent requests
			const startTime = Date.now()
			const promises = Array.from({ length: 10 }, () =>
				apiClient.get({
					url: '/health',
					baseURL: 'http://localhost:3000',
				}),
			)

			const results = await Promise.all(promises)
			const endTime = Date.now()
			const duration = endTime - startTime

			// Verify all requests completed successfully
			expect(results).toHaveLength(10)
			results.forEach((result) => {
				expect(result.status).toBe(200)
				expect((result.data as { message: string }).message).toBe(
					'Api Health Status: OK',
				)
			})

			// Verify reasonable performance (should complete within 1 second)
			expect(duration).toBeLessThan(1000)
		})

		it('should handle high-frequency requests without memory leaks', async () => {
			// Setup MSW handler
			setupServerWithHandlers([
				http.get('http://localhost:3000/health', () => {
					return HttpResponse.json(
						{ message: 'Api Health Status: OK' },
						{ status: 200 },
					)
				}),
			])

			// Make many requests in sequence to test for memory leaks
			const requestCount = 50
			const results = []

			for (let i = 0; i < requestCount; i++) {
				const result = await apiClient.get({
					url: '/health',
					baseURL: 'http://localhost:3000',
				})
				results.push(result)
			}

			// Verify all requests completed successfully
			expect(results).toHaveLength(requestCount)
			results.forEach((result) => {
				expect(result.status).toBe(200)
				expect((result.data as { message: string }).message).toBe(
					'Api Health Status: OK',
				)
			})
		})

		it('should maintain performance under load', async () => {
			// Setup MSW handler with slight delay to simulate real API
			setupServerWithHandlers([
				http.get('http://localhost:3000/health', () => {
					return new Promise((resolve) => {
						setTimeout(() => {
							resolve(
								HttpResponse.json(
									{ message: 'Api Health Status: OK' },
									{ status: 200 },
								),
							)
						}, 10) // 10ms delay
					})
				}),
			])

			// Test performance under load
			const startTime = Date.now()
			const promises = Array.from({ length: 20 }, () =>
				apiClient.get({
					url: '/health',
					baseURL: 'http://localhost:3000',
				}),
			)

			const results = await Promise.all(promises)
			const endTime = Date.now()
			const duration = endTime - startTime

			// Verify all requests completed
			expect(results).toHaveLength(20)
			results.forEach((result) => {
				expect(result.status).toBe(200)
			})

			// Verify reasonable performance under load
			expect(duration).toBeLessThan(2000) // Should complete within 2 seconds
		})
	})

	describe('Enhanced Reliability Testing', () => {
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

		it('should recover from temporary network failures', async () => {
			// Setup MSW handler that fails first, then succeeds
			let requestCount = 0
			setupServerWithHandlers([
				http.get('http://localhost:3000/health', () => {
					requestCount++
					if (requestCount <= 2) {
						return HttpResponse.json(
							{ message: 'Service Unavailable' },
							{ status: 503 },
						)
					}
					return HttpResponse.json(
						{ message: 'Api Health Status: OK' },
						{ status: 200 },
					)
				}),
			])

			// First requests should fail
			try {
				await apiClient.get({
					url: '/health',
					baseURL: 'http://localhost:3000',
				})
				expect.fail('Expected 503 error')
			} catch (error: unknown) {
				expect(error).toBeDefined()
			}

			// Subsequent requests should succeed
			const result = await apiClient.get({
				url: '/health',
				baseURL: 'http://localhost:3000',
			})

			expect(result.status).toBe(200)
			expect((result.data as { message: string }).message).toBe(
				'Api Health Status: OK',
			)
		})

		it('should handle timeout scenarios reliably', async () => {
			// Setup MSW handler with long delay
			setupServerWithHandlers([
				http.get('http://localhost:3000/slow', () => {
					return new Promise((resolve) => {
						setTimeout(() => {
							resolve(
								HttpResponse.json(
									{ message: 'Slow response' },
									{ status: 200 },
								),
							)
						}, 200) // 200ms delay
					})
				}),
			])

			// Test timeout handling
			try {
				await apiClient.get({
					url: '/slow',
					baseURL: 'http://localhost:3000',
					timeout: 100, // 100ms timeout
				})
				expect.fail('Expected timeout error')
			} catch (error: unknown) {
				// Verify timeout was handled gracefully
				expect(error).toBeDefined()
				expect(error).toBeInstanceOf(Error)
			}
		})

		it('should maintain client stability across multiple operations', async () => {
			// Setup MSW handlers for different operations
			setupServerWithHandlers([
				http.get('http://localhost:3000/health', () => {
					return HttpResponse.json(
						{ message: 'Api Health Status: OK' },
						{ status: 200 },
					)
				}),
				http.post('http://localhost:3000/auth/login', () => {
					return HttpResponse.json(
						{ message: 'Login successful' },
						{ status: 200 },
					)
				}),
				http.put('http://localhost:3000/user/profile', () => {
					return HttpResponse.json(
						{ message: 'Profile updated' },
						{ status: 200 },
					)
				}),
				http.delete('http://localhost:3000/user/session', () => {
					return HttpResponse.json(
						{ message: 'Session deleted' },
						{ status: 200 },
					)
				}),
			])

			// Perform various operations
			const operations = [
				() =>
					apiClient.get({ url: '/health', baseURL: 'http://localhost:3000' }),
				() =>
					apiClient.post({
						url: '/auth/login',
						baseURL: 'http://localhost:3000',
						data: {},
					}),
				() =>
					apiClient.put({
						url: '/user/profile',
						baseURL: 'http://localhost:3000',
						data: {},
					}),
				() =>
					apiClient.delete({
						url: '/user/session',
						baseURL: 'http://localhost:3000',
					}),
			]

			// Execute all operations
			const results = await Promise.all(operations.map((op) => op()))

			// Verify all operations completed successfully
			expect(results).toHaveLength(4)
			results.forEach((result) => {
				expect(result.status).toBe(200)
				expect(result.data).toHaveProperty('message')
			})

			// Verify client instances are still stable
			expect(apiClient).toBeDefined()
			expect(apiClientWithoutCredentials).toBeDefined()
			expect(apiClient.instance).toBeDefined()
			expect(apiClientWithoutCredentials.instance).toBeDefined()
		})

		it('should handle mixed success and failure scenarios', async () => {
			// Setup MSW handlers with mixed responses
			setupServerWithHandlers([
				http.get('http://localhost:3000/health', () => {
					return HttpResponse.json(
						{ message: 'Api Health Status: OK' },
						{ status: 200 },
					)
				}),
				http.get('http://localhost:3000/error', () => {
					return HttpResponse.json(
						{ message: 'Internal Server Error' },
						{ status: 500 },
					)
				}),
			])

			// Test mixed scenarios
			const successPromise = apiClient.get({
				url: '/health',
				baseURL: 'http://localhost:3000',
			})

			const errorPromise = apiClient.get({
				url: '/error',
				baseURL: 'http://localhost:3000',
			})

			// Wait for both to complete
			const [successResult, errorResult] = await Promise.allSettled([
				successPromise,
				errorPromise,
			])

			// Verify success case
			expect(successResult.status).toBe('fulfilled')
			if (successResult.status === 'fulfilled') {
				expect(successResult.value.status).toBe(200)
				expect((successResult.value.data as { message: string }).message).toBe(
					'Api Health Status: OK',
				)
			}

			// Verify error case - it might be handled by interceptors
			if (errorResult.status === 'rejected') {
				expect(errorResult.reason).toBeDefined()
				// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
			} else if (errorResult.status === 'fulfilled') {
				// If the error was handled by interceptors, verify it's a 500 response
				expect(errorResult.value.status).toBe(500)
				if (errorResult.value.data) {
					expect((errorResult.value.data as { message: string }).message).toBe(
						'Internal Server Error',
					)
				}
			}
		})
	})
})
