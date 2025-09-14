import {
	CognitoIdentityProviderClient,
	type GetUserCommandOutput,
	type SignUpCommandOutput,
} from '@aws-sdk/client-cognito-identity-provider'
import { type AwsClientStub, mockClient } from 'aws-sdk-client-mock'
import { vi } from 'vitest'
import type { cognitoService } from '../../features/auth/auth.services.ts'

// Type inference helper - this will be used inside functions to avoid hoisting issues
type CognitoServiceType = typeof cognitoService

// Type inference from actual cognitoService instance - following established pattern
// This ensures our mocks stay in sync with the real implementation
type MockCognitoServiceType = {
	[K in keyof CognitoServiceType]: ReturnType<typeof vi.fn>
}

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

// Service method mocks are statically defined to avoid hoisting issues with vi.mock
// The type definition ensures our mocks stay in sync with the expected interface

/**
 * Creates and returns an AWS SDK client mock for CognitoIdentityProviderClient
 * Use this for service-level tests that test the CognitoService directly
 */
export const createAwsMock =
	(): AwsClientStub<CognitoIdentityProviderClient> => {
		return mockClient(CognitoIdentityProviderClient)
	}

/**
 * Creates a basic service mock with all methods
 * Use this for creating fresh mock instances
 * Creates mocks for all known CognitoService methods based on the type inference
 */
export const createCognitoServiceMock = (): MockCognitoServiceType => {
	// Create mocks for all known methods - these are inferred from the type
	// This maintains type safety while avoiding hoisting issues
	return {
		signUpUser: vi.fn(),
		confirmSignUp: vi.fn(),
		resendConfirmationCode: vi.fn(),
		signInUser: vi.fn(),
		signOutUser: vi.fn(),
		refreshToken: vi.fn(),
		forgotPassword: vi.fn(),
		confirmForgotPassword: vi.fn(),
		getAuthUser: vi.fn(),
	} as MockCognitoServiceType
}

/**
 * Creates a mock factory for vi.mock() to mock the CognitoService class
 * Use this for middleware/controller tests that use the CognitoService
 */
export const createServiceMock = (): {
	CognitoService: ReturnType<typeof vi.fn>
	cognitoService: MockCognitoServiceType
} => {
	const serviceMock = createCognitoServiceMock()

	return {
		CognitoService: vi.fn().mockImplementation(() => serviceMock),
		cognitoService: serviceMock,
	}
}

/**
 * Sets up and returns the service method mocks for easy access in tests
 * Use this in beforeEach for middleware/controller tests
 */
export const setupServiceMock = (): MockCognitoServiceType => {
	vi.clearAllMocks()
	return createCognitoServiceMock()
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
	// eslint-disable-next-line no-underscore-dangle
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
 * Following the established pattern from other mock helpers
 */
export const mockCognitoService = {
	// Core factory functions
	create: createCognitoServiceMock,
	createModule: createServiceMock,
	setup: setupServiceMock,

	// AWS SDK Client Mock (for service-level tests)
	createAwsMock,

	// Mock data creators
	createUser: createMockCognitoUser,
	createSignUpResponse: createMockSignUpResponse,
	createError: createMockCognitoError,

	// Error helpers for common scenarios
	errorHelpers: createCognitoErrorHelpers,
}
