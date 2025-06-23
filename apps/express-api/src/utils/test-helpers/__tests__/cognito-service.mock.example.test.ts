import {
	CognitoIdentityProviderClient,
	GetUserCommand,
	GetUserCommandOutput,
} from '@aws-sdk/client-cognito-identity-provider'
import { AwsClientStub } from 'aws-sdk-client-mock'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { Result } from '../../../utils/errors.ts'
import { mockCognitoService } from '../cognito-service.mock.ts'
import { mockConfig } from '../config.mock.ts'

/**
 * Example test demonstrating the simplified aws-sdk-client-mock approach
 * This shows how to use the reusable mock for service-level tests
 */

// Mock the config using the reusable helper
vi.mock('../../../config/default.ts', () => mockConfig.createModule())

describe('CognitoService Mock Example - AWS SDK Client Mock', () => {
	let cognitoMock: AwsClientStub<CognitoIdentityProviderClient>

	beforeEach(() => {
		// Setup config mock for consistent test environment
		mockConfig.setup()

		// Create the AWS SDK client mock
		cognitoMock = mockCognitoService.createAwsMock()
	})

	it('should demonstrate successful GetUser response', () => {
		// Arrange - Create properly typed mock user
		const mockUser: GetUserCommandOutput = mockCognitoService.createUser({
			Username: 'example-user-123',
			UserAttributes: [
				{ Name: 'email', Value: 'example@test.com' },
				{ Name: 'email_verified', Value: 'true' },
			],
		})

		// Mock the AWS SDK call
		cognitoMock.on(GetUserCommand).resolves(mockUser)

		// Act - This would be your actual service call
		// const result = await cognitoService.getAuthUser('test-token')

		// Assert - Verify the mock was set up correctly
		expect(mockUser.Username).toBe('example-user-123')
		expect(mockUser.UserAttributes).toHaveLength(2)
		expect(mockUser.$metadata.httpStatusCode).toBe(200)
	})

	it('should demonstrate error response using error helpers', () => {
		// Arrange - Create properly typed Cognito error
		const cognitoError = mockCognitoService.errorHelpers.userNotFound(
			'User does not exist',
		)

		// Mock the AWS SDK call to reject with the error
		cognitoMock.on(GetUserCommand).rejects(cognitoError)

		// Assert - Verify the error is properly typed
		expect(cognitoError.__type).toBe('UserNotFoundException')
		expect(cognitoError.message).toBe('User does not exist')
		expect(cognitoError.$metadata.httpStatusCode).toBe(404)
		expect(cognitoError.$fault).toBe('client')
	})

	it('should demonstrate different error types', () => {
		// Test different error scenarios
		const errors = {
			usernameExists: mockCognitoService.errorHelpers.usernameExists(),
			userNotConfirmed: mockCognitoService.errorHelpers.userNotConfirmed(),
			notAuthorized: mockCognitoService.errorHelpers.notAuthorized(),
			codeMismatch: mockCognitoService.errorHelpers.codeMismatch(),
			expiredCode: mockCognitoService.errorHelpers.expiredCode(),
			tooManyRequests: mockCognitoService.errorHelpers.tooManyRequests(),
		}

		// Verify each error type has correct properties
		expect(errors.usernameExists.__type).toBe('UsernameExistsException')
		expect(errors.userNotConfirmed.__type).toBe('UserNotConfirmedException')
		expect(errors.notAuthorized.__type).toBe('NotAuthorizedException')
		expect(errors.codeMismatch.__type).toBe('CodeMismatchException')
		expect(errors.expiredCode.__type).toBe('ExpiredCodeException')
		expect(errors.tooManyRequests.__type).toBe('TooManyRequestsException')

		// All should have proper HTTP status codes
		expect(errors.usernameExists.$metadata.httpStatusCode).toBe(400)
		expect(errors.notAuthorized.$metadata.httpStatusCode).toBe(401)
		expect(errors.tooManyRequests.$metadata.httpStatusCode).toBe(429)
	})

	it('should demonstrate custom error creation', () => {
		// Create a custom error with specific properties
		const customError = mockCognitoService.createError('Custom error message', {
			__type: 'CustomException',
			httpStatusCode: 500,
			$fault: 'server',
			code: 'CUSTOM_ERROR_CODE',
		})

		expect(customError.message).toBe('Custom error message')
		expect(customError.__type).toBe('CustomException')
		expect(customError.$metadata.httpStatusCode).toBe(500)
		expect(customError.$fault).toBe('server')
		expect(customError.code).toBe('CUSTOM_ERROR_CODE')
	})
})

describe('CognitoService Mock Example - Service Method Mock', () => {
	let cognitoMocks: ReturnType<typeof mockCognitoService.setupServiceMock>

	beforeEach(() => {
		// Setup config mock for consistent test environment
		mockConfig.setup()

		// Setup service method mocks (for middleware/controller tests)
		cognitoMocks = mockCognitoService.setupServiceMock()
	})

	it('should demonstrate service method mocking', async () => {
		// Arrange - Create mock response
		const mockUser = mockCognitoService.createUser({
			Username: 'service-test-user',
		})

		// Mock the service method to return a Result tuple
		cognitoMocks.mockGetAuthUser.mockResolvedValue([mockUser, null])

		// Act - This would be your middleware/controller calling the service
		const [result, error] = (await cognitoMocks.mockGetAuthUser(
			'test-token',
		)) as Result<GetUserCommandOutput>

		// Assert
		expect(error).toBeNull()
		expect(result).toEqual(mockUser)
		expect(result).toBeDefined()
		expect(result?.Username).toBe('service-test-user')
		expect(cognitoMocks.mockGetAuthUser).toHaveBeenCalledWith('test-token')
	})

	it('should demonstrate service method error mocking', async () => {
		// Arrange - Create error
		const cognitoError =
			mockCognitoService.errorHelpers.notAuthorized('Invalid token')

		// Mock the service method to return an error
		cognitoMocks.mockGetAuthUser.mockResolvedValue([
			null,
			cognitoError as unknown as Error,
		])

		// Act
		const [result, error] = (await cognitoMocks.mockGetAuthUser(
			'invalid-token',
		)) as Result<GetUserCommandOutput>

		// Assert
		expect(result).toBeNull()
		expect(error).toEqual(cognitoError)
		expect(cognitoMocks.mockGetAuthUser).toHaveBeenCalledWith('invalid-token')
	})
})
