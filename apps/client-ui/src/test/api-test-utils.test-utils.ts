/**
 * API Client Testing Utilities
 *
 * Specialized utilities for testing API clients, interceptors, and network-related functionality
 * in the client-ui project. These utilities focus on mocking HTTP requests, testing interceptors,
 * and validating API client behavior.
 */

// Import MSW utilities from our new setup
import type { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios'
import MockAdapter from 'axios-mock-adapter'
import { http, type HttpHandler, HttpResponse } from 'msw'
import { expect, vi } from 'vitest'

import { server, setupServerWithHandlers } from './msw-setup'
// Import from main test utilities
import {
	createMockApiClient,
	createMockApiError,
	createMockApiResponse,
	createMockAxiosInstance,
	type MockApiClient,
	type MockAxiosInstance,
} from './test-utils.test-utils'

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * API test scenario with enhanced options
 */
export interface EnhancedApiCallScenario {
	data?: unknown
	delay?: number
	expectedError?: string
	expectedResponse?: unknown
	headers?: Record<string, string>
	method: 'DELETE' | 'GET' | 'PATCH' | 'POST' | 'PUT'
	status?: number
	times?: number // How many times this scenario should match
	url: RegExp | string
}

/**
 * Interceptor test configuration
 */
export interface InterceptorTestConfig {
	errorInterceptor?: boolean
	requestInterceptor?: boolean
	responseInterceptor?: boolean
}

/**
 * Mock adapter configuration
 */
export interface MockAdapterConfig {
	delayResponse?: number
	onNoMatch?: 'passthrough' | 'throwException'
}

/**
 * MSW handler configuration
 */
export interface MSWHandlerConfig {
	baseURL?: string
	customHandlers?: HttpHandler[]
	scenarios?: EnhancedApiCallScenario[]
}

/**
 * Token refresh test configuration
 */
export interface TokenRefreshTestConfig {
	accessToken?: string
	delay?: number
	errorMessage?: string
	refreshToken?: string
	shouldSucceed: boolean
}

// ============================================================================
// Axios Mock Adapter Utilities
// ============================================================================

/**
 * Create a mock adapter for an Axios instance
 * @param axiosInstance
 * @param config
 */
export const createMockAdapter = (
	axiosInstance: AxiosInstance,
	config: MockAdapterConfig = {},
): MockAdapter => {
	const mockAdapter = new MockAdapter(axiosInstance, {
		delayResponse: config.delayResponse ?? 0,
		onNoMatch: config.onNoMatch ?? 'passthrough',
	})

	return mockAdapter
}

/**
 * Setup mock adapter with common scenarios
 * @param axiosInstance
 * @param scenarios
 * @param config
 */
export const setupMockAdapter = (
	axiosInstance: AxiosInstance,
	scenarios: EnhancedApiCallScenario[] = [],
	config: MockAdapterConfig = {},
): MockAdapter => {
	const mockAdapter = createMockAdapter(axiosInstance, config)

	// Apply scenarios to mock adapter
	scenarios.forEach((scenario) => {
		const {
			delay = 0,
			expectedError,
			expectedResponse,
			status = 200,
			url,
		} = scenario

		if (expectedError) {
			mockAdapter.onAny(url).reply(status, { error: expectedError })
		} else {
			const response = expectedResponse ?? { data: {}, success: true }
			mockAdapter.onAny(url).reply(status, response)
		}

		// Apply delay if specified
		if (delay > 0) {
			mockAdapter.onAny(url).reply(() => {
				return new Promise((resolve) => {
					setTimeout(() => {
						resolve([status, expectedResponse ?? { data: {}, success: true }])
					}, delay)
				})
			})
		}
	})

	return mockAdapter
}

/**
 * Create a comprehensive mock API client with axios-mock-adapter
 * @param scenarios
 * @param config
 */
export const createMockApiClientWithAdapter = (
	scenarios: EnhancedApiCallScenario[] = [],
	config: MockAdapterConfig = {},
): { adapter: MockAdapter; client: MockApiClient } => {
	const mockClient = createMockApiClient()
	const mockAdapter = setupMockAdapter(mockClient.instance, scenarios, config)

	return { adapter: mockAdapter, client: mockClient }
}

// ============================================================================
// Enhanced MSW Integration
// ============================================================================

/**
 * Create dynamic MSW handlers for test scenarios
 * @param config
 */
export const createDynamicMSWHandlers = (config: MSWHandlerConfig = {}) => {
	const {
		baseURL = 'http://localhost:3000',
		customHandlers = [],
		scenarios = [],
	} = config

	const dynamicHandlers = scenarios.map((scenario) => {
		const {
			delay = 0,
			expectedError,
			expectedResponse,
			method,
			status = 200,
			url,
		} = scenario

		// Convert string URL to MSW pattern
		const urlPattern = typeof url === 'string' ? `${baseURL}${url}` : url

		// Create handler based on method
		const handlerMap = {
			DELETE: http.delete,
			GET: http.get,
			PATCH: http.patch,
			POST: http.post,
			PUT: http.put,
		}

		const handler = handlerMap[method]

		if (expectedError) {
			return handler(urlPattern, () => {
				return HttpResponse.json(
					{ error: { message: expectedError }, success: false },
					{ status },
				)
			})
		}

		return handler(urlPattern, () => {
			const response = expectedResponse ?? { data: {}, success: true }

			if (delay > 0) {
				return new Promise((resolve) => {
					setTimeout(() => {
						resolve(HttpResponse.json(response, { status }))
					}, delay)
				})
			}

			return HttpResponse.json(response, { status })
		})
	})

	return [...dynamicHandlers, ...customHandlers] as HttpHandler[]
}

/**
 * Setup MSW server with dynamic handlers
 * @param config
 */
export const setupDynamicMSWServer = (config: MSWHandlerConfig = {}) => {
	const dynamicHandlers = createDynamicMSWHandlers(config)
	const allHandlers: HttpHandler[] = Array.from(dynamicHandlers)

	if (allHandlers.length > 0) {
		setupServerWithHandlers(allHandlers)
	}

	return { handlers: allHandlers, server }
}

// ============================================================================
// Hybrid Testing Utilities (Axios Mock Adapter + MSW)
// ============================================================================

/**
 * Create a hybrid testing setup that uses both axios-mock-adapter and MSW
 * @param axiosInstance
 * @param config
 * @param config.axiosScenarios
 * @param config.mswConfig
 * @param config.mockAdapterConfig
 */
export const createHybridTestSetup = (
	axiosInstance: AxiosInstance,
	config: {
		axiosScenarios?: EnhancedApiCallScenario[]
		mockAdapterConfig?: MockAdapterConfig
		mswConfig?: MSWHandlerConfig
	} = {},
) => {
	const { axiosScenarios = [], mockAdapterConfig = {}, mswConfig = {} } = config

	// Setup axios mock adapter
	const mockAdapter = setupMockAdapter(
		axiosInstance,
		axiosScenarios,
		mockAdapterConfig,
	)

	// Setup MSW server

	const mswSetup = setupDynamicMSWServer(mswConfig)

	return {
		cleanup: () => {
			mockAdapter.restore()
			server.resetHandlers()
		},
		mockAdapter,

		mswHandlers: mswSetup.handlers,
		mswServer: mswSetup.server,
	}
}

// ============================================================================
// Interceptor Testing Utilities
// ============================================================================

/**
 * Create mock interceptors for testing
 */
export const createMockInterceptors = () => {
	const requestInterceptor = vi.fn()
	const responseInterceptor = vi.fn()

	const errorInterceptor = vi.fn()

	return {
		errorInterceptor,
		request: {
			eject: vi.fn(),
			use: vi
				.fn()
				.mockImplementation((onFulfilled: (value: unknown) => unknown) => {
					requestInterceptor.mockImplementation(onFulfilled)
					return 0 // Mock interceptor ID
				}),
		},
		// Expose the actual mock functions for testing
		requestInterceptor,
		response: {
			eject: vi.fn(),
			use: vi
				.fn()
				.mockImplementation(
					(
						onFulfilled: (value: unknown) => unknown,
						onRejected?: (error: unknown) => unknown,
					) => {
						responseInterceptor.mockImplementation(onFulfilled)
						if (onRejected) {
							errorInterceptor.mockImplementation(onRejected)
						}
						return 1 // Mock interceptor ID
					},
				),
		},
		responseInterceptor,
	}
}

/**
 * Test interceptor behavior
 * @param interceptorFn
 * @param input
 * @param expectedOutput
 */
export const testInterceptor = async <TInput, TOutput>(
	interceptorFn: (input: TInput) => Promise<TOutput>,
	input: TInput,
	expectedOutput?: TOutput,
): Promise<TOutput> => {
	const result = await interceptorFn(input)
	if (expectedOutput !== undefined) {
		expect(result).toEqual(expectedOutput)
	}
	return result
}

/**
 * Create a mock Axios instance with interceptors
 * @param config
 */
export const createMockAxiosWithInterceptors = (
	config: InterceptorTestConfig = {},
): MockAxiosInstance => {
	// Use config parameter to avoid unused variable warning
	// eslint-disable-next-line sonarjs/void-use
	void config
	const mockInstance = createMockAxiosInstance()
	const mockInterceptors = createMockInterceptors()

	// Replace the interceptor mocks
	mockInstance.interceptors =
		mockInterceptors as typeof mockInstance.interceptors

	return mockInstance
}

// ============================================================================
// Token Refresh Testing Utilities
// ============================================================================

/**
 * Create a mock token refresh function
 * @param config
 */
export const createMockTokenRefreshFunction = (
	config: TokenRefreshTestConfig = { shouldSucceed: true },
) => {
	return vi.fn().mockImplementation(async () => {
		if (config.delay) {
			await new Promise((resolve) => setTimeout(resolve, config.delay))
		}

		if (!config.shouldSucceed) {
			throw new Error(config.errorMessage ?? 'Token refresh failed')
		}

		return {
			accessToken: config.accessToken ?? 'new-access-token',
			refreshToken: config.refreshToken ?? 'new-refresh-token',
		}
	})
}

/**
 * Create a mock shared refresh promise
 */
export const createMockSharedRefreshPromise = () => {
	const mockPromise = {
		promise: Promise.resolve({
			accessToken: 'refreshed-access-token',
			refreshToken: 'refreshed-refresh-token',
		}),
		reject: vi.fn(),
		resolve: vi.fn(),
	}

	return {
		clearSharedRefreshPromise: vi.fn(),
		getSharedRefreshPromise: vi.fn().mockReturnValue(mockPromise.promise),
		mockPromise,
		setSharedRefreshPromise: vi.fn(),
		waitForRefreshCompletion: vi.fn().mockResolvedValue(undefined),
	}
}

// ============================================================================
// API Call Testing Utilities
// ============================================================================

/**
 * Test API call scenarios
 * @param apiClient
 * @param scenarios
 * @param useMSW
 */
export const testApiCallScenarios = async (
	apiClient: AxiosInstance,
	scenarios: EnhancedApiCallScenario[],
	useMSW = false,
) => {
	const results = []

	if (useMSW) {
		// Use MSW for testing
		setupDynamicMSWServer({ scenarios })

		for (const scenario of scenarios) {
			try {
				const response = await apiClient.request({
					data: scenario.data,
					headers: scenario.headers,
					method: scenario.method,
					url: scenario.url as string,
				})
				results.push({ error: null, result: response, scenario })
			} catch (error) {
				results.push({ error, result: null, scenario })
			}
		}

		server.resetHandlers()
	} else {
		// Use axios-mock-adapter for testing
		const mockAdapter = setupMockAdapter(apiClient, scenarios)

		for (const scenario of scenarios) {
			try {
				const response = await apiClient.request({
					data: scenario.data,
					headers: scenario.headers,
					method: scenario.method,
					url: scenario.url as string,
				})
				results.push({ error: null, result: response, scenario })
			} catch (error) {
				results.push({ error, result: null, scenario })
			}
		}

		mockAdapter.restore()
	}

	return results
}

/**
 * Create a mock API client that tracks all calls
 */
export const createTrackingMockApiClient = (): MockApiClient & {
	callHistory: {
		data?: unknown
		headers?: Record<string, string>
		method: string
		timestamp: number
		url: string
	}[]
	clearHistory: () => void
} => {
	const mockClient = createMockApiClient()
	const callHistory: {
		data?: unknown
		headers?: Record<string, string>
		method: string
		timestamp: number
		url: string
	}[] = []

	const trackCall = (
		method: string,
		url: string,
		data?: unknown,
		headers?: Record<string, string>,
	) => {
		callHistory.push({
			data,
			headers,
			method,
			timestamp: Date.now(),
			url,
		})
	}

	// Override all HTTP methods to track calls
	mockClient.get.mockImplementation(
		(url: string, config?: AxiosRequestConfig) => {
			trackCall(
				'GET',
				url,
				undefined,
				config?.headers as Record<string, string>,
			)
			return Promise.resolve(createMockApiResponse({ method: 'GET', url }))
		},
	)

	mockClient.post.mockImplementation(
		(url: string, data?: unknown, config?: AxiosRequestConfig) => {
			trackCall('POST', url, data, config?.headers as Record<string, string>)
			return Promise.resolve(
				createMockApiResponse({ data, method: 'POST', url }),
			)
		},
	)

	mockClient.put.mockImplementation(
		(url: string, data?: unknown, config?: AxiosRequestConfig) => {
			trackCall('PUT', url, data, config?.headers as Record<string, string>)
			return Promise.resolve(
				createMockApiResponse({ data, method: 'PUT', url }),
			)
		},
	)

	mockClient.delete.mockImplementation(
		(url: string, config?: AxiosRequestConfig) => {
			trackCall(
				'DELETE',
				url,
				undefined,
				config?.headers as Record<string, string>,
			)
			return Promise.resolve(createMockApiResponse({ method: 'DELETE', url }))
		},
	)

	mockClient.patch.mockImplementation(
		(url: string, data?: unknown, config?: AxiosRequestConfig) => {
			trackCall('PATCH', url, data, config?.headers as Record<string, string>)
			return Promise.resolve(
				createMockApiResponse({ data, method: 'PATCH', url }),
			)
		},
	)

	return {
		...mockClient,
		callHistory,
		clearHistory: () => {
			callHistory.length = 0
		},
	}
}

// ============================================================================
// Network Error Testing Utilities
// ============================================================================

/**
 * Create common network error scenarios
 */
export const createNetworkErrorScenarios = () => ({
	forbidden: createMockApiError('Forbidden', 403, 'FORBIDDEN'),
	networkError: new Error('Network Error'),
	notFound: createMockApiError('Not Found', 404, 'NOT_FOUND'),
	serverError: createMockApiError('Internal Server Error', 500, 'SERVER_ERROR'),
	timeout: new Error('Request timeout'),
	unauthorized: createMockApiError('Unauthorized', 401, 'UNAUTHORIZED'),
	validationError: createMockApiError(
		'Validation Error',
		422,
		'VALIDATION_ERROR',
	),
})

/**
 * Test error handling scenarios
 * @param mockClient
 * @param errorScenarios
 */
export const testErrorHandling = async (
	mockClient: MockApiClient,
	errorScenarios: Record<string, AxiosResponse | Error>,
) => {
	const results = []

	for (const [scenarioName, error] of Object.entries(errorScenarios)) {
		// Reset mocks
		Object.values(mockClient).forEach((mockFn) => {
			if (typeof mockFn === 'function' && 'mockClear' in mockFn) {
				;(mockFn as { mockClear: () => void }).mockClear()
			}
		})

		// Configure mock to throw/reject with the error
		mockClient.get.mockRejectedValueOnce(error)

		try {
			await mockClient.get('/test')
			results.push({ error: null, handled: false, scenario: scenarioName })
		} catch (caughtError) {
			results.push({
				error: caughtError,
				handled: true,
				scenario: scenarioName,
			})
		}
	}

	return results
}

// ============================================================================
// Advanced Testing Scenarios
// ============================================================================

/**
 * Create authentication test scenarios
 * @param baseURL
 */
export const createAuthTestScenarios = (
	baseURL = 'http://localhost:3000',
): EnhancedApiCallScenario[] => [
	{
		expectedResponse: {
			data: {
				tokens: { accessToken: 'mock-token', refreshToken: 'mock-refresh' },
				user: { email: 'test@example.com', id: '1', name: 'Test User' },
			},
			success: true,
		},
		method: 'POST',
		status: 200,
		url: `${baseURL}/auth/login`,
	},
	{
		expectedResponse: {
			data: { accessToken: 'new-token', refreshToken: 'new-refresh' },
			success: true,
		},
		method: 'POST',
		status: 200,
		url: `${baseURL}/auth/refresh`,
	},
	{
		expectedResponse: { data: { message: 'Logged out' }, success: true },
		method: 'POST',
		status: 200,
		url: `${baseURL}/auth/logout`,
	},
]

/**
 * Create error test scenarios
 * @param baseURL
 */
export const createErrorTestScenarios = (
	baseURL = 'http://localhost:3000',
): EnhancedApiCallScenario[] => [
	{
		expectedError: 'Network Error',
		method: 'GET',
		status: 0,
		url: `${baseURL}/network-error`,
	},
	{
		expectedError: 'Internal Server Error',
		method: 'GET',
		status: 500,
		url: `${baseURL}/server-error`,
	},
	{
		expectedError: 'Unauthorized',
		method: 'GET',
		status: 401,
		url: `${baseURL}/unauthorized`,
	},
	{
		delay: 10000, // 10 second delay to simulate timeout
		expectedError: 'Request timeout',
		method: 'GET',
		status: 408,
		url: `${baseURL}/timeout`,
	},
]

/**
 * Create performance test scenarios
 * @param baseURL
 */
export const createPerformanceTestScenarios = (
	baseURL = 'http://localhost:3000',
): EnhancedApiCallScenario[] => [
	{
		delay: 100, // 100ms delay
		expectedResponse: { data: { message: 'Fast response' }, success: true },
		method: 'GET',
		status: 200,
		url: `${baseURL}/fast-endpoint`,
	},
	{
		delay: 2000, // 2 second delay
		expectedResponse: { data: { message: 'Slow response' }, success: true },
		method: 'GET',
		status: 200,
		url: `${baseURL}/slow-endpoint`,
	},
]
