import {
	CognitoIdentityProviderClient,
	GetUserCommandOutput,
	SignUpCommandOutput,
} from '@aws-sdk/client-cognito-identity-provider'
import { AwsClientStub, mockClient } from 'aws-sdk-client-mock'
import { vi } from 'vitest'

// Cognito error interface for proper typing
interface ICognitoError extends Error {
	$fault: 'client' | 'server'
	$metadata: {
		httpStatusCode: number
		requestId: string
		extendedRequestId?: string
		cfId?: string
		attempts: number
		totalRetryDelay: number
	}
	__type: string
	message: string
	code?: string
}

/**
 * Reusable mock for CognitoService supporting both approaches:
 * 1. AWS SDK Client Mock (for service-level tests)
 * 2. Service Method Mock (for middleware/controller tests)
 *
 * AWS SDK Client Mock Usage (for auth.services.test.ts):
 * ```typescript
 * import { mockCognitoService } from '../../utils/test-helpers/cognito-service.mock.ts'
 *
 * describe('CognitoService', () => {
 *   let cognitoMock: AwsClientStub<CognitoIdentityProviderClient>
 *
 *   beforeEach(() => {
 *     cognitoMock = mockCognitoService.createAwsMock()
 *   })
 *
 *   it('should test something', () => {
 *     const mockUser = mockCognitoService.createUser({ Username: 'test-user' })
 *     cognitoMock.on(GetUserCommand).resolves(mockUser)
 *   })
 * })
 * ```
 *
 * Service Method Mock Usage (for middleware/controller tests):
 * ```typescript
 * import { mockCognitoService } from '../../utils/test-helpers/cognito-service.mock.ts'
 *
 * vi.mock('../../features/auth/auth.services.ts', () => mockCognitoService.createServiceMock())
 *
 * describe('Auth Middleware', () => {
 *   let cognitoMocks: ReturnType<typeof mockCognitoService.setupServiceMock>
 *
 *   beforeEach(() => {
 *     cognitoMocks = mockCognitoService.setupServiceMock()
 *   })
 *
 *   it('should test something', () => {
 *     const mockUser = mockCognitoService.createUser({ Username: 'test-user' })
 *     cognitoMocks.mockGetAuthUser.mockResolvedValue([mockUser, null])
 *   })
 * })
 * ```
 */

// Service method mocks for middleware/controller tests
export const mockGetAuthUser = vi.fn()
export const mockSignUpUser = vi.fn()
export const mockConfirmSignUp = vi.fn()
export const mockResendConfirmationCode = vi.fn()
export const mockSignInUser = vi.fn()
export const mockSignOutUser = vi.fn()
export const mockForgotPassword = vi.fn()
export const mockConfirmForgotPassword = vi.fn()

/**
 * Creates and returns an AWS SDK client mock for CognitoIdentityProviderClient
 * Use this for service-level tests that test the CognitoService directly
 */
export const createAwsMock =
	(): AwsClientStub<CognitoIdentityProviderClient> => {
		return mockClient(CognitoIdentityProviderClient)
	}

/**
 * Creates a mock factory for vi.mock() to mock the CognitoService class
 * Use this for middleware/controller tests that use the CognitoService
 */
export const createServiceMock = () => ({
	CognitoService: vi.fn().mockImplementation(() => ({
		getAuthUser: mockGetAuthUser,
		signUpUser: mockSignUpUser,
		confirmSignUp: mockConfirmSignUp,
		resendConfirmationCode: mockResendConfirmationCode,
		signInUser: mockSignInUser,
		signOutUser: mockSignOutUser,
		forgotPassword: mockForgotPassword,
		confirmForgotPassword: mockConfirmForgotPassword,
	})),
	cognitoService: {
		getAuthUser: mockGetAuthUser,
		signUpUser: mockSignUpUser,
		confirmSignUp: mockConfirmSignUp,
		resendConfirmationCode: mockResendConfirmationCode,
		signInUser: mockSignInUser,
		signOutUser: mockSignOutUser,
		forgotPassword: mockForgotPassword,
		confirmForgotPassword: mockConfirmForgotPassword,
	},
})

/**
 * Sets up and returns the service method mocks for easy access in tests
 * Use this in beforeEach for middleware/controller tests
 */
export const setupServiceMock = () => {
	vi.clearAllMocks()

	// Reset all mock implementations
	mockGetAuthUser.mockReset()
	mockSignUpUser.mockReset()
	mockConfirmSignUp.mockReset()
	mockResendConfirmationCode.mockReset()
	mockSignInUser.mockReset()
	mockSignOutUser.mockReset()
	mockForgotPassword.mockReset()
	mockConfirmForgotPassword.mockReset()

	return {
		mockGetAuthUser,
		mockSignUpUser,
		mockConfirmSignUp,
		mockResendConfirmationCode,
		mockSignInUser,
		mockSignOutUser,
		mockForgotPassword,
		mockConfirmForgotPassword,
	}
}

/**
 * Creates a mock Cognito user object for testing
 *
 * @param overrides - Properties to override in the default user object
 * @returns Mock Cognito user object with proper GetUserCommandOutput type
 */
export const createMockCognitoUser = (
	overrides: Partial<GetUserCommandOutput> = {},
): GetUserCommandOutput => ({
	Username: 'test-user-id-123',
	UserAttributes: [
		{ Name: 'email', Value: 'test@example.com' },
		{ Name: 'email_verified', Value: 'true' },
	],
	$metadata: {
		httpStatusCode: 200,
		requestId: 'test-request-id',
		attempts: 1,
		totalRetryDelay: 0,
	},
	...overrides,
})

/**
 * Creates a mock SignUp response for testing
 */
export const createMockSignUpResponse = (
	overrides: Partial<SignUpCommandOutput> = {},
): SignUpCommandOutput => ({
	UserSub: 'test-user-sub-123',
	UserConfirmed: false,
	$metadata: {
		httpStatusCode: 200,
		requestId: 'test-request-id',
		attempts: 1,
		totalRetryDelay: 0,
	},
	...overrides,
})

/**
 * Creates a mock Cognito error for testing with proper ICognitoError typing
 *
 * @param message - Error message
 * @param options - Optional error configuration
 * @returns Mock Cognito error object with proper typing
 */
export const createMockCognitoError = (
	message: string,
	options: {
		code?: string
		__type?: string
		httpStatusCode?: number
		$fault?: 'client' | 'server'
	} = {},
): ICognitoError => {
	const {
		code,
		__type = 'UnknownException',
		httpStatusCode = 400,
		$fault = 'client',
	} = options

	const error = new Error(message) as ICognitoError

	// Add Cognito-specific properties
	error.$fault = $fault
	error.$metadata = {
		httpStatusCode,
		requestId: `mock-request-id-${Date.now().toString()}`,
		attempts: 1,
		totalRetryDelay: 0,
	}
	error.__type = __type
	error.message = message

	if (code) {
		error.code = code
	}

	return error
}

/**
 * Helper functions for common Cognito error types
 * These can be used with aws-sdk-client-mock to simulate AWS errors
 */
export const createCognitoErrorHelpers = {
	/**
	 * Creates a UsernameExistsException error
	 */
	usernameExists: (message = 'User already exists'): ICognitoError =>
		createMockCognitoError(message, {
			__type: 'UsernameExistsException',
			httpStatusCode: 400,
			$fault: 'client',
		}),

	/**
	 * Creates a UserNotConfirmedException error
	 */
	userNotConfirmed: (message = 'User is not confirmed'): ICognitoError =>
		createMockCognitoError(message, {
			__type: 'UserNotConfirmedException',
			httpStatusCode: 400,
			$fault: 'client',
		}),

	/**
	 * Creates a UserNotFoundException error
	 */
	userNotFound: (message = 'User not found'): ICognitoError =>
		createMockCognitoError(message, {
			__type: 'UserNotFoundException',
			httpStatusCode: 404,
			$fault: 'client',
		}),

	/**
	 * Creates a NotAuthorizedException error
	 */
	notAuthorized: (message = 'Invalid username or password'): ICognitoError =>
		createMockCognitoError(message, {
			__type: 'NotAuthorizedException',
			httpStatusCode: 401,
			$fault: 'client',
		}),

	/**
	 * Creates a CodeMismatchException error
	 */
	codeMismatch: (message = 'Invalid verification code'): ICognitoError =>
		createMockCognitoError(message, {
			__type: 'CodeMismatchException',
			httpStatusCode: 400,
			$fault: 'client',
		}),

	/**
	 * Creates an ExpiredCodeException error
	 */
	expiredCode: (message = 'Verification code has expired'): ICognitoError =>
		createMockCognitoError(message, {
			__type: 'ExpiredCodeException',
			httpStatusCode: 400,
			$fault: 'client',
		}),

	/**
	 * Creates a TooManyRequestsException error
	 */
	tooManyRequests: (message = 'Too many requests'): ICognitoError =>
		createMockCognitoError(message, {
			__type: 'TooManyRequestsException',
			httpStatusCode: 429,
			$fault: 'client',
		}),
}

/**
 * Unified export object supporting both AWS SDK mocking and service method mocking
 */
export const mockCognitoService = {
	// AWS SDK Client Mock (for service-level tests)
	createAwsMock,

	// Service Method Mock (for middleware/controller tests)
	createServiceMock,
	setupServiceMock,

	// Mock data creators
	createUser: createMockCognitoUser,
	createSignUpResponse: createMockSignUpResponse,
	createError: createMockCognitoError,

	// Error helpers for common scenarios
	errorHelpers: createCognitoErrorHelpers,
}
