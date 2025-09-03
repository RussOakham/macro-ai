import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
	AppError,
	InternalError,
	NotFoundError,
	UnauthorizedError,
	ValidationError,
} from '../../../utils/errors.ts'
import { createServiceMocks } from '../../../utils/test-helpers/enhanced-mocks.ts'
import { mockErrorHandling } from '../../../utils/test-helpers/error-handling.mock.ts'
import { createMockData } from '../../../utils/test-helpers/index.ts'
import { mockLogger } from '../../../utils/test-helpers/logger.mock.ts'
import { CognitoService } from '../../auth/auth.services.ts'
import { UserService } from '../user.services.ts'
import { IUserRepository, TUser } from '../user.types.ts'

// Mock the logger using the reusable helper
vi.mock('../../../utils/logger.ts', () => mockLogger.createModule())

// Mock the error handling module using the helper
vi.mock('../../../utils/error-handling/try-catch.ts', () =>
	mockErrorHandling.createModule(),
)

// Import after mocking
import { tryCatchSync } from '../../../utils/error-handling/try-catch.ts'

// Mock the user schemas
vi.mock('../user.schemas.ts', () => ({
	userIdSchema: {
		safeParse: vi.fn(),
	},
}))

// Mock zod-validation-error
vi.mock('zod-validation-error', () => ({
	fromError: vi.fn(),
}))

describe('UserService', () => {
	let userService: UserService
	let mockUserRepository: IUserRepository
	let mockCognitoService: CognitoService
	let mockUser: TUser

	beforeEach(() => {
		vi.clearAllMocks()

		// Use enhanced service mocks
		const { userService: mockUserService, authService } = createServiceMocks()
		mockUserRepository = mockUserService as unknown as IUserRepository
		mockCognitoService = authService as unknown as CognitoService
		// Create mock user data with proper TUser structure
		mockUser = {
			...createMockData.user(),
			emailVerified: true,
			lastLogin: new Date(),
		} as TUser

		userService = new UserService(mockUserRepository, mockCognitoService)
	})

	describe('getUserById', () => {
		describe.each([
			['valid-uuid', true],
			['invalid-id', false],
			['', false],
			['123', false],
		])('User ID validation: %s', (userId, isValid) => {
			it(`should ${isValid ? 'return user' : 'return validation error'} for ${userId}`, async () => {
				// Arrange
				const testUser = {
					...createMockData.user({
						id: userId,
						email: 'test@example.com',
					}),
					emailVerified: true,
					lastLogin: new Date(),
				} as TUser

				if (isValid) {
					vi.mocked(tryCatchSync).mockReturnValue(
						mockErrorHandling.successResult(userId),
					)
					vi.mocked(mockUserRepository.findUserById).mockResolvedValue([
						testUser,
						null,
					])
				} else {
					const validationError = mockErrorHandling.errors.validation(
						'Invalid user ID',
						{},
						'test',
					)
					vi.mocked(tryCatchSync).mockReturnValue(
						mockErrorHandling.errorResult(validationError),
					)
				}

				// Act
				const [result, error] = await userService.getUserById({ userId })

				// Assert
				expect(tryCatchSync).toHaveBeenCalledOnce()

				if (isValid) {
					expect(mockUserRepository.findUserById).toHaveBeenCalledWith({
						id: userId,
					})
					expect(result).toEqual(testUser)
					expect(error).toBeNull()
				} else {
					expect(mockUserRepository.findUserById).not.toHaveBeenCalled()
					expect(result).toBeNull()
					expect(error).toBeInstanceOf(AppError)
				}
			})
		})

		it('should return repository error when database fails', async () => {
			// Arrange
			const dbError = mockErrorHandling.errors.internal(
				'Database error',
				'test',
			)
			vi.mocked(tryCatchSync).mockReturnValue(
				mockErrorHandling.successResult('123e4567-e89b-12d3-a456-426614174000'),
			)
			vi.mocked(mockUserRepository.findUserById).mockResolvedValue([
				null,
				dbError,
			])

			// Act
			const [result, error] = await userService.getUserById({
				userId: '123e4567-e89b-12d3-a456-426614174000',
			})

			// Assert
			expect(tryCatchSync).toHaveBeenCalledOnce()
			expect(mockUserRepository.findUserById).toHaveBeenCalledOnce()
			expect(result).toBeNull()
			expect(error).toEqual(dbError)
		})

		it('should return NotFoundError when user not found', async () => {
			// Arrange
			vi.mocked(tryCatchSync).mockReturnValue(
				mockErrorHandling.successResult('123e4567-e89b-12d3-a456-426614174000'),
			)
			vi.mocked(mockUserRepository.findUserById).mockResolvedValue([
				undefined,
				null,
			])

			// Act
			const [result, error] = await userService.getUserById({
				userId: '123e4567-e89b-12d3-a456-426614174000',
			})

			// Assert
			expect(tryCatchSync).toHaveBeenCalledOnce()
			expect(mockUserRepository.findUserById).toHaveBeenCalledOnce()
			expect(result).toBeNull()
			expect(error).toBeInstanceOf(NotFoundError)
			expect((error as NotFoundError).message).toContain(
				'User with ID 123e4567-e89b-12d3-a456-426614174000 not found',
			)
		})
	})

	describe('getUserByEmail', () => {
		describe.each([
			['test@example.com', true],
			['user@domain.co.uk', true],
			['invalid-email', false],
			['@domain.com', false],
			['user@', false],
			['', false],
		])('Email validation: %s', (email, isValid) => {
			it(`should ${isValid ? 'return user' : 'return validation error'} for ${email}`, async () => {
				// Arrange
				const testUser = {
					...createMockData.user({
						email,
					}),
					emailVerified: true,
					lastLogin: new Date(),
				} as TUser

				if (isValid) {
					vi.mocked(tryCatchSync).mockReturnValue([email, null])
					vi.mocked(mockUserRepository.findUserByEmail).mockResolvedValue([
						testUser,
						null,
					])
				} else {
					const validationError = new ValidationError(
						'Invalid email',
						{},
						'test',
					)
					vi.mocked(tryCatchSync).mockReturnValue([null, validationError])
				}

				// Act
				const [result, error] = await userService.getUserByEmail({ email })

				// Assert
				expect(tryCatchSync).toHaveBeenCalledOnce()

				if (isValid) {
					expect(mockUserRepository.findUserByEmail).toHaveBeenCalledWith({
						email,
					})
					expect(result).toEqual(testUser)
					expect(error).toBeNull()
				} else {
					expect(mockUserRepository.findUserByEmail).not.toHaveBeenCalled()
					expect(result).toBeNull()
					expect(error).toBeInstanceOf(ValidationError)
				}
			})
		})

		it('should return repository error when database fails', async () => {
			// Arrange
			const dbError = new InternalError('Database error', 'test')
			vi.mocked(tryCatchSync).mockReturnValue(['test@example.com', null])
			vi.mocked(mockUserRepository.findUserByEmail).mockResolvedValue([
				null,
				dbError,
			])

			// Act
			const [result, error] = await userService.getUserByEmail({
				email: 'test@example.com',
			})

			// Assert
			expect(tryCatchSync).toHaveBeenCalledOnce()
			expect(mockUserRepository.findUserByEmail).toHaveBeenCalledOnce()
			expect(result).toBeNull()
			expect(error).toEqual(dbError)
		})

		it('should return NotFoundError when user not found', async () => {
			// Arrange
			vi.mocked(tryCatchSync).mockReturnValue(['test@example.com', null])
			vi.mocked(mockUserRepository.findUserByEmail).mockResolvedValue([
				undefined,
				null,
			])

			// Act
			const [result, error] = await userService.getUserByEmail({
				email: 'test@example.com',
			})

			// Assert
			expect(tryCatchSync).toHaveBeenCalledOnce()
			expect(mockUserRepository.findUserByEmail).toHaveBeenCalledOnce()
			expect(result).toBeNull()
			expect(error).toBeInstanceOf(NotFoundError)
			expect((error as NotFoundError).message).toContain(
				'User with email test@example.com not found',
			)
		})
	})

	describe('getUserByAccessToken', () => {
		it('should return user when valid access token provided', async () => {
			// Arrange
			const mockCognitoUser = {
				Username: '123e4567-e89b-12d3-a456-426614174000',
				UserAttributes: [],
				$metadata: {},
			}

			vi.mocked(mockCognitoService.getAuthUser).mockResolvedValue([
				mockCognitoUser,
				null,
			])
			vi.mocked(tryCatchSync).mockReturnValue([
				'123e4567-e89b-12d3-a456-426614174000',
				null,
			])
			vi.mocked(mockUserRepository.findUserById).mockResolvedValue([
				mockUser,
				null,
			])

			// Act
			const [result, error] = await userService.getUserByAccessToken({
				accessToken: 'valid-token',
			})

			// Assert
			expect(mockCognitoService.getAuthUser).toHaveBeenCalledWith('valid-token')
			expect(result).toEqual(mockUser)
			expect(error).toBeNull()
		})

		it('should return error when Cognito service fails', async () => {
			// Arrange
			const cognitoError = new UnauthorizedError('Invalid token', 'cognito')
			vi.mocked(mockCognitoService.getAuthUser).mockResolvedValue([
				null,
				cognitoError,
			])

			// Act
			const [result, error] = await userService.getUserByAccessToken({
				accessToken: 'invalid-token',
			})

			// Assert
			expect(mockCognitoService.getAuthUser).toHaveBeenCalledWith(
				'invalid-token',
			)
			expect(result).toBeNull()
			expect(error).toEqual(cognitoError)
		})

		it('should return UnauthorizedError when Cognito user has no Username', async () => {
			// Arrange
			const mockCognitoUser = {
				Username: undefined,
				UserAttributes: [],
				$metadata: {},
			}
			vi.mocked(mockCognitoService.getAuthUser).mockResolvedValue([
				mockCognitoUser,
				null,
			])

			// Act
			const [result, error] = await userService.getUserByAccessToken({
				accessToken: 'token-without-username',
			})

			// Assert
			expect(mockCognitoService.getAuthUser).toHaveBeenCalledWith(
				'token-without-username',
			)
			expect(result).toBeNull()
			expect(error).toBeInstanceOf(UnauthorizedError)
			expect((error as UnauthorizedError).message).toBe('Invalid access token')
		})

		it('should return error when getUserById fails', async () => {
			// Arrange
			const mockCognitoUser = {
				Username: '123e4567-e89b-12d3-a456-426614174000',
				UserAttributes: [],
				$metadata: {},
			}
			const userError = new NotFoundError('User not found', 'test')

			vi.mocked(mockCognitoService.getAuthUser).mockResolvedValue([
				mockCognitoUser,
				null,
			])
			vi.mocked(tryCatchSync).mockReturnValue([
				'123e4567-e89b-12d3-a456-426614174000',
				null,
			])
			vi.mocked(mockUserRepository.findUserById).mockResolvedValue([
				null,
				userError,
			])

			// Act
			const [result, error] = await userService.getUserByAccessToken({
				accessToken: 'valid-token',
			})

			// Assert
			expect(mockCognitoService.getAuthUser).toHaveBeenCalledWith('valid-token')
			expect(result).toBeNull()
			expect(error).toEqual(userError)
		})
	})

	describe('registerOrLoginUserById', () => {
		it('should create new user when user does not exist', async () => {
			// Arrange
			const userData = {
				id: '123e4567-e89b-12d3-a456-426614174000',
				email: 'test@example.com',
				firstName: 'John',
				lastName: 'Doe',
			}

			vi.mocked(mockUserRepository.findUserById).mockResolvedValue([
				undefined,
				null,
			])
			vi.mocked(mockUserRepository.createUser).mockResolvedValue([
				mockUser,
				null,
			])

			// Act
			const [result, error] =
				await userService.registerOrLoginUserById(userData)

			// Assert
			expect(mockUserRepository.findUserById).toHaveBeenCalledWith({
				id: userData.id,
			})
			expect(mockUserRepository.createUser).toHaveBeenCalledWith({ userData })
			expect(result).toEqual(mockUser)
			expect(error).toBeNull()
		})

		it('should update last login when user exists', async () => {
			// Arrange
			const userData = {
				id: '123e4567-e89b-12d3-a456-426614174000',
				email: 'test@example.com',
			}
			const updatedUser = { ...mockUser, lastLogin: new Date() }

			vi.mocked(mockUserRepository.findUserById).mockResolvedValue([
				mockUser,
				null,
			])
			vi.mocked(mockUserRepository.updateLastLogin).mockResolvedValue([
				updatedUser,
				null,
			])

			// Act
			const [result, error] =
				await userService.registerOrLoginUserById(userData)

			// Assert
			expect(mockUserRepository.findUserById).toHaveBeenCalledWith({
				id: userData.id,
			})
			expect(mockUserRepository.updateLastLogin).toHaveBeenCalledWith({
				id: userData.id,
			})
			expect(result).toEqual(updatedUser)
			expect(error).toBeNull()
		})

		it('should return error when findUserById fails', async () => {
			// Arrange
			const userData = {
				id: '123e4567-e89b-12d3-a456-426614174000',
				email: 'test@example.com',
			}
			const dbError = new InternalError('Database error', 'test')

			vi.mocked(mockUserRepository.findUserById).mockResolvedValue([
				null,
				dbError,
			])

			// Act
			const [result, error] =
				await userService.registerOrLoginUserById(userData)

			// Assert
			expect(mockUserRepository.findUserById).toHaveBeenCalledWith({
				id: userData.id,
			})
			expect(mockUserRepository.createUser).not.toHaveBeenCalled()
			expect(mockUserRepository.updateLastLogin).not.toHaveBeenCalled()
			expect(result).toBeNull()
			expect(error).toEqual(dbError)
		})

		it('should return error when createUser fails', async () => {
			// Arrange
			const userData = {
				id: '123e4567-e89b-12d3-a456-426614174000',
				email: 'test@example.com',
			}
			const createError = new InternalError('Create user failed', 'test')

			vi.mocked(mockUserRepository.findUserById).mockResolvedValue([
				undefined,
				null,
			])
			vi.mocked(mockUserRepository.createUser).mockResolvedValue([
				null,
				createError,
			])

			// Act
			const [result, error] =
				await userService.registerOrLoginUserById(userData)

			// Assert
			expect(mockUserRepository.findUserById).toHaveBeenCalledWith({
				id: userData.id,
			})
			expect(mockUserRepository.createUser).toHaveBeenCalledWith({ userData })
			expect(result).toBeNull()
			expect(error).toEqual(createError)
		})

		it('should return error when updateLastLogin fails', async () => {
			// Arrange
			const userData = {
				id: '123e4567-e89b-12d3-a456-426614174000',
				email: 'test@example.com',
			}
			const updateError = new InternalError('Update failed', 'test')

			vi.mocked(mockUserRepository.findUserById).mockResolvedValue([
				mockUser,
				null,
			])
			vi.mocked(mockUserRepository.updateLastLogin).mockResolvedValue([
				null,
				updateError,
			])

			// Act
			const [result, error] =
				await userService.registerOrLoginUserById(userData)

			// Assert
			expect(mockUserRepository.findUserById).toHaveBeenCalledWith({
				id: userData.id,
			})
			expect(mockUserRepository.updateLastLogin).toHaveBeenCalledWith({
				id: userData.id,
			})
			expect(result).toBeNull()
			expect(error).toEqual(updateError)
		})

		it('should return InternalError when updateLastLogin returns undefined', async () => {
			// Arrange
			const userData = {
				id: '123e4567-e89b-12d3-a456-426614174000',
				email: 'test@example.com',
			}

			vi.mocked(mockUserRepository.findUserById).mockResolvedValue([
				mockUser,
				null,
			])
			vi.mocked(mockUserRepository.updateLastLogin).mockResolvedValue([
				undefined,
				null,
			])

			// Act
			const [result, error] =
				await userService.registerOrLoginUserById(userData)

			// Assert
			expect(mockUserRepository.findUserById).toHaveBeenCalledWith({
				id: userData.id,
			})
			expect(mockUserRepository.updateLastLogin).toHaveBeenCalledWith({
				id: userData.id,
			})
			expect(result).toBeNull()
			expect(error).toBeInstanceOf(InternalError)
			expect((error as InternalError).message).toBe(
				'Failed to update last login timestamp',
			)
		})
	})
})
