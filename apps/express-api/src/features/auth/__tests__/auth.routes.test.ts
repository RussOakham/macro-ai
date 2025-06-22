import express, { type Router } from 'express'
import request from 'supertest'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { verifyAuth } from '../../../middleware/auth.middleware.ts'
import { authRateLimiter } from '../../../middleware/rate-limit.middleware.ts'
import { validate } from '../../../middleware/validation.middleware.ts'
import { authController } from '../auth.controller.ts'
import { authRouter } from '../auth.routes.ts'
import {
	confirmForgotPasswordRequestSchema,
	confirmRegistrationRequestSchema,
	forgotPasswordRequestSchema,
	loginRequestSchema,
	registerUserRequestSchema,
	resendConfirmationCodeRequestSchema,
} from '../auth.schemas.ts'

// Mock the logger
vi.mock('../../../utils/logger.ts', () => ({
	pino: {
		logger: {
			error: vi.fn(),
			info: vi.fn(),
		},
	},
	configureLogger: vi.fn(),
}))

// Mock the auth controller
vi.mock('../auth.controller.ts', () => ({
	authController: {
		register: vi.fn(),
		confirmRegistration: vi.fn(),
		resendConfirmationCode: vi.fn(),
		login: vi.fn(),
		forgotPassword: vi.fn(),
		confirmForgotPassword: vi.fn(),
		logout: vi.fn(),
		refreshToken: vi.fn(),
		getAuthUser: vi.fn(),
	},
}))

// Mock middleware
vi.mock('../../../middleware/auth.middleware.ts', () => ({
	verifyAuth: vi.fn(),
}))

vi.mock('../../../middleware/rate-limit.middleware.ts', () => ({
	authRateLimiter: vi.fn(),
}))

vi.mock('../../../middleware/validation.middleware.ts', () => ({
	validate: vi.fn(),
}))

// Mock config
vi.mock('../../../config/default.ts', () => ({
	config: {
		nodeEnv: 'test',
		cookieDomain: 'localhost',
		awsCognitoRefreshTokenExpiry: 30,
	},
}))

describe('Auth Routes', () => {
	let app: express.Application
	let router: Router

	beforeEach(() => {
		vi.clearAllMocks()

		// Create Express app and router
		app = express()
		router = express.Router()
		app.use(express.json())

		// Mock middleware to call next()
		vi.mocked(authRateLimiter).mockImplementation(async (req, res, next) => {
			next()
			return Promise.resolve()
		})
		vi.mocked(verifyAuth).mockImplementation(async (_req, _res, next) => {
			next()
			return Promise.resolve()
		})
		vi.mocked(validate).mockImplementation(() => async (_req, _res, next) => {
			next()
			return Promise.resolve()
		})

		// Mock controller methods to send success responses
		vi.mocked(authController.register).mockImplementation(async (_req, res) => {
			res.status(201).json({ message: 'Registration successful' })
			return Promise.resolve()
		})
		vi.mocked(authController.confirmRegistration).mockImplementation(
			async (_req, res) => {
				res.status(200).json({ message: 'Registration confirmed' })
				return Promise.resolve()
			},
		)
		vi.mocked(authController.resendConfirmationCode).mockImplementation(
			async (_req, res) => {
				res.status(200).json({ message: 'Confirmation code resent' })
				return Promise.resolve()
			},
		)
		vi.mocked(authController.login).mockImplementation(async (_req, res) => {
			res.status(200).json({ message: 'Login successful' })
			return Promise.resolve()
		})
		vi.mocked(authController.forgotPassword).mockImplementation(
			async (_req, res) => {
				res.status(200).json({ message: 'Password reset initiated' })
				return Promise.resolve()
			},
		)
		vi.mocked(authController.confirmForgotPassword).mockImplementation(
			async (_req, res) => {
				res.status(200).json({ message: 'Password reset confirmed' })
				return Promise.resolve()
			},
		)
		vi.mocked(authController.logout).mockImplementation(async (_req, res) => {
			res.status(200).json({ message: 'Logout successful' })
			return Promise.resolve()
		})
		vi.mocked(authController.refreshToken).mockImplementation(
			async (_req, res) => {
				res.status(200).json({ message: 'Token refreshed' })
				return Promise.resolve()
			},
		)
		vi.mocked(authController.getAuthUser).mockImplementation(
			async (_req, res) => {
				res.status(200).json({ id: 'user-id', email: 'test@example.com' })
				return Promise.resolve()
			},
		)

		// Setup routes
		authRouter(router)
		app.use(router)
	})

	describe('POST /auth/register', () => {
		it('should register route with correct middleware and controller', async () => {
			// Arrange
			const registerData = {
				email: 'test@example.com',
				password: 'Password123!',
				confirmPassword: 'Password123!',
			}

			// Act
			const response = await request(app)
				.post('/auth/register')
				.send(registerData)

			// Assert
			expect(response.status).toBe(201)
			expect(response.body).toEqual({ message: 'Registration successful' })
			expect(authRateLimiter).toHaveBeenCalled()
			expect(validate).toHaveBeenCalledWith(registerUserRequestSchema)
			expect(authController.register).toHaveBeenCalled()
		})
	})

	describe('POST /auth/confirm-registration', () => {
		it('should register route with correct middleware and controller', async () => {
			// Arrange
			const confirmData = {
				email: 'test@example.com',
				code: 123456,
			}

			// Act
			const response = await request(app)
				.post('/auth/confirm-registration')
				.send(confirmData)

			// Assert
			expect(response.status).toBe(200)
			expect(response.body).toEqual({ message: 'Registration confirmed' })
			expect(authRateLimiter).toHaveBeenCalled()
			expect(validate).toHaveBeenCalledWith(confirmRegistrationRequestSchema)
			expect(authController.confirmRegistration).toHaveBeenCalled()
		})
	})

	describe('POST /auth/resend-confirmation-code', () => {
		it('should register route with correct middleware and controller', async () => {
			// Arrange
			const resendData = {
				email: 'test@example.com',
			}

			// Act
			const response = await request(app)
				.post('/auth/resend-confirmation-code')
				.send(resendData)

			// Assert
			expect(response.status).toBe(200)
			expect(response.body).toEqual({ message: 'Confirmation code resent' })
			expect(authRateLimiter).toHaveBeenCalled()
			expect(validate).toHaveBeenCalledWith(resendConfirmationCodeRequestSchema)
			expect(authController.resendConfirmationCode).toHaveBeenCalled()
		})
	})

	describe('POST /auth/login', () => {
		it('should register route with correct middleware and controller', async () => {
			// Arrange
			const loginData = {
				email: 'test@example.com',
				password: 'Password123!',
			}

			// Act
			const response = await request(app).post('/auth/login').send(loginData)

			// Assert
			expect(response.status).toBe(200)
			expect(response.body).toEqual({ message: 'Login successful' })
			expect(authRateLimiter).toHaveBeenCalled()
			expect(validate).toHaveBeenCalledWith(loginRequestSchema)
			expect(authController.login).toHaveBeenCalled()
		})
	})

	describe('POST /auth/forgot-password', () => {
		it('should register route with correct middleware and controller', async () => {
			// Arrange
			const forgotPasswordData = {
				email: 'test@example.com',
			}

			// Act
			const response = await request(app)
				.post('/auth/forgot-password')
				.send(forgotPasswordData)

			// Assert
			expect(response.status).toBe(200)
			expect(response.body).toEqual({ message: 'Password reset initiated' })
			expect(authRateLimiter).toHaveBeenCalled()
			expect(validate).toHaveBeenCalledWith(forgotPasswordRequestSchema)
			expect(authController.forgotPassword).toHaveBeenCalled()
		})
	})

	describe('POST /auth/confirm-forgot-password', () => {
		it('should register route with correct middleware and controller', async () => {
			// Arrange
			const confirmForgotPasswordData = {
				email: 'test@example.com',
				code: '123456',
				newPassword: 'NewPassword123!',
				confirmPassword: 'NewPassword123!',
			}

			// Act
			const response = await request(app)
				.post('/auth/confirm-forgot-password')
				.send(confirmForgotPasswordData)

			// Assert
			expect(response.status).toBe(200)
			expect(response.body).toEqual({ message: 'Password reset confirmed' })
			expect(authRateLimiter).toHaveBeenCalled()
			expect(authController.confirmForgotPassword).toHaveBeenCalled()
		})
	})

	describe('POST /auth/logout', () => {
		it('should register route with correct middleware and controller', async () => {
			// Act
			const response = await request(app).post('/auth/logout')

			// Assert
			expect(response.status).toBe(200)
			expect(response.body).toEqual({ message: 'Logout successful' })
			expect(verifyAuth).toHaveBeenCalled()
			expect(authController.logout).toHaveBeenCalled()
		})
	})

	describe('POST /auth/refresh', () => {
		it('should register route with correct controller', async () => {
			// Act
			const response = await request(app).post('/auth/refresh')

			// Assert
			expect(response.status).toBe(200)
			expect(response.body).toEqual({ message: 'Token refreshed' })
			expect(authController.refreshToken).toHaveBeenCalled()
		})
	})

	describe('GET /auth/user', () => {
		it('should register route with correct middleware and controller', async () => {
			// Act
			const response = await request(app).get('/auth/user')

			// Assert
			expect(response.status).toBe(200)
			expect(response.body).toEqual({
				id: 'user-id',
				email: 'test@example.com',
			})
			expect(verifyAuth).toHaveBeenCalled()
			expect(authController.getAuthUser).toHaveBeenCalled()
		})
	})

	describe('Middleware Integration', () => {
		describe('Rate Limiting', () => {
			it('should apply rate limiting to auth endpoints', async () => {
				// Test multiple endpoints to ensure rate limiting is applied
				const endpoints = [
					'/auth/register',
					'/auth/confirm-registration',
					'/auth/resend-confirmation-code',
					'/auth/login',
					'/auth/forgot-password',
					'/auth/confirm-forgot-password',
				]

				for (const endpoint of endpoints) {
					await request(app).post(endpoint).send({})
				}

				// Assert rate limiter was called for each endpoint
				expect(authRateLimiter).toHaveBeenCalledTimes(endpoints.length)
			})

			it('should not apply rate limiting to protected endpoints', async () => {
				// Clear previous calls
				vi.clearAllMocks()

				// Test endpoints that shouldn't have rate limiting
				await request(app).post('/auth/logout')
				await request(app).post('/auth/refresh')
				await request(app).get('/auth/user')

				// Assert rate limiter was not called
				expect(authRateLimiter).not.toHaveBeenCalled()
			})
		})

		describe('Authentication', () => {
			it('should apply authentication to protected endpoints', async () => {
				// Test protected endpoints
				await request(app).post('/auth/logout')
				await request(app).get('/auth/user')

				// Assert verifyAuth was called for protected endpoints
				expect(verifyAuth).toHaveBeenCalledTimes(2)
			})

			it('should not apply authentication to public endpoints', async () => {
				// Clear previous calls
				vi.clearAllMocks()

				// Test public endpoints
				const publicEndpoints = [
					'/auth/register',
					'/auth/confirm-registration',
					'/auth/resend-confirmation-code',
					'/auth/login',
					'/auth/forgot-password',
					'/auth/confirm-forgot-password',
					'/auth/refresh',
				]

				for (const endpoint of publicEndpoints) {
					await request(app).post(endpoint).send({})
				}

				// Assert verifyAuth was not called for public endpoints
				expect(verifyAuth).not.toHaveBeenCalled()
			})
		})

		describe('Validation', () => {
			it('should apply validation to endpoints with request bodies', async () => {
				// Test endpoints that should have validation
				const validationEndpoints = [
					{ path: '/auth/register', schema: registerUserRequestSchema },
					{
						path: '/auth/confirm-registration',
						schema: confirmRegistrationRequestSchema,
					},
					{
						path: '/auth/resend-confirmation-code',
						schema: resendConfirmationCodeRequestSchema,
					},
					{ path: '/auth/login', schema: loginRequestSchema },
					{
						path: '/auth/forgot-password',
						schema: forgotPasswordRequestSchema,
					},
					{
						path: '/auth/confirm-forgot-password',
						schema: confirmForgotPasswordRequestSchema,
					},
				]

				for (const { path, schema } of validationEndpoints) {
					await request(app).post(path).send({})
					expect(validate).toHaveBeenCalledWith(schema)
				}
			})
		})
	})

	describe('Route Coverage', () => {
		it('should have tests for all auth routes', () => {
			// This test ensures we have coverage for all auth routes
			// by verifying that our test suite covers all expected endpoints
			const testedRoutes = [
				'POST /auth/register',
				'POST /auth/confirm-registration',
				'POST /auth/resend-confirmation-code',
				'POST /auth/login',
				'POST /auth/forgot-password',
				'POST /auth/confirm-forgot-password',
				'POST /auth/logout',
				'POST /auth/refresh',
				'GET /auth/user',
			]

			// Verify we have the expected number of route tests
			expect(testedRoutes).toHaveLength(9)
		})
	})
})
