/**
 * API Client Testing Utilities
 *
 * Specialized utilities for testing API clients, interceptors, and network-related functionality
 * in the client-ui project. These utilities focus on mocking HTTP requests, testing interceptors,
 * and validating API client behavior.
 */

// Import MSW utilities from our new setup
import { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios'
import MockAdapter from 'axios-mock-adapter'
import { http, HttpResponse } from 'msw'
import { expect, vi } from 'vitest'

import { server, setupServerWithHandlers } from './msw-setup'
// Import from main test utilities
import {
	createMockApiClient,
	createMockApiError,
	createMockApiResponse,
	createMockAxiosInstance,
	MockApiClient,
	MockAxiosInstance,
} from './test-utils'

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Mock adapter configuration
 */
export interface MockAdapterConfig {
	delayResponse?: number
	onNoMatch?: 'passthrough' | 'throwException'
}

/**
 * API test scenario with enhanced options
 */
export interface EnhancedApiCallScenario {
	url: string | RegExp
	method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'
	data?: unknown
	headers?: Record<string, string>
	expectedResponse?: unknown
	expectedError?: string
	status?: number
	delay?: number
	times?: number // How many times this scenario should match
}

/**
 * MSW handler configuration
 */
export interface MSWHandlerConfig {
	baseURL?: string
	scenarios?: EnhancedApiCallScenario[]
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	customHandlers?: any[]
}

/**
 * Interceptor test configuration
 */
export interface InterceptorTestConfig {
	requestInterceptor?: boolean
	responseInterceptor?: boolean
	errorInterceptor?: boolean
}

/**
 * Token refresh test configuration
 */
export interface TokenRefreshTestConfig {
	shouldSucceed: boolean
	accessToken?: string
	refreshToken?: string
	errorMessage?: string
	delay?: number
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
			url,
			expectedResponse,
			expectedError,
			status = 200,
			delay = 0,
		} = scenario

		if (expectedError) {
			mockAdapter.onAny(url).reply(status, { error: expectedError })
		} else {
			const response = expectedResponse ?? { success: true, data: {} }
			mockAdapter.onAny(url).reply(status, response)
		}

		// Apply delay if specified
		if (delay > 0) {
			mockAdapter.onAny(url).reply(() => {
				return new Promise((resolve) => {
					setTimeout(() => {
						resolve([status, expectedResponse ?? { success: true, data: {} }])
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
): { client: MockApiClient; adapter: MockAdapter } => {
	const mockClient = createMockApiClient()
	const mockAdapter = setupMockAdapter(mockClient.instance, scenarios, config)

	return { client: mockClient, adapter: mockAdapter }
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
		scenarios = [],
		customHandlers = [],
	} = config

	const dynamicHandlers = scenarios.map((scenario) => {
		const {
			url,
			method,
			expectedResponse,
			expectedError,
			status = 200,
			delay = 0,
		} = scenario

		// Convert string URL to MSW pattern
		const urlPattern = typeof url === 'string' ? `${baseURL}${url}` : url

		// Create handler based on method
		const handlerMap = {
			GET: http.get,
			POST: http.post,
			PUT: http.put,
			DELETE: http.delete,
			PATCH: http.patch,
		}

		const handler = handlerMap[method]

		if (expectedError) {
			return handler(urlPattern, () => {
				return HttpResponse.json(
					{ success: false, error: { message: expectedError } },
					{ status },
				)
			})
		}

		return handler(urlPattern, () => {
			const response = expectedResponse ?? { success: true, data: {} }

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

	// eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-assignment
	return [...dynamicHandlers, ...customHandlers]
}

/**
 * Setup MSW server with dynamic handlers
 * @param config
 */
export const setupDynamicMSWServer = (config: MSWHandlerConfig = {}) => {
	const dynamicHandlers = createDynamicMSWHandlers(config)
	// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
	const allHandlers = [...dynamicHandlers]

	if (allHandlers.length > 0) {
		// eslint-disable-next-line @typescript-eslint/no-unsafe-argument
		setupServerWithHandlers(allHandlers)
	}

	return { server, handlers: allHandlers }
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
		mswConfig?: MSWHandlerConfig
		mockAdapterConfig?: MockAdapterConfig
	} = {},
) => {
	const { axiosScenarios = [], mswConfig = {}, mockAdapterConfig = {} } = config

	// Setup axios mock adapter
	const mockAdapter = setupMockAdapter(
		axiosInstance,
		axiosScenarios,
		mockAdapterConfig,
	)

	// Setup MSW server

	const mswSetup = setupDynamicMSWServer(mswConfig)

	return {
		mockAdapter,
		mswServer: mswSetup.server,

		mswHandlers: mswSetup.handlers,
		cleanup: () => {
			mockAdapter.restore()
			server.resetHandlers()
		},
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
		request: {
			use: vi.fn().mockImplementation((onFulfilled) => {
				// eslint-disable-next-line @typescript-eslint/no-unsafe-argument
				requestInterceptor.mockImplementation(onFulfilled)
				return 0 // Mock interceptor ID
			}),
			eject: vi.fn(),
		},
		response: {
			use: vi.fn().mockImplementation((onFulfilled, onRejected) => {
				// eslint-disable-next-line @typescript-eslint/no-unsafe-argument
				responseInterceptor.mockImplementation(onFulfilled)
				if (onRejected) {
					// eslint-disable-next-line @typescript-eslint/no-unsafe-argument
					errorInterceptor.mockImplementation(onRejected)
				}
				return 1 // Mock interceptor ID
			}),
			eject: vi.fn(),
		},
		// Expose the actual mock functions for testing
		requestInterceptor,
		responseInterceptor,
		errorInterceptor,
	}
}

/**
 * Test interceptor behavior
 * @param interceptorFn
 * @param input
 * @param expectedOutput
 */
export const testInterceptor = async (
	interceptorFn: ReturnType<typeof vi.fn>,
	input: unknown,
	expectedOutput?: unknown,
) => {
	// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
	const result = await interceptorFn(input)
	if (expectedOutput !== undefined) {
		expect(result).toEqual(expectedOutput)
	}
	// eslint-disable-next-line @typescript-eslint/no-unsafe-return
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
	void config
	const mockInstance = createMockAxiosInstance()
	const mockInterceptors = createMockInterceptors()

	// Replace the interceptor mocks
	// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment
	mockInstance.interceptors = mockInterceptors as any

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
		resolve: vi.fn(),
		reject: vi.fn(),
	}

	return {
		setSharedRefreshPromise: vi.fn(),
		clearSharedRefreshPromise: vi.fn(),
		getSharedRefreshPromise: vi.fn().mockReturnValue(mockPromise.promise),
		waitForRefreshCompletion: vi.fn().mockResolvedValue(undefined),
		mockPromise,
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
					url: scenario.url as string,
					method: scenario.method,
					data: scenario.data,
					headers: scenario.headers,
				})
				results.push({ scenario, result: response, error: null })
			} catch (error) {
				results.push({ scenario, result: null, error })
			}
		}

		server.resetHandlers()
	} else {
		// Use axios-mock-adapter for testing
		const mockAdapter = setupMockAdapter(apiClient, scenarios)

		for (const scenario of scenarios) {
			try {
				const response = await apiClient.request({
					url: scenario.url as string,
					method: scenario.method,
					data: scenario.data,
					headers: scenario.headers,
				})
				results.push({ scenario, result: response, error: null })
			} catch (error) {
				results.push({ scenario, result: null, error })
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
		method: string
		url: string
		data?: unknown
		headers?: Record<string, string>
		timestamp: number
	}[]
	clearHistory: () => void
} => {
	const mockClient = createMockApiClient()
	const callHistory: {
		method: string
		url: string
		data?: unknown
		headers?: Record<string, string>
		timestamp: number
	}[] = []

	const trackCall = (
		method: string,
		url: string,
		data?: unknown,
		headers?: Record<string, string>,
	) => {
		callHistory.push({
			method,
			url,
			data,
			headers,
			timestamp: Date.now(),
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
			return Promise.resolve(createMockApiResponse({ url, method: 'GET' }))
		},
	)

	mockClient.post.mockImplementation(
		(url: string, data?: unknown, config?: AxiosRequestConfig) => {
			trackCall('POST', url, data, config?.headers as Record<string, string>)
			return Promise.resolve(
				createMockApiResponse({ url, method: 'POST', data }),
			)
		},
	)

	mockClient.put.mockImplementation(
		(url: string, data?: unknown, config?: AxiosRequestConfig) => {
			trackCall('PUT', url, data, config?.headers as Record<string, string>)
			return Promise.resolve(
				createMockApiResponse({ url, method: 'PUT', data }),
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
			return Promise.resolve(createMockApiResponse({ url, method: 'DELETE' }))
		},
	)

	mockClient.patch.mockImplementation(
		(url: string, data?: unknown, config?: AxiosRequestConfig) => {
			trackCall('PATCH', url, data, config?.headers as Record<string, string>)
			return Promise.resolve(
				createMockApiResponse({ url, method: 'PATCH', data }),
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
	timeout: new Error('Request timeout'),
	networkError: new Error('Network Error'),
	serverError: createMockApiError('Internal Server Error', 500, 'SERVER_ERROR'),
	unauthorized: createMockApiError('Unauthorized', 401, 'UNAUTHORIZED'),
	forbidden: createMockApiError('Forbidden', 403, 'FORBIDDEN'),
	notFound: createMockApiError('Not Found', 404, 'NOT_FOUND'),
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
	errorScenarios: Record<string, Error | AxiosResponse>,
) => {
	const results = []

	for (const [scenarioName, error] of Object.entries(errorScenarios)) {
		// Reset mocks
		Object.values(mockClient).forEach((mockFn) => {
			if (typeof mockFn === 'function' && 'mockClear' in mockFn) {
				// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unnecessary-type-assertion
				;(mockFn as any).mockClear()
			}
		})

		// Configure mock to throw/reject with the error
		mockClient.get.mockRejectedValueOnce(error)

		try {
			await mockClient.get('/test')
			results.push({ scenario: scenarioName, handled: false, error: null })
		} catch (caughtError) {
			results.push({
				scenario: scenarioName,
				handled: true,
				error: caughtError,
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
		url: `${baseURL}/auth/login`,
		method: 'POST',
		expectedResponse: {
			success: true,
			data: {
				user: { id: '1', email: 'test@example.com', name: 'Test User' },
				tokens: { accessToken: 'mock-token', refreshToken: 'mock-refresh' },
			},
		},
		status: 200,
	},
	{
		url: `${baseURL}/auth/refresh`,
		method: 'POST',
		expectedResponse: {
			success: true,
			data: { accessToken: 'new-token', refreshToken: 'new-refresh' },
		},
		status: 200,
	},
	{
		url: `${baseURL}/auth/logout`,
		method: 'POST',
		expectedResponse: { success: true, data: { message: 'Logged out' } },
		status: 200,
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
		url: `${baseURL}/network-error`,
		method: 'GET',
		expectedError: 'Network Error',
		status: 0,
	},
	{
		url: `${baseURL}/server-error`,
		method: 'GET',
		expectedError: 'Internal Server Error',
		status: 500,
	},
	{
		url: `${baseURL}/unauthorized`,
		method: 'GET',
		expectedError: 'Unauthorized',
		status: 401,
	},
	{
		url: `${baseURL}/timeout`,
		method: 'GET',
		expectedError: 'Request timeout',
		status: 408,
		delay: 10000, // 10 second delay to simulate timeout
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
		url: `${baseURL}/fast-endpoint`,
		method: 'GET',
		expectedResponse: { success: true, data: { message: 'Fast response' } },
		status: 200,
		delay: 100, // 100ms delay
	},
	{
		url: `${baseURL}/slow-endpoint`,
		method: 'GET',
		expectedResponse: { success: true, data: { message: 'Slow response' } },
		status: 200,
		delay: 2000, // 2 second delay
	},
]
