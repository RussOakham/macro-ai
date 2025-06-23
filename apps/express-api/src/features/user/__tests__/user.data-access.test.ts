import { beforeEach, describe, expect, it, vi } from 'vitest'

import { tryCatch } from '../../../utils/error-handling/try-catch.ts'
import { AppError, InternalError } from '../../../utils/errors.ts'
import { safeValidateSchema } from '../../../utils/response-handlers.ts'
import { mockDatabase } from '../../../utils/test-helpers/drizzle-db.mock.ts'
import { userRepository } from '../user.data-access.ts'
import { TInsertUser, TUser } from '../user.types.ts'

// Mock the database using the standardized helper
vi.mock('../../../data-access/db.ts', () => mockDatabase.createModule())

// Mock the tryCatch utility
vi.mock('../../../utils/error-handling/try-catch.ts', () => ({
	tryCatch: vi.fn(),
}))

// Mock the response handlers
vi.mock('../../../utils/response-handlers.ts', () => ({
	safeValidateSchema: vi.fn(),
}))

// Mock the user schemas
vi.mock('../user.schemas.ts', () => ({
	selectUserSchema: {},
	usersTable: {
		email: 'email',
		id: 'id',
	},
}))

describe('UserRepository', () => {
	// Use the standardized mock data creators
	const mockUser: TUser = mockDatabase.createUser() as TUser
	const mockInsertUser: TInsertUser =
		mockDatabase.createInsertUser() as TInsertUser

	beforeEach(() => {
		vi.clearAllMocks()
	})

	describe('findUserByEmail', () => {
		it('should return user when found', async () => {
			// Arrange
			vi.mocked(tryCatch).mockResolvedValue([[mockUser], null])
			vi.mocked(safeValidateSchema).mockReturnValue([mockUser, null])

			// Act
			const [result, error] = await userRepository.findUserByEmail({
				email: 'test@example.com',
			})

			// Assert
			expect(tryCatch).toHaveBeenCalledOnce()
			expect(safeValidateSchema).toHaveBeenCalledOnce()
			expect(result).toEqual(mockUser)
			expect(error).toBeNull()
		})

		it('should return undefined when user not found', async () => {
			// Arrange
			vi.mocked(tryCatch).mockResolvedValue([[], null])

			// Act
			const [result, error] = await userRepository.findUserByEmail({
				email: 'notfound@example.com',
			})

			// Assert
			expect(tryCatch).toHaveBeenCalledOnce()
			expect(result).toBeUndefined()
			expect(error).toBeNull()
		})

		it('should handle database error', async () => {
			// Arrange
			const dbError = new InternalError('Database connection failed', 'test')

			vi.mocked(tryCatch).mockResolvedValue([null, dbError])

			// Act
			const [result, error] = await userRepository.findUserByEmail({
				email: 'test@example.com',
			})

			// Assert
			expect(tryCatch).toHaveBeenCalledOnce()
			expect(result).toBeNull()
			expect(error).toEqual(dbError)
		})

		it('should handle validation error', async () => {
			// Arrange
			const validationError = new InternalError('Validation failed', 'test')

			vi.mocked(tryCatch).mockResolvedValue([[mockUser], null])
			vi.mocked(safeValidateSchema).mockReturnValue([null, validationError])

			// Act
			const [result, error] = await userRepository.findUserByEmail({
				email: 'test@example.com',
			})

			// Assert
			expect(tryCatch).toHaveBeenCalledOnce()
			expect(safeValidateSchema).toHaveBeenCalledOnce()
			expect(result).toBeNull()
			expect(error).toBeInstanceOf(AppError)
		})
	})

	describe('findUserById', () => {
		it('should return user when found', async () => {
			// Arrange
			vi.mocked(tryCatch).mockResolvedValue([[mockUser], null])
			vi.mocked(safeValidateSchema).mockReturnValue([mockUser, null])

			// Act
			const [result, error] = await userRepository.findUserById({
				id: '123e4567-e89b-12d3-a456-426614174000',
			})

			// Assert
			expect(tryCatch).toHaveBeenCalledOnce()
			expect(safeValidateSchema).toHaveBeenCalledOnce()
			expect(result).toEqual(mockUser)
			expect(error).toBeNull()
		})

		it('should return undefined when user not found', async () => {
			// Arrange
			vi.mocked(tryCatch).mockResolvedValue([[], null])

			// Act
			const [result, error] = await userRepository.findUserById({
				id: 'nonexistent-id',
			})

			// Assert
			expect(tryCatch).toHaveBeenCalledOnce()
			expect(result).toBeUndefined()
			expect(error).toBeNull()
		})

		it('should handle database error', async () => {
			// Arrange
			const dbError = new InternalError('Database connection failed', 'test')

			vi.mocked(tryCatch).mockResolvedValue([null, dbError])

			// Act
			const [result, error] = await userRepository.findUserById({
				id: '123e4567-e89b-12d3-a456-426614174000',
			})

			// Assert
			expect(tryCatch).toHaveBeenCalledOnce()
			expect(result).toBeNull()
			expect(error).toEqual(dbError)
		})

		it('should handle validation error', async () => {
			// Arrange
			const validationError = new InternalError('Validation failed', 'test')

			vi.mocked(tryCatch).mockResolvedValue([[mockUser], null])
			vi.mocked(safeValidateSchema).mockReturnValue([null, validationError])

			// Act
			const [result, error] = await userRepository.findUserById({
				id: '123e4567-e89b-12d3-a456-426614174000',
			})

			// Assert
			expect(tryCatch).toHaveBeenCalledOnce()
			expect(safeValidateSchema).toHaveBeenCalledOnce()
			expect(result).toBeNull()
			expect(error).toBeInstanceOf(AppError)
		})
	})

	describe('createUser', () => {
		it('should create user successfully', async () => {
			// Arrange
			vi.mocked(tryCatch).mockResolvedValue([[mockUser], null])
			vi.mocked(safeValidateSchema).mockReturnValue([mockUser, null])

			// Act
			const [result, error] = await userRepository.createUser({
				userData: mockInsertUser,
			})

			// Assert
			expect(tryCatch).toHaveBeenCalledOnce()
			expect(safeValidateSchema).toHaveBeenCalledOnce()
			expect(result).toEqual(mockUser)
			expect(error).toBeNull()
		})

		it('should handle database error during creation', async () => {
			// Arrange
			const dbError = new InternalError('Database insert failed', 'test')

			vi.mocked(tryCatch).mockResolvedValue([null, dbError])

			// Act
			const [result, error] = await userRepository.createUser({
				userData: mockInsertUser,
			})

			// Assert
			expect(tryCatch).toHaveBeenCalledOnce()
			expect(result).toBeNull()
			expect(error).toEqual(dbError)
		})

		it('should handle empty result from database', async () => {
			// Arrange
			vi.mocked(tryCatch).mockResolvedValue([[], null])

			// Act
			const [result, error] = await userRepository.createUser({
				userData: mockInsertUser,
			})

			// Assert
			expect(tryCatch).toHaveBeenCalledOnce()
			expect(result).toBeNull()
			expect(error).toBeInstanceOf(InternalError)
			expect((error as InternalError).message).toBe('Failed to create user')
		})

		it('should handle validation error during creation', async () => {
			// Arrange
			const validationError = new InternalError('Validation failed', 'test')

			vi.mocked(tryCatch).mockResolvedValue([[mockUser], null])
			vi.mocked(safeValidateSchema).mockReturnValue([null, validationError])

			// Act
			const [result, error] = await userRepository.createUser({
				userData: mockInsertUser,
			})

			// Assert
			expect(tryCatch).toHaveBeenCalledOnce()
			expect(safeValidateSchema).toHaveBeenCalledOnce()
			expect(result).toBeNull()
			expect(error).toBeInstanceOf(AppError)
		})
	})

	describe('updateLastLogin', () => {
		it('should update last login successfully', async () => {
			// Arrange
			vi.mocked(tryCatch).mockResolvedValue([[mockUser], null])
			vi.mocked(safeValidateSchema).mockReturnValue([mockUser, null])

			// Act
			const [result, error] = await userRepository.updateLastLogin({
				id: '123e4567-e89b-12d3-a456-426614174000',
			})

			// Assert
			expect(tryCatch).toHaveBeenCalledOnce()
			expect(safeValidateSchema).toHaveBeenCalledOnce()
			expect(result).toEqual(mockUser)
			expect(error).toBeNull()
		})

		it('should return undefined when user not found for update', async () => {
			// Arrange
			vi.mocked(tryCatch).mockResolvedValue([[], null])

			// Act
			const [result, error] = await userRepository.updateLastLogin({
				id: 'nonexistent-id',
			})

			// Assert
			expect(tryCatch).toHaveBeenCalledOnce()
			expect(result).toBeUndefined()
			expect(error).toBeNull()
		})

		it('should handle database error during update', async () => {
			// Arrange
			const dbError = new InternalError('Database update failed', 'test')

			vi.mocked(tryCatch).mockResolvedValue([null, dbError])

			// Act
			const [result, error] = await userRepository.updateLastLogin({
				id: '123e4567-e89b-12d3-a456-426614174000',
			})

			// Assert
			expect(tryCatch).toHaveBeenCalledOnce()
			expect(result).toBeNull()
			expect(error).toEqual(dbError)
		})

		it('should handle validation error during update', async () => {
			// Arrange
			const validationError = new InternalError('Validation failed', 'test')

			vi.mocked(tryCatch).mockResolvedValue([[mockUser], null])
			vi.mocked(safeValidateSchema).mockReturnValue([null, validationError])

			// Act
			const [result, error] = await userRepository.updateLastLogin({
				id: '123e4567-e89b-12d3-a456-426614174000',
			})

			// Assert
			expect(tryCatch).toHaveBeenCalledOnce()
			expect(safeValidateSchema).toHaveBeenCalledOnce()
			expect(result).toBeNull()
			expect(error).toBeInstanceOf(AppError)
		})
	})

	describe('updateUser', () => {
		it('should update user successfully', async () => {
			// Arrange
			const updateData = { firstName: 'Jane', lastName: 'Smith' }

			vi.mocked(tryCatch).mockResolvedValue([[mockUser], null])
			vi.mocked(safeValidateSchema).mockReturnValue([mockUser, null])

			// Act
			const [result, error] = await userRepository.updateUser(
				'123e4567-e89b-12d3-a456-426614174000',
				updateData,
			)

			// Assert
			expect(tryCatch).toHaveBeenCalledOnce()
			expect(safeValidateSchema).toHaveBeenCalledOnce()
			expect(result).toEqual(mockUser)
			expect(error).toBeNull()
		})

		it('should return undefined when user not found for update', async () => {
			// Arrange
			const updateData = { firstName: 'Jane' }

			vi.mocked(tryCatch).mockResolvedValue([[], null])

			// Act
			const [result, error] = await userRepository.updateUser(
				'nonexistent-id',
				updateData,
			)

			// Assert
			expect(tryCatch).toHaveBeenCalledOnce()
			expect(result).toBeUndefined()
			expect(error).toBeNull()
		})

		it('should handle database error during user update', async () => {
			// Arrange
			const updateData = { firstName: 'Jane' }
			const dbError = new InternalError('Database update failed', 'test')

			vi.mocked(tryCatch).mockResolvedValue([null, dbError])

			// Act
			const [result, error] = await userRepository.updateUser(
				'123e4567-e89b-12d3-a456-426614174000',
				updateData,
			)

			// Assert
			expect(tryCatch).toHaveBeenCalledOnce()
			expect(result).toBeNull()
			expect(error).toEqual(dbError)
		})

		it('should handle validation error during user update', async () => {
			// Arrange
			const updateData = { firstName: 'Jane' }
			const validationError = new InternalError('Validation failed', 'test')

			vi.mocked(tryCatch).mockResolvedValue([[mockUser], null])
			vi.mocked(safeValidateSchema).mockReturnValue([null, validationError])

			// Act
			const [result, error] = await userRepository.updateUser(
				'123e4567-e89b-12d3-a456-426614174000',
				updateData,
			)

			// Assert
			expect(tryCatch).toHaveBeenCalledOnce()
			expect(safeValidateSchema).toHaveBeenCalledOnce()
			expect(result).toBeNull()
			expect(error).toBeInstanceOf(AppError)
		})
	})
})
