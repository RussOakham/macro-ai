
import express, { NextFunction, Request, Response, Router } from 'express'
import { StatusCodes } from 'http-status-codes'
import request from 'supertest'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { NotFoundError, UnauthorizedError } from '../../../utils/errors.ts'
import { mockLogger } from '../../../utils/test-helpers/logger.mock.ts'
import { userController } from '../user.controller.ts'
import { userRouter } from '../user.routes.ts'
import { TUser } from '../user.types.ts'

// Mock the logger using the reusable helper
vi.mock('../../../utils/logger.ts', () => mockLogger.createModule())

// Mock the user controller
vi.mock('../user.controller.ts', () => ({
	userController: {
		getCurrentUser: vi.fn(),
		getUserById: vi.fn(),
	},
}))

// Mock the auth middleware
vi.mock('../../../middleware/auth.middleware.ts', () => ({
	verifyAuth: vi.fn((req: Request, res: Response, next: NextFunction) => {
		// Simulate successful authentication by default
		req.userId = '123e4567-e89b-12d3-a456-426614174000'
		next()
	}),
}))

// Mock the rate limit middleware
vi.mock('../../../middleware/rate-limit.middleware.ts', () => ({
	apiRateLimiter: vi.fn((req: Request, res: Response, next: NextFunction) => {
		// Simulate successful rate limit check by default
		next()
	}),
}))

describe('userRouter', () => {
	let app: express.Express

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

	const mockUserResponse = {
		user: {
			id: mockUser.id,
			email: mockUser.email,
			emailVerified: mockUser.emailVerified,
			firstName: mockUser.firstName,
			lastName: mockUser.lastName,
			createdAt: mockUser.createdAt?.toISOString(),
			updatedAt: mockUser.updatedAt?.toISOString(),
			lastLogin: mockUser.lastLogin?.toISOString(),
		},
	}

	beforeEach(async () => {
		// Clear all mocks for test isolation
		vi.clearAllMocks()

		// Reset middleware mocks to default behavior
		const { verifyAuth } = await import(
			'../../../middleware/auth.middleware.ts'
		)
		const { apiRateLimiter } = await import(
			'../../../middleware/rate-limit.middleware.ts'
		)

		vi.mocked(verifyAuth).mockImplementation(
			async (req: Request, res: Response, next: NextFunction) => {
				req.userId = '123e4567-e89b-12d3-a456-426614174000'
				next()
				return Promise.resolve()
			},
		)

		vi.mocked(apiRateLimiter).mockImplementation(
			async (req: Request, res: Response, next: NextFunction) => {
				next()
				return Promise.resolve()
			},
		)

		app = express()
		app.use(express.json())
		const router = Router()
		userRouter(router)
		app.use(router)

		// Add error handler middleware for consistent error responses
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
			if (err instanceof UnauthorizedError) {
				res.status(StatusCodes.UNAUTHORIZED).json({ message: err.message })
			} else if (err instanceof NotFoundError) {
				res.status(StatusCodes.NOT_FOUND).json({ message: err.message })
			} else {
				res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
					message: 'Internal server error',
				})
			}
		})
	})

	describe('GET /users/me', () => {
		describe.each([
			[
				'successful user retrieval',
				StatusCodes.OK,
				mockUserResponse,
				true,
				false,
				false,
			],
			[
				'authentication failure',
				StatusCodes.UNAUTHORIZED,
				{ message: 'Authentication required' },
				false,
				true,
				false,
			],
			[
				'rate limiting',
				StatusCodes.TOO_MANY_REQUESTS,
				{
					status: StatusCodes.TOO_MANY_REQUESTS,
					message: 'API rate limit exceeded, please try again later.',
				},
				false,
				false,
				true,
			],
			[
				'user not found',
				StatusCodes.NOT_FOUND,
				{ message: 'User not found' },
				true,
				false,
				false,
			],
			[
				'internal server error',
				StatusCodes.INTERNAL_SERVER_ERROR,
				{ message: 'Internal server error' },
				true,
				false,
				false,
			],
		] as const)(
			'should handle %s',
			(scenario, expectedStatus, expectedResponse, shouldCallController, shouldFailAuth, shouldFailRateLimit) => {
				it(`should ${scenario}`, async () => {
					// Arrange
					if (shouldFailAuth) {
						const { verifyAuth } = await import(
							'../../../middleware/auth.middleware.ts'
						)
						vi.mocked(verifyAuth).mockImplementation(
							async (req: Request, res: Response, next: NextFunction) => {
								const error = new UnauthorizedError(
									'Authentication required',
									'verifyAuth middleware',
								)
								next(error)
								return Promise.resolve()
							},
						)
					}

					if (shouldFailRateLimit) {
						const { apiRateLimiter } = await import(
							'../../../middleware/rate-limit.middleware.ts'
						)
						vi.mocked(apiRateLimiter).mockImplementation(
							async (req: Request, res: Response) => {
								res.status(StatusCodes.TOO_MANY_REQUESTS).json({
									status: StatusCodes.TOO_MANY_REQUESTS,
									message: 'API rate limit exceeded, please try again later.',
								})
								return Promise.resolve()
							},
						)
					}

					if (shouldCallController) {
						vi.mocked(userController.getCurrentUser).mockImplementation(
							async (req: Request, res: Response, next: NextFunction) => {
								if (scenario === 'user not found') {
									const error = new NotFoundError('User not found', 'userController')
									next(error)
								} else if (scenario === 'internal server error') {
									const error = new Error('Unexpected error')
									next(error)
								} else {
									res.status(StatusCodes.OK).json(mockUserResponse)
								}
								return Promise.resolve()
							},
						)
					}

					// Act
					const res = await request(app).get('/users/me')

					// Assert
					expect(res.status).toBe(expectedStatus)
					expect(res.body).toEqual(expectedResponse)
					if (shouldCallController) {
						expect(userController.getCurrentUser).toHaveBeenCalledTimes(1)
					} else {
						expect(userController.getCurrentUser).not.toHaveBeenCalled()
					}
				})
			},
		)
	})

	describe('GET /users/:id', () => {
		const userId = '123e4567-e89b-12d3-a456-426614174000'

		describe.each([
			[
				'successful user retrieval by ID',
				userId,
				StatusCodes.OK,
				mockUserResponse,
				true,
				false,
				false,
			],
			[
				'authentication failure',
				userId,
				StatusCodes.UNAUTHORIZED,
				{ message: 'Authentication required' },
				false,
				true,
				false,
			],
			[
				'rate limiting',
				userId,
				StatusCodes.TOO_MANY_REQUESTS,
				{
					status: StatusCodes.TOO_MANY_REQUESTS,
					message: 'API rate limit exceeded, please try again later.',
				},
				false,
				false,
				true,
			],
			[
				'user not found',
				userId,
				StatusCodes.NOT_FOUND,
				{ message: 'User not found' },
				true,
				false,
				false,
			],
			[
				'invalid user ID format',
				'invalid-id',
				StatusCodes.OK,
				mockUserResponse,
				true,
				false,
				false,
			],
			[
				'internal server error',
				userId,
				StatusCodes.INTERNAL_SERVER_ERROR,
				{ message: 'Internal server error' },
				true,
				false,
				false,
			],
		] as const)(
			'should handle %s',
			(scenario, testUserId, expectedStatus, expectedResponse, shouldCallController, shouldFailAuth, shouldFailRateLimit) => {
				it(`should ${scenario}`, async () => {
					// Arrange
					if (shouldFailAuth) {
						const { verifyAuth } = await import(
							'../../../middleware/auth.middleware.ts'
						)
						vi.mocked(verifyAuth).mockImplementation(
							async (req: Request, res: Response, next: NextFunction) => {
								const error = new UnauthorizedError(
									'Authentication required',
									'verifyAuth middleware',
								)
								next(error)
								return Promise.resolve()
							},
						)
					}

					if (shouldFailRateLimit) {
						const { apiRateLimiter } = await import(
							'../../../middleware/rate-limit.middleware.ts'
						)
						vi.mocked(apiRateLimiter).mockImplementation(
							async (req: Request, res: Response) => {
								res.status(StatusCodes.TOO_MANY_REQUESTS).json({
									status: StatusCodes.TOO_MANY_REQUESTS,
									message: 'API rate limit exceeded, please try again later.',
								})
								return Promise.resolve()
							},
						)
					}

					if (shouldCallController) {
						vi.mocked(userController.getUserById).mockImplementation(
							async (req: Request, res: Response, next: NextFunction) => {
								if (scenario === 'user not found') {
									const error = new NotFoundError('User not found', 'userController')
									next(error)
								} else if (scenario === 'internal server error') {
									const error = new Error('Database connection failed')
									next(error)
								} else {
									res.status(StatusCodes.OK).json(mockUserResponse)
								}
								return Promise.resolve()
							},
						)
					}

					// Act
					const res = await request(app).get(`/users/${testUserId}`)

					// Assert
					expect(res.status).toBe(expectedStatus)
					expect(res.body).toEqual(expectedResponse)
					if (shouldCallController) {
						expect(userController.getUserById).toHaveBeenCalledTimes(1)
					} else {
						expect(userController.getUserById).not.toHaveBeenCalled()
					}
				})
			},
		)
	})

	describe('Route Integration', () => {
		it('should apply middleware in correct order for /users/me', async () => {
			// Arrange
			const middlewareCallOrder: string[] = []
			const { verifyAuth } = await import(
				'../../../middleware/auth.middleware.ts'
			)
			const { apiRateLimiter } = await import(
				'../../../middleware/rate-limit.middleware.ts'
			)

			vi.mocked(verifyAuth).mockImplementation(
				async (req: Request, res: Response, next: NextFunction) => {
					middlewareCallOrder.push('verifyAuth')
					req.userId = '123e4567-e89b-12d3-a456-426614174000'
					next()
					return Promise.resolve()
				},
			)

			vi.mocked(apiRateLimiter).mockImplementation(
				async (req: Request, res: Response, next: NextFunction) => {
					middlewareCallOrder.push('apiRateLimiter')
					next()
					return Promise.resolve()
				},
			)

			vi.mocked(userController.getCurrentUser).mockImplementation(
				async (req: Request, res: Response) => {
					middlewareCallOrder.push('controller')
					res.status(StatusCodes.OK).json(mockUserResponse)
					return Promise.resolve()
				},
			)

			// Act
			await request(app).get('/users/me')

			// Assert
			expect(middlewareCallOrder).toEqual([
				'verifyAuth',
				'apiRateLimiter',
				'controller',
			])
		})

		it('should apply middleware in correct order for /users/:id', async () => {
			// Arrange
			const middlewareCallOrder: string[] = []
			const { verifyAuth } = await import(
				'../../../middleware/auth.middleware.ts'
			)
			const { apiRateLimiter } = await import(
				'../../../middleware/rate-limit.middleware.ts'
			)

			vi.mocked(verifyAuth).mockImplementation(
				async (req: Request, res: Response, next: NextFunction) => {
					middlewareCallOrder.push('verifyAuth')
					req.userId = '123e4567-e89b-12d3-a456-426614174000'
					next()
					return Promise.resolve()
				},
			)

			vi.mocked(apiRateLimiter).mockImplementation(
				async (req: Request, res: Response, next: NextFunction) => {
					middlewareCallOrder.push('apiRateLimiter')
					next()
					return Promise.resolve()
				},
			)

			vi.mocked(userController.getUserById).mockImplementation(
				async (req: Request, res: Response) => {
					middlewareCallOrder.push('controller')
					res.status(StatusCodes.OK).json(mockUserResponse)
					return Promise.resolve()
				},
			)

			// Act
			await request(app).get('/users/123e4567-e89b-12d3-a456-426614174000')

			// Assert
			expect(middlewareCallOrder).toEqual([
				'verifyAuth',
				'apiRateLimiter',
				'controller',
			])
		})

		it('should stop middleware chain when verifyAuth fails', async () => {
			// Arrange
			const middlewareCallOrder: string[] = []
			const { verifyAuth } = await import(
				'../../../middleware/auth.middleware.ts'
			)
			const { apiRateLimiter } = await import(
				'../../../middleware/rate-limit.middleware.ts'
			)

			vi.mocked(verifyAuth).mockImplementation(
				async (req: Request, res: Response, next: NextFunction) => {
					middlewareCallOrder.push('verifyAuth')
					const error = new UnauthorizedError(
						'Authentication required',
						'verifyAuth middleware',
					)
					next(error)
					return Promise.resolve()
				},
			)

			vi.mocked(apiRateLimiter).mockImplementation(
				async (req: Request, res: Response, next: NextFunction) => {
					middlewareCallOrder.push('apiRateLimiter')
					next()
					return Promise.resolve()
				},
			)

			vi.mocked(userController.getCurrentUser).mockImplementation(
				async (req: Request, res: Response) => {
					middlewareCallOrder.push('controller')
					res.status(StatusCodes.OK).json(mockUserResponse)
					return Promise.resolve()
				},
			)

			// Act
			await request(app).get('/users/me')

			// Assert
			expect(middlewareCallOrder).toEqual(['verifyAuth'])
			expect(middlewareCallOrder).not.toContain('apiRateLimiter')
			expect(middlewareCallOrder).not.toContain('controller')
		})

		it('should stop middleware chain when rate limiter fails', async () => {
			// Arrange
			const middlewareCallOrder: string[] = []
			const { verifyAuth } = await import(
				'../../../middleware/auth.middleware.ts'
			)
			const { apiRateLimiter } = await import(
				'../../../middleware/rate-limit.middleware.ts'
			)

			vi.mocked(verifyAuth).mockImplementation(
				async (req: Request, res: Response, next: NextFunction) => {
					middlewareCallOrder.push('verifyAuth')
					req.userId = '123e4567-e89b-12d3-a456-426614174000'
					next()
					return Promise.resolve()
				},
			)

			vi.mocked(apiRateLimiter).mockImplementation(
				async (req: Request, res: Response) => {
					middlewareCallOrder.push('apiRateLimiter')
					res.status(StatusCodes.TOO_MANY_REQUESTS).json({
						status: StatusCodes.TOO_MANY_REQUESTS,
						message: 'API rate limit exceeded, please try again later.',
					})
					return Promise.resolve()
				},
			)

			vi.mocked(userController.getCurrentUser).mockImplementation(
				async (req: Request, res: Response) => {
					middlewareCallOrder.push('controller')
					res.status(StatusCodes.OK).json(mockUserResponse)
					return Promise.resolve()
				},
			)

			// Act
			await request(app).get('/users/me')

			// Assert
			expect(middlewareCallOrder).toEqual(['verifyAuth', 'apiRateLimiter'])
			expect(middlewareCallOrder).not.toContain('controller')
		})
	})
})
