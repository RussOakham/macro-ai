/**
 * Enhanced Client-UI Testing Utilities
 *
 * Comprehensive testing utilities for client-ui that integrate with the config-testing package
 * and provide enhanced mocking patterns, React component testing helpers, and MSW integration.
 */

// Import utilities from config-testing package
import {
	apiResponseFactory,
	authFactory,
	chatFactory,
	errorHandlers,
	handlers,
	testUtils,
	userFactory,
} from '@repo/config-testing'
import { render, RenderOptions, RenderResult } from '@testing-library/react'
import { AxiosHeaders, AxiosInstance, AxiosResponse } from 'axios'
import { ReactElement } from 'react'

/**
 * Enhanced render result with test context
 */
export interface EnhancedRenderResult extends RenderResult {
	testContext: ComponentTestContext
}
import { RequestHandler } from 'msw'
import { expect, vi } from 'vitest'

// Import MSW utilities from our new setup
import { server, setupServerWithHandlers } from './msw-setup'

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Enhanced API client mock interface
 */
export interface MockApiClient {
	instance: AxiosInstance
	post: ReturnType<typeof vi.fn>
	get: ReturnType<typeof vi.fn>
	put: ReturnType<typeof vi.fn>
	delete: ReturnType<typeof vi.fn>
	patch: ReturnType<typeof vi.fn>
}

/**
 * Mock Axios instance interface
 */
export interface MockAxiosInstance {
	interceptors: {
		request: {
			use: ReturnType<typeof vi.fn>
			eject: ReturnType<typeof vi.fn>
		}
		response: {
			use: ReturnType<typeof vi.fn>
			eject: ReturnType<typeof vi.fn>
		}
	}
	defaults: {
		baseURL: string
		headers: AxiosHeaders
		withCredentials: boolean
	}
	request: ReturnType<typeof vi.fn>
	get: ReturnType<typeof vi.fn>
	post: ReturnType<typeof vi.fn>
	put: ReturnType<typeof vi.fn>
	delete: ReturnType<typeof vi.fn>
	patch: ReturnType<typeof vi.fn>
	head: ReturnType<typeof vi.fn>
	options: ReturnType<typeof vi.fn>
}

/**
 * Authentication state for testing
 */
export interface AuthTestState {
	isAuthenticated: boolean
	user: ReturnType<typeof userFactory.create> | null
	token: string | null
	refreshToken: string | null
}

/**
 * API test configuration
 */
export interface ApiTestConfig {
	baseURL: string
	apiKey: string
	withCredentials: boolean
	timeout: number
}

/**
 * Component test context
 */
export interface ComponentTestContext {
	authState: AuthTestState
	apiConfig: ApiTestConfig
	mswHandlers: unknown[]
}

// ============================================================================
// Enhanced API Client Mocking
// ============================================================================

const defaultBaseURL = 'http://localhost:3000'
const defaultApiKey = 'test-api-key'
const defaultWithCredentials = true
const defaultTimeout = 5000

/**
 * Create a comprehensive mock Axios instance
 * @param config
 */
export const createMockAxiosInstance = (
	config: Partial<ApiTestConfig> = {},
): MockAxiosInstance => {
	const defaultConfig: ApiTestConfig = {
		baseURL: defaultBaseURL,
		apiKey: defaultApiKey,
		withCredentials: defaultWithCredentials,
		timeout: defaultTimeout,
		...config,
	}

	return {
		interceptors: {
			request: {
				use: vi.fn(),
				eject: vi.fn(),
			},
			response: {
				use: vi.fn(),
				eject: vi.fn(),
			},
		},
		defaults: {
			baseURL: defaultConfig.baseURL,
			headers: new AxiosHeaders({
				'X-API-KEY': defaultConfig.apiKey,
			}),
			withCredentials: defaultConfig.withCredentials,
		},
		request: vi.fn(),
		get: vi.fn(),
		post: vi.fn(),
		put: vi.fn(),
		delete: vi.fn(),
		patch: vi.fn(),
		head: vi.fn(),
		options: vi.fn(),
	}
}

/**
 * Create a comprehensive mock API client
 * @param config
 */
export const createMockApiClient = (
	config: Partial<ApiTestConfig> = {},
): MockApiClient => {
	const mockAxiosInstance = createMockAxiosInstance(config)

	return {
		instance: mockAxiosInstance as unknown as AxiosInstance,
		post: vi.fn(),
		get: vi.fn(),
		put: vi.fn(),
		delete: vi.fn(),
		patch: vi.fn(),
	}
}

/**
 * Create mock API responses with consistent structure
 * @param data
 * @param status
 * @param headers
 */
export const createMockApiResponse = <T>(
	data: T,
	status = 200,
	headers: Record<string, string> = {},
): AxiosResponse<T> => ({
	data,
	status,
	statusText: status === 200 ? 'OK' : 'Error',
	headers,
	// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment
	config: {} as any,
})

/**
 * Create mock API error responses
 * @param message
 * @param status
 * @param code
 */
export const createMockApiError = (
	message: string,
	status = 400,
	code = 'API_ERROR',
): AxiosResponse => ({
	data: { success: false, error: { message, code, status } },
	status,
	statusText: 'Error',
	headers: {},
	// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment
	config: {} as any,
})

// ============================================================================
// Enhanced Authentication Mocking
// ============================================================================

/**
 * Create mock authentication state
 * @param overrides
 */
export const createMockAuthState = (
	overrides: Partial<AuthTestState> = {},
): AuthTestState => {
	const defaultState: AuthTestState = {
		isAuthenticated: false,
		user: null,
		token: null,
		refreshToken: null,
	}

	return {
		...defaultState,
		...overrides,
	}
}

/**
 * Create authenticated user state
 * @param userOverrides
 */
export const createAuthenticatedUserState = (
	userOverrides = {},
): AuthTestState => {
	const user = userFactory.create(userOverrides)

	return {
		isAuthenticated: true,
		user,
		token: 'mock-access-token',
		refreshToken: 'mock-refresh-token',
	}
}

/**
 * Create mock token refresh function
 */
export const createMockTokenRefresh = () => {
	return vi.fn().mockImplementation(() => {
		return Promise.resolve({
			accessToken: 'mock-access-token',
			refreshToken: 'mock-refresh-token',
		})
	})
}

// ============================================================================
// Enhanced MSW Integration
// ============================================================================

/**
 * Setup MSW server with custom handlers
 * @param customHandlers
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const setupMSWServer = (customHandlers: any[] = []) => {
	if (customHandlers.length > 0) {
		setupServerWithHandlers(customHandlers as RequestHandler[])
	}
	return server
}

/**
 * Create MSW handlers for specific test scenarios
 */
export const createMSWHandlers = {
	/**
	 * Create handlers for authentication scenarios
	 * @param scenarios
	 * @param scenarios.loginSuccess
	 * @param scenarios.loginError
	 * @param scenarios.refreshSuccess
	 * @param scenarios.refreshError
	 * @param scenarios.logoutSuccess
	 */
	auth: (
		scenarios: {
			loginSuccess?: boolean
			loginError?: string
			refreshSuccess?: boolean
			refreshError?: string
			logoutSuccess?: boolean
		} = {},
	) => {
		const authHandlers: unknown[] = []

		// Login handler
		if (scenarios.loginSuccess !== false) {
			authHandlers
				.push
				// Add specific login success handler
				()
		}

		if (scenarios.loginError) {
			authHandlers
				.push
				// Add specific login error handler
				()
		}

		return authHandlers
	},

	/**
	 * Create handlers for API error scenarios
	 * @param errorTypes
	 */
	errors: (errorTypes: string[] = ['network', 'validation', 'server']) => {
		return errorHandlers.filter((handler: unknown) =>
			errorTypes.some((type) => String(handler).includes(type)),
		)
	},

	/**
	 * Create handlers for specific API endpoints
	 * @param endpoints
	 */
	endpoints: (endpoints: string[]) => {
		return handlers.filter((handler: unknown) =>
			endpoints.some((endpoint) => String(handler).includes(endpoint)),
		)
	},
}

// ============================================================================
// Enhanced React Component Testing
// ============================================================================

/**
 * Enhanced render function with default providers
 * @param ui
 * @param options
 */
export const renderWithProviders = (
	ui: ReactElement,
	options: RenderOptions & {
		authState?: AuthTestState
		apiConfig?: Partial<ApiTestConfig>
		mswHandlers?: unknown[]
	} = {},
): EnhancedRenderResult => {
	const {
		authState = createMockAuthState(),
		apiConfig = {},
		mswHandlers = [],
		...renderOptions
	} = options

	// Setup MSW if handlers provided
	if (mswHandlers.length > 0) {
		setupMSWServer(mswHandlers)
	}

	// Create test context
	const testContext: ComponentTestContext = {
		authState,
		apiConfig: {
			baseURL: defaultBaseURL,
			apiKey: defaultApiKey,
			withCredentials: defaultWithCredentials,
			timeout: defaultTimeout,
			...apiConfig,
		},
		mswHandlers,
	}

	// Render with context
	return {
		...render(ui, renderOptions),
		testContext,
	}
}

/**
 * Create mock router context for testing
 * @param overrides
 */
export const createMockRouterContext = (overrides = {}) => {
	return {
		router: {
			navigate: vi.fn(),
			state: {
				location: {
					pathname: '/test',
					search: '',
					hash: '',
				},
			},
		},
		...overrides,
	}
}

// ============================================================================
// Enhanced Test Data Factories
// ============================================================================

/**
 * Enhanced test data factories specific to client-ui
 */
export const clientUITestData = {
	/**
	 * Create API client configuration
	 * @param overrides
	 */
	apiConfig: (overrides: Partial<ApiTestConfig> = {}): ApiTestConfig => ({
		baseURL: defaultBaseURL,
		apiKey: defaultApiKey,
		withCredentials: defaultWithCredentials,
		timeout: defaultTimeout,
		...overrides,
	}),

	/**
	 * Create chat data with user context
	 * @param userOverrides
	 * @param chatOverrides
	 */
	chatWithUser: (userOverrides = {}, chatOverrides = {}) => {
		const user = userFactory.create(userOverrides)
		const chat = chatFactory.create({
			userId: user.id,
			...chatOverrides,
		})
		return { user, chat }
	},

	/**
	 * Create message data with chat context
	 * @param chatOverrides
	 * @param messageOverrides
	 */
	messageWithChat: (chatOverrides = {}, messageOverrides = {}) => {
		const chat = chatFactory.create(chatOverrides)
		const message = chatFactory.createMessage({
			chatId: chat.id,
			...messageOverrides,
		})
		return { chat, message }
	},

	/**
	 * Create complete conversation data
	 * @param userOverrides
	 * @param chatOverrides
	 * @param messageCount
	 */
	conversation: (userOverrides = {}, chatOverrides = {}, messageCount = 3) => {
		const user = userFactory.create(userOverrides)
		const chat = chatFactory.create({
			userId: user.id,
			...chatOverrides,
		})
		const messages = Array.from({ length: messageCount }, (_, index) =>
			chatFactory.createMessage({
				chatId: chat.id,
				role: index % 2 === 0 ? 'user' : 'assistant',
				content: `Test message ${String(index + 1)}`,
			}),
		)
		return { user, chat, messages }
	},
}

// ============================================================================
// Enhanced Test Utilities
// ============================================================================

/**
 * Enhanced test utilities specific to client-ui
 */
export const clientUITestUtils = {
	/**
	 * Wait for API call to complete
	 * @param mockFn
	 * @param timeout
	 */
	waitForApiCall: async (mockFn: ReturnType<typeof vi.fn>, timeout = 5000) => {
		const start = Date.now()
		while (Date.now() - start < timeout) {
			if (mockFn.mock.calls.length > 0) {
				return mockFn.mock.calls[0]
			}
			await new Promise((resolve) => setTimeout(resolve, 100))
		}
		throw new Error(`API call not made within ${String(timeout)}ms`)
	},

	/**
	 * Wait for component to update
	 */
	waitForComponentUpdate: async () => {
		await new Promise((resolve) => setTimeout(resolve, 100))
	},

	/**
	 * Simulate user interaction delay
	 * @param ms
	 */
	simulateUserDelay: async (ms = 100) => {
		await new Promise((resolve) => setTimeout(resolve, ms))
	},

	/**
	 * Create mock file for file upload testing
	 * @param name
	 * @param type
	 * @param content
	 */
	createMockFile: (
		name = 'test.txt',
		type = 'text/plain',
		content = 'test content',
	) => {
		const file = new File([content], name, { type })
		return file
	},

	/**
	 * Create mock form data
	 * @param data
	 */
	createMockFormData: (data: Record<string, string | Blob>) => {
		const formData = new FormData()
		Object.entries(data).forEach(([key, value]) => {
			formData.append(key, value)
		})
		return formData
	},
}

// ============================================================================
// Enhanced Test Assertions
// ============================================================================

/**
 * Enhanced test assertions specific to client-ui
 */
export const clientUITestAssertions = {
	/**
	 * Assert API call was made with correct parameters
	 * @param mockFn
	 * @param expectedUrl
	 * @param expectedMethod
	 * @param expectedData
	 */
	assertApiCall: (
		mockFn: ReturnType<typeof vi.fn>,
		expectedUrl: string,
		expectedMethod: string,
		expectedData?: unknown,
	) => {
		expect(mockFn).toHaveBeenCalled()
		const call = mockFn.mock.calls[0]
		if (call) {
			expect(call[0]).toBe(expectedUrl)
			expect(call[1]).toBe(expectedMethod)
			if (expectedData) {
				expect(call[2]).toEqual(expectedData)
			}
		}
	},

	/**
	 * Assert authentication state
	 * @param authState
	 * @param expected
	 */
	assertAuthState: (
		authState: AuthTestState,
		expected: Partial<AuthTestState>,
	) => {
		Object.entries(expected).forEach(([key, value]) => {
			expect(authState[key as keyof AuthTestState]).toEqual(value)
		})
	},

	/**
	 * Assert API response structure
	 * @param response
	 * @param expectedData
	 */
	assertApiResponse: (response: unknown, expectedData?: unknown) => {
		expect(response).toHaveProperty('success')
		expect(response).toHaveProperty('data')
		expect(response).toHaveProperty('timestamp')
		if (
			expectedData &&
			response &&
			typeof response === 'object' &&
			'data' in response
		) {
			expect((response as { data: unknown }).data).toEqual(expectedData)
		}
	},

	/**
	 * Assert error response structure
	 * @param response
	 * @param expectedMessage
	 * @param expectedCode
	 */
	assertErrorResponse: (
		response: unknown,
		expectedMessage?: string,
		expectedCode?: string,
	) => {
		expect(response).toHaveProperty('success', false)
		expect(response).toHaveProperty('error')
		if (response && typeof response === 'object' && 'error' in response) {
			const error = (response as { error: unknown }).error
			expect(error).toHaveProperty('message')
			expect(error).toHaveProperty('code')
			expect(error).toHaveProperty('timestamp')
			if (
				expectedMessage &&
				error &&
				typeof error === 'object' &&
				'message' in error
			) {
				expect((error as { message: unknown }).message).toBe(expectedMessage)
			}
			if (
				expectedCode &&
				error &&
				typeof error === 'object' &&
				'code' in error
			) {
				expect((error as { code: unknown }).code).toBe(expectedCode)
			}
		}
	},
}

// ============================================================================
// Re-export from config-testing
// ============================================================================

export { userFactory, authFactory, chatFactory, apiResponseFactory, testUtils }
