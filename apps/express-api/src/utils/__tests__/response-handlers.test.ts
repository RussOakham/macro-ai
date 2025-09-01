import { Response } from 'express'
import { StatusCodes } from 'http-status-codes'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'

import { tryCatchSync } from '../error-handling/try-catch.ts'
import { ValidationError } from '../errors.ts'
import { pino } from '../logger.ts'
import {
	handleServiceError,
	safeValidateSchema,
	sendSuccess,
	type TAwsServiceMetadata,
	validateData,
	validateSchema,
} from '../response-handlers.ts'
import { mockErrorHandling } from '../test-helpers/error-handling.mock.ts'
import { mockExpress } from '../test-helpers/express-mocks.ts'
import { mockLogger } from '../test-helpers/logger.mock.ts'

// Mock dependencies
vi.mock('../error-handling/try-catch.ts', () => ({
	tryCatchSync: vi.fn(),
}))

vi.mock('../logger.ts', () => ({
	pino: {
		logger: {
			error: vi.fn(),
			info: vi.fn(),
			warn: vi.fn(),
			debug: vi.fn(),
			fatal: vi.fn(),
			trace: vi.fn(),
			silent: vi.fn(),
			level: 'info',
		},
	},
}))

describe('response-handlers.ts', () => {
	const mockTryCatchSync = vi.mocked(tryCatchSync)
	const mockLoggerInstance = vi.mocked(pino.logger)

	beforeEach(() => {
		vi.resetModules()

		// Setup logger mock for consistent test environment (includes vi.clearAllMocks())
		mockLogger.setup()
	})

	describe('sendSuccess function', () => {
		let mockResponse: Partial<Response>

		beforeEach(() => {
			// Setup Express mocks (includes vi.clearAllMocks())
			const mocks = mockExpress.setup()
			mockResponse = mocks.res
			mockResponse.status = vi.fn().mockReturnValue(mockResponse)
			mockResponse.json = vi.fn().mockReturnValue(mockResponse)
		})

		describe('successful responses', () => {
			it('should send success response with default status 200', () => {
				const testData = { message: 'Success', id: 123 }

				const result = sendSuccess(mockResponse as Response, testData)

				expect(mockResponse.status).toHaveBeenCalledWith(StatusCodes.OK)
				expect(mockResponse.json).toHaveBeenCalledWith(testData)
				expect(result).toBe(mockResponse)
			})

			it('should send success response with custom status code', () => {
				const testData = { created: true, id: 456 }
				const customStatus = StatusCodes.CREATED

				const result = sendSuccess(
					mockResponse as Response,
					testData,
					customStatus,
				)

				expect(mockResponse.status).toHaveBeenCalledWith(customStatus)
				expect(mockResponse.json).toHaveBeenCalledWith(testData)
				expect(result).toBe(mockResponse)
			})

			it('should handle null data', () => {
				const result = sendSuccess(mockResponse as Response, null)

				expect(mockResponse.status).toHaveBeenCalledWith(StatusCodes.OK)
				expect(mockResponse.json).toHaveBeenCalledWith(null)
				expect(result).toBe(mockResponse)
			})

			it('should handle undefined data', () => {
				const result = sendSuccess(mockResponse as Response, undefined)

				expect(mockResponse.status).toHaveBeenCalledWith(StatusCodes.OK)
				expect(mockResponse.json).toHaveBeenCalledWith(undefined)
				expect(result).toBe(mockResponse)
			})

			it('should handle empty object data', () => {
				const testData = {}

				const result = sendSuccess(mockResponse as Response, testData)

				expect(mockResponse.status).toHaveBeenCalledWith(StatusCodes.OK)
				expect(mockResponse.json).toHaveBeenCalledWith(testData)
				expect(result).toBe(mockResponse)
			})

			it('should handle array data', () => {
				const testData = [{ id: 1 }, { id: 2 }, { id: 3 }]

				const result = sendSuccess(mockResponse as Response, testData)

				expect(mockResponse.status).toHaveBeenCalledWith(StatusCodes.OK)
				expect(mockResponse.json).toHaveBeenCalledWith(testData)
				expect(result).toBe(mockResponse)
			})

			it('should handle string data', () => {
				const testData = 'Simple string response'

				const result = sendSuccess(mockResponse as Response, testData)

				expect(mockResponse.status).toHaveBeenCalledWith(StatusCodes.OK)
				expect(mockResponse.json).toHaveBeenCalledWith(testData)
				expect(result).toBe(mockResponse)
			})

			it('should handle number data', () => {
				const testData = 42

				const result = sendSuccess(mockResponse as Response, testData)

				expect(mockResponse.status).toHaveBeenCalledWith(StatusCodes.OK)
				expect(mockResponse.json).toHaveBeenCalledWith(testData)
				expect(result).toBe(mockResponse)
			})

			it('should handle boolean data', () => {
				const testData = true

				const result = sendSuccess(mockResponse as Response, testData)

				expect(mockResponse.status).toHaveBeenCalledWith(StatusCodes.OK)
				expect(mockResponse.json).toHaveBeenCalledWith(testData)
				expect(result).toBe(mockResponse)
			})
		})

		describe('status code variations', () => {
			it('should handle 201 Created status', () => {
				const testData = { created: true }

				sendSuccess(mockResponse as Response, testData, StatusCodes.CREATED)

				expect(mockResponse.status).toHaveBeenCalledWith(StatusCodes.CREATED)
			})

			it('should handle 202 Accepted status', () => {
				const testData = { accepted: true }

				sendSuccess(mockResponse as Response, testData, StatusCodes.ACCEPTED)

				expect(mockResponse.status).toHaveBeenCalledWith(StatusCodes.ACCEPTED)
			})

			it('should handle 204 No Content status', () => {
				const testData = null

				sendSuccess(mockResponse as Response, testData, StatusCodes.NO_CONTENT)

				expect(mockResponse.status).toHaveBeenCalledWith(StatusCodes.NO_CONTENT)
			})
		})

		describe('response chaining', () => {
			it('should return the response object for method chaining', () => {
				const testData = { test: 'data' }

				const result = sendSuccess(mockResponse as Response, testData)

				expect(result).toBe(mockResponse)
				// Verify that the response object can be chained
				expect(typeof result.status).toBe('function')
				expect(typeof result.json).toBe('function')
			})
		})
	})

	describe('handleServiceError function', () => {
		const mockErrorMessage = 'Service operation failed'
		const mockLogContext = 'TestService'

		describe('successful service responses', () => {
			it('should return success for 200 status code', () => {
				const response: TAwsServiceMetadata = {
					$metadata: {
						httpStatusCode: 200,
						requestId: 'test-request-id',
					},
				}

				const result = handleServiceError(
					response,
					mockErrorMessage,
					mockLogContext,
				)

				expect(result).toEqual({ success: true })
				expect(mockLoggerInstance.error).not.toHaveBeenCalled()
			})

			it('should return success when httpStatusCode is undefined', () => {
				const response: TAwsServiceMetadata = {
					$metadata: {
						requestId: 'test-request-id',
					},
				}

				const result = handleServiceError(
					response,
					mockErrorMessage,
					mockLogContext,
				)

				expect(result).toEqual({ success: true })
				expect(mockLoggerInstance.error).not.toHaveBeenCalled()
			})

			it('should return success when $metadata is undefined', () => {
				const response: TAwsServiceMetadata = {}

				const result = handleServiceError(
					response,
					mockErrorMessage,
					mockLogContext,
				)

				expect(result).toEqual({ success: true })
				expect(mockLoggerInstance.error).not.toHaveBeenCalled()
			})
		})

		describe('error service responses', () => {
			it('should return error for 400 status code', () => {
				const response: TAwsServiceMetadata = {
					$metadata: {
						httpStatusCode: 400,
						requestId: 'test-request-id',
					},
				}

				const result = handleServiceError(
					response,
					mockErrorMessage,
					mockLogContext,
				)

				expect(result).toEqual({
					success: false,
					error: {
						status: 400,
						message: mockErrorMessage,
					},
				})
				expect(mockLoggerInstance.error).toHaveBeenCalledWith(
					`[${mockLogContext}]: ${mockErrorMessage}: 400`,
				)
			})

			it('should return error for 401 status code', () => {
				const response: TAwsServiceMetadata = {
					$metadata: {
						httpStatusCode: 401,
						requestId: 'test-request-id',
					},
				}

				const result = handleServiceError(
					response,
					mockErrorMessage,
					mockLogContext,
				)

				expect(result).toEqual({
					success: false,
					error: {
						status: 401,
						message: mockErrorMessage,
					},
				})
				expect(mockLoggerInstance.error).toHaveBeenCalledWith(
					`[${mockLogContext}]: ${mockErrorMessage}: 401`,
				)
			})

			it('should return error for 403 status code', () => {
				const response: TAwsServiceMetadata = {
					$metadata: {
						httpStatusCode: 403,
						requestId: 'test-request-id',
					},
				}

				const result = handleServiceError(
					response,
					mockErrorMessage,
					mockLogContext,
				)

				expect(result).toEqual({
					success: false,
					error: {
						status: 403,
						message: mockErrorMessage,
					},
				})
				expect(mockLoggerInstance.error).toHaveBeenCalledWith(
					`[${mockLogContext}]: ${mockErrorMessage}: 403`,
				)
			})

			it('should return error for 404 status code', () => {
				const response: TAwsServiceMetadata = {
					$metadata: {
						httpStatusCode: 404,
						requestId: 'test-request-id',
					},
				}

				const result = handleServiceError(
					response,
					mockErrorMessage,
					mockLogContext,
				)

				expect(result).toEqual({
					success: false,
					error: {
						status: 404,
						message: mockErrorMessage,
					},
				})
				expect(mockLoggerInstance.error).toHaveBeenCalledWith(
					`[${mockLogContext}]: ${mockErrorMessage}: 404`,
				)
			})

			it('should return error for 500 status code', () => {
				const response: TAwsServiceMetadata = {
					$metadata: {
						httpStatusCode: 500,
						requestId: 'test-request-id',
					},
				}

				const result = handleServiceError(
					response,
					mockErrorMessage,
					mockLogContext,
				)

				expect(result).toEqual({
					success: false,
					error: {
						status: 500,
						message: mockErrorMessage,
					},
				})
				expect(mockLoggerInstance.error).toHaveBeenCalledWith(
					`[${mockLogContext}]: ${mockErrorMessage}: 500`,
				)
			})
		})

		describe('edge cases', () => {
			it('should handle response with additional metadata fields', () => {
				const response: TAwsServiceMetadata = {
					$metadata: {
						httpStatusCode: 400,
						requestId: 'test-request-id',
						extendedRequestId: 'extended-id',
						attempts: 3,
					},
				}

				const result = handleServiceError(
					response,
					mockErrorMessage,
					mockLogContext,
				)

				expect(result).toEqual({
					success: false,
					error: {
						status: 400,
						message: mockErrorMessage,
					},
				})
				expect(mockLoggerInstance.error).toHaveBeenCalledWith(
					`[${mockLogContext}]: ${mockErrorMessage}: 400`,
				)
			})

			it('should handle alternative metadata structure', () => {
				const response = {
					$metadata: {
						httpStatusCode: 403,
					},
				}

				const result = handleServiceError(
					response,
					mockErrorMessage,
					mockLogContext,
				)

				expect(result).toEqual({
					success: false,
					error: {
						status: 403,
						message: mockErrorMessage,
					},
				})
				expect(mockLoggerInstance.error).toHaveBeenCalledWith(
					`[${mockLogContext}]: ${mockErrorMessage}: 403`,
				)
			})
		})
	})

	describe('validateData function', () => {
		const mockErrorMessage = 'Validation failed'
		const mockLogContext = 'TestValidation'

		describe('successful validation', () => {
			it('should return valid true when condition is true', () => {
				const result = validateData(true, mockErrorMessage, mockLogContext)

				expect(result).toEqual({ valid: true })
				expect(mockLoggerInstance.error).not.toHaveBeenCalled()
			})

			it('should return valid true for truthy values', () => {
				const result = validateData(!!1, mockErrorMessage, mockLogContext)

				expect(result).toEqual({ valid: true })
				expect(mockLoggerInstance.error).not.toHaveBeenCalled()
			})

			it('should return valid true for non-empty string', () => {
				const testString = 'test'
				const result = validateData(
					Boolean(testString),
					mockErrorMessage,
					mockLogContext,
				)

				expect(result).toEqual({ valid: true })
				expect(mockLoggerInstance.error).not.toHaveBeenCalled()
			})

			it('should return valid true for non-empty array', () => {
				const testArray = ['item']
				const result = validateData(
					Boolean(testArray.length),
					mockErrorMessage,
					mockLogContext,
				)

				expect(result).toEqual({ valid: true })
				expect(mockLoggerInstance.error).not.toHaveBeenCalled()
			})

			it('should return valid true for non-empty object', () => {
				const testObject = { key: 'value' }
				const result = validateData(
					Boolean(Object.keys(testObject).length),
					mockErrorMessage,
					mockLogContext,
				)

				expect(result).toEqual({ valid: true })
				expect(mockLoggerInstance.error).not.toHaveBeenCalled()
			})
		})

		describe('validation failures', () => {
			it('should return error with default BAD_REQUEST status when condition is false', () => {
				const result = validateData(false, mockErrorMessage, mockLogContext)

				expect(result).toEqual({
					valid: false,
					error: {
						message: mockErrorMessage,
						status: StatusCodes.BAD_REQUEST,
					},
				})
				expect(mockLoggerInstance.error).toHaveBeenCalledWith(
					`[${mockLogContext}]: ${mockErrorMessage}`,
				)
			})

			it('should return error with custom status code', () => {
				const customStatus = StatusCodes.UNAUTHORIZED
				const result = validateData(
					false,
					mockErrorMessage,
					mockLogContext,
					customStatus,
				)

				expect(result).toEqual({
					valid: false,
					error: {
						message: mockErrorMessage,
						status: customStatus,
					},
				})
				expect(mockLoggerInstance.error).toHaveBeenCalledWith(
					`[${mockLogContext}]: ${mockErrorMessage}`,
				)
			})

			it('should return error for falsy values', () => {
				const falsyValue = 0
				const result = validateData(
					Boolean(falsyValue),
					mockErrorMessage,
					mockLogContext,
				)

				expect(result).toEqual({
					valid: false,
					error: {
						message: mockErrorMessage,
						status: StatusCodes.BAD_REQUEST,
					},
				})
				expect(mockLoggerInstance.error).toHaveBeenCalledWith(
					`[${mockLogContext}]: ${mockErrorMessage}`,
				)
			})

			it('should return error for empty string', () => {
				const emptyString = ''
				const result = validateData(
					Boolean(emptyString),
					mockErrorMessage,
					mockLogContext,
				)

				expect(result).toEqual({
					valid: false,
					error: {
						message: mockErrorMessage,
						status: StatusCodes.BAD_REQUEST,
					},
				})
				expect(mockLoggerInstance.error).toHaveBeenCalledWith(
					`[${mockLogContext}]: ${mockErrorMessage}`,
				)
			})

			it('should return error for null', () => {
				const nullValue = null
				const result = validateData(
					Boolean(nullValue),
					mockErrorMessage,
					mockLogContext,
				)

				expect(result).toEqual({
					valid: false,
					error: {
						message: mockErrorMessage,
						status: StatusCodes.BAD_REQUEST,
					},
				})
				expect(mockLoggerInstance.error).toHaveBeenCalledWith(
					`[${mockLogContext}]: ${mockErrorMessage}`,
				)
			})

			it('should return error for undefined', () => {
				const undefinedValue = undefined
				const result = validateData(
					Boolean(undefinedValue),
					mockErrorMessage,
					mockLogContext,
				)

				expect(result).toEqual({
					valid: false,
					error: {
						message: mockErrorMessage,
						status: StatusCodes.BAD_REQUEST,
					},
				})
				expect(mockLoggerInstance.error).toHaveBeenCalledWith(
					`[${mockLogContext}]: ${mockErrorMessage}`,
				)
			})
		})

		describe('status code variations', () => {
			it('should handle NOT_FOUND status', () => {
				const result = validateData(
					false,
					'Resource not found',
					mockLogContext,
					StatusCodes.NOT_FOUND,
				)

				expect(result).toEqual({
					valid: false,
					error: {
						message: 'Resource not found',
						status: StatusCodes.NOT_FOUND,
					},
				})
			})

			it('should handle FORBIDDEN status', () => {
				const result = validateData(
					false,
					'Access denied',
					mockLogContext,
					StatusCodes.FORBIDDEN,
				)

				expect(result).toEqual({
					valid: false,
					error: {
						message: 'Access denied',
						status: StatusCodes.FORBIDDEN,
					},
				})
			})

			it('should handle INTERNAL_SERVER_ERROR status', () => {
				const result = validateData(
					false,
					'Server error',
					mockLogContext,
					StatusCodes.INTERNAL_SERVER_ERROR,
				)

				expect(result).toEqual({
					valid: false,
					error: {
						message: 'Server error',
						status: StatusCodes.INTERNAL_SERVER_ERROR,
					},
				})
			})
		})

		describe('logging verification', () => {
			it('should log error with correct format', () => {
				const customMessage = 'Custom validation error'
				const customContext = 'CustomService'

				validateData(false, customMessage, customContext)

				expect(mockLoggerInstance.error).toHaveBeenCalledWith(
					`[${customContext}]: ${customMessage}`,
				)
				expect(mockLoggerInstance.error).toHaveBeenCalledTimes(1)
			})
		})
	})

	describe('validateSchema function', () => {
		const mockLogContext = 'TestSchemaValidation'

		beforeEach(() => {
			// Use real implementation by default for schema validation tests
			mockTryCatchSync.mockImplementation(
				mockErrorHandling.withRealTryCatchSync(),
			)
		})

		describe('successful validation', () => {
			it('should validate and parse valid data with string schema', () => {
				const schema = z.string()
				const validData = 'test string'

				const result = validateSchema(validData, schema, mockLogContext)

				expect(result).toEqual([validData, null])
				expect(mockTryCatchSync).toHaveBeenCalledWith(
					expect.any(Function),
					`${mockLogContext} - validateSchema`,
				)
			})

			it('should validate and parse valid data with object schema', () => {
				const schema = z.object({
					name: z.string(),
					age: z.number(),
				})
				const validData = { name: 'John', age: 30 }

				const result = validateSchema(validData, schema, mockLogContext)

				expect(result).toEqual([validData, null])
			})

			it('should validate and parse valid data with array schema', () => {
				const schema = z.array(z.string())
				const validData = ['item1', 'item2', 'item3']

				const result = validateSchema(validData, schema, mockLogContext)

				expect(result).toEqual([validData, null])
			})

			it('should validate and parse valid data with number schema', () => {
				const schema = z.number()
				const validData = 42

				const result = validateSchema(validData, schema, mockLogContext)

				expect(result).toEqual([validData, null])
			})

			it('should validate and parse valid data with boolean schema', () => {
				const schema = z.boolean()
				const validData = true

				const result = validateSchema(validData, schema, mockLogContext)

				expect(result).toEqual([validData, null])
			})

			it('should transform data according to schema', () => {
				const schema = z.string().transform((val) => val.toUpperCase())
				const inputData = 'test string'
				const expectedData = 'TEST STRING'

				const result = validateSchema(inputData, schema, mockLogContext)

				expect(result).toEqual([expectedData, null])
			})
		})

		describe('validation failures', () => {
			it('should return error for invalid string data', () => {
				const schema = z.string()
				const invalidData = 123

				const result = validateSchema(invalidData, schema, mockLogContext)

				expect(result[0]).toBeNull()
				expect(result[1]).toBeInstanceOf(Error)
			})

			it('should return error for invalid object data', () => {
				const schema = z.object({
					name: z.string(),
					age: z.number(),
				})
				const invalidData = { name: 'John', age: 'thirty' }

				const result = validateSchema(invalidData, schema, mockLogContext)

				expect(result[0]).toBeNull()
				expect(result[1]).toBeInstanceOf(Error)
			})

			it('should return error for missing required fields', () => {
				const schema = z.object({
					name: z.string(),
					age: z.number(),
				})
				const invalidData = { name: 'John' }

				const result = validateSchema(invalidData, schema, mockLogContext)

				expect(result[0]).toBeNull()
				expect(result[1]).toBeInstanceOf(Error)
			})

			it('should return error for invalid array data', () => {
				const schema = z.array(z.string())
				const invalidData = ['item1', 123, 'item3']

				const result = validateSchema(invalidData, schema, mockLogContext)

				expect(result[0]).toBeNull()
				expect(result[1]).toBeInstanceOf(Error)
			})

			it('should return error for null data when not allowed', () => {
				const schema = z.string()
				const invalidData = null

				const result = validateSchema(invalidData, schema, mockLogContext)

				expect(result[0]).toBeNull()
				expect(result[1]).toBeInstanceOf(Error)
			})

			it('should return error for undefined data when not allowed', () => {
				const schema = z.string()
				const invalidData = undefined

				const result = validateSchema(invalidData, schema, mockLogContext)

				expect(result[0]).toBeNull()
				expect(result[1]).toBeInstanceOf(Error)
			})
		})

		describe('complex schema validation', () => {
			it('should validate nested object schema', () => {
				const schema = z.object({
					user: z.object({
						name: z.string(),
						email: z.email(),
					}),
					settings: z.object({
						theme: z.enum(['light', 'dark']),
						notifications: z.boolean(),
					}),
				})
				const validData = {
					user: {
						name: 'John Doe',
						email: 'john@example.com',
					},
					settings: {
						theme: 'dark' as const,
						notifications: true,
					},
				}

				const result = validateSchema(validData, schema, mockLogContext)

				expect(result).toEqual([validData, null])
			})

			it('should validate optional fields', () => {
				const schema = z.object({
					name: z.string(),
					age: z.number().optional(),
				})
				const validData = { name: 'John' }

				const result = validateSchema(validData, schema, mockLogContext)

				expect(result).toEqual([validData, null])
			})

			it('should validate with default values', () => {
				const schema = z.object({
					name: z.string(),
					age: z.number().default(25),
				})
				const inputData = { name: 'John' }
				const expectedData = { name: 'John', age: 25 }

				const result = validateSchema(inputData, schema, mockLogContext)

				expect(result).toEqual([expectedData, null])
			})
		})

		describe('error handling', () => {
			it('should handle tryCatchSync errors', () => {
				const error = mockErrorHandling.errors.validation('Mock error')
				mockTryCatchSync.mockReturnValue(mockErrorHandling.errorResult(error))

				const schema = z.string()
				const result = validateSchema('test', schema, mockLogContext)

				expect(result).toEqual([null, error])
			})

			it('should call tryCatchSync with correct context', () => {
				const schema = z.string()
				const customContext = 'CustomValidationContext'

				validateSchema('test', schema, customContext)

				expect(mockTryCatchSync).toHaveBeenCalledWith(
					expect.any(Function),
					`${customContext} - validateSchema`,
				)
			})
		})
	})

	describe('safeValidateSchema function', () => {
		const mockLogContext = 'TestSafeSchemaValidation'

		beforeEach(() => {
			// Use real implementation by default for schema validation tests
			mockTryCatchSync.mockImplementation(
				mockErrorHandling.withRealTryCatchSync(),
			)
		})

		describe('successful validation', () => {
			it('should validate and parse valid data with string schema', () => {
				const schema = z.string()
				const validData = 'test string'

				const result = safeValidateSchema(validData, schema, mockLogContext)

				expect(result).toEqual([validData, null])
				expect(mockTryCatchSync).toHaveBeenCalledWith(
					expect.any(Function),
					`${mockLogContext} - safeValidateSchema`,
				)
			})

			it('should validate and parse valid data with object schema', () => {
				const schema = z.object({
					name: z.string(),
					age: z.number(),
				})
				const validData = { name: 'John', age: 30 }

				const result = safeValidateSchema(validData, schema, mockLogContext)

				expect(result).toEqual([validData, null])
			})

			it('should validate and parse valid data with array schema', () => {
				const schema = z.array(z.string())
				const validData = ['item1', 'item2', 'item3']

				const result = safeValidateSchema(validData, schema, mockLogContext)

				expect(result).toEqual([validData, null])
			})

			it('should transform data according to schema', () => {
				const schema = z.string().transform((val) => val.toUpperCase())
				const inputData = 'test string'
				const expectedData = 'TEST STRING'

				const result = safeValidateSchema(inputData, schema, mockLogContext)

				expect(result).toEqual([expectedData, null])
			})
		})

		describe('validation failures', () => {
			it('should return ValidationError for invalid string data', () => {
				const schema = z.string()
				const invalidData = 123

				const result = safeValidateSchema(invalidData, schema, mockLogContext)

				expect(result[0]).toBeNull()
				expect(result[1]).toBeInstanceOf(ValidationError)
				expect(result[1]?.message).toContain('Validation failed:')
			})

			it('should return ValidationError for invalid object data', () => {
				const schema = z.object({
					name: z.string(),
					age: z.number(),
				})
				const invalidData = { name: 'John', age: 'thirty' }

				const result = safeValidateSchema(invalidData, schema, mockLogContext)

				expect(result[0]).toBeNull()
				expect(result[1]).toBeInstanceOf(ValidationError)
				expect(result[1]?.message).toContain('Validation failed:')
			})

			it('should return ValidationError for missing required fields', () => {
				const schema = z.object({
					name: z.string(),
					age: z.number(),
				})
				const invalidData = { name: 'John' }

				const result = safeValidateSchema(invalidData, schema, mockLogContext)

				expect(result[0]).toBeNull()
				expect(result[1]).toBeInstanceOf(ValidationError)
				expect(result[1]?.message).toContain('Validation failed:')
			})

			it('should return ValidationError for invalid array data', () => {
				const schema = z.array(z.string())
				const invalidData = ['item1', 123, 'item3']

				const result = safeValidateSchema(invalidData, schema, mockLogContext)

				expect(result[0]).toBeNull()
				expect(result[1]).toBeInstanceOf(ValidationError)
				expect(result[1]?.message).toContain('Validation failed:')
			})

			it('should include validation details in error', () => {
				const schema = z.object({
					email: z.email(),
				})
				const invalidData = { email: 'invalid-email' }

				const result = safeValidateSchema(invalidData, schema, mockLogContext)

				expect(result[0]).toBeNull()
				expect(result[1]).toBeInstanceOf(ValidationError)
				expect(result[1]?.details).toBeDefined()
			})

			it('should set correct service context in ValidationError', () => {
				const schema = z.string()
				const invalidData = 123
				const customContext = 'CustomSafeValidation'

				const result = safeValidateSchema(invalidData, schema, customContext)

				expect(result[0]).toBeNull()
				expect(result[1]).toBeInstanceOf(ValidationError)
				expect(result[1]?.service).toBe(customContext)
			})
		})

		describe('complex schema validation', () => {
			it('should validate nested object schema', () => {
				const schema = z.object({
					user: z.object({
						name: z.string(),
						email: z.email(),
					}),
					settings: z.object({
						theme: z.enum(['light', 'dark']),
						notifications: z.boolean(),
					}),
				})
				const validData = {
					user: {
						name: 'John Doe',
						email: 'john@example.com',
					},
					settings: {
						theme: 'dark' as const,
						notifications: true,
					},
				}

				const result = safeValidateSchema(validData, schema, mockLogContext)

				expect(result).toEqual([validData, null])
			})

			it('should handle validation errors in nested objects', () => {
				const schema = z.object({
					user: z.object({
						name: z.string(),
						email: z.email(),
					}),
				})
				const invalidData = {
					user: {
						name: 'John Doe',
						email: 'invalid-email',
					},
				}

				const result = safeValidateSchema(invalidData, schema, mockLogContext)

				expect(result[0]).toBeNull()
				expect(result[1]).toBeInstanceOf(ValidationError)
				expect(result[1]?.message).toContain('Validation failed:')
			})
		})

		describe('error handling', () => {
			it('should handle tryCatchSync errors', () => {
				const error = mockErrorHandling.errors.validation('Mock error')
				mockTryCatchSync.mockReturnValue(mockErrorHandling.errorResult(error))

				const schema = z.string()
				const result = safeValidateSchema('test', schema, mockLogContext)

				expect(result).toEqual([null, error])
			})

			it('should call tryCatchSync with correct context', () => {
				const schema = z.string()
				const customContext = 'CustomSafeValidationContext'

				safeValidateSchema('test', schema, customContext)

				expect(mockTryCatchSync).toHaveBeenCalledWith(
					expect.any(Function),
					`${customContext} - safeValidateSchema`,
				)
			})
		})
	})
})
