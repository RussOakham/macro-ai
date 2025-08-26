import { vi } from 'vitest'

// Mock interface for the ParameterStoreService
// Simple interface with just the methods we need to mock
interface MockParameterStoreServiceType {
	getParameter: ReturnType<typeof vi.fn>
	getParametersByPath: ReturnType<typeof vi.fn>
	getCognitoConfig: ReturnType<typeof vi.fn>
	clearCache: ReturnType<typeof vi.fn>
}

/**
 * Mock helper for ParameterStoreService
 *
 * This mock provides test doubles for the Parameter Store service methods,
 * allowing tests to control what configuration values are returned without
 * making actual AWS API calls.
 */

/**
 * Creates a basic ParameterStoreService mock with all methods
 */
export const createParameterStoreServiceMock =
	(): MockParameterStoreServiceType => {
		return {
			getParameter: vi.fn(),
			getParametersByPath: vi.fn(),
			getCognitoConfig: vi.fn(),
			clearCache: vi.fn(),
		}
	}

/**
 * Creates a mock factory for vi.mock() to mock the createParameterStoreService function
 */
export const createServiceMock = () => {
	const mockService = createParameterStoreServiceMock()

	return {
		createParameterStoreService: vi.fn(() => mockService),
		ParameterStoreService: vi.fn().mockImplementation(() => mockService),
	}
}

/**
 * Sets up a fresh ParameterStoreService mock and returns it
 * Use this in beforeEach to get a clean mock for each test
 */
export const setupServiceMock = () => {
	const mockService = createParameterStoreServiceMock()

	// Reset all mocks
	vi.clearAllMocks()

	return mockService
}

/**
 * Creates mock Cognito configuration data
 */
export const createMockCognitoConfig = (
	overrides: Partial<{
		region: string
		userPoolId: string
		userPoolClientId: string
		userPoolSecretKey: string
		refreshTokenExpiry: number
	}> = {},
) => {
	return {
		region: 'us-east-1',
		userPoolId: 'us-east-1_testpool123',
		userPoolClientId: 'testclientid123456789',
		userPoolSecretKey: 'test-secret-key-for-testing-only',
		refreshTokenExpiry: 30,
		...overrides,
	}
}

/**
 * Creates mock parameter values for testing
 */
export const createMockParameters = (
	overrides: Record<string, string> = {},
) => {
	const defaultParams = {
		'aws-cognito-region': 'us-east-1',
		'aws-cognito-user-pool-id': 'us-east-1_testpool123',
		'aws-cognito-user-pool-client-id': 'testclientid123456789',
		'aws-cognito-user-pool-secret-key': 'test-secret-key-for-testing-only',
		'aws-cognito-refresh-token-expiry': '30',
		...overrides,
	}

	return defaultParams
}

/**
 * Sets up a ParameterStoreService mock with default Cognito configuration
 * This is the most common use case for CognitoService tests
 */
export const setupDefaultCognitoConfig = () => {
	const mockService = setupServiceMock()
	const mockConfig = createMockCognitoConfig()

	// Mock the getCognitoConfig method to return the default config
	mockService.getCognitoConfig.mockResolvedValue(mockConfig)

	// Also mock individual parameter methods for flexibility
	mockService.getParameter.mockImplementation(
		(paramName: keyof ReturnType<typeof createMockParameters>) => {
			const mockParams = createMockParameters()
			return Promise.resolve(mockParams[paramName] || 'mock-value')
		},
	)

	return mockService
}

/**
 * Sets up a ParameterStoreService mock that simulates configuration loading failure
 */
export const setupFailedConfig = () => {
	const mockService = setupServiceMock()

	// Mock the getCognitoConfig method to throw an error
	mockService.getCognitoConfig.mockRejectedValue(
		new Error('Failed to load configuration from Parameter Store'),
	)

	return mockService
}

/**
 * Unified export object following the established pattern from other mock helpers
 */
export const mockParameterStore = {
	// Core factory functions
	create: createParameterStoreServiceMock,
	createModule: createServiceMock,
	setup: setupServiceMock,

	// Pre-configured setups
	setupDefaultCognitoConfig,
	setupFailedConfig,

	// Mock data creators
	createCognitoConfig: createMockCognitoConfig,
	createParameters: createMockParameters,
}
