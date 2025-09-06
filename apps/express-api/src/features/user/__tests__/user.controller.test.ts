import { NextFunction, Request, Response } from 'express'
import { StatusCodes } from 'http-status-codes'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { InternalError, NotFoundError } from '../../../utils/errors.ts'
import { MockDataFactory } from '../../../utils/test-helpers/advanced-mocking.ts'
import { createMockExpressObjects } from '../../../utils/test-helpers/enhanced-mocks.ts'
import { mockLogger } from '../../../utils/test-helpers/logger.mock.ts'
import { mockUserService } from '../../../utils/test-helpers/user-service.mock.ts'
import { userController } from '../user.controller.ts'
import { userService } from '../user.services.ts'

// Mock the logger using the reusable helper
vi.mock('../../../utils/logger.ts', () => mockLogger.createModule())

// Mock the user service using the reusable helper
vi.mock('../user.services.ts', () => mockUserService.createModule())

describe('UserController', () => {
	let mockRequest: Request
	let mockResponse: Response
	let mockNext: NextFunction

	// Create mock user data using enhanced factory
	const mockUser = MockDataFactory.createUser({
		email: 'test@example.com',
		firstName: 'John',
		lastName: 'Doe',
	})

	beforeEach(() => {
		// Setup enhanced Express mocks
		const mocks = createMockExpressObjects()
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
			await userController.getCurrentUser(mockRequest, mockResponse, mockNext)

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
			await userController.getCurrentUser(mockRequest, mockResponse, mockNext)

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
			await userController.getCurrentUser(mockRequest, mockResponse, mockNext)

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
		describe.each([
			['123e4567-e89b-12d3-a456-426614174000', 'valid UUID'],
			['987fcdeb-51a2-43d7-8f9e-123456789abc', 'different UUID'],
			['00000000-0000-0000-0000-000000000000', 'zero UUID'],
		])('User ID validation: %s', (userId, description) => {
			it(`should return user when ${description} provided`, async () => {
				// Arrange
				mockRequest.params = { id: userId }
				vi.mocked(userService.getUserById).mockResolvedValue([mockUser, null])

				// Act
				await userController.getUserById(mockRequest, mockResponse, mockNext)

				// Assert
				expect(userService.getUserById).toHaveBeenCalledWith({
					userId,
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
		})

		describe.each([
			[{}, 'no user ID provided'],
			[{ id: '' }, 'empty string user ID'],
		])('Invalid user ID scenarios: %s', (params, description) => {
			it(`should return ValidationError when ${description}`, async () => {
				// Arrange
				mockRequest.params = params

				// Act
				await userController.getUserById(mockRequest, mockResponse, mockNext)

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

		it('should pass whitespace-only user ID to service layer', async () => {
			// Arrange
			mockRequest.params = { id: '   ' }
			vi.mocked(userService.getUserById).mockResolvedValue([
				null,
				new NotFoundError('User not found', 'userService'),
			])

			// Act
			await userController.getUserById(mockRequest, mockResponse, mockNext)

			// Assert
			expect(userService.getUserById).toHaveBeenCalledWith({
				userId: '   ',
			})
			expect(mockNext).toHaveBeenCalledWith(expect.any(NotFoundError))
			expect(mockResponse.status).not.toHaveBeenCalled()
			expect(mockResponse.json).not.toHaveBeenCalled()
		})

		it('should handle service error and call next middleware', async () => {
			// Arrange
			mockRequest.params = { id: '123e4567-e89b-12d3-a456-426614174000' }
			const serviceError = new InternalError('Database error', 'userService')
			vi.mocked(userService.getUserById).mockResolvedValue([null, serviceError])

			// Act
			await userController.getUserById(mockRequest, mockResponse, mockNext)

			// Assert
			expect(userService.getUserById).toHaveBeenCalledWith({
				userId: '123e4567-e89b-12d3-a456-426614174000',
			})
			expect(mockNext).toHaveBeenCalledWith(serviceError)
			expect(mockResponse.status).not.toHaveBeenCalled()
			expect(mockResponse.json).not.toHaveBeenCalled()
		})
	})
})
