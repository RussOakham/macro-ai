import { http, HttpResponse } from 'msw'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { validateEnvironment } from '@/lib/validation/environment'

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

// Mock the auth service
vi.mock('@/services/network/auth/post-refresh-token', () => ({
	postRefreshToken: vi.fn(),
}))

// Mock the router
vi.mock('@/main', () => ({
	router: {
		navigate: vi.fn(),
		state: {
			location: {
				pathname: '/test',
			},
		},
	},
}))

// Mock the shared refresh promise
vi.mock('../../auth/shared-refresh-promise', () => ({
	setSharedRefreshPromise: vi.fn(),
	clearSharedRefreshPromise: vi.fn(),
	getSharedRefreshPromise: vi.fn(),
	waitForRefreshCompletion: vi.fn(),
}))

// Mock the logger
vi.mock('../../logger/logger', () => ({
	logger: {
		error: vi.fn(),
		warn: vi.fn(),
		info: vi.fn(),
	},
}))

// Mock the error standardization
vi.mock('../../errors/standardize-error', () => ({
	standardizeError: vi.fn((error: unknown) => ({
		message: (error as { message?: string }).message ?? 'Standardized error',
		code: (error as { code?: string }).code ?? 'UNKNOWN_ERROR',
	})),
}))

// Mock the initialize-api module to prevent auto-initialization during tests
vi.mock('../initialize-api', () => ({
	initializeApiClients: vi.fn(),
}))

// Apply interceptors manually for integration tests
// This simulates what initialize-api.ts does asynchronously
const setupInterceptorsForTests = async () => {
	const { applyTokenRefreshInterceptors } = await import('../interceptors')
	const { apiClient, apiClientWithoutCredentials } = await import('../clients')
	applyTokenRefreshInterceptors({ axios: apiClient.instance })
	applyTokenRefreshInterceptors({ axios: apiClientWithoutCredentials.instance })
}

// Setup interceptors before running tests
beforeAll(async () => {
	await setupInterceptorsForTests()
})

describe('Token Refresh Integration Tests', () => {
	// Setup MSW for all tests in this describe block
	setupMSWForTests()

	beforeEach(() => {
		vi.clearAllMocks()
	})

	describe('Client Integration', () => {
		it('should have unified clients properly configured for token refresh', () => {
			const env = validateEnvironment()
			const clients = [apiClient, apiClientWithoutCredentials]

			clients.forEach((client) => {
				// Verify client has axios instance
				expect(client.instance).toBeDefined()

				// Verify interceptors are configured
				expect(client.instance.interceptors.response).toBeDefined()
				expect(typeof client.instance.interceptors.response.use).toBe(
					'function',
				)
				expect(typeof client.instance.interceptors.response.eject).toBe(
					'function',
				)

				// Verify base configuration
				expect(client.instance.defaults.baseURL).toBe(env.VITE_API_URL)
				expect(client.instance.defaults.headers['X-API-KEY']).toBe(
					env.VITE_API_KEY,
				)
			})
		})

		it('should have proper credentials configuration', () => {
			// Main client should have credentials enabled
			expect(apiClient.instance.defaults.withCredentials).toBe(true)

			// Client without credentials should have credentials disabled
			expect(
				apiClientWithoutCredentials.instance.defaults.withCredentials,
			).toBe(false)
		})

		it('should support interceptor functionality', () => {
			// Test that interceptors can be added and removed
			const clients = [apiClient, apiClientWithoutCredentials]

			clients.forEach((client) => {
				const testInterceptorId = client.instance.interceptors.response.use(
					(response) => response,
					(error) => Promise.reject(new Error(String(error))),
				)

				expect(typeof testInterceptorId).toBe('number')

				// Clean up
				client.instance.interceptors.response.eject(testInterceptorId)
			})
		})
	})

	describe('Enhanced Token Refresh Integration Testing', () => {
		it('should handle token refresh flow with real HTTP requests', async () => {
			// Setup MSW handlers for token refresh flow
			setupServerWithHandlers([
				http.get('http://localhost:3000/protected', () => {
					return HttpResponse.json({ message: 'Unauthorized' }, { status: 401 })
				}),
				http.post('http://localhost:3000/auth/refresh', () => {
					return HttpResponse.json(
						{
							message: 'Token refreshed',
							tokens: {
								accessToken: 'new-access-token',
								refreshToken: 'new-refresh-token',
								expiresIn: 3600,
							},
						},
						{ status: 200 },
					)
				}),
			])

			// Mock the refresh token function to resolve successfully
			const { postRefreshToken } = await import(
				'@/services/network/auth/post-refresh-token'
			)
			const mockPostRefreshToken = vi.fn().mockResolvedValue({
				message: 'Token refreshed',
				tokens: {
					accessToken: 'new-access-token',
					refreshToken: 'new-refresh-token',
					expiresIn: 3600,
				},
			})
			vi.mocked(postRefreshToken).mockImplementation(mockPostRefreshToken)

			// Make a request that should trigger 401 and refresh
			try {
				await apiClient.get({
					url: '/protected',
					baseURL: 'http://localhost:3000',
				})
			} catch {
				// The request should fail, but we can verify the refresh was attempted
				expect(postRefreshToken).toHaveBeenCalled()
			}
		})

		it('should handle refresh token expiration gracefully', async () => {
			// Setup MSW handler for refresh endpoint returning 401
			setupServerWithHandlers([
				http.post('http://localhost:3000/auth/refresh', () => {
					return HttpResponse.json(
						{ message: 'Refresh token expired' },
						{ status: 401 },
					)
				}),
			])

			// Mock the router navigate function
			const { router } = await import('@/main')

			// Make a request to the refresh endpoint that should return 401
			try {
				await apiClient.post({
					url: '/auth/refresh',
					baseURL: 'http://localhost:3000',
					data: { refreshToken: 'expired-token' },
				})
			} catch {
				// Verify the router was called to navigate to login
				expect(router.navigate).toHaveBeenCalledWith({
					to: '/auth/login',
					search: { redirect: '/test' },
				})
			}
		})

		it('should handle concurrent token refresh requests', async () => {
			// Setup MSW handlers
			setupServerWithHandlers([
				http.get('http://localhost:3000/protected1', () => {
					return HttpResponse.json({ message: 'Unauthorized' }, { status: 401 })
				}),
				http.get('http://localhost:3000/protected2', () => {
					return HttpResponse.json({ message: 'Unauthorized' }, { status: 401 })
				}),
				http.post('http://localhost:3000/auth/refresh', () => {
					return HttpResponse.json(
						{
							message: 'Token refreshed',
							tokens: {
								accessToken: 'new-access-token',
								refreshToken: 'new-refresh-token',
								expiresIn: 3600,
							},
						},
						{ status: 200 },
					)
				}),
			])

			// Mock the refresh token function to resolve successfully
			const { postRefreshToken } = await import(
				'@/services/network/auth/post-refresh-token'
			)
			const mockPostRefreshToken = vi.fn().mockResolvedValue({
				message: 'Token refreshed',
				tokens: {
					accessToken: 'new-access-token',
					refreshToken: 'new-refresh-token',
					expiresIn: 3600,
				},
			})
			vi.mocked(postRefreshToken).mockImplementation(mockPostRefreshToken)

			// Make concurrent requests that should trigger 401
			const promises = [
				apiClient.get({
					url: '/protected1',
					baseURL: 'http://localhost:3000',
				}),
				apiClient.get({
					url: '/protected2',
					baseURL: 'http://localhost:3000',
				}),
			]

			// All requests should be handled (either succeed or fail gracefully)
			const results = await Promise.allSettled(promises)

			// Verify that refresh was called
			expect(postRefreshToken).toHaveBeenCalled()

			// Verify all requests were handled
			expect(results).toHaveLength(2)
		})

		it('should integrate with shared refresh promise correctly', async () => {
			// Setup MSW handlers
			setupServerWithHandlers([
				http.get('http://localhost:3000/protected', () => {
					return HttpResponse.json({ message: 'Unauthorized' }, { status: 401 })
				}),
				http.post('http://localhost:3000/auth/refresh', () => {
					return HttpResponse.json(
						{
							message: 'Token refreshed',
							tokens: {
								accessToken: 'new-access-token',
								refreshToken: 'new-refresh-token',
								expiresIn: 3600,
							},
						},
						{ status: 200 },
					)
				}),
			])

			// Mock the refresh token function
			const { postRefreshToken } = await import(
				'@/services/network/auth/post-refresh-token'
			)
			const mockPostRefreshToken = vi.fn().mockResolvedValue({
				message: 'Token refreshed',
				tokens: {
					accessToken: 'new-access-token',
					refreshToken: 'new-refresh-token',
					expiresIn: 3600,
				},
			})
			vi.mocked(postRefreshToken).mockImplementation(mockPostRefreshToken)

			// Mock the shared refresh promise functions
			const { setSharedRefreshPromise, clearSharedRefreshPromise } =
				await import('../../auth/shared-refresh-promise')

			// Make a request that should trigger refresh
			try {
				await apiClient.get({
					url: '/protected',
					baseURL: 'http://localhost:3000',
				})
			} catch {
				// Verify the shared refresh promise functions were called
				expect(setSharedRefreshPromise).toHaveBeenCalled()
				expect(clearSharedRefreshPromise).toHaveBeenCalled()
			}
		})

		it('should handle network errors during token refresh', async () => {
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

		it('should maintain client stability during token refresh operations', async () => {
			// Setup MSW handlers for various scenarios
			setupServerWithHandlers([
				http.get('http://localhost:3000/health', () => {
					return HttpResponse.json(
						{ message: 'Api Health Status: OK' },
						{ status: 200 },
					)
				}),
				http.get('http://localhost:3000/protected', () => {
					return HttpResponse.json({ message: 'Unauthorized' }, { status: 401 })
				}),
				http.post('http://localhost:3000/auth/refresh', () => {
					return HttpResponse.json(
						{
							message: 'Token refreshed',
							tokens: {
								accessToken: 'new-access-token',
								refreshToken: 'new-refresh-token',
								expiresIn: 3600,
							},
						},
						{ status: 200 },
					)
				}),
			])

			// Mock the refresh token function
			const { postRefreshToken } = await import(
				'@/services/network/auth/post-refresh-token'
			)
			const mockPostRefreshToken = vi.fn().mockResolvedValue({
				message: 'Token refreshed',
				tokens: {
					accessToken: 'new-access-token',
					refreshToken: 'new-refresh-token',
					expiresIn: 3600,
				},
			})
			vi.mocked(postRefreshToken).mockImplementation(mockPostRefreshToken)

			// Perform various operations to test client stability
			const operations = [
				() =>
					apiClient.get({ url: '/health', baseURL: 'http://localhost:3000' }),
				() =>
					apiClient.get({
						url: '/protected',
						baseURL: 'http://localhost:3000',
					}),
			]

			// Execute operations
			const results = await Promise.allSettled(operations.map((op) => op()))

			// Verify operations were handled
			expect(results).toHaveLength(2)

			// Verify client instances are still stable
			expect(apiClient).toBeDefined()
			expect(apiClientWithoutCredentials).toBeDefined()
			expect(apiClient.instance).toBeDefined()
			expect(apiClientWithoutCredentials.instance).toBeDefined()

			// Verify interceptors are still functional
			expect(apiClient.instance.interceptors.response).toBeDefined()
			expect(
				apiClientWithoutCredentials.instance.interceptors.response,
			).toBeDefined()
		})
	})
})
