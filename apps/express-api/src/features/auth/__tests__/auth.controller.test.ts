// AWS Cognito types
import type {
	ConfirmForgotPasswordCommandOutput,
	ConfirmSignUpCommandOutput,
	ForgotPasswordCommandOutput,
	GlobalSignOutCommandOutput,
	InitiateAuthCommandOutput,
	ResendConfirmationCodeCommandOutput,
} from '@aws-sdk/client-cognito-identity-provider'
import type { NextFunction, Request, Response } from 'express'
import { StatusCodes } from 'http-status-codes'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
	getAccessToken,
	getRefreshToken,
	getSynchronizeToken,
} from '../../../utils/cookies.ts'
import { decrypt, encrypt } from '../../../utils/crypto.ts'
import {
	ErrorType,
	InternalError,
	NotFoundError,
} from '../../../utils/errors.ts'
import {
	handleServiceError,
	validateData,
} from '../../../utils/response-handlers.ts'
import { MockDataFactory } from '../../../utils/test-helpers/advanced-mocking.ts'
import { mockCognitoService } from '../../../utils/test-helpers/cognito-service.mock.ts'
import { mockConfig } from '../../../utils/test-helpers/config.mock.ts'
import { createMockExpressObjects } from '../../../utils/test-helpers/enhanced-mocks.ts'
import { mockErrorHandling } from '../../../utils/test-helpers/error-handling.mock.ts'
import { mockLogger } from '../../../utils/test-helpers/logger.mock.ts'
import { mockUserService } from '../../../utils/test-helpers/user-service.mock.ts'
import { userRepository } from '../../user/user.data-access.ts'
import { userService } from '../../user/user.services.ts'
import { authController } from '../auth.controller.ts'
import { cognitoService } from '../auth.services.ts'
import type {
	TConfirmForgotPasswordRequest,
	TConfirmRegistrationRequest,
	TForgotPasswordRequest,
	TLoginRequest,
	TRegisterUserRequest,
	TResendConfirmationCodeRequest,
} from '../auth.types.ts'

// Mock the logger using the reusable helper
vi.mock('../../../utils/logger.ts', () => mockLogger.createModule())

// Mock the error handling module using the helper
vi.mock('../../../utils/error-handling/try-catch.ts', () =>
	mockErrorHandling.createModule(),
)

// Import after mocking
import { tryCatchSync } from '../../../utils/error-handling/try-catch.ts'

// Mock the CognitoService using the reusable helper
vi.mock('../auth.services.ts', () => mockCognitoService.createModule())

// Mock user services using the reusable helper
vi.mock('../../user/user.services.ts', () => mockUserService.createModule())

// Mock user data access
vi.mock('../../user/user.data-access.ts', () => ({
	userRepository: {
		createUser: vi.fn(),
		updateUser: vi.fn(),
	},
}))

// Mock response handlers
vi.mock('../../../utils/response-handlers.ts', () => ({
	handleServiceError: vi.fn(),
	validateData: vi.fn(),
}))

// Mock config using the reusable helper
vi.mock('../../../utils/load-config.ts', () => mockConfig.createModule())

// Mock utility functions
vi.mock('../../../utils/cookies.ts', () => ({
	getAccessToken: vi.fn(),
	getRefreshToken: vi.fn(),
	getSynchronizeToken: vi.fn(),
}))

vi.mock('../../../utils/crypto.ts', () => ({
	encrypt: vi.fn(),
	decrypt: vi.fn(),
}))

// Import after mocking

describe('AuthController', () => {
	let mockRequest: Request
	let mockResponse: Response
	let mockNext: NextFunction
	let mockUser: ReturnType<typeof MockDataFactory.createUser>

	beforeEach(() => {
		vi.clearAllMocks()

		// Setup config and logger mocks for consistent test environment
		mockConfig.setup()
		mockLogger.setup()

		// Use enhanced Express mocking
		const { req, res, next } = createMockExpressObjects()
		mockRequest = req
		mockResponse = res
		mockNext = next

		// Create mock user data using enhanced factory
		mockUser = MockDataFactory.createUser({
			email: 'test@example.com',
			firstName: 'John',
			lastName: 'Doe',
		})

		// Mock utility functions
		vi.mocked(handleServiceError).mockReturnValue({ success: true })
		vi.mocked(validateData).mockReturnValue({ valid: true })
		vi.mocked(encrypt).mockReturnValue(['encrypted-value', null])
		vi.mocked(decrypt).mockReturnValue(['decrypted-value', null])
		vi.mocked(getAccessToken).mockReturnValue('mock-access-token')
		vi.mocked(getRefreshToken).mockReturnValue('mock-refresh-token')
		vi.mocked(getSynchronizeToken).mockReturnValue('mock-sync-token')
		vi.mocked(tryCatchSync).mockReturnValue(['success', null])
	})

	describe('register', () => {
		describe.each([
			[
				'test@example.com',
				'Password123!',
				'Password123!',
				'valid registration',
			],
			[
				'user@domain.com',
				'SecurePass456!',
				'SecurePass456!',
				'different email',
			],
			['admin@company.org', 'AdminPass789!', 'AdminPass789!', 'admin email'],
		])(
			'Registration scenarios: %s',
			(email, password, confirmPassword, description) => {
				it(`should handle user already exists scenario for ${description}`, async () => {
					// Arrange
					const registerRequest: TRegisterUserRequest = {
						email,
						password,
						confirmPassword,
					}
					mockRequest.body = registerRequest

					const existingUser = MockDataFactory.createUser({ email })
					vi.mocked(userService.getUserByEmail).mockResolvedValue([
						existingUser,
						null,
					])

					// Act
					await authController.register(mockRequest, mockResponse, mockNext)

					// Assert
					expect(userService.getUserByEmail).toHaveBeenCalledWith({
						email: registerRequest.email,
					})
					expect(mockNext).toHaveBeenCalledWith(
						expect.objectContaining({
							message: 'User already exists',
							type: ErrorType.ConflictError,
						}),
					)
					expect(mockResponse.status).not.toHaveBeenCalled()
					expect(mockResponse.json).not.toHaveBeenCalled()
				})
			},
		)

		it('should handle getUserByEmail service error', async () => {
			// Arrange
			const registerRequest: TRegisterUserRequest = {
				email: 'test@example.com',
				password: 'Password123!',
				confirmPassword: 'Password123!',
			}
			mockRequest.body = registerRequest

			const serviceError = new InternalError('Database error', 'userService')
			vi.mocked(userService.getUserByEmail).mockResolvedValue([
				null,
				serviceError,
			])

			// Act
			await authController.register(mockRequest, mockResponse, mockNext)

			// Assert
			expect(userService.getUserByEmail).toHaveBeenCalledWith({
				email: registerRequest.email,
			})
			expect(mockNext).toHaveBeenCalledWith(serviceError)
			expect(mockResponse.status).not.toHaveBeenCalled()
			expect(mockResponse.json).not.toHaveBeenCalled()
		})

		it('should successfully register a new user', async () => {
			// Arrange
			const registerRequest: TRegisterUserRequest = {
				email: 'test@example.com',
				password: 'Password123!',
				confirmPassword: 'Password123!',
			}
			mockRequest.body = registerRequest

			const notFoundError = new NotFoundError('User not found', 'userService')
			const mockSignUpResponse = mockCognitoService.createSignUpResponse({
				UserSub: 'test-user-id',
				UserConfirmed: false,
			})
			const mockCreatedUser = MockDataFactory.createUser({
				id: 'test-user-id',
				email: 'test@example.com',
				firstName: 'John',
				lastName: 'Doe',
			})

			vi.mocked(userService.getUserByEmail).mockResolvedValue([
				null,
				notFoundError,
			])
			vi.mocked(cognitoService.signUpUser).mockResolvedValue([
				mockSignUpResponse,
				null,
			])
			vi.mocked(userRepository.createUser).mockResolvedValue([
				mockCreatedUser,
				null,
			])

			// Act
			await authController.register(mockRequest, mockResponse, mockNext)

			// Assert
			expect(userService.getUserByEmail).toHaveBeenCalledWith({
				email: registerRequest.email,
			})
			expect(cognitoService.signUpUser).toHaveBeenCalledWith(registerRequest)
			expect(userRepository.createUser).toHaveBeenCalledWith({
				userData: {
					id: 'test-user-id',
					email: 'test@example.com',
				},
			})
			expect(mockResponse.status).toHaveBeenCalledWith(StatusCodes.CREATED)
			expect(mockResponse.json).toHaveBeenCalledWith({
				message:
					'Registration successful. Please check your email for verification code.',
				user: {
					id: 'test-user-id',
					email: 'test@example.com',
				},
			})
			expect(mockNext).not.toHaveBeenCalled()
		})

		it('should handle Cognito signUp error', async () => {
			// Arrange
			const registerRequest: TRegisterUserRequest = {
				email: 'test@example.com',
				password: 'Password123!',
				confirmPassword: 'Password123!',
			}
			mockRequest.body = registerRequest

			const notFoundError = new NotFoundError('User not found', 'userService')
			const cognitoError = new InternalError('Cognito error', 'cognitoService')

			vi.mocked(userService.getUserByEmail).mockResolvedValue([
				null,
				notFoundError,
			])
			vi.mocked(cognitoService.signUpUser).mockResolvedValue([
				null,
				cognitoError,
			])

			// Act
			await authController.register(mockRequest, mockResponse, mockNext)

			// Assert
			expect(cognitoService.signUpUser).toHaveBeenCalledWith(registerRequest)
			expect(mockNext).toHaveBeenCalledWith(cognitoError)
			expect(mockResponse.status).not.toHaveBeenCalled()
			expect(mockResponse.json).not.toHaveBeenCalled()
		})

		it('should handle service error in register', async () => {
			// Arrange
			const registerRequest: TRegisterUserRequest = {
				email: 'test@example.com',
				password: 'Password123!',
				confirmPassword: 'Password123!',
			}
			mockRequest.body = registerRequest

			const notFoundError = new NotFoundError('User not found', 'userService')
			const mockSignUpResponse = mockCognitoService.createSignUpResponse({
				UserSub: 'test-user-id',
				UserConfirmed: false,
			})

			vi.mocked(userService.getUserByEmail).mockResolvedValue([
				null,
				notFoundError,
			])
			vi.mocked(cognitoService.signUpUser).mockResolvedValue([
				mockSignUpResponse,
				null,
			])
			vi.mocked(handleServiceError).mockReturnValue({
				success: false,
				error: { status: StatusCodes.BAD_REQUEST, message: 'Service error' },
			})

			// Act
			await authController.register(mockRequest, mockResponse, mockNext)

			// Assert
			expect(cognitoService.signUpUser).toHaveBeenCalledWith(registerRequest)
			expect(mockResponse.status).toHaveBeenCalledWith(StatusCodes.BAD_REQUEST)
			expect(mockResponse.json).toHaveBeenCalledWith({
				message: 'Service error',
			})
			expect(mockNext).not.toHaveBeenCalled()
		})

		it('should handle missing UserSub in register', async () => {
			// Arrange
			const registerRequest: TRegisterUserRequest = {
				email: 'test@example.com',
				password: 'Password123!',
				confirmPassword: 'Password123!',
			}
			mockRequest.body = registerRequest

			const notFoundError = new NotFoundError('User not found', 'userService')
			// Missing UserSub - set to undefined to test validation
			const mockSignUpResponse = mockCognitoService.createSignUpResponse({
				UserSub: undefined,
				UserConfirmed: false,
			})

			vi.mocked(userService.getUserByEmail).mockResolvedValue([
				null,
				notFoundError,
			])
			vi.mocked(cognitoService.signUpUser).mockResolvedValue([
				mockSignUpResponse,
				null,
			])
			vi.mocked(handleServiceError).mockReturnValue({ success: true })

			// Act
			await authController.register(mockRequest, mockResponse, mockNext)

			// Assert
			expect(cognitoService.signUpUser).toHaveBeenCalledWith(registerRequest)
			expect(mockNext).toHaveBeenCalledWith(
				expect.objectContaining({
					message: 'User not created - no user ID returned',
				}),
			)
			expect(mockResponse.status).not.toHaveBeenCalled()
			expect(mockResponse.json).not.toHaveBeenCalled()
		})

		it('should handle userRepository.createUser error', async () => {
			// Arrange
			const registerRequest: TRegisterUserRequest = {
				email: 'test@example.com',
				password: 'Password123!',
				confirmPassword: 'Password123!',
			}
			mockRequest.body = registerRequest

			const notFoundError = new NotFoundError('User not found', 'userService')
			const mockSignUpResponse = mockCognitoService.createSignUpResponse({
				UserSub: 'test-user-id',
				UserConfirmed: false,
			})
			const createUserError = new InternalError(
				'Database error',
				'userRepository',
			)

			vi.mocked(userService.getUserByEmail).mockResolvedValue([
				null,
				notFoundError,
			])
			vi.mocked(cognitoService.signUpUser).mockResolvedValue([
				mockSignUpResponse,
				null,
			])
			vi.mocked(handleServiceError).mockReturnValue({ success: true })
			vi.mocked(userRepository.createUser).mockResolvedValue([
				null,
				createUserError,
			])

			// Act
			await authController.register(mockRequest, mockResponse, mockNext)

			// Assert
			expect(userRepository.createUser).toHaveBeenCalledWith({
				userData: {
					id: 'test-user-id',
					email: 'test@example.com',
				},
			})
			expect(mockNext).toHaveBeenCalledWith(createUserError)
			expect(mockResponse.status).not.toHaveBeenCalled()
			expect(mockResponse.json).not.toHaveBeenCalled()
		})
	})

	describe('confirmRegistration', () => {
		it('should successfully confirm user registration', async () => {
			// Arrange
			const confirmRequest: TConfirmRegistrationRequest = {
				email: 'test@example.com',
				code: 123456,
			}
			mockRequest.body = confirmRequest

			const mockConfirmResponse: ConfirmSignUpCommandOutput = {
				$metadata: {
					httpStatusCode: 200,
					requestId: 'test-request-id',
					attempts: 1,
					totalRetryDelay: 0,
				},
			}
			const mockUpdatedUser = mockUserService.createUser({
				...mockUser,
				emailVerified: true,
				createdAt: mockUser.createdAt ?? new Date(),
				updatedAt: mockUser.updatedAt ?? new Date(),
			})

			vi.mocked(cognitoService.confirmSignUp).mockResolvedValue([
				mockConfirmResponse,
				null,
			])
			vi.mocked(userService.getUserByEmail).mockResolvedValue([mockUser, null])
			vi.mocked(userRepository.updateUser).mockResolvedValue([
				mockUpdatedUser,
				null,
			])

			// Act
			await authController.confirmRegistration(
				mockRequest,
				mockResponse,
				mockNext,
			)

			// Assert
			expect(cognitoService.confirmSignUp).toHaveBeenCalledWith(
				'test@example.com',
				123456,
			)
			expect(userService.getUserByEmail).toHaveBeenCalledWith({
				email: 'test@example.com',
			})
			expect(userRepository.updateUser).toHaveBeenCalledWith(mockUser.id, {
				emailVerified: true,
			})
			expect(mockResponse.status).toHaveBeenCalledWith(StatusCodes.OK)
			expect(mockResponse.json).toHaveBeenCalledWith({
				message: 'Email confirmed successfully',
			})
			expect(mockNext).not.toHaveBeenCalled()
		})

		it('should handle Cognito confirmSignUp error', async () => {
			// Arrange
			const confirmRequest: TConfirmRegistrationRequest = {
				email: 'test@example.com',
				code: 123456,
			}
			mockRequest.body = confirmRequest

			const cognitoError = new InternalError('Cognito error', 'cognitoService')
			vi.mocked(cognitoService.confirmSignUp).mockResolvedValue([
				null,
				cognitoError,
			])

			// Act
			await authController.confirmRegistration(
				mockRequest,
				mockResponse,
				mockNext,
			)

			// Assert
			expect(cognitoService.confirmSignUp).toHaveBeenCalledWith(
				'test@example.com',
				123456,
			)
			expect(mockNext).toHaveBeenCalledWith(cognitoError)
			expect(mockResponse.status).not.toHaveBeenCalled()
			expect(mockResponse.json).not.toHaveBeenCalled()
		})
	})

	describe('login', () => {
		it('should successfully login a user', async () => {
			// Arrange

			const loginRequest: TLoginRequest = {
				email: 'test@example.com',
				password: 'Password123!',
			}
			mockRequest.body = loginRequest

			const mockSignInResponse: InitiateAuthCommandOutput & {
				Username: string
			} = {
				AuthenticationResult: {
					AccessToken: 'access-token',
					RefreshToken: 'refresh-token',
					ExpiresIn: 3600,
				},
				Username: 'test-user-id',
				$metadata: {
					httpStatusCode: 200,
					requestId: 'test-request-id',
					attempts: 1,
					totalRetryDelay: 0,
				},
			}

			vi.mocked(cognitoService.signInUser).mockResolvedValue([
				mockSignInResponse,
				null,
			])
			vi.mocked(userService.registerOrLoginUserById).mockResolvedValue([
				mockUser,
				null,
			])
			vi.mocked(encrypt).mockReturnValue(['encrypted-value', null])

			// Act
			await authController.login(mockRequest, mockResponse, mockNext)

			// Assert
			expect(cognitoService.signInUser).toHaveBeenCalledWith(
				loginRequest.email,
				loginRequest.password,
			)
			expect(userService.registerOrLoginUserById).toHaveBeenCalledWith({
				id: 'test-user-id',
				email: 'test@example.com',
			})
			expect(encrypt).toHaveBeenCalledWith('test-user-id')
			expect(mockResponse.cookie).toHaveBeenCalledWith(
				'macro-ai-accessToken',
				'access-token',
				expect.objectContaining({
					httpOnly: true,
					secure: false, // matches test environment
					domain: undefined, // localhost case
					sameSite: 'strict',
				}),
			)
			expect(mockResponse.cookie).toHaveBeenCalledWith(
				'macro-ai-refreshToken',
				'refresh-token',
				expect.objectContaining({
					httpOnly: true,
					secure: false, // matches test environment
					domain: undefined, // localhost case
					sameSite: 'strict',
				}),
			)
			expect(mockResponse.cookie).toHaveBeenCalledWith(
				'macro-ai-synchronize',
				'encrypted-value',
				expect.any(Object),
			)
			expect(mockResponse.status).toHaveBeenCalledWith(StatusCodes.OK)
			expect(mockResponse.json).toHaveBeenCalledWith({
				message: 'Login successful',
				tokens: {
					accessToken: 'access-token',
					refreshToken: 'refresh-token',
					expiresIn: 3600,
				},
			})
			expect(mockNext).not.toHaveBeenCalled()

		})

		it('should handle Cognito signIn error', async () => {
			// Arrange
			const loginRequest: TLoginRequest = {
				email: 'test@example.com',
				password: 'Password123!',
			}
			mockRequest.body = loginRequest

			const cognitoError = new InternalError(
				'Invalid credentials',
				'cognitoService',
			)
			vi.mocked(cognitoService.signInUser).mockResolvedValue([
				null,
				cognitoError,
			])

			// Act
			await authController.login(mockRequest, mockResponse, mockNext)

			// Assert
			expect(cognitoService.signInUser).toHaveBeenCalledWith(
				loginRequest.email,
				loginRequest.password,
			)
			expect(mockNext).toHaveBeenCalledWith(cognitoError)
			expect(mockResponse.status).not.toHaveBeenCalled()
			expect(mockResponse.json).not.toHaveBeenCalled()
		})

		it('should handle user registration/login error', async () => {
			// Arrange
			const loginRequest: TLoginRequest = {
				email: 'test@example.com',
				password: 'Password123!',
			}
			mockRequest.body = loginRequest

			const mockSignInResponse: InitiateAuthCommandOutput & {
				Username: string
			} = {
				AuthenticationResult: {
					AccessToken: 'access-token',
					RefreshToken: 'refresh-token',
					ExpiresIn: 3600,
				},
				Username: 'test-user-id',
				$metadata: {
					httpStatusCode: 200,
					requestId: 'test-request-id',
					attempts: 1,
					totalRetryDelay: 0,
				},
			}

			const userServiceError = new InternalError(
				'Database error',
				'userService',
			)
			vi.mocked(cognitoService.signInUser).mockResolvedValue([
				mockSignInResponse,
				null,
			])
			vi.mocked(userService.registerOrLoginUserById).mockResolvedValue([
				null,
				userServiceError,
			])

			// Act
			await authController.login(mockRequest, mockResponse, mockNext)

			// Assert
			expect(cognitoService.signInUser).toHaveBeenCalledWith(
				loginRequest.email,
				loginRequest.password,
			)
			expect(userService.registerOrLoginUserById).toHaveBeenCalledWith({
				id: 'test-user-id',
				email: 'test@example.com',
			})
			expect(mockNext).toHaveBeenCalledWith(userServiceError)
			expect(mockResponse.status).not.toHaveBeenCalled()
			expect(mockResponse.json).not.toHaveBeenCalled()
		})

		it('should set domain field to undefined when cookieDomain is localhost', async () => {
			// Arrange

			const loginRequest = {
				email: 'test@example.com',
				password: 'password123',
			}

			mockRequest.body = loginRequest

			const mockSignInResponse: InitiateAuthCommandOutput & {
				Username: string
			} = {
				AuthenticationResult: {
					AccessToken: 'access-token',
					RefreshToken: 'refresh-token',
					ExpiresIn: 3600,
				},
				Username: 'test-user-id',
				$metadata: {
					httpStatusCode: 200,
					requestId: 'test-request-id',
					attempts: 1,
					totalRetryDelay: 0,
				},
			}

			vi.mocked(validateData).mockReturnValue({ valid: true })
			vi.mocked(cognitoService.signInUser).mockResolvedValue([
				mockSignInResponse,
				null,
			])
			vi.mocked(userService.registerOrLoginUserById).mockResolvedValue([
				mockUser,
				null,
			])
			vi.mocked(handleServiceError).mockReturnValue({ success: true })
			vi.mocked(encrypt).mockReturnValue(['encrypted-value', null])

			// Act
			await authController.login(mockRequest, mockResponse, mockNext)

			// Assert - Verify domain field is undefined for localhost (default test config)
			expect(mockResponse.cookie).toHaveBeenCalledWith(
				'macro-ai-accessToken',
				'access-token',
				expect.objectContaining({
					domain: undefined, // Should be undefined for localhost
					httpOnly: true,
					secure: false, // matches test environment
					sameSite: 'strict',
				}),
			)
			expect(mockResponse.cookie).toHaveBeenCalledWith(
				'macro-ai-refreshToken',
				'refresh-token',
				expect.objectContaining({
					domain: undefined, // Should be undefined for localhost
					httpOnly: true,
					secure: false, // matches test environment
					sameSite: 'strict',
				}),
			)
			expect(mockResponse.cookie).toHaveBeenCalledWith(
				'macro-ai-synchronize',
				'encrypted-value',
				expect.objectContaining({
					domain: undefined, // Should be undefined for localhost
					httpOnly: true,
					secure: false, // matches test environment
					sameSite: 'strict',
				}),
			)

		})
	})

	describe('logout', () => {
		it('should successfully logout a user', async () => {
			// Arrange
			mockRequest.cookies = {
				'macro-ai-accessToken': 'access-token',
			}

			const mockSignOutResponse: GlobalSignOutCommandOutput = {
				$metadata: {
					httpStatusCode: 200,
					requestId: 'test-request-id',
					attempts: 1,
					totalRetryDelay: 0,
				},
			}

			vi.mocked(tryCatchSync).mockReturnValue(['access-token', null])
			vi.mocked(cognitoService.signOutUser).mockResolvedValue([
				mockSignOutResponse,
				null,
			])
			vi.mocked(handleServiceError).mockReturnValue({ success: true })

			// Act
			await authController.logout(mockRequest, mockResponse, mockNext)

			// Assert
			expect(tryCatchSync).toHaveBeenCalledWith(
				expect.any(Function),
				'authController - logout',
			)
			expect(cognitoService.signOutUser).toHaveBeenCalledWith('access-token')
			expect(mockResponse.clearCookie).toHaveBeenCalledWith(
				'macro-ai-accessToken',
				expect.any(Object),
			)
			expect(mockResponse.clearCookie).toHaveBeenCalledWith(
				'macro-ai-refreshToken',
				expect.any(Object),
			)
			expect(mockResponse.clearCookie).toHaveBeenCalledWith(
				'macro-ai-synchronize',
				expect.any(Object),
			)
			expect(mockResponse.status).toHaveBeenCalledWith(StatusCodes.OK)
			expect(mockResponse.json).toHaveBeenCalledWith({
				message: 'Logout successful',
			})
			expect(mockNext).not.toHaveBeenCalled()
		})

		it('should handle tryCatchSync error', async () => {
			// Arrange
			const accessTokenError = new InternalError(
				'Token error',
				'authController',
			)
			vi.mocked(tryCatchSync).mockReturnValue([null, accessTokenError])

			// Act
			await authController.logout(mockRequest, mockResponse, mockNext)

			// Assert
			expect(tryCatchSync).toHaveBeenCalledWith(
				expect.any(Function),
				'authController - logout',
			)
			expect(mockNext).toHaveBeenCalledWith(accessTokenError)
			expect(cognitoService.signOutUser).not.toHaveBeenCalled()
			expect(mockResponse.status).not.toHaveBeenCalled()
			expect(mockResponse.json).not.toHaveBeenCalled()
		})

		it('should handle Cognito signOut error', async () => {
			// Arrange
			const cognitoError = new InternalError('Cognito error', 'cognitoService')
			vi.mocked(tryCatchSync).mockReturnValue(['access-token', null])
			vi.mocked(cognitoService.signOutUser).mockResolvedValue([
				null,
				cognitoError,
			])

			// Act
			await authController.logout(mockRequest, mockResponse, mockNext)

			// Assert
			expect(tryCatchSync).toHaveBeenCalledWith(
				expect.any(Function),
				'authController - logout',
			)
			expect(cognitoService.signOutUser).toHaveBeenCalledWith('access-token')
			expect(mockNext).toHaveBeenCalledWith(cognitoError)
			expect(mockResponse.status).not.toHaveBeenCalled()
			expect(mockResponse.json).not.toHaveBeenCalled()
		})
	})

	describe('resendConfirmationCode', () => {
		it('should successfully resend confirmation code', async () => {
			// Arrange
			const resendRequest: TResendConfirmationCodeRequest = {
				email: 'test@example.com',
			}
			mockRequest.body = resendRequest

			const mockResendResponse: ResendConfirmationCodeCommandOutput = {
				$metadata: {
					httpStatusCode: 200,
					requestId: 'test-request-id',
					attempts: 1,
					totalRetryDelay: 0,
				},
			}
			vi.mocked(cognitoService.resendConfirmationCode).mockResolvedValue([
				mockResendResponse,
				null,
			])
			vi.mocked(handleServiceError).mockReturnValue({ success: true })

			// Act
			await authController.resendConfirmationCode(
				mockRequest,
				mockResponse,
				mockNext,
			)

			// Assert
			expect(cognitoService.resendConfirmationCode).toHaveBeenCalledWith(
				'test@example.com',
			)
			expect(mockResponse.status).toHaveBeenCalledWith(StatusCodes.OK)
			expect(mockResponse.json).toHaveBeenCalledWith({
				message: 'Confirmation code resent successfully',
			})
			expect(mockNext).not.toHaveBeenCalled()
		})

		it('should handle Cognito resendConfirmationCode error', async () => {
			// Arrange
			const resendRequest: TResendConfirmationCodeRequest = {
				email: 'test@example.com',
			}
			mockRequest.body = resendRequest

			const cognitoError = new InternalError('Cognito error', 'cognitoService')
			vi.mocked(cognitoService.resendConfirmationCode).mockResolvedValue([
				null,
				cognitoError,
			])

			// Act
			await authController.resendConfirmationCode(
				mockRequest,
				mockResponse,
				mockNext,
			)

			// Assert
			expect(cognitoService.resendConfirmationCode).toHaveBeenCalledWith(
				'test@example.com',
			)
			expect(mockNext).toHaveBeenCalledWith(cognitoError)
			expect(mockResponse.status).not.toHaveBeenCalled()
			expect(mockResponse.json).not.toHaveBeenCalled()
		})

		it('should handle service error in resendConfirmationCode', async () => {
			// Arrange
			const resendRequest: TResendConfirmationCodeRequest = {
				email: 'test@example.com',
			}
			mockRequest.body = resendRequest

			const mockResendResponse: ResendConfirmationCodeCommandOutput = {
				$metadata: {
					httpStatusCode: 200,
					requestId: 'test-request-id',
					attempts: 1,
					totalRetryDelay: 0,
				},
			}
			vi.mocked(cognitoService.resendConfirmationCode).mockResolvedValue([
				mockResendResponse,
				null,
			])
			vi.mocked(handleServiceError).mockReturnValue({
				success: false,
				error: { status: StatusCodes.BAD_REQUEST, message: 'Service error' },
			})

			// Act
			await authController.resendConfirmationCode(
				mockRequest,
				mockResponse,
				mockNext,
			)

			// Assert
			expect(cognitoService.resendConfirmationCode).toHaveBeenCalledWith(
				'test@example.com',
			)
			expect(mockResponse.status).toHaveBeenCalledWith(StatusCodes.BAD_REQUEST)
			expect(mockResponse.json).toHaveBeenCalledWith({
				message: 'Service error',
			})
			expect(mockNext).not.toHaveBeenCalled()
		})
	})

	describe('forgotPassword', () => {
		it('should successfully initiate forgot password', async () => {
			// Arrange
			const forgotPasswordRequest: TForgotPasswordRequest = {
				email: 'test@example.com',
			}
			mockRequest.body = forgotPasswordRequest

			const mockForgotPasswordResponse: ForgotPasswordCommandOutput = {
				$metadata: {
					httpStatusCode: 200,
					requestId: 'test-request-id',
					attempts: 1,
					totalRetryDelay: 0,
				},
			}
			vi.mocked(cognitoService.forgotPassword).mockResolvedValue([
				mockForgotPasswordResponse,
				null,
			])
			vi.mocked(handleServiceError).mockReturnValue({ success: true })

			// Act
			await authController.forgotPassword(mockRequest, mockResponse, mockNext)

			// Assert
			expect(cognitoService.forgotPassword).toHaveBeenCalledWith(
				'test@example.com',
			)
			expect(mockResponse.status).toHaveBeenCalledWith(StatusCodes.OK)
			expect(mockResponse.json).toHaveBeenCalledWith({
				message: 'Password reset initiated successfully',
			})
			expect(mockNext).not.toHaveBeenCalled()
		})

		it('should handle Cognito forgotPassword error', async () => {
			// Arrange
			const forgotPasswordRequest: TForgotPasswordRequest = {
				email: 'test@example.com',
			}
			mockRequest.body = forgotPasswordRequest

			const cognitoError = new InternalError('Cognito error', 'cognitoService')
			vi.mocked(cognitoService.forgotPassword).mockResolvedValue([
				null,
				cognitoError,
			])

			// Act
			await authController.forgotPassword(mockRequest, mockResponse, mockNext)

			// Assert
			expect(cognitoService.forgotPassword).toHaveBeenCalledWith(
				'test@example.com',
			)
			expect(mockNext).toHaveBeenCalledWith(cognitoError)
			expect(mockResponse.status).not.toHaveBeenCalled()
			expect(mockResponse.json).not.toHaveBeenCalled()
		})
	})

	describe('confirmForgotPassword', () => {
		it('should successfully confirm forgot password', async () => {
			// Arrange
			const confirmForgotPasswordRequest: TConfirmForgotPasswordRequest = {
				email: 'test@example.com',
				code: '123456',
				newPassword: 'NewPassword123!',
				confirmPassword: 'NewPassword123!',
			}
			mockRequest.body = confirmForgotPasswordRequest

			const mockConfirmForgotPasswordResponse: ConfirmForgotPasswordCommandOutput =
				{
					$metadata: {
						httpStatusCode: 200,
						requestId: 'test-request-id',
						attempts: 1,
						totalRetryDelay: 0,
					},
				}
			vi.mocked(cognitoService.confirmForgotPassword).mockResolvedValue([
				mockConfirmForgotPasswordResponse,
				null,
			])
			vi.mocked(handleServiceError).mockReturnValue({ success: true })

			// Act
			await authController.confirmForgotPassword(
				mockRequest,
				mockResponse,
				mockNext,
			)

			// Assert
			expect(cognitoService.confirmForgotPassword).toHaveBeenCalledWith(
				'test@example.com',
				'123456',
				'NewPassword123!',
				'NewPassword123!',
			)
			expect(mockResponse.status).toHaveBeenCalledWith(StatusCodes.OK)
			expect(mockResponse.json).toHaveBeenCalledWith({
				message: 'Password reset successfully',
			})
			expect(mockNext).not.toHaveBeenCalled()
		})

		it('should handle Cognito confirmForgotPassword error', async () => {
			// Arrange
			const confirmForgotPasswordRequest: TConfirmForgotPasswordRequest = {
				email: 'test@example.com',
				code: '123456',
				newPassword: 'NewPassword123!',
				confirmPassword: 'NewPassword123!',
			}
			mockRequest.body = confirmForgotPasswordRequest

			const cognitoError = new InternalError('Cognito error', 'cognitoService')
			vi.mocked(cognitoService.confirmForgotPassword).mockResolvedValue([
				null,
				cognitoError,
			])

			// Act
			await authController.confirmForgotPassword(
				mockRequest,
				mockResponse,
				mockNext,
			)

			// Assert
			expect(cognitoService.confirmForgotPassword).toHaveBeenCalledWith(
				'test@example.com',
				'123456',
				'NewPassword123!',
				'NewPassword123!',
			)
			expect(mockNext).toHaveBeenCalledWith(cognitoError)
			expect(mockResponse.status).not.toHaveBeenCalled()
			expect(mockResponse.json).not.toHaveBeenCalled()
		})
	})

	describe('refreshToken', () => {
		it('should successfully refresh token', async () => {
			// Arrange

			mockRequest.cookies = {
				'macro-ai-refreshToken': 'refresh-token',
				'macro-ai-synchronize': 'encrypted-username',
			}

			const mockRefreshTokenResponse: InitiateAuthCommandOutput = {
				AuthenticationResult: {
					AccessToken: 'new-access-token',
					RefreshToken: 'new-refresh-token',
					ExpiresIn: 3600,
				},
				$metadata: {
					httpStatusCode: 200,
					requestId: 'test-request-id',
					attempts: 1,
					totalRetryDelay: 0,
				},
			}

			vi.mocked(tryCatchSync)
				.mockReturnValueOnce(['refresh-token', null]) // getRefreshToken
				.mockReturnValueOnce(['encrypted-username', null]) // getSynchronizeToken
			vi.mocked(decrypt).mockReturnValue(['decrypted-username', null])
			vi.mocked(cognitoService.refreshToken).mockResolvedValue([
				mockRefreshTokenResponse,
				null,
			])
			vi.mocked(handleServiceError).mockReturnValue({ success: true })

			// Act
			await authController.refreshToken(mockRequest, mockResponse, mockNext)

			// Assert
			expect(tryCatchSync).toHaveBeenCalledWith(
				expect.any(Function),
				'authController - refreshToken',
			)
			expect(decrypt).toHaveBeenCalledWith('encrypted-username')
			expect(cognitoService.refreshToken).toHaveBeenCalledWith(
				'refresh-token',
				'decrypted-username',
			)
			expect(mockResponse.cookie).toHaveBeenCalledWith(
				'macro-ai-accessToken',
				'new-access-token',
				expect.objectContaining({
					httpOnly: false,
					secure: false, // matches test environment
					domain: undefined, // localhost case
					sameSite: 'strict',
				}),
			)
			expect(mockResponse.cookie).toHaveBeenCalledWith(
				'macro-ai-refreshToken',
				'new-refresh-token',
				expect.objectContaining({
					httpOnly: true,
					secure: false, // matches test environment
					domain: undefined, // localhost case
					sameSite: 'strict',
				}),
			)
			expect(mockResponse.cookie).toHaveBeenCalledWith(
				'macro-ai-synchronize',
				'encrypted-username',
				expect.objectContaining({
					httpOnly: true,
					secure: false, // matches test environment
					domain: undefined, // localhost case
					sameSite: 'strict',
				}),
			)
			expect(mockResponse.status).toHaveBeenCalledWith(StatusCodes.OK)
			expect(mockResponse.json).toHaveBeenCalledWith({
				message: 'Token refreshed successfully',
				tokens: {
					accessToken: 'new-access-token',
					refreshToken: 'new-refresh-token',
					expiresIn: 3600,
				},
			})
			expect(mockNext).not.toHaveBeenCalled()

		})

		it('should set domain field to undefined when cookieDomain is localhost during refresh', async () => {
			// Arrange

			mockRequest.cookies = {
				'macro-ai-refreshToken': 'refresh-token',
				'macro-ai-synchronize': 'encrypted-username',
			}

			const mockRefreshTokenResponse: InitiateAuthCommandOutput = {
				AuthenticationResult: {
					AccessToken: 'new-access-token',
					RefreshToken: 'new-refresh-token',
					ExpiresIn: 3600,
				},
				$metadata: {
					httpStatusCode: 200,
					requestId: 'test-request-id',
					attempts: 1,
					totalRetryDelay: 0,
				},
			}

			vi.mocked(tryCatchSync)
				.mockReturnValueOnce(['refresh-token', null]) // getRefreshToken
				.mockReturnValueOnce(['encrypted-username', null]) // getSynchronizeToken
			vi.mocked(decrypt).mockReturnValue(['decrypted-username', null])
			vi.mocked(cognitoService.refreshToken).mockResolvedValue([
				mockRefreshTokenResponse,
				null,
			])
			vi.mocked(handleServiceError).mockReturnValue({ success: true })

			// Act
			await authController.refreshToken(mockRequest, mockResponse, mockNext)

			// Assert - Verify domain field is undefined for localhost (default test config)
			expect(mockResponse.cookie).toHaveBeenCalledWith(
				'macro-ai-accessToken',
				'new-access-token',
				expect.objectContaining({
					domain: undefined, // Should be undefined for localhost
					httpOnly: false,
					secure: false, // matches test environment
					sameSite: 'strict',
				}),
			)
			expect(mockResponse.cookie).toHaveBeenCalledWith(
				'macro-ai-refreshToken',
				'new-refresh-token',
				expect.objectContaining({
					domain: undefined, // Should be undefined for localhost
					httpOnly: true,
					secure: false, // matches test environment
					sameSite: 'strict',
				}),
			)
			expect(mockResponse.cookie).toHaveBeenCalledWith(
				'macro-ai-synchronize',
				'encrypted-username',
				expect.objectContaining({
					domain: undefined, // Should be undefined for localhost
					httpOnly: true,
					secure: false, // matches test environment
					sameSite: 'strict',
				}),
			)

		})

		it('should handle getRefreshToken error', async () => {
			// Arrange
			const refreshTokenError = new InternalError(
				'Refresh token error',
				'authController',
			)
			vi.mocked(tryCatchSync).mockReturnValue([null, refreshTokenError])

			// Act
			await authController.refreshToken(mockRequest, mockResponse, mockNext)

			// Assert
			expect(tryCatchSync).toHaveBeenCalledWith(
				expect.any(Function),
				'authController - refreshToken',
			)
			expect(mockNext).toHaveBeenCalledWith(refreshTokenError)
			expect(mockResponse.status).not.toHaveBeenCalled()
			expect(mockResponse.json).not.toHaveBeenCalled()
		})

		it('should handle getSynchronizeToken error', async () => {
			// Arrange
			const synchronizeTokenError = new InternalError(
				'Synchronize token error',
				'authController',
			)
			vi.mocked(tryCatchSync)
				.mockReturnValueOnce(['refresh-token', null]) // getRefreshToken
				.mockReturnValueOnce([null, synchronizeTokenError]) // getSynchronizeToken

			// Act
			await authController.refreshToken(mockRequest, mockResponse, mockNext)

			// Assert
			expect(tryCatchSync).toHaveBeenCalledTimes(2)
			expect(mockResponse.status).toHaveBeenCalledWith(StatusCodes.UNAUTHORIZED)
			expect(mockResponse.json).toHaveBeenCalledWith({
				message: 'Synchronize token not found or invalid',
			})
			expect(mockNext).not.toHaveBeenCalled()
		})

		it('should handle decrypt error', async () => {
			// Arrange
			const decryptError = new InternalError('Decrypt error', 'crypto')
			vi.mocked(tryCatchSync)
				.mockReturnValueOnce(['refresh-token', null]) // getRefreshToken
				.mockReturnValueOnce(['encrypted-username', null]) // getSynchronizeToken
			vi.mocked(decrypt).mockReturnValue([null, decryptError])

			// Act
			await authController.refreshToken(mockRequest, mockResponse, mockNext)

			// Assert
			expect(decrypt).toHaveBeenCalledWith('encrypted-username')
			expect(mockNext).toHaveBeenCalledWith(decryptError)
			expect(mockResponse.status).not.toHaveBeenCalled()
			expect(mockResponse.json).not.toHaveBeenCalled()
		})

		it('should handle missing authentication tokens in response', async () => {
			// Arrange
			const mockRefreshTokenResponse: InitiateAuthCommandOutput = {
				AuthenticationResult: {
					// Missing AccessToken and ExpiresIn
				},
				$metadata: {
					httpStatusCode: 200,
					requestId: 'test-request-id',
					attempts: 1,
					totalRetryDelay: 0,
				},
			}

			vi.mocked(tryCatchSync)
				.mockReturnValueOnce(['refresh-token', null]) // getRefreshToken
				.mockReturnValueOnce(['encrypted-username', null]) // getSynchronizeToken
			vi.mocked(decrypt).mockReturnValue(['decrypted-username', null])
			vi.mocked(cognitoService.refreshToken).mockResolvedValue([
				mockRefreshTokenResponse,
				null,
			])
			vi.mocked(handleServiceError).mockReturnValue({ success: true })

			// Act
			await authController.refreshToken(mockRequest, mockResponse, mockNext)

			// Assert
			expect(mockNext).toHaveBeenCalledWith(
				expect.objectContaining({
					message: 'Authentication tokens missing from response',
				}),
			)
			expect(mockResponse.status).not.toHaveBeenCalled()
			expect(mockResponse.json).not.toHaveBeenCalled()
		})
	})

	describe('getAuthUser', () => {
		it('should successfully get authenticated user', async () => {
			// Arrange
			mockRequest.cookies = {
				'macro-ai-accessToken': 'access-token',
			}

			const mockGetAuthUserResponse = mockCognitoService.createUser({
				Username: 'test-user-id',
				UserAttributes: [
					{ Name: 'email', Value: 'test@example.com' },
					{ Name: 'email_verified', Value: 'true' },
				],
			})

			vi.mocked(tryCatchSync).mockReturnValue(['access-token', null])
			vi.mocked(cognitoService.getAuthUser).mockResolvedValue([
				mockGetAuthUserResponse,
				null,
			])
			vi.mocked(handleServiceError).mockReturnValue({ success: true })

			// Act
			await authController.getAuthUser(mockRequest, mockResponse, mockNext)

			// Assert
			expect(tryCatchSync).toHaveBeenCalledWith(
				expect.any(Function),
				'authController - getAuthUser',
			)
			expect(cognitoService.getAuthUser).toHaveBeenCalledWith('access-token')
			expect(mockResponse.status).toHaveBeenCalledWith(StatusCodes.OK)
			expect(mockResponse.json).toHaveBeenCalledWith({
				id: 'test-user-id',
				email: 'test@example.com',
				emailVerified: true,
			})
			expect(mockNext).not.toHaveBeenCalled()
		})

		it('should handle getAccessToken error', async () => {
			// Arrange
			const accessTokenError = new InternalError(
				'Access token error',
				'authController',
			)
			vi.mocked(tryCatchSync).mockReturnValue([null, accessTokenError])

			// Act
			await authController.getAuthUser(mockRequest, mockResponse, mockNext)

			// Assert
			expect(tryCatchSync).toHaveBeenCalledWith(
				expect.any(Function),
				'authController - getAuthUser',
			)
			expect(mockResponse.status).toHaveBeenCalledWith(StatusCodes.UNAUTHORIZED)
			expect(mockResponse.json).toHaveBeenCalledWith({
				message: 'Authentication required',
			})
			expect(mockNext).not.toHaveBeenCalled()
		})

		it('should handle missing email in user attributes', async () => {
			// Arrange
			const mockGetAuthUserResponse = mockCognitoService.createUser({
				Username: 'test-user-id',
				UserAttributes: [
					{ Name: 'email_verified', Value: 'true' },
					// Missing email attribute
				],
			})

			vi.mocked(tryCatchSync).mockReturnValue(['access-token', null])
			vi.mocked(cognitoService.getAuthUser).mockResolvedValue([
				mockGetAuthUserResponse,
				null,
			])
			vi.mocked(handleServiceError).mockReturnValue({ success: true })

			// Act
			await authController.getAuthUser(mockRequest, mockResponse, mockNext)

			// Assert
			expect(cognitoService.getAuthUser).toHaveBeenCalledWith('access-token')
			expect(mockResponse.status).toHaveBeenCalledWith(
				StatusCodes.PARTIAL_CONTENT,
			)
			expect(mockResponse.json).toHaveBeenCalledWith({
				message: 'User profile incomplete',
			})
			expect(mockNext).not.toHaveBeenCalled()
		})
	})
})
