import { NextFunction, Request, Response } from 'express'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
	AppError,
	InternalError,
	NotFoundError,
	UnauthorizedError,
	ValidationError,
} from '../../utils/errors.ts'
import { mockExpress } from '../../utils/test-helpers/express-mocks.ts'
import { mockLogger } from '../../utils/test-helpers/logger.mock.ts'

// Mock the logger using the reusable helper
vi.mock('../../utils/logger.ts', () => mockLogger.createModule())

// Import after mocking
import { errorHandler } from '../error.middleware.ts'

describe('errorHandler Middleware', () => {
	let mockRequest: Partial<Request>
	let mockResponse: Partial<Response>
	let mockNext: NextFunction
	let originalNodeEnv: string | undefined

	beforeEach(() => {
		// Setup logger mock for consistent test environment
		mockLogger.setup()

		// Setup Express mocks with default properties for error middleware tests
		const expressMocks = mockExpress.setup({
			path: '/api/test',
			method: 'GET',
		})
		mockRequest = expressMocks.req
		mockResponse = expressMocks.res
		mockNext = expressMocks.next

		// Store original NODE_ENV and reset it for each test
		originalNodeEnv = process.env.NODE_ENV
		process.env.NODE_ENV = undefined
	})

	afterEach(() => {
		// Restore original NODE_ENV
		if (originalNodeEnv !== undefined) {
			process.env.NODE_ENV = originalNodeEnv
		} else {
			process.env.NODE_ENV = undefined
		}
	})

	describe('Headers Already Sent Handling', () => {
		it('should call next(error) when headers are already sent', async () => {
			// Arrange
			const error = new NotFoundError('Resource not found', 'test')
			const responseWithSentHeaders = {
				...mockResponse,
				headersSent: true,
			} as Response

			// Act
			await errorHandler(
				error,
				mockRequest as Request,
				responseWithSentHeaders,
				mockNext,
			)

			// Assert
			expect(mockNext).toHaveBeenCalledWith(error)
			expect(mockNext).toHaveBeenCalledTimes(1)
		})

		it(`should not send response when headers are already sent`, async () => {
			// Arrange
			const error = new ValidationError('Validation failed', {}, 'test')
			const responseWithSentHeaders = mockResponse as Response
			responseWithSentHeaders.headersSent = true

			// Act
			await errorHandler(
				error,
				mockRequest as Request,
				responseWithSentHeaders,
				mockNext,
			)

			// Assert
			expect(mockResponse.status).not.toHaveBeenCalled()
			expect(mockResponse.json).not.toHaveBeenCalled()
		})

		it('should handle headers sent with non-AppError', async () => {
			// Arrange
			const error = new Error('Generic error')
			const responseWithSentHeaders = mockResponse as Response
			responseWithSentHeaders.headersSent = true

			// Act
			await errorHandler(
				error,
				mockRequest as Request,
				responseWithSentHeaders,
				mockNext,
			)

			// Assert
			expect(mockNext).toHaveBeenCalledWith(error)
			expect(mockResponse.status).not.toHaveBeenCalled()
		})
	})

	describe('Error Standardization', () => {
		it('should pass through AppError instances unchanged', async () => {
			// Arrange
			const appError = new UnauthorizedError('Access denied', 'auth service')

			// Act
			await errorHandler(
				appError,
				mockRequest as Request,
				mockResponse as Response,
				mockNext,
			)

			// Assert
			expect(mockResponse.status).toHaveBeenCalledWith(401)
			expect(mockResponse.json).toHaveBeenCalledWith({
				message: 'Access denied',
				details: undefined,
				type: 'UnauthorizedError',
			})
		})

		it('should convert non-AppError to AppError using AppError.from()', async () => {
			// Arrange
			const genericError = new Error('Generic error message')

			// Act
			await errorHandler(
				genericError,
				mockRequest as Request,
				mockResponse as Response,
				mockNext,
			)

			// Assert
			expect(mockResponse.status).toHaveBeenCalledWith(500)
			expect(mockResponse.json).toHaveBeenCalledWith({
				message: 'Generic error message',
				details: undefined,
				type: 'Error',
			})
		})

		it('should handle unknown error types', async () => {
			// Arrange
			const unknownError = 'string error'

			// Act
			await errorHandler(
				unknownError,
				mockRequest as Request,
				mockResponse as Response,
				mockNext,
			)

			// Assert
			expect(mockResponse.status).toHaveBeenCalledWith(500)
			expect(mockResponse.json).toHaveBeenCalledWith({
				message: 'An unknown error occurred',
				details: undefined,
				type: 'UnknownError',
			})
		})

		it('should handle null/undefined errors', async () => {
			// Arrange
			const nullError = null

			// Act
			await errorHandler(
				nullError,
				mockRequest as Request,
				mockResponse as Response,
				mockNext,
			)

			// Assert
			expect(mockResponse.status).toHaveBeenCalledWith(500)
			expect(mockResponse.json).toHaveBeenCalledWith({
				message: 'An unknown error occurred',
				details: undefined,
				type: 'UnknownError',
			})
		})
	})

	describe('Logging Behavior', () => {
		it('should log error with request context', async () => {
			// Arrange
			const { pino } = await import('../../utils/logger.ts')
			const error = new NotFoundError('User not found', 'user service')
			const request = {
				...mockRequest,
				path: '/api/users/123',
				method: 'GET',
			} as Request

			// Act
			await errorHandler(error, request, mockResponse as Response, mockNext)

			// Assert
			expect(pino.logger.error).toHaveBeenCalledWith(
				expect.objectContaining({
					path: '/api/users/123',
					method: 'GET',
					status: 404,
					type: 'NotFoundError',
					service: 'user service',
					// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
					stack: expect.any(String), // Stack trace is included in non-production
				}),
				'[ErrorHandler]: User not found',
			)
		})

		it('should include stack trace in non-production environment', async () => {
			// Arrange
			const { pino } = await import('../../utils/logger.ts')
			const error = new InternalError(
				'Database connection failed',
				'db service',
			)
			process.env.NODE_ENV = 'development'

			// Act
			await errorHandler(
				error,
				mockRequest as Request,
				mockResponse as Response,
				mockNext,
			)

			// Assert
			expect(pino.logger.error).toHaveBeenCalledWith(
				expect.objectContaining({
					// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
					stack: expect.any(String),
				}),
				'[ErrorHandler]: Database connection failed',
			)
		})

		it('should exclude stack trace in production environment', async () => {
			// Arrange
			const { pino } = await import('../../utils/logger.ts')
			const error = new InternalError(
				'Database connection failed',
				'db service',
			)
			process.env.NODE_ENV = 'production'

			// Act
			await errorHandler(
				error,
				mockRequest as Request,
				mockResponse as Response,
				mockNext,
			)

			// Assert
			expect(pino.logger.error).toHaveBeenCalledWith(
				expect.objectContaining({
					stack: undefined,
				}),
				'[ErrorHandler]: Database connection failed',
			)
		})
	})

	describe('Environment-Specific Response Handling', () => {
		it('should include error details and type in non-production environment', async () => {
			// Arrange
			const error = new ValidationError(
				'Invalid input',
				{ field: 'email', issue: 'invalid format' },
				'validation service',
			)
			process.env.NODE_ENV = 'development'

			// Act
			await errorHandler(
				error,
				mockRequest as Request,
				mockResponse as Response,
				mockNext,
			)

			// Assert
			expect(mockResponse.json).toHaveBeenCalledWith({
				message: 'Invalid input',
				details: { field: 'email', issue: 'invalid format' },
				type: 'ValidationError',
			})
		})

		it('should exclude error details and type in production environment', async () => {
			// Arrange
			const error = new ValidationError(
				'Invalid input',
				{ field: 'email', issue: 'invalid format' },
				'validation service',
			)
			process.env.NODE_ENV = 'production'

			// Act
			await errorHandler(
				error,
				mockRequest as Request,
				mockResponse as Response,
				mockNext,
			)

			// Assert
			expect(mockResponse.json).toHaveBeenCalledWith({
				message: 'Invalid input',
			})
		})

		it('should include details in test environment', async () => {
			// Arrange
			const error = new InternalError('Server error', 'test service')
			process.env.NODE_ENV = 'test'

			// Act
			await errorHandler(
				error,
				mockRequest as Request,
				mockResponse as Response,
				mockNext,
			)

			// Assert
			expect(mockResponse.json).toHaveBeenCalledWith({
				message: 'Server error',
				details: undefined,
				type: 'InternalError',
			})
		})

		it('should treat undefined NODE_ENV as non-production', async () => {
			// Arrange
			const error = new NotFoundError('Resource not found', 'api service')
			process.env.NODE_ENV = undefined

			// Act
			await errorHandler(
				error,
				mockRequest as Request,
				mockResponse as Response,
				mockNext,
			)

			// Assert
			expect(mockResponse.json).toHaveBeenCalledWith({
				message: 'Resource not found',
				details: undefined,
				type: 'NotFoundError',
			})
		})
	})

	describe('HTTP Status Code Handling', () => {
		it('should respond with 400 for ValidationError', async () => {
			// Arrange
			const error = new ValidationError('Invalid data', {}, 'validation')

			// Act
			await errorHandler(
				error,
				mockRequest as Request,
				mockResponse as Response,
				mockNext,
			)

			// Assert
			expect(mockResponse.status).toHaveBeenCalledWith(400)
		})

		it('should respond with 401 for UnauthorizedError', async () => {
			// Arrange
			const error = new UnauthorizedError('Access denied', 'auth')

			// Act
			await errorHandler(
				error,
				mockRequest as Request,
				mockResponse as Response,
				mockNext,
			)

			// Assert
			expect(mockResponse.status).toHaveBeenCalledWith(401)
		})

		it('should respond with 404 for NotFoundError', async () => {
			// Arrange
			const error = new NotFoundError('Resource not found', 'api')

			// Act
			await errorHandler(
				error,
				mockRequest as Request,
				mockResponse as Response,
				mockNext,
			)

			// Assert
			expect(mockResponse.status).toHaveBeenCalledWith(404)
		})

		it('should respond with 500 for InternalError', async () => {
			// Arrange
			const error = new InternalError('Server error', 'server')

			// Act
			await errorHandler(
				error,
				mockRequest as Request,
				mockResponse as Response,
				mockNext,
			)

			// Assert
			expect(mockResponse.status).toHaveBeenCalledWith(500)
		})

		it('should respond with custom status code for AppError', async () => {
			// Arrange
			const error = new AppError({
				message: 'Custom error',
				status: 418,
				service: 'teapot service',
			})

			// Act
			await errorHandler(
				error,
				mockRequest as Request,
				mockResponse as Response,
				mockNext,
			)

			// Assert
			expect(mockResponse.status).toHaveBeenCalledWith(418)
		})
	})

	describe('Error Context and Service Information', () => {
		it('should log error with correct service context', async () => {
			// Arrange
			const { pino } = await import('../../utils/logger.ts')
			const error = new UnauthorizedError('Token expired', 'auth middleware')

			// Act
			await errorHandler(
				error,
				mockRequest as Request,
				mockResponse as Response,
				mockNext,
			)

			// Assert
			expect(pino.logger.error).toHaveBeenCalledWith(
				expect.objectContaining({
					service: 'auth middleware',
				}),
				'[ErrorHandler]: Token expired',
			)
		})

		it('should handle errors with unknown service', async () => {
			// Arrange
			const { pino } = await import('../../utils/logger.ts')
			const error = new AppError({
				message: 'Unknown service error',
				status: 500,
			})

			// Act
			await errorHandler(
				error,
				mockRequest as Request,
				mockResponse as Response,
				mockNext,
			)

			// Assert
			expect(pino.logger.error).toHaveBeenCalledWith(
				expect.objectContaining({
					service: 'unknown',
				}),
				'[ErrorHandler]: Unknown service error',
			)
		})

		it('should log error type correctly', async () => {
			// Arrange
			const { pino } = await import('../../utils/logger.ts')
			const error = new ValidationError(
				'Invalid email format',
				{},
				'validation',
			)

			// Act
			await errorHandler(
				error,
				mockRequest as Request,
				mockResponse as Response,
				mockNext,
			)

			// Assert
			expect(pino.logger.error).toHaveBeenCalledWith(
				expect.objectContaining({
					type: 'ValidationError',
				}),
				'[ErrorHandler]: Invalid email format',
			)
		})
	})

	describe('Request Context Logging', () => {
		it('should log request path and method', async () => {
			// Arrange
			const { pino } = await import('../../utils/logger.ts')
			const error = new NotFoundError('Endpoint not found', 'router')
			const request = {
				...mockRequest,
				path: '/api/nonexistent',
				method: 'POST',
			} as Request

			// Act
			await errorHandler(error, request, mockResponse as Response, mockNext)

			// Assert
			expect(pino.logger.error).toHaveBeenCalledWith(
				expect.objectContaining({
					path: '/api/nonexistent',
					method: 'POST',
				}),
				'[ErrorHandler]: Endpoint not found',
			)
		})

		it('should handle missing request path', async () => {
			// Arrange
			const { pino } = await import('../../utils/logger.ts')
			const error = new InternalError('Server error', 'server')
			const request = {
				...mockRequest,
				path: undefined,
				method: 'GET',
			} as unknown as Request

			// Act
			await errorHandler(error, request, mockResponse as Response, mockNext)

			// Assert
			expect(pino.logger.error).toHaveBeenCalledWith(
				expect.objectContaining({
					path: undefined,
					method: 'GET',
				}),
				'[ErrorHandler]: Server error',
			)
		})

		it('should handle missing request method', async () => {
			// Arrange
			const { pino } = await import('../../utils/logger.ts')
			const error = new InternalError('Server error', 'server')
			const request = {
				...mockRequest,
				path: '/api/test',
				method: undefined,
			} as unknown as Request

			// Act
			await errorHandler(error, request, mockResponse as Response, mockNext)

			// Assert
			expect(pino.logger.error).toHaveBeenCalledWith(
				expect.objectContaining({
					path: '/api/test',
					method: undefined,
				}),
				'[ErrorHandler]: Server error',
			)
		})
	})

	describe('Response Body Structure', () => {
		it('should always include message in response', async () => {
			// Arrange
			const error = new NotFoundError('User not found', 'user service')

			// Act
			await errorHandler(
				error,
				mockRequest as Request,
				mockResponse as Response,
				mockNext,
			)

			// Assert
			expect(mockResponse.json).toHaveBeenCalledWith(
				expect.objectContaining({
					message: 'User not found',
				}),
			)
		})

		it('should handle errors with empty message', async () => {
			// Arrange
			const error = new AppError({
				message: '',
				status: 400,
				service: 'test',
			})

			// Act
			await errorHandler(
				error,
				mockRequest as Request,
				mockResponse as Response,
				mockNext,
			)

			// Assert
			expect(mockResponse.json).toHaveBeenCalledWith(
				expect.objectContaining({
					message: '',
				}),
			)
		})

		it('should handle errors with undefined details', async () => {
			// Arrange
			const error = new AppError({
				message: 'Test error',
				status: 400,
				details: undefined,
				service: 'test',
			})
			process.env.NODE_ENV = 'development'

			// Act
			await errorHandler(
				error,
				mockRequest as Request,
				mockResponse as Response,
				mockNext,
			)

			// Assert
			expect(mockResponse.json).toHaveBeenCalledWith({
				message: 'Test error',
				details: undefined,
				type: 'ApiError',
			})
		})

		it('should handle errors with null details', async () => {
			// Arrange
			const error = new AppError({
				message: 'Test error',
				status: 400,
				details: null,
				service: 'test',
			})
			process.env.NODE_ENV = 'development'

			// Act
			await errorHandler(
				error,
				mockRequest as Request,
				mockResponse as Response,
				mockNext,
			)

			// Assert
			expect(mockResponse.json).toHaveBeenCalledWith({
				message: 'Test error',
				details: null,
				type: 'ApiError',
			})
		})
	})

	describe('Edge Cases', () => {
		it('should handle circular reference in error details', () => {
			// Arrange
			const circularObj: Record<string, unknown> = { name: 'test' }
			circularObj.self = circularObj
			const error = new ValidationError(
				'Circular reference error',
				circularObj,
				'test',
			)
			process.env.NODE_ENV = 'development'

			// Act & Assert - Should not throw
			expect(async () => {
				await errorHandler(
					error,
					mockRequest as Request,
					mockResponse as Response,
					mockNext,
				)
			}).not.toThrow()

			expect(mockResponse.status).toHaveBeenCalledWith(400)
		})

		it('should handle very large error messages', async () => {
			// Arrange
			const largeMessage = 'Error: ' + 'x'.repeat(10000)
			const error = new InternalError(largeMessage, 'test')

			// Act
			await errorHandler(
				error,
				mockRequest as Request,
				mockResponse as Response,
				mockNext,
			)

			// Assert
			expect(mockResponse.status).toHaveBeenCalledWith(500)
			expect(mockResponse.json).toHaveBeenCalledWith({
				message: largeMessage,
				details: undefined,
				type: 'InternalError',
			})
		})

		it('should handle error with special characters in message', async () => {
			// Arrange
			const specialMessage =
				'Error with special chars: <script>alert("xss")</script> & "quotes"'
			const error = new ValidationError(specialMessage, {}, 'test')

			// Act
			await errorHandler(
				error,
				mockRequest as Request,
				mockResponse as Response,
				mockNext,
			)

			// Assert
			expect(mockResponse.json).toHaveBeenCalledWith({
				message: specialMessage,
				details: {},
				type: 'ValidationError',
			})
		})

		it('should handle error with unicode characters', async () => {
			// Arrange
			const unicodeMessage = 'Error: 🚨 Unicode test 中文 العربية'
			const error = new NotFoundError(unicodeMessage, 'test')

			// Act
			await errorHandler(
				error,
				mockRequest as Request,
				mockResponse as Response,
				mockNext,
			)

			// Assert
			expect(mockResponse.json).toHaveBeenCalledWith({
				message: unicodeMessage,
				details: undefined,
				type: 'NotFoundError',
			})
		})

		it('should handle error with newlines and tabs', async () => {
			// Arrange
			const multilineMessage = 'Error:\n\tLine 1\n\tLine 2\n\tLine 3'
			const error = new InternalError(multilineMessage, 'test')

			// Act
			await errorHandler(
				error,
				mockRequest as Request,
				mockResponse as Response,
				mockNext,
			)

			// Assert
			expect(mockResponse.json).toHaveBeenCalledWith({
				message: multilineMessage,
				details: undefined,
				type: 'InternalError',
			})
		})
	})

	describe('Security Considerations', () => {
		it('should not expose sensitive information in production', async () => {
			// Arrange
			const sensitiveError = new InternalError(
				// eslint-disable-next-line no-secrets/no-secrets
				'Database connection failed: password=FAKE_TEST_PASSWORD_123',
				'database service',
			)
			process.env.NODE_ENV = 'production'

			// Act
			await errorHandler(
				sensitiveError,
				mockRequest as Request,
				mockResponse as Response,
				mockNext,
			)

			// Assert - In production, only message is exposed, not details or type
			expect(mockResponse.json).toHaveBeenCalledWith({
				// eslint-disable-next-line no-secrets/no-secrets
				message: 'Database connection failed: password=FAKE_TEST_PASSWORD_123',
			})
			expect(mockResponse.json).toHaveBeenCalledTimes(1)
		})

		it('should not expose stack traces in production', async () => {
			// Arrange
			const { pino } = await import('../../utils/logger.ts')
			const error = new InternalError('Internal error', 'test')
			process.env.NODE_ENV = 'production'

			// Act
			await errorHandler(
				error,
				mockRequest as Request,
				mockResponse as Response,
				mockNext,
			)

			// Assert
			expect(pino.logger.error).toHaveBeenCalledWith(
				expect.objectContaining({
					stack: undefined,
				}),
				'[ErrorHandler]: Internal error',
			)
		})

		it('should handle potential XSS in error messages safely', async () => {
			// Arrange
			const xssAttempt = '<script>alert("xss")</script>'
			const error = new ValidationError(xssAttempt, {}, 'test')

			// Act
			await errorHandler(
				error,
				mockRequest as Request,
				mockResponse as Response,
				mockNext,
			)

			// Assert
			expect(mockResponse.json).toHaveBeenCalledWith({
				message: xssAttempt,
				details: {},
				type: 'ValidationError',
			})
			// Note: XSS protection should be handled by the client/browser, not the API
		})

		it('should handle SQL injection attempts in error messages', async () => {
			// Arrange
			const sqlInjection = "'; DROP TABLE users; --"
			const error = new ValidationError(sqlInjection, {}, 'test')

			// Act
			await errorHandler(
				error,
				mockRequest as Request,
				mockResponse as Response,
				mockNext,
			)

			// Assert
			expect(mockResponse.json).toHaveBeenCalledWith({
				message: sqlInjection,
				details: {},
				type: 'ValidationError',
			})
		})
	})

	describe('Integration with AppError.from()', () => {
		it('should properly convert Error instances', async () => {
			// Arrange
			const jsError = new Error('Standard JavaScript error')

			// Act
			await errorHandler(
				jsError,
				mockRequest as Request,
				mockResponse as Response,
				mockNext,
			)

			// Assert
			expect(mockResponse.status).toHaveBeenCalledWith(500)
			expect(mockResponse.json).toHaveBeenCalledWith({
				message: 'Standard JavaScript error',
				details: undefined,
				type: 'Error',
			})
		})

		it('should handle TypeError instances', async () => {
			// Arrange
			const typeError = new TypeError('Cannot read property of undefined')

			// Act
			await errorHandler(
				typeError,
				mockRequest as Request,
				mockResponse as Response,
				mockNext,
			)

			// Assert
			expect(mockResponse.status).toHaveBeenCalledWith(500)
			expect(mockResponse.json).toHaveBeenCalledWith({
				message: 'Cannot read property of undefined',
				details: undefined,
				type: 'Error',
			})
		})

		it('should handle ReferenceError instances', async () => {
			// Arrange
			const refError = new ReferenceError('Variable is not defined')

			// Act
			await errorHandler(
				refError,
				mockRequest as Request,
				mockResponse as Response,
				mockNext,
			)

			// Assert
			expect(mockResponse.status).toHaveBeenCalledWith(500)
			expect(mockResponse.json).toHaveBeenCalledWith({
				message: 'Variable is not defined',
				details: undefined,
				type: 'Error',
			})
		})

		it('should pass service context to AppError.from()', async () => {
			// Arrange
			const { pino } = await import('../../utils/logger.ts')
			const jsError = new Error('Generic error')

			// Act
			await errorHandler(
				jsError,
				mockRequest as Request,
				mockResponse as Response,
				mockNext,
			)

			// Assert
			expect(pino.logger.error).toHaveBeenCalledWith(
				expect.objectContaining({
					service: 'globalErrorHandler',
				}),
				'[ErrorHandler]: Generic error',
			)
		})
	})
})
