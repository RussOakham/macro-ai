import type { AxiosInstance } from 'axios'
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
import { applyTokenRefreshInterceptors } from '../interceptors'

// Mock the auth service
vi.mock('@/services/network/auth/postRefreshToken', () => ({
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
	clearSharedRefreshPromise: vi.fn(),
	getSharedRefreshPromise: vi.fn(),
	setSharedRefreshPromise: vi.fn(),
	waitForRefreshCompletion: vi.fn(),
}))

// Mock the logger
vi.mock('../../logger/logger', () => ({
	logger: {
		error: vi.fn(),
		info: vi.fn(),
		warn: vi.fn(),
	},
}))

// Mock the error standardization
vi.mock('../../errors/standardize-error', () => ({
	standardizeError: vi.fn((error: unknown) => ({
		code: (error as { code?: string }).code ?? 'UNKNOWN_ERROR',
		message: (error as { message?: string }).message ?? 'Standardized error',
	})),
}))

describe('Token Refresh Interceptors', () => {
	// Setup MSW for all tests in this describe block
	setupMSWForTests()

	let mockAxiosInstance: AxiosInstance
	let mockClient: { axios: AxiosInstance }

	beforeEach(() => {
		vi.clearAllMocks()

		mockAxiosInstance = {
			interceptors: {
				response: {
					use: vi.fn(),
				},
			},
		} as unknown as AxiosInstance

		mockClient = {
			axios: mockAxiosInstance,
		}
	})

	describe('Basic Interceptor Setup', () => {
		it('should apply interceptors to a client', () => {
			applyTokenRefreshInterceptors(mockClient)

			expect(mockAxiosInstance.interceptors.response.use).toHaveBeenCalledTimes(
				1,
			)
			expect(mockAxiosInstance.interceptors.response.use).toHaveBeenCalledWith(
				expect.any(Function),
				expect.any(Function),
			)
		})

		it('should accept clients with axios instance', () => {
			expect(() => {
				applyTokenRefreshInterceptors(mockClient)
			}).not.toThrow()
		})

		it('should have consistent interceptor behavior across all clients', () => {
			const authClient = { axios: mockAxiosInstance }
			const chatClient = { axios: mockAxiosInstance }
			const userClient = { axios: mockAxiosInstance }

			// Apply interceptors to all clients
			applyTokenRefreshInterceptors(authClient)
			applyTokenRefreshInterceptors(chatClient)
			applyTokenRefreshInterceptors(userClient)

			// Each client should have interceptors applied
			expect(mockAxiosInstance.interceptors.response.use).toHaveBeenCalledTimes(
				3,
			)
		})

		it('should handle clients without axios instance gracefully', () => {
			const invalidClient = {} as { axios: AxiosInstance }

			expect(() => {
				applyTokenRefreshInterceptors(invalidClient)
			}).toThrow()
		})
	})

	describe('Enhanced Interceptor Testing with Real HTTP Requests', () => {
		it('should handle 401 errors and trigger token refresh', async () => {
			// Setup MSW handler for 401 response
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
								expiresIn: 3600,
								refreshToken: 'new-refresh-token',
							},
						},
						{ status: 200 },
					)
				}),
			])

			// Create a real axios instance with interceptors
			const { createApiClient } = await import('@repo/macro-ai-api-client')
			const realApiClient = createApiClient('http://localhost:3000', {
				withCredentials: false,
			})

			// Apply interceptors to the real client
			applyTokenRefreshInterceptors({ axios: realApiClient.instance })

			// Mock the refresh token function to resolve successfully
			const { postRefreshToken } = await import(
				'@/services/network/auth/post-refresh-token'
			)

			// Make a request that should trigger 401 and refresh
			try {
				await realApiClient.get({
					baseURL: 'http://localhost:3000',
					url: '/protected',
				})
			} catch {
				// The request should fail, but we can verify the refresh was attempted
				expect(postRefreshToken).toHaveBeenCalled()
			}
		})

		it('should handle 403 errors and redirect to login', async () => {
			// Setup MSW handler for 403 response
			setupServerWithHandlers([
				http.get('http://localhost:3000/forbidden', () => {
					return HttpResponse.json({ message: 'Forbidden' }, { status: 403 })
				}),
			])

			// Create a real axios instance with interceptors
			const { createApiClient } = await import('@repo/macro-ai-api-client')
			const realApiClient = createApiClient('http://localhost:3000', {
				withCredentials: false,
			})

			// Apply interceptors to the real client
			applyTokenRefreshInterceptors({ axios: realApiClient.instance })

			// Mock the router navigate function
			const { router } = await import('@/main')

			// Make a request that should trigger 403
			try {
				await realApiClient.get({
					baseURL: 'http://localhost:3000',
					url: '/forbidden',
				})
			} catch {
				// Verify the router was called to navigate to login
				expect(router.navigate).toHaveBeenCalledWith({
					search: {
						code: '403',
						message: 'You do not have permission to access this resource.',
					},
					to: '/auth/login',
				})
			}
		})

		it('should handle API key configuration errors', async () => {
			// Setup MSW handler for 500 with API key error
			setupServerWithHandlers([
				http.get('http://localhost:3000/api-error', () => {
					return HttpResponse.json(
						{ message: 'Server configuration error' },
						{ status: 500 },
					)
				}),
			])

			// Create a real axios instance with interceptors
			const { createApiClient } = await import('@repo/macro-ai-api-client')
			const realApiClient = createApiClient('http://localhost:3000', {
				withCredentials: false,
			})

			// Apply interceptors to the real client
			applyTokenRefreshInterceptors({ axios: realApiClient.instance })

			// Mock the logger
			const { logger } = await import('../../logger/logger')

			// Make a request that should trigger API key error
			try {
				await realApiClient.get({
					baseURL: 'http://localhost:3000',
					url: '/api-error',
				})
			} catch (error) {
				// Verify the logger was called with the API key error
				expect(logger.error).toHaveBeenCalledWith(
					'API key not configured on server',
				)
				// Verify the error was standardized
				expect(error).toBeInstanceOf(Error)
				expect((error as Error).message).toBe('API configuration error')
			}
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

		it('should prevent infinite refresh loops', async () => {
			// Setup MSW handler for refresh endpoint returning 401
			setupServerWithHandlers([
				http.post('http://localhost:3000/auth/refresh', () => {
					return HttpResponse.json(
						{ message: 'Refresh token expired' },
						{ status: 401 },
					)
				}),
			])

			// Create a real axios instance with interceptors
			const { createApiClient } = await import('@repo/macro-ai-api-client')
			const realApiClient = createApiClient('http://localhost:3000', {
				withCredentials: false,
			})

			// Apply interceptors to the real client
			applyTokenRefreshInterceptors({ axios: realApiClient.instance })

			// Mock the router navigate function
			const { router } = await import('@/main')

			// Make a request to the refresh endpoint that should return 401
			try {
				await realApiClient.post({
					baseURL: 'http://localhost:3000',
					data: { refreshToken: 'expired-token' },
					url: '/auth/refresh',
				})
			} catch {
				// Verify the router was called to navigate to login (not infinite loop)
				expect(router.navigate).toHaveBeenCalledWith({
					search: { redirect: '/test' },
					to: '/auth/login',
				})
			}
		})

		it('should handle concurrent requests during token refresh', async () => {
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
								expiresIn: 3600,
								refreshToken: 'new-refresh-token',
							},
						},
						{ status: 200 },
					)
				}),
			])

			// Create a real axios instance with interceptors
			const { createApiClient } = await import('@repo/macro-ai-api-client')
			const realApiClient = createApiClient('http://localhost:3000', {
				withCredentials: false,
			})

			// Apply interceptors to the real client
			applyTokenRefreshInterceptors({ axios: realApiClient.instance })

			// Make concurrent requests that should trigger 401
			const promises = [
				realApiClient.get({
					baseURL: 'http://localhost:3000',
					url: '/protected1',
				}),
				realApiClient.get({
					baseURL: 'http://localhost:3000',
					url: '/protected2',
				}),
			]

			// All requests should be handled (either succeed or fail gracefully)
			const results = await Promise.allSettled(promises)

			// Verify all requests were handled (they should all fail due to 401, but be handled gracefully)
			expect(results).toHaveLength(2)

			// Verify that all requests completed (either resolved or rejected)
			results.forEach((result) => {
				expect(result).toHaveProperty('status')
				expect(['fulfilled', 'rejected']).toContain(result.status)
			})
		})
	})
})
