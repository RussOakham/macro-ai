import { NextFunction, Request, Response } from 'express'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'

import { mockExpress } from '../../utils/test-helpers/express-mocks.ts'
import { mockLogger } from '../../utils/test-helpers/logger.mock.ts'

// Mock external dependencies
vi.mock('../../utils/logger.ts', () => mockLogger.createModule())
vi.mock('../../utils/error-handling/try-catch.ts', () => ({
	tryCatch: vi.fn(),
}))

describe('Validation Middleware', () => {
	let mockRequest: Partial<Request>
	let mockResponse: Partial<Response>
	let mockNext: NextFunction
	let mockTryCatch: ReturnType<typeof vi.fn>

	beforeEach(async () => {
		vi.clearAllMocks()
		vi.resetModules()

		// Setup Express mocks
		const expressMocks = mockExpress.setup()
		mockResponse = expressMocks.res
		mockNext = expressMocks.next

		// Get the mocked tryCatch function
		mockTryCatch = vi.mocked(
			(await import('../../utils/error-handling/try-catch.ts')).tryCatch,
		)
	})

	describe('Middleware Exports', () => {
		it('should export validate function', async () => {
			const middleware = await import('../validation.middleware.ts')

			expect(middleware.validate).toBeDefined()
			expect(typeof middleware.validate).toBe('function')
		})

		it('should export ValidationTarget and ValidSchema types', async () => {
			const middleware = await import('../validation.middleware.ts')

			// Types are exported but not available at runtime
			expect(middleware).toBeDefined()
		})
	})

	describe('Successful Validation', () => {
		it('should validate request body successfully with valid data', async () => {
			// Arrange
			const testSchema = z.object({
				email: z.email(),
				name: z.string().min(1),
			})

			const validData = {
				email: 'test@example.com',
				name: 'John Doe',
			}

			mockRequest = mockExpress.createRequest({
				body: { email: 'original@example.com', name: 'Original' },
				path: '/api/test',
			})

			// Mock the schema's parseAsync method to prevent actual validation
			const mockParseAsync = vi.fn().mockResolvedValue(validData)
			vi.spyOn(testSchema, 'parseAsync').mockImplementation(mockParseAsync)

			// Mock successful tryCatch result
			mockTryCatch.mockResolvedValue([validData, null])

			const middleware = await import('../validation.middleware.ts')
			const validator = middleware.validate(testSchema, 'body')

			// Act
			await validator(
				mockRequest as Request,
				mockResponse as Response,
				mockNext,
			)

			// Assert
			expect(mockTryCatch).toHaveBeenCalledWith(
				expect.any(Function),
				'validation middleware - body',
			)
			expect(mockRequest.body).toEqual(validData)
			expect(mockNext).toHaveBeenCalledWith()
			expect(mockNext).toHaveBeenCalledTimes(1)
		})

		it('should validate request params successfully', async () => {
			// Arrange
			const testSchema = z.object({
				id: z.uuid(),
			})

			const validParams = {
				id: '123e4567-e89b-12d3-a456-426614174000',
			}

			mockRequest = mockExpress.createRequest({
				params: { id: 'original-id' },
				path: '/api/users/123e4567-e89b-12d3-a456-426614174000',
			})

			// Mock the schema's parseAsync method
			const mockParseAsync = vi.fn().mockResolvedValue(validParams)
			vi.spyOn(testSchema, 'parseAsync').mockImplementation(mockParseAsync)

			// Mock successful tryCatch result
			mockTryCatch.mockResolvedValue([validParams, null])

			const middleware = await import('../validation.middleware.ts')
			const validator = middleware.validate(testSchema, 'params')

			// Act
			await validator(
				mockRequest as Request,
				mockResponse as Response,
				mockNext,
			)

			// Assert
			expect(mockTryCatch).toHaveBeenCalledWith(
				expect.any(Function),
				'validation middleware - params',
			)
			expect(mockRequest.params).toEqual(validParams)
			expect(mockNext).toHaveBeenCalledWith()
		})

		it('should validate request query successfully', async () => {
			// Arrange
			const testSchema = z.object({
				page: z.string().transform(Number),
				limit: z.string().transform(Number),
			})

			const transformedQuery = {
				page: 1,
				limit: 10,
			}

			mockRequest = mockExpress.createRequest({
				query: { page: '1', limit: '10' },
				path: '/api/users',
			})

			// Mock the schema's parseAsync method
			const mockParseAsync = vi.fn().mockResolvedValue(transformedQuery)
			vi.spyOn(testSchema, 'parseAsync').mockImplementation(mockParseAsync)

			// Mock successful tryCatch result
			mockTryCatch.mockResolvedValue([transformedQuery, null])

			const middleware = await import('../validation.middleware.ts')
			const validator = middleware.validate(testSchema, 'query')

			// Act
			await validator(
				mockRequest as Request,
				mockResponse as Response,
				mockNext,
			)

			// Assert
			expect(mockTryCatch).toHaveBeenCalledWith(
				expect.any(Function),
				'validation middleware - query',
			)
			expect(mockRequest.query).toEqual(transformedQuery)
			expect(mockNext).toHaveBeenCalledWith()
		})

		it('should default to body validation when no target specified', async () => {
			// Arrange
			const testSchema = z.object({
				message: z.string(),
			})

			const validData = { message: 'Hello World' }

			mockRequest = mockExpress.createRequest({
				body: { message: 'original' },
				path: '/api/test',
			})

			// Mock the schema's parseAsync method
			const mockParseAsync = vi.fn().mockResolvedValue(validData)
			vi.spyOn(testSchema, 'parseAsync').mockImplementation(mockParseAsync)

			// Mock successful tryCatch result
			mockTryCatch.mockResolvedValue([validData, null])

			const middleware = await import('../validation.middleware.ts')
			const validator = middleware.validate(testSchema) // No target specified

			// Act
			await validator(
				mockRequest as Request,
				mockResponse as Response,
				mockNext,
			)

			// Assert
			expect(mockTryCatch).toHaveBeenCalledWith(
				expect.any(Function),
				'validation middleware - body',
			)
			expect(mockRequest.body).toEqual(validData)
			expect(mockNext).toHaveBeenCalledWith()
		})
	})

	describe('ZodError Handling', () => {
		it('should handle ZodError and call next with ValidationError', async () => {
			// Arrange
			const testSchema = z.object({
				email: z.email(),
				name: z.string().min(1),
			})

			mockRequest = mockExpress.createRequest({
				body: { email: 'invalid-email', name: '' },
				path: '/api/test',
			})

			// Mock the schema's parseAsync method to prevent actual validation
			const mockParseAsync = vi
				.fn()
				.mockRejectedValue(new Error('Mocked validation'))
			vi.spyOn(testSchema, 'parseAsync').mockImplementation(mockParseAsync)

			// Mock ZodError from tryCatch
			const { ErrorType } = await import('../../utils/errors.ts')
			const mockZodError = {
				type: ErrorType.ZodError,
				message: 'Validation failed',
				details: [
					{ message: 'Invalid email', path: ['email'] },
					{ message: 'Name is required', path: ['name'] },
				],
				status: 400,
				service: 'validation middleware - body',
			}
			mockTryCatch.mockResolvedValue([null, mockZodError])

			const middleware = await import('../validation.middleware.ts')
			const { ValidationError } = await import('../../utils/errors.ts')
			const validator = middleware.validate(testSchema, 'body')

			// Act
			await validator(
				mockRequest as Request,
				mockResponse as Response,
				mockNext,
			)

			// Assert
			expect(mockTryCatch).toHaveBeenCalledWith(
				expect.any(Function),
				'validation middleware - body',
			)
			expect(mockNext).toHaveBeenCalledTimes(1)
			const calledError = vi.mocked(mockNext).mock.calls[0]?.[0]
			expect(calledError).toBeInstanceOf(ValidationError)
			expect(calledError).toHaveProperty('message', 'Validation Failed')
			expect(calledError).toHaveProperty('details', mockZodError.details)
			expect(calledError).toHaveProperty('service', 'validation middleware')
		})

		it('should log warning for ZodError validation failures', async () => {
			// Arrange
			const testSchema = z.object({
				email: z.email(),
			})

			mockRequest = mockExpress.createRequest({
				body: { email: 'invalid' },
				path: '/api/test',
			})

			// Mock the schema's parseAsync method to prevent actual validation
			const mockParseAsync = vi
				.fn()
				.mockRejectedValue(new Error('Mocked validation'))
			vi.spyOn(testSchema, 'parseAsync').mockImplementation(mockParseAsync)

			// Mock ZodError from tryCatch
			const { ErrorType } = await import('../../utils/errors.ts')
			const mockZodError = {
				type: ErrorType.ZodError,
				message: 'Invalid email format',
				details: [{ message: 'Invalid email', path: ['email'] }],
				status: 400,
				service: 'validation middleware - body',
			}
			mockTryCatch.mockResolvedValue([null, mockZodError])

			const middleware = await import('../validation.middleware.ts')
			const validator = middleware.validate(testSchema, 'body')

			// Act
			await validator(
				mockRequest as Request,
				mockResponse as Response,
				mockNext,
			)

			// Assert
			const { pino } = await import('../../utils/logger.ts')
			expect(pino.logger.warn).toHaveBeenCalledWith({
				msg: '[middleware - validateRequest]: Validation error',
				path: '/api/test',
				error: 'Invalid email format',
			})
		})

		it('should handle ZodError for different validation targets', async () => {
			// Arrange
			const testSchema = z.object({
				id: z.uuid(),
			})

			mockRequest = mockExpress.createRequest({
				params: { id: 'invalid-uuid' },
				path: '/api/users/invalid-uuid',
			})

			// Mock the schema's parseAsync method to prevent actual validation
			const mockParseAsync = vi
				.fn()
				.mockRejectedValue(new Error('Mocked validation'))
			vi.spyOn(testSchema, 'parseAsync').mockImplementation(mockParseAsync)

			// Mock ZodError from tryCatch
			const { ErrorType } = await import('../../utils/errors.ts')
			const mockZodError = {
				type: ErrorType.ZodError,
				message: 'Invalid UUID format',
				details: [{ message: 'Invalid UUID', path: ['id'] }],
				status: 400,
				service: 'validation middleware - params',
			}
			mockTryCatch.mockResolvedValue([null, mockZodError])

			const middleware = await import('../validation.middleware.ts')
			const { ValidationError } = await import('../../utils/errors.ts')
			const validator = middleware.validate(testSchema, 'params')

			// Act
			await validator(
				mockRequest as Request,
				mockResponse as Response,
				mockNext,
			)

			// Assert
			expect(mockTryCatch).toHaveBeenCalledWith(
				expect.any(Function),
				'validation middleware - params',
			)
			const calledError = vi.mocked(mockNext).mock.calls[0]?.[0]
			expect(calledError).toBeInstanceOf(ValidationError)
		})
	})

	describe('Non-ZodError Handling', () => {
		it('should pass through non-ZodError from tryCatch', async () => {
			// Arrange
			const testSchema = z.object({
				data: z.string(),
			})

			mockRequest = mockExpress.createRequest({
				body: { data: 'test' },
				path: '/api/test',
			})

			// Mock non-ZodError from tryCatch (e.g., InternalError)
			const { ErrorType } = await import('../../utils/errors.ts')
			const mockInternalError = {
				type: ErrorType.InternalError,
				message: 'Database connection failed',
				status: 500,
				service: 'validation middleware - body',
			}
			mockTryCatch.mockResolvedValue([null, mockInternalError])

			const middleware = await import('../validation.middleware.ts')
			const validator = middleware.validate(testSchema, 'body')

			// Act
			await validator(
				mockRequest as Request,
				mockResponse as Response,
				mockNext,
			)

			// Assert
			expect(mockNext).toHaveBeenCalledWith(mockInternalError)
			expect(mockNext).toHaveBeenCalledTimes(1)
		})

		it('should handle undefined errors gracefully (treats as success)', async () => {
			// Arrange
			const testSchema = z.object({
				data: z.string(),
			})

			const validData = { data: 'test' }

			mockRequest = mockExpress.createRequest({
				body: { data: 'original' },
				path: '/api/test',
			})

			// Mock the schema's parseAsync method
			const mockParseAsync = vi.fn().mockResolvedValue(validData)
			vi.spyOn(testSchema, 'parseAsync').mockImplementation(mockParseAsync)

			// Mock undefined error from tryCatch (falsy, so treated as success)
			mockTryCatch.mockResolvedValue([validData, undefined])

			const middleware = await import('../validation.middleware.ts')
			const validator = middleware.validate(testSchema, 'body')

			// Act
			await validator(
				mockRequest as Request,
				mockResponse as Response,
				mockNext,
			)

			// Assert - undefined is falsy, so middleware treats it as success
			expect(mockRequest.body).toEqual(validData)
			expect(mockNext).toHaveBeenCalledWith()
			expect(mockNext).toHaveBeenCalledTimes(1)
		})

		it('should handle null errors gracefully (treats as success)', async () => {
			// Arrange
			const testSchema = z.object({
				data: z.string(),
			})

			const validData = { data: 'test' }

			mockRequest = mockExpress.createRequest({
				body: { data: 'original' },
				path: '/api/test',
			})

			// Mock the schema's parseAsync method
			const mockParseAsync = vi.fn().mockResolvedValue(validData)
			vi.spyOn(testSchema, 'parseAsync').mockImplementation(mockParseAsync)

			// Mock null error from tryCatch (falsy, so treated as success)
			mockTryCatch.mockResolvedValue([validData, null])

			const middleware = await import('../validation.middleware.ts')
			const validator = middleware.validate(testSchema, 'body')

			// Act
			await validator(
				mockRequest as Request,
				mockResponse as Response,
				mockNext,
			)

			// Assert - null is falsy, so middleware treats it as success
			expect(mockRequest.body).toEqual(validData)
			expect(mockNext).toHaveBeenCalledWith()
			expect(mockNext).toHaveBeenCalledTimes(1)
		})

		it('should handle falsy errors by calling next without arguments', async () => {
			// Arrange
			const testSchema = z.object({
				data: z.string(),
			})

			mockRequest = mockExpress.createRequest({
				body: { data: 'test' },
				path: '/api/test',
			})

			// Mock falsy error from tryCatch (this represents no error)
			mockTryCatch.mockResolvedValue([{ data: 'test' }, null])

			const middleware = await import('../validation.middleware.ts')
			const validator = middleware.validate(testSchema, 'body')

			// Act
			await validator(
				mockRequest as Request,
				mockResponse as Response,
				mockNext,
			)

			// Assert
			expect(mockNext).toHaveBeenCalledWith()
			expect(mockNext).toHaveBeenCalledTimes(1)
		})
	})

	describe('Complex Schema Validation', () => {
		it('should handle ZodEffects schemas successfully', async () => {
			// Arrange
			const testSchema = z
				.object({
					password: z.string(),
					confirmPassword: z.string(),
				})
				.refine((data) => data.password === data.confirmPassword, {
					message: 'Passwords do not match',
					path: ['confirmPassword'],
				})

			const validData = {
				password: 'password123',
				confirmPassword: 'password123',
			}

			mockRequest = mockExpress.createRequest({
				body: { password: 'original', confirmPassword: 'original' },
				path: '/api/auth/register',
			})

			// Mock the schema's parseAsync method to prevent actual validation
			const mockParseAsync = vi.fn().mockResolvedValue(validData)
			vi.spyOn(testSchema, 'parseAsync').mockImplementation(mockParseAsync)

			// Mock successful tryCatch result
			mockTryCatch.mockResolvedValue([validData, null])

			const middleware = await import('../validation.middleware.ts')
			const validator = middleware.validate(testSchema, 'body')

			// Act
			await validator(
				mockRequest as Request,
				mockResponse as Response,
				mockNext,
			)

			// Assert
			expect(mockRequest.body).toEqual(validData)
			expect(mockNext).toHaveBeenCalledWith()
		})

		it('should handle ZodEffects validation failures', async () => {
			// Arrange
			const testSchema = z
				.object({
					password: z.string(),
					confirmPassword: z.string(),
				})
				.refine((data) => data.password === data.confirmPassword, {
					message: 'Passwords do not match',
					path: ['confirmPassword'],
				})

			mockRequest = mockExpress.createRequest({
				body: { password: 'password123', confirmPassword: 'different' },
				path: '/api/auth/register',
			})

			// Mock the schema's parseAsync method to prevent actual validation
			const mockParseAsync = vi
				.fn()
				.mockRejectedValue(new Error('Mocked validation'))
			vi.spyOn(testSchema, 'parseAsync').mockImplementation(mockParseAsync)

			// Mock ZodError from tryCatch
			const { ErrorType } = await import('../../utils/errors.ts')
			const mockZodError = {
				type: ErrorType.ZodError,
				message: 'Passwords do not match',
				details: [
					{ message: 'Passwords do not match', path: ['confirmPassword'] },
				],
				status: 400,
				service: 'validation middleware - body',
			}
			mockTryCatch.mockResolvedValue([null, mockZodError])

			const middleware = await import('../validation.middleware.ts')
			const { ValidationError } = await import('../../utils/errors.ts')
			const validator = middleware.validate(testSchema, 'body')

			// Act
			await validator(
				mockRequest as Request,
				mockResponse as Response,
				mockNext,
			)

			// Assert
			const calledError = vi.mocked(mockNext).mock.calls[0]?.[0]
			expect(calledError).toBeInstanceOf(ValidationError)
		})

		it('should handle async schema validation', async () => {
			// Arrange
			const asyncSchema = z
				.object({
					email: z.email(),
				})
				.refine(
					async (data) => {
						// Simulate async validation
						await new Promise((resolve) => setTimeout(resolve, 10))
						return data.email !== 'taken@example.com'
					},
					{
						message: 'Email already exists',
						path: ['email'],
					},
				)

			const validData = {
				email: 'available@example.com',
			}

			mockRequest = mockExpress.createRequest({
				body: { email: 'original@example.com' },
				path: '/api/test',
			})

			// Mock the schema's parseAsync method to prevent actual validation
			const mockParseAsync = vi.fn().mockResolvedValue(validData)
			vi.spyOn(asyncSchema, 'parseAsync').mockImplementation(mockParseAsync)

			// Mock successful tryCatch result
			mockTryCatch.mockResolvedValue([validData, null])

			const middleware = await import('../validation.middleware.ts')
			const validator = middleware.validate(asyncSchema, 'body')

			// Act
			await validator(
				mockRequest as Request,
				mockResponse as Response,
				mockNext,
			)

			// Assert
			expect(mockRequest.body).toEqual(validData)
			expect(mockNext).toHaveBeenCalledWith()
		})
	})

	describe('Edge Cases', () => {
		it('should handle empty request body', async () => {
			// Arrange
			const testSchema = z.object({
				name: z.string().optional(),
			})

			const validData = {}

			mockRequest = mockExpress.createRequest({
				body: {},
				path: '/api/test',
			})

			// Mock the schema's parseAsync method
			const mockParseAsync = vi.fn().mockResolvedValue(validData)
			vi.spyOn(testSchema, 'parseAsync').mockImplementation(mockParseAsync)

			// Mock successful tryCatch result
			mockTryCatch.mockResolvedValue([validData, null])

			const middleware = await import('../validation.middleware.ts')
			const validator = middleware.validate(testSchema, 'body')

			// Act
			await validator(
				mockRequest as Request,
				mockResponse as Response,
				mockNext,
			)

			// Assert
			expect(mockRequest.body).toEqual(validData)
			expect(mockNext).toHaveBeenCalledWith()
		})

		it('should handle large request bodies', async () => {
			// Arrange
			const testSchema = z.object({
				data: z.string(),
			})

			const largeData = {
				data: 'x'.repeat(10000), // 10KB string
			}

			mockRequest = mockExpress.createRequest({
				body: { data: 'original' },
				path: '/api/test',
			})

			// Mock the schema's parseAsync method
			const mockParseAsync = vi.fn().mockResolvedValue(largeData)
			vi.spyOn(testSchema, 'parseAsync').mockImplementation(mockParseAsync)

			// Mock successful tryCatch result
			mockTryCatch.mockResolvedValue([largeData, null])

			const middleware = await import('../validation.middleware.ts')
			const validator = middleware.validate(testSchema, 'body')

			// Act
			await validator(
				mockRequest as Request,
				mockResponse as Response,
				mockNext,
			)

			// Assert
			expect(mockRequest.body).toEqual(largeData)
			expect(mockNext).toHaveBeenCalledWith()
		})

		it('should handle special characters in validation data', async () => {
			// Arrange
			const testSchema = z.object({
				message: z.string(),
				emoji: z.string(),
			})

			const specialData = {
				message: 'Hello 世界! 🌍',
				emoji: '🚀💻🎉',
			}

			mockRequest = mockExpress.createRequest({
				body: { message: 'original', emoji: 'original' },
				path: '/api/test',
			})

			// Mock the schema's parseAsync method
			const mockParseAsync = vi.fn().mockResolvedValue(specialData)
			vi.spyOn(testSchema, 'parseAsync').mockImplementation(mockParseAsync)

			// Mock successful tryCatch result
			mockTryCatch.mockResolvedValue([specialData, null])

			const middleware = await import('../validation.middleware.ts')
			const validator = middleware.validate(testSchema, 'body')

			// Act
			await validator(
				mockRequest as Request,
				mockResponse as Response,
				mockNext,
			)

			// Assert
			expect(mockRequest.body).toEqual(specialData)
			expect(mockNext).toHaveBeenCalledWith()
		})
	})
})
