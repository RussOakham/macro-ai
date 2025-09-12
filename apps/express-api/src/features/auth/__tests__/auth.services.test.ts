/* eslint-disable @typescript-eslint/no-explicit-any */
import {
	CognitoIdentityProviderClient,
	ConfirmSignUpCommand,
	ForgotPasswordCommandOutput,
	GetUserCommand,
	GlobalSignOutCommand,
	InitiateAuthCommand,
	ListUsersCommand,
	SignUpCommand,
	type ConfirmForgotPasswordCommandOutput,
	type ConfirmSignUpCommandOutput,
	type GetUserCommandOutput,
	type GlobalSignOutCommandOutput,
	type InitiateAuthCommandOutput,
	type ListUsersCommandOutput,
	type ResendConfirmationCodeCommandOutput,
	type SignUpCommandOutput,
	type UserType,
} from '@aws-sdk/client-cognito-identity-provider'
import { mockClient } from 'aws-sdk-client-mock'
import crypto from 'node:crypto'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
	tryCatch,
	tryCatchSync,
} from '../../../utils/error-handling/try-catch.ts'
import {
	InternalError,
	NotFoundError,
	ValidationError,
	type AppError,
} from '../../../utils/errors.ts'
import { MockDataFactory } from '../../../utils/test-helpers/advanced-mocking.ts'
import { mockConfig } from '../../../utils/test-helpers/config.mock.ts'
import { mockLogger } from '../../../utils/test-helpers/logger.mock.ts'
import { mockParameterStore } from '../../../utils/test-helpers/parameter-store.mock.ts'
import { CognitoService } from '../auth.services.ts'
import type { TRegisterUserRequest } from '../auth.types.ts'

// Mock the logger using the reusable helper
vi.mock('../../../utils/logger.ts', () => mockLogger.createModule())

// Mock the config using the reusable helper
vi.mock('../../../utils/load-config.ts', () => mockConfig.createModule())

// Mock the Parameter Store service
vi.mock('../../../utils/parameter-store.ts', () => ({
	createParameterStoreService: vi.fn(),
	ParameterStoreService: vi.fn(),
}))

// Mock the tryCatch utilities
vi.mock('../../../utils/error-handling/try-catch.ts', () => ({
	tryCatch: vi.fn(),
	tryCatchSync: vi.fn(),
}))

// Mock crypto
vi.mock('crypto', () => ({
	default: {
		randomUUID: vi.fn(),
		createHmac: vi.fn().mockReturnValue({
			update: vi.fn().mockReturnThis(),
			digest: vi.fn().mockReturnValue('mock-secret-hash'),
		}),
	},
}))

// Create AWS SDK mock
const cognitoMock = mockClient(CognitoIdentityProviderClient)

// Helper function to mock tryCatchSync with real implementation
const mockTryCatchSyncWithRealImplementation = () => {
	vi.mocked(tryCatchSync).mockImplementation((fn) => {
		try {
			const result = fn()
			return [result, null]
		} catch (error) {
			return [null, error as AppError]
		}
	})
}

describe('CognitoService', () => {
	let cognitoService: CognitoService

	beforeEach(async () => {
		// Clear all mocks for test isolation
		vi.clearAllMocks()

		// Use config mock setup for consistent test environment
		mockConfig.setup()
		mockLogger.setup()
		cognitoMock.reset()

		// Mock the Parameter Store service to return default Cognito configuration
		const mockParamStore = mockParameterStore.setupDefaultCognitoConfig()
		const { createParameterStoreService } = await import(
			'../../../utils/parameter-store.ts'
		)
		vi.mocked(createParameterStoreService).mockReturnValue(
			mockParamStore as any,
		)

		cognitoService = new CognitoService()
	})

	describe('signUpUser', () => {
		const validRequest: TRegisterUserRequest = {
			email: 'test@example.com',
			password: 'Password123!',
			confirmPassword: 'Password123!',
		}

		it('should successfully sign up a user when passwords match', async () => {
			// Arrange
			const mockUserId = MockDataFactory.uuid()
			const mockSignUpResponse: SignUpCommandOutput = {
				UserSub: mockUserId,
				UserConfirmed: false,
				$metadata: {
					httpStatusCode: 200,
					requestId: 'test-request-id',
				},
			}

			vi.mocked(crypto.randomUUID).mockReturnValue(
				mockUserId as `${string}-${string}-${string}-${string}-${string}`,
			)
			vi.mocked(tryCatchSync)
				.mockReturnValueOnce([true, null]) // password validation
				.mockReturnValueOnce(['mock-secret-hash', null]) // hash generation
			vi.mocked(tryCatch).mockResolvedValue([mockSignUpResponse, null])

			cognitoMock.on(SignUpCommand).resolves(mockSignUpResponse)

			// Act
			const [result, error] = await cognitoService.signUpUser(validRequest)

			// Assert
			expect(vi.mocked(tryCatchSync)).toHaveBeenCalledTimes(2)
			expect(vi.mocked(tryCatch)).toHaveBeenCalledOnce()
			expect(result).toEqual(mockSignUpResponse)
			expect(error).toBeNull()
		})

		it('should return validation error when passwords do not match', async () => {
			// Arrange
			const invalidRequest = {
				...validRequest,
				// eslint-disable-next-line no-secrets/no-secrets
				confirmPassword: 'DifferentPassword123!',
			}
			const validationError = new ValidationError(
				'Passwords do not match',
				undefined,
				'authService',
			)

			vi.mocked(tryCatchSync).mockReturnValue([null, validationError])

			// Act
			const [result, error] = await cognitoService.signUpUser(invalidRequest)

			// Assert
			expect(vi.mocked(tryCatchSync)).toHaveBeenCalledOnce()
			expect(vi.mocked(tryCatch)).not.toHaveBeenCalled()
			expect(result).toBeNull()
			expect(error).toEqual(validationError)
		})

		it('should return error when hash generation fails', async () => {
			// Arrange
			const hashError = new InternalError(
				'Hash generation failed',
				'authService',
			)

			vi.mocked(tryCatchSync)
				.mockReturnValueOnce([true, null]) // password validation
				.mockReturnValueOnce([null, hashError]) // hash generation

			// Act
			const [result, error] = await cognitoService.signUpUser(validRequest)

			// Assert
			expect(vi.mocked(tryCatchSync)).toHaveBeenCalledTimes(2)
			expect(vi.mocked(tryCatch)).not.toHaveBeenCalled()
			expect(result).toBeNull()
			expect(error).toEqual(hashError)
		})

		it('should return error when Cognito service fails', async () => {
			// Arrange
			const mockUserId = '123e4567-e89b-12d3-a456-426614174000'
			const mockSecretHash = 'mock-secret-hash'
			const cognitoError = new InternalError('Cognito error', 'authService')

			vi.mocked(crypto.randomUUID).mockReturnValue(
				mockUserId as `${string}-${string}-${string}-${string}-${string}`,
			)
			vi.mocked(tryCatchSync)
				.mockReturnValueOnce([true, null]) // password validation
				.mockReturnValueOnce([mockSecretHash, null]) // hash generation
			vi.mocked(tryCatch).mockResolvedValue([null, cognitoError])

			// Act
			const [result, error] = await cognitoService.signUpUser(validRequest)

			// Assert
			expect(vi.mocked(tryCatch)).toHaveBeenCalledOnce()
			expect(result).toBeNull()
			expect(error).toEqual(cognitoError)
		})
	})

	describe('confirmSignUp', () => {
		const email = 'test@example.com'
		const code = 123456

		it('should successfully confirm sign up', async () => {
			// Arrange
			const mockUser: UserType = {
				Username: MockDataFactory.uuid(),
				Attributes: [{ Name: 'email', Value: email }],
				UserCreateDate: new Date(),
				UserLastModifiedDate: new Date(),
				Enabled: true,
				UserStatus: 'CONFIRMED',
			}
			const mockUsersResponse: ListUsersCommandOutput = {
				Users: [mockUser],
				$metadata: {
					httpStatusCode: 200,
					requestId: 'test-request-id',
				},
			}
			const mockConfirmResponse: ConfirmSignUpCommandOutput = {
				$metadata: {
					httpStatusCode: 200,
					requestId: 'test-request-id',
				},
			}

			vi.mocked(tryCatch).mockResolvedValueOnce([mockUsersResponse, null])
			vi.mocked(tryCatchSync)
				.mockReturnValueOnce([mockUser, null]) // user validation
				.mockReturnValueOnce(['mock-secret-hash', null]) // hash generation
			vi.mocked(tryCatch).mockResolvedValueOnce([mockConfirmResponse, null])

			cognitoMock.on(ListUsersCommand).resolves(mockUsersResponse)
			cognitoMock.on(ConfirmSignUpCommand).resolves(mockConfirmResponse)

			// Act
			const [result, error] = await cognitoService.confirmSignUp(email, code)

			// Assert
			expect(vi.mocked(tryCatch)).toHaveBeenCalledTimes(2)
			expect(vi.mocked(tryCatchSync)).toHaveBeenCalledTimes(2)
			expect(result).toEqual(mockConfirmResponse)
			expect(error).toBeNull()
		})

		it('should return error when user lookup fails', async () => {
			// Arrange
			const getUserError = new InternalError(
				'User lookup failed',
				'authService',
			)

			vi.mocked(tryCatch).mockResolvedValue([null, getUserError])

			// Act
			const [result, error] = await cognitoService.confirmSignUp(email, code)

			// Assert
			expect(vi.mocked(tryCatch)).toHaveBeenCalledOnce()
			expect(result).toBeNull()
			expect(error).toEqual(getUserError)
		})

		it('should return error when user validation fails', async () => {
			// Arrange
			const mockUsersResponse = {
				Users: [],
			}
			const validationError = new NotFoundError('User not found', 'authService')

			vi.mocked(tryCatch).mockResolvedValue([mockUsersResponse, null])
			vi.mocked(tryCatchSync).mockReturnValue([null, validationError])

			// Act
			const [result, error] = await cognitoService.confirmSignUp(email, code)

			// Assert
			expect(vi.mocked(tryCatch)).toHaveBeenCalledOnce()
			expect(vi.mocked(tryCatchSync)).toHaveBeenCalledOnce()
			expect(result).toBeNull()
			expect(error).toEqual(validationError)
		})
	})

	describe('resendConfirmationCode', () => {
		const email = 'test@example.com'

		it('should successfully resend confirmation code', async () => {
			// Arrange
			const mockUser = {
				Username: '123e4567-e89b-12d3-a456-426614174000',
				Attributes: [{ Name: 'email', Value: email }],
			}
			const mockUsersResponse: ListUsersCommandOutput = {
				Users: [mockUser],
				$metadata: {
					httpStatusCode: 200,
					requestId: 'test-request-id',
				},
			}
			const mockSecretHash = 'mock-secret-hash'
			const mockResendResponse: ResendConfirmationCodeCommandOutput = {
				$metadata: {
					httpStatusCode: 200,
					requestId: 'test-request-id',
				},
			}

			vi.mocked(tryCatch).mockResolvedValueOnce([mockUsersResponse, null])
			vi.mocked(tryCatchSync)
				.mockReturnValueOnce([mockUser, null]) // user validation
				.mockReturnValueOnce([mockSecretHash, null]) // hash generation
			vi.mocked(tryCatch).mockResolvedValueOnce([mockResendResponse, null])

			// Act
			const [result, error] = await cognitoService.resendConfirmationCode(email)

			// Assert
			expect(vi.mocked(tryCatch)).toHaveBeenCalledTimes(2)
			expect(vi.mocked(tryCatchSync)).toHaveBeenCalledTimes(2)
			expect(result).toEqual(mockResendResponse)
			expect(error).toBeNull()
		})

		it('should return error when user lookup fails', async () => {
			// Arrange
			const getUserError = new InternalError(
				'User lookup failed',
				'authService',
			)

			vi.mocked(tryCatch).mockResolvedValue([null, getUserError])

			// Act
			const [result, error] = await cognitoService.resendConfirmationCode(email)

			// Assert
			expect(vi.mocked(tryCatch)).toHaveBeenCalledOnce()
			expect(result).toBeNull()
			expect(error).toEqual(getUserError)
		})
	})

	describe('signInUser', () => {
		const email = 'test@example.com'
		const password = 'Password123!'

		it('should successfully sign in a user', async () => {
			// Arrange
			const mockUser: UserType = {
				Username: '123e4567-e89b-12d3-a456-426614174000',
				Attributes: [{ Name: 'email', Value: email }],
				UserCreateDate: new Date(),
				UserLastModifiedDate: new Date(),
				Enabled: true,
				UserStatus: 'CONFIRMED',
			}
			const mockUsersResponse: ListUsersCommandOutput = {
				Users: [mockUser],
				$metadata: {
					httpStatusCode: 200,
					requestId: 'test-request-id',
				},
			}
			const mockSignInResponse: InitiateAuthCommandOutput = {
				AuthenticationResult: {
					AccessToken: 'access-token',
					RefreshToken: 'refresh-token',
					ExpiresIn: 3600,
					TokenType: 'Bearer',
				},
				$metadata: {
					httpStatusCode: 200,
					requestId: 'test-request-id',
				},
			}

			vi.mocked(tryCatch).mockResolvedValueOnce([mockUsersResponse, null])
			vi.mocked(tryCatchSync)
				.mockReturnValueOnce([mockUser, null]) // user validation
				.mockReturnValueOnce(['mock-secret-hash', null]) // hash generation
			vi.mocked(tryCatch).mockResolvedValueOnce([mockSignInResponse, null])

			// Act
			const [result, error] = await cognitoService.signInUser(email, password)

			// Assert
			expect(vi.mocked(tryCatch)).toHaveBeenCalledTimes(2)
			expect(vi.mocked(tryCatchSync)).toHaveBeenCalledTimes(2)
			expect(result).toEqual({
				...mockSignInResponse,
				Username: mockUser.Username,
			})
			expect(error).toBeNull()
		})

		it('should return error when user lookup fails', async () => {
			// Arrange
			const getUserError = new InternalError(
				'User lookup failed',
				'authService',
			)

			vi.mocked(tryCatch).mockResolvedValue([null, getUserError])

			// Act
			const [result, error] = await cognitoService.signInUser(email, password)

			// Assert
			expect(vi.mocked(tryCatch)).toHaveBeenCalledOnce()
			expect(result).toBeNull()
			expect(error).toEqual(getUserError)
		})

		it('should return error when user validation fails', async () => {
			// Arrange
			const mockUsersResponse: ListUsersCommandOutput = {
				Users: [],
				$metadata: {
					httpStatusCode: 200,
					requestId: 'test-request-id',
				},
			}
			const validationError = new NotFoundError('User not found', 'authService')

			vi.mocked(tryCatch).mockResolvedValue([mockUsersResponse, null])
			vi.mocked(tryCatchSync).mockReturnValue([null, validationError])

			// Act
			const [result, error] = await cognitoService.signInUser(email, password)

			// Assert
			expect(vi.mocked(tryCatch)).toHaveBeenCalledOnce()
			expect(vi.mocked(tryCatchSync)).toHaveBeenCalledOnce()
			expect(result).toBeNull()
			expect(error).toEqual(validationError)
		})

		it('should return error when sign in fails', async () => {
			// Arrange
			const mockUser = {
				Username: '123e4567-e89b-12d3-a456-426614174000',
				Attributes: [{ Name: 'email', Value: email }],
			}
			const mockUsersResponse: ListUsersCommandOutput = {
				Users: [mockUser],
				$metadata: {
					httpStatusCode: 200,
					requestId: 'test-request-id',
				},
			}
			const mockSecretHash = 'mock-secret-hash'
			const signInError = new InternalError('Sign in failed', 'authService')

			vi.mocked(tryCatch).mockResolvedValueOnce([mockUsersResponse, null])
			vi.mocked(tryCatchSync)
				.mockReturnValueOnce([mockUser, null]) // user validation
				.mockReturnValueOnce([mockSecretHash, null]) // hash generation
			vi.mocked(tryCatch).mockResolvedValueOnce([null, signInError])

			// Act
			const [result, error] = await cognitoService.signInUser(email, password)

			// Assert
			expect(vi.mocked(tryCatch)).toHaveBeenCalledTimes(2)
			expect(vi.mocked(tryCatchSync)).toHaveBeenCalledTimes(2)
			expect(result).toBeNull()
			expect(error).toEqual(signInError)
		})

		it('should return error when user has no Username', async () => {
			// Arrange
			const mockUser: UserType = {
				Username: undefined,
				Attributes: [{ Name: 'email', Value: email }],
			}
			const mockUsersResponse: ListUsersCommandOutput = {
				Users: [mockUser],
				$metadata: {
					httpStatusCode: 200,
					requestId: 'test-request-id',
				},
			}
			const mockSecretHash = 'mock-secret-hash'
			const mockSignInResponse: InitiateAuthCommandOutput = {
				AuthenticationResult: {
					AccessToken: 'access-token',
					RefreshToken: 'refresh-token',
				},
				$metadata: {},
			}

			vi.mocked(tryCatch).mockResolvedValueOnce([mockUsersResponse, null])
			vi.mocked(tryCatchSync)
				.mockReturnValueOnce([mockUser, null]) // user validation
				.mockReturnValueOnce([mockSecretHash, null]) // hash generation
			vi.mocked(tryCatch).mockResolvedValueOnce([mockSignInResponse, null])

			// Act
			const [result, error] = await cognitoService.signInUser(email, password)

			// Assert
			expect(result).toBeNull()
			expect(error).toBeInstanceOf(NotFoundError)
			expect((error as NotFoundError).message).toBe('User not found')
		})
	})

	describe('signOutUser', () => {
		const accessToken = 'valid-access-token'

		it('should successfully sign out a user', async () => {
			// Arrange
			const mockSignOutResponse: GlobalSignOutCommandOutput = {
				$metadata: {
					httpStatusCode: 200,
					requestId: 'test-request-id',
				},
			}

			vi.mocked(tryCatch).mockResolvedValue([mockSignOutResponse, null])
			cognitoMock.on(GlobalSignOutCommand).resolves(mockSignOutResponse)

			// Act
			const [result, error] = await cognitoService.signOutUser(accessToken)

			// Assert
			expect(vi.mocked(tryCatch)).toHaveBeenCalledOnce()
			expect(result).toEqual(mockSignOutResponse)
			expect(error).toBeNull()
		})

		it('should return error when sign out fails', async () => {
			// Arrange
			const signOutError = new InternalError('Sign out failed', 'authService')

			vi.mocked(tryCatch).mockResolvedValue([null, signOutError])

			// Act
			const [result, error] = await cognitoService.signOutUser(accessToken)

			// Assert
			expect(vi.mocked(tryCatch)).toHaveBeenCalledOnce()
			expect(result).toBeNull()
			expect(error).toEqual(signOutError)
		})
	})

	describe('refreshToken', () => {
		const refreshToken = 'valid-refresh-token'
		const username = 'test-username'

		it('should successfully refresh token', async () => {
			// Arrange
			const mockRefreshResponse: InitiateAuthCommandOutput = {
				AuthenticationResult: {
					AccessToken: 'new-access-token',
					ExpiresIn: 3600,
					TokenType: 'Bearer',
				},
				$metadata: {
					httpStatusCode: 200,
					requestId: 'test-request-id',
				},
			}

			vi.mocked(tryCatchSync).mockReturnValue(['mock-secret-hash', null])
			vi.mocked(tryCatch).mockResolvedValue([mockRefreshResponse, null])
			cognitoMock.on(InitiateAuthCommand).resolves(mockRefreshResponse)

			// Act
			const [result, error] = await cognitoService.refreshToken(
				refreshToken,
				username,
			)

			// Assert
			expect(vi.mocked(tryCatchSync)).toHaveBeenCalledOnce()
			expect(vi.mocked(tryCatch)).toHaveBeenCalledOnce()
			expect(result).toEqual(mockRefreshResponse)
			expect(error).toBeNull()
		})

		it('should return error when hash generation fails', async () => {
			// Arrange
			const hashError = new InternalError(
				'Hash generation failed',
				'authService',
			)

			vi.mocked(tryCatchSync).mockReturnValue([null, hashError])

			// Act
			const [result, error] = await cognitoService.refreshToken(
				refreshToken,
				username,
			)

			// Assert
			expect(vi.mocked(tryCatchSync)).toHaveBeenCalledOnce()
			expect(vi.mocked(tryCatch)).not.toHaveBeenCalled()
			expect(result).toBeNull()
			expect(error).toEqual(hashError)
		})

		it('should return error when refresh fails', async () => {
			// Arrange
			const mockSecretHash = 'mock-secret-hash'
			const refreshError = new InternalError('Refresh failed', 'authService')

			vi.mocked(tryCatchSync).mockReturnValue([mockSecretHash, null])
			vi.mocked(tryCatch).mockResolvedValue([null, refreshError])

			// Act
			const [result, error] = await cognitoService.refreshToken(
				refreshToken,
				username,
			)

			// Assert
			expect(vi.mocked(tryCatchSync)).toHaveBeenCalledOnce()
			expect(vi.mocked(tryCatch)).toHaveBeenCalledOnce()
			expect(result).toBeNull()
			expect(error).toEqual(refreshError)
		})
	})

	describe('forgotPassword', () => {
		const email = 'test@example.com'

		it('should successfully initiate forgot password', async () => {
			// Arrange
			const mockUser = {
				Username: '123e4567-e89b-12d3-a456-426614174000',
				Attributes: [{ Name: 'email', Value: email }],
			}
			const mockUsersResponse: ListUsersCommandOutput = {
				Users: [mockUser],
				$metadata: {
					httpStatusCode: 200,
					requestId: 'test-request-id',
				},
			}
			const mockSecretHash = 'mock-secret-hash'
			const mockForgotPasswordResponse: ForgotPasswordCommandOutput = {
				$metadata: {},
			}

			vi.mocked(tryCatch).mockResolvedValueOnce([mockUsersResponse, null])
			vi.mocked(tryCatchSync)
				.mockReturnValueOnce([mockUser, null]) // user validation
				.mockReturnValueOnce([mockSecretHash, null]) // hash generation
			vi.mocked(tryCatch).mockResolvedValueOnce([
				mockForgotPasswordResponse,
				null,
			])

			// Act
			const [result, error] = await cognitoService.forgotPassword(email)

			// Assert
			expect(vi.mocked(tryCatch)).toHaveBeenCalledTimes(2)
			expect(vi.mocked(tryCatchSync)).toHaveBeenCalledTimes(2)
			expect(result).toEqual(mockForgotPasswordResponse)
			expect(error).toBeNull()
		})

		it('should return error when user lookup fails', async () => {
			// Arrange
			const getUserError = new InternalError(
				'User lookup failed',
				'authService',
			)

			vi.mocked(tryCatch).mockResolvedValue([null, getUserError])

			// Act
			const [result, error] = await cognitoService.forgotPassword(email)

			// Assert
			expect(vi.mocked(tryCatch)).toHaveBeenCalledOnce()
			expect(result).toBeNull()
			expect(error).toEqual(getUserError)
		})
	})

	describe('confirmForgotPassword', () => {
		const email = 'test@example.com'
		const code = '123456'
		const newPassword = 'NewPassword123!'
		const confirmPassword = 'NewPassword123!'

		it('should successfully confirm forgot password', async () => {
			// Arrange
			const mockUser: UserType = {
				Username: '123e4567-e89b-12d3-a456-426614174000',
				Attributes: [{ Name: 'email', Value: email }],
			}
			const mockUsersResponse: ListUsersCommandOutput = {
				Users: [mockUser],
				$metadata: {
					httpStatusCode: 200,
					requestId: 'test-request-id',
				},
			}
			const mockSecretHash = 'mock-secret-hash'
			const mockConfirmResponse: ConfirmForgotPasswordCommandOutput = {
				$metadata: {
					httpStatusCode: 200,
					requestId: 'test-request-id',
				},
			}

			vi.mocked(tryCatchSync)
				.mockReturnValueOnce([true, null]) // password validation
				.mockReturnValueOnce([mockUser, null]) // user validation
				.mockReturnValueOnce([mockSecretHash, null]) // hash generation
			vi.mocked(tryCatch).mockResolvedValueOnce([mockUsersResponse, null])
			vi.mocked(tryCatch).mockResolvedValueOnce([mockConfirmResponse, null])

			// Act
			const [result, error] = await cognitoService.confirmForgotPassword(
				email,
				code,
				newPassword,
				confirmPassword,
			)

			// Assert
			expect(vi.mocked(tryCatchSync)).toHaveBeenCalledTimes(3)
			expect(vi.mocked(tryCatch)).toHaveBeenCalledTimes(2)
			expect(result).toEqual(mockConfirmResponse)
			expect(error).toBeNull()
		})

		it('should return validation error when passwords do not match', async () => {
			// Arrange
			const validationError = new ValidationError(
				'Passwords do not match',
				undefined,
				'authService',
			)

			vi.mocked(tryCatchSync).mockReturnValue([null, validationError])

			// Act
			const [result, error] = await cognitoService.confirmForgotPassword(
				email,
				code,
				newPassword,
				// eslint-disable-next-line no-secrets/no-secrets
				'DifferentPassword123!',
			)

			// Assert
			expect(vi.mocked(tryCatchSync)).toHaveBeenCalledOnce()
			expect(vi.mocked(tryCatch)).not.toHaveBeenCalled()
			expect(result).toBeNull()
			expect(error).toEqual(validationError)
		})

		it('should return error when user lookup fails', async () => {
			// Arrange
			const getUserError = new InternalError(
				'User lookup failed',
				'authService',
			)

			vi.mocked(tryCatchSync).mockReturnValueOnce([true, null]) // password validation
			vi.mocked(tryCatch).mockResolvedValue([null, getUserError])

			// Act
			const [result, error] = await cognitoService.confirmForgotPassword(
				email,
				code,
				newPassword,
				confirmPassword,
			)

			// Assert
			expect(vi.mocked(tryCatchSync)).toHaveBeenCalledOnce()
			expect(vi.mocked(tryCatch)).toHaveBeenCalledOnce()
			expect(result).toBeNull()
			expect(error).toEqual(getUserError)
		})
	})

	describe('getAuthUser', () => {
		const accessToken = 'valid-access-token'

		it('should successfully get authenticated user', async () => {
			// Arrange
			const mockUserResponse: GetUserCommandOutput = {
				Username: '123e4567-e89b-12d3-a456-426614174000',
				UserAttributes: [
					{ Name: 'email', Value: 'test@example.com' },
					{ Name: 'email_verified', Value: 'true' },
				],
				$metadata: {
					httpStatusCode: 200,
					requestId: 'test-request-id',
				},
			}

			vi.mocked(tryCatch).mockResolvedValue([mockUserResponse, null])
			cognitoMock.on(GetUserCommand).resolves(mockUserResponse)

			// Act
			const [result, error] = await cognitoService.getAuthUser(accessToken)

			// Assert
			expect(vi.mocked(tryCatch)).toHaveBeenCalledOnce()
			expect(result).toEqual(mockUserResponse)
			expect(error).toBeNull()
		})

		it('should return error when get user fails', async () => {
			// Arrange
			const getUserError = new InternalError('Get user failed', 'authService')

			vi.mocked(tryCatch).mockResolvedValue([null, getUserError])

			// Act
			const [result, error] = await cognitoService.getAuthUser(accessToken)

			// Assert
			expect(vi.mocked(tryCatch)).toHaveBeenCalledOnce()
			expect(result).toBeNull()
			expect(error).toEqual(getUserError)
		})
	})

	describe('Business Logic Edge Cases', () => {
		describe('User validation scenarios', () => {
			it('should handle empty users list in confirmSignUp', async () => {
				// Arrange
				const email = 'test@example.com'
				const code = 123456
				const emptyUsersResponse: ListUsersCommandOutput = {
					Users: [],
					$metadata: {
						httpStatusCode: 200,
						requestId: 'test-request-id',
					},
				}

				// Mock tryCatch to return empty users list, but let tryCatchSync run real validation
				vi.mocked(tryCatch).mockResolvedValue([emptyUsersResponse, null])
				mockTryCatchSyncWithRealImplementation()

				cognitoMock.on(ListUsersCommand).resolves(emptyUsersResponse)

				// Act
				const [result, error] = await cognitoService.confirmSignUp(email, code)

				// Assert
				expect(result).toBeNull()
				expect(error).toBeInstanceOf(NotFoundError)
				expect((error as NotFoundError).message).toBe('User not found')
			})

			it('should handle user with no email attribute in confirmSignUp', async () => {
				// Arrange
				const email = 'test@example.com'
				const code = 123456
				const userWithoutEmail: UserType = {
					Username: '123e4567-e89b-12d3-a456-426614174000',
					Attributes: [{ Name: 'phone_number', Value: '+1234567890' }], // No email attribute
					UserCreateDate: new Date(),
					UserLastModifiedDate: new Date(),
					Enabled: true,
					UserStatus: 'CONFIRMED',
				}
				const usersResponse: ListUsersCommandOutput = {
					Users: [userWithoutEmail],
					$metadata: {
						httpStatusCode: 200,
						requestId: 'test-request-id',
					},
				}

				// Mock tryCatch to return users, but let tryCatchSync run real validation
				vi.mocked(tryCatch).mockResolvedValue([usersResponse, null])
				mockTryCatchSyncWithRealImplementation()

				cognitoMock.on(ListUsersCommand).resolves(usersResponse)

				// Act
				const [result, error] = await cognitoService.confirmSignUp(email, code)

				// Assert
				expect(result).toBeNull()
				expect(error).toBeInstanceOf(NotFoundError)
				expect((error as NotFoundError).message).toBe('User not found')
			})

			it('should handle user with matching email but no Username in confirmSignUp', async () => {
				// Arrange
				const email = 'test@example.com'
				const code = 123456
				const userWithoutUsername: UserType = {
					Username: undefined, // No username
					Attributes: [{ Name: 'email', Value: email }],
					UserCreateDate: new Date(),
					UserLastModifiedDate: new Date(),
					Enabled: true,
					UserStatus: 'CONFIRMED',
				}
				const usersResponse: ListUsersCommandOutput = {
					Users: [userWithoutUsername],
					$metadata: {
						httpStatusCode: 200,
						requestId: 'test-request-id',
					},
				}

				// Mock tryCatch to return users, but let tryCatchSync run real validation
				vi.mocked(tryCatch).mockResolvedValue([usersResponse, null])
				mockTryCatchSyncWithRealImplementation()

				cognitoMock.on(ListUsersCommand).resolves(usersResponse)

				// Act
				const [result, error] = await cognitoService.confirmSignUp(email, code)

				// Assert
				expect(result).toBeNull()
				expect(error).toBeInstanceOf(NotFoundError)
				expect((error as NotFoundError).message).toBe('User not found')
			})
		})

		describe('Password validation scenarios', () => {
			it('should test actual password comparison logic in signUpUser', async () => {
				// Arrange
				const requestWithMismatchedPasswords: TRegisterUserRequest = {
					email: 'test@example.com',
					password: 'Password123!',
					// eslint-disable-next-line no-secrets/no-secrets
					confirmPassword: 'DifferentPassword456!',
				}

				// Let tryCatchSync run the real password validation logic
				mockTryCatchSyncWithRealImplementation()

				// Act
				const [result, error] = await cognitoService.signUpUser(
					requestWithMismatchedPasswords,
				)

				// Assert
				expect(result).toBeNull()
				expect(error).toBeInstanceOf(ValidationError)
				expect((error as ValidationError).message).toBe(
					'Passwords do not match',
				)
			})

			it('should test actual password comparison logic in confirmForgotPassword', async () => {
				// Arrange
				const email = 'test@example.com'
				const code = '123456'
				const newPassword = 'NewPassword123!'
				// eslint-disable-next-line no-secrets/no-secrets
				const confirmPassword = 'DifferentPassword456!'

				// Let tryCatchSync run the real password validation logic
				mockTryCatchSyncWithRealImplementation()

				// Act
				const [result, error] = await cognitoService.confirmForgotPassword(
					email,
					code,
					newPassword,
					confirmPassword,
				)

				// Assert
				expect(result).toBeNull()
				expect(error).toBeInstanceOf(ValidationError)
				expect((error as ValidationError).message).toBe(
					'Passwords do not match',
				)
			})
		})
	})
})
