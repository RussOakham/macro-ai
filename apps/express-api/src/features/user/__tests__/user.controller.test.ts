import { NextFunction, Request, Response } from 'express'
import { StatusCodes } from 'http-status-codes'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { InternalError, NotFoundError } from '../../../utils/errors.ts'
import { mockExpress } from '../../../utils/test-helpers/express-mocks.ts'
import { mockLogger } from '../../../utils/test-helpers/logger.mock.ts'
import { userController } from '../user.controller.ts'
import { userService } from '../user.services.ts'
import { TUser } from '../user.types.ts'

// Mock the logger using the reusable helper
vi.mock('../../../utils/logger.ts', () => mockLogger.createModule())

// Mock the user service
vi.mock('../user.services.ts', () => ({
	userService: {
		getUserById: vi.fn(),
		getUserByEmail: vi.fn(),
		getUserByAccessToken: vi.fn(),
		registerOrLoginUserById: vi.fn(),
	},
}))

describe('UserController', () => {
	let mockRequest: Partial<Request>
	let mockResponse: Partial<Response>
	let mockNext: NextFunction

	const mockUser: TUser = {
		id: '123e4567-e89b-12d3-a456-426614174000',
		email: 'test@example.com',
		emailVerified: true,
		firstName: 'John',
		lastName: 'Doe',
		createdAt: new Date('2023-01-01'),
		updatedAt: new Date('2023-01-01'),
		lastLogin: new Date('2023-01-01'),
	}

	beforeEach(() => {
		const mocks = mockExpress.setup()
		mockRequest = mocks.req
		mockResponse = mocks.res
		mockNext = mocks.next
	})

	describe('getCurrentUser', () => {
		it('should return current user when authenticated', async () => {
			// Arrange
			mockRequest.userId = '123e4567-e89b-12d3-a456-426614174000'
			vi.mocked(userService.getUserById).mockResolvedValue([mockUser, null])

			// Act
			await userController.getCurrentUser(
				mockRequest as Request,
				mockResponse as Response,
				mockNext,
			)

			// Assert
			expect(userService.getUserById).toHaveBeenCalledWith({
				userId: '123e4567-e89b-12d3-a456-426614174000',
			})
			expect(mockResponse.status).toHaveBeenCalledWith(StatusCodes.OK)
			expect(mockResponse.json).toHaveBeenCalledWith({
				user: {
					id: mockUser.id,
					email: mockUser.email,
					emailVerified: mockUser.emailVerified,
					firstName: mockUser.firstName,
					lastName: mockUser.lastName,
					createdAt: mockUser.createdAt,
					updatedAt: mockUser.updatedAt,
					lastLogin: mockUser.lastLogin,
				},
			})
			expect(mockNext).not.toHaveBeenCalled()
		})

		it('should return UnauthorizedError when no userId in request', async () => {
			// Arrange
			mockRequest.userId = undefined

			// Act
			await userController.getCurrentUser(
				mockRequest as Request,
				mockResponse as Response,
				mockNext,
			)

			// Assert
			expect(mockNext).toHaveBeenCalledWith(
				expect.objectContaining({
					message: 'Authentication required',
					status: StatusCodes.UNAUTHORIZED,
				}),
			)
			expect(mockResponse.status).not.toHaveBeenCalled()
			expect(mockResponse.json).not.toHaveBeenCalled()
		})

		it('should handle service error and call next middleware', async () => {
			// Arrange
			mockRequest.userId = '123e4567-e89b-12d3-a456-426614174000'
			const serviceError = new NotFoundError('User not found', 'userService')
			vi.mocked(userService.getUserById).mockResolvedValue([null, serviceError])

			// Act
			await userController.getCurrentUser(
				mockRequest as Request,
				mockResponse as Response,
				mockNext,
			)

			// Assert
			expect(userService.getUserById).toHaveBeenCalledWith({
				userId: '123e4567-e89b-12d3-a456-426614174000',
			})
			expect(mockNext).toHaveBeenCalledWith(serviceError)
			expect(mockResponse.status).not.toHaveBeenCalled()
			expect(mockResponse.json).not.toHaveBeenCalled()
		})
	})

	describe('getUserById', () => {
		it('should return user when valid ID provided', async () => {
			// Arrange
			mockRequest.params = { id: '123e4567-e89b-12d3-a456-426614174000' }
			vi.mocked(userService.getUserById).mockResolvedValue([mockUser, null])

			// Act
			await userController.getUserById(
				mockRequest as Request,
				mockResponse as Response,
				mockNext,
			)

			// Assert
			expect(userService.getUserById).toHaveBeenCalledWith({
				userId: '123e4567-e89b-12d3-a456-426614174000',
			})
			expect(mockResponse.status).toHaveBeenCalledWith(StatusCodes.OK)
			expect(mockResponse.json).toHaveBeenCalledWith({
				user: {
					id: mockUser.id,
					email: mockUser.email,
					emailVerified: mockUser.emailVerified,
					firstName: mockUser.firstName,
					lastName: mockUser.lastName,
					createdAt: mockUser.createdAt,
					updatedAt: mockUser.updatedAt,
					lastLogin: mockUser.lastLogin,
				},
			})
			expect(mockNext).not.toHaveBeenCalled()
		})

		it('should return ValidationError when no user ID provided', async () => {
			// Arrange
			mockRequest.params = {}

			// Act
			await userController.getUserById(
				mockRequest as Request,
				mockResponse as Response,
				mockNext,
			)

			// Assert
			expect(mockNext).toHaveBeenCalledWith(
				expect.objectContaining({
					message: 'User ID is required',
					status: StatusCodes.BAD_REQUEST,
				}),
			)
			expect(mockResponse.status).not.toHaveBeenCalled()
			expect(mockResponse.json).not.toHaveBeenCalled()
		})

		it('should handle service error and call next middleware', async () => {
			// Arrange
			mockRequest.params = { id: '123e4567-e89b-12d3-a456-426614174000' }
			const serviceError = new InternalError('Database error', 'userService')
			vi.mocked(userService.getUserById).mockResolvedValue([null, serviceError])

			// Act
			await userController.getUserById(
				mockRequest as Request,
				mockResponse as Response,
				mockNext,
			)

			// Assert
			expect(userService.getUserById).toHaveBeenCalledWith({
				userId: '123e4567-e89b-12d3-a456-426614174000',
			})
			expect(mockNext).toHaveBeenCalledWith(serviceError)
			expect(mockResponse.status).not.toHaveBeenCalled()
			expect(mockResponse.json).not.toHaveBeenCalled()
		})

		it('should handle empty string user ID as missing ID', async () => {
			// Arrange
			mockRequest.params = { id: '' }

			// Act
			await userController.getUserById(
				mockRequest as Request,
				mockResponse as Response,
				mockNext,
			)

			// Assert
			expect(mockNext).toHaveBeenCalledWith(
				expect.objectContaining({
					message: 'User ID is required',
					status: StatusCodes.BAD_REQUEST,
				}),
			)
			expect(mockResponse.status).not.toHaveBeenCalled()
			expect(mockResponse.json).not.toHaveBeenCalled()
		})
	})
})
