/* eslint-disable @typescript-eslint/unbound-method */
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
import { createMockExpressObjects } from '../test-helpers/enhanced-mocks.ts'
import { mockErrorHandling } from '../test-helpers/error-handling.mock.ts'
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
		let mockResponse: Response

		beforeEach(() => {
			vi.clearAllMocks()
			const { res } = createMockExpressObjects()
			mockResponse = res
		})

		describe('successful responses', () => {
			describe.each([
				['object data', { message: 'Success', id: 123 }, StatusCodes.OK],
				['null data', null, StatusCodes.OK],
				['undefined data', undefined, StatusCodes.OK],
				['empty object data', {}, StatusCodes.OK],
				['array data', [{ id: 1 }, { id: 2 }, { id: 3 }], StatusCodes.OK],
				['string data', 'Simple string response', StatusCodes.OK],
				['number data', 42, StatusCodes.OK],
				['boolean data', true, StatusCodes.OK],
			])('should handle %s', (dataType, testData, expectedStatus) => {
				it(`should send success response with ${dataType}`, () => {
					const result = sendSuccess(mockResponse, testData)

					expect(mockResponse.status).toHaveBeenCalledWith(expectedStatus)
					expect(mockResponse.json).toHaveBeenCalledWith(testData)
					expect(result).toBe(mockResponse)
				})
			})

			it('should send success response with custom status code', () => {
				const testData = { created: true, id: 456 }
				const customStatus = StatusCodes.CREATED

				const result = sendSuccess(mockResponse, testData, customStatus)

				expect(mockResponse.status).toHaveBeenCalledWith(customStatus)
				expect(mockResponse.json).toHaveBeenCalledWith(testData)
				expect(result).toBe(mockResponse)
			})
		})

		describe('status code variations', () => {
			describe.each([
				['201 Created', { created: true }, StatusCodes.CREATED],
				['202 Accepted', { accepted: true }, StatusCodes.ACCEPTED],
				['204 No Content', null, StatusCodes.NO_CONTENT],
			])('should handle %s', (statusName, testData, statusCode) => {
				it(`should handle ${statusName} status`, () => {
					sendSuccess(mockResponse, testData, statusCode)

					expect(mockResponse.status).toHaveBeenCalledWith(statusCode)
				})
			})
		})

		describe('response chaining', () => {
			it('should return the response object for method chaining', () => {
				const testData = { test: 'data' }

				const result = sendSuccess(mockResponse, testData)

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
			describe.each([
				[
					'200 status code',
					{ $metadata: { httpStatusCode: 200, requestId: 'test-request-id' } },
				],
				[
					'undefined httpStatusCode',
					{ $metadata: { requestId: 'test-request-id' } },
				],
				['undefined $metadata', {}],
			])('should return success for %s', (scenario, response) => {
				it(`should return success for ${scenario}`, () => {
					const result = handleServiceError(
						response as TAwsServiceMetadata,
						mockErrorMessage,
						mockLogContext,
					)

					expect(result).toEqual({ success: true })
					expect(mockLoggerInstance.error).not.toHaveBeenCalled()
				})
			})
		})

		describe('error service responses', () => {
			describe.each([
				[400, '400 status code'],
				[401, '401 status code'],
				[403, '403 status code'],
				[404, '404 status code'],
				[500, '500 status code'],
			])('should return error for %s', (statusCode, scenario) => {
				it(`should return error for ${scenario}`, () => {
					const response: TAwsServiceMetadata = {
						$metadata: {
							httpStatusCode: statusCode,
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
							status: statusCode,
							message: mockErrorMessage,
						},
					})
					expect(mockLoggerInstance.error).toHaveBeenCalledWith(
						`[${mockLogContext}]: ${mockErrorMessage}: ${statusCode.toString()}`,
					)
				})
			})
		})

		describe('edge cases', () => {
			describe.each([
				[
					'additional metadata fields',
					{
						$metadata: {
							httpStatusCode: 400,
							requestId: 'test-request-id',
							extendedRequestId: 'extended-id',
							attempts: 3,
						},
					},
					400,
				],
				[
					'alternative metadata structure',
					{
						$metadata: {
							httpStatusCode: 403,
						},
					},
					403,
				],
			])(
				'should handle response with %s',
				(scenario, response, expectedStatus) => {
					it(`should handle response with ${scenario}`, () => {
						const result = handleServiceError(
							response as TAwsServiceMetadata,
							mockErrorMessage,
							mockLogContext,
						)

						expect(result).toEqual({
							success: false,
							error: {
								status: expectedStatus,
								message: mockErrorMessage,
							},
						})
						expect(mockLoggerInstance.error).toHaveBeenCalledWith(
							`[${mockLogContext}]: ${mockErrorMessage}: ${expectedStatus.toString()}`,
						)
					})
				},
			)
		})
	})

	describe('validateData function', () => {
		const mockErrorMessage = 'Validation failed'
		const mockLogContext = 'TestValidation'

		describe('successful validation', () => {
			describe.each([
				['true condition', true],
				['truthy values', !!1],
				['non-empty string', Boolean('test')],
				['non-empty array', Boolean(['item'].length)],
				['non-empty object', Boolean(Object.keys({ key: 'value' }).length)],
			])('should return valid true for %s', (scenario, condition) => {
				it(`should return valid true for ${scenario}`, () => {
					const result = validateData(
						condition,
						mockErrorMessage,
						mockLogContext,
					)

					expect(result).toEqual({ valid: true })
					expect(mockLoggerInstance.error).not.toHaveBeenCalled()
				})
			})
		})

		describe('validation failures', () => {
			describe.each([
				['false condition', false, StatusCodes.BAD_REQUEST],
				['falsy values', Boolean(0), StatusCodes.BAD_REQUEST],
				['empty string', Boolean(''), StatusCodes.BAD_REQUEST],
				['null value', Boolean(null), StatusCodes.BAD_REQUEST],
				['undefined value', Boolean(undefined), StatusCodes.BAD_REQUEST],
			])(
				'should return error for %s',
				(scenario, condition, expectedStatus) => {
					it(`should return error for ${scenario}`, () => {
						const result = validateData(
							condition,
							mockErrorMessage,
							mockLogContext,
						)

						expect(result).toEqual({
							valid: false,
							error: {
								message: mockErrorMessage,
								status: expectedStatus,
							},
						})
						expect(mockLoggerInstance.error).toHaveBeenCalledWith(
							`[${mockLogContext}]: ${mockErrorMessage}`,
						)
					})
				},
			)

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
		})

		describe('status code variations', () => {
			describe.each([
				['NOT_FOUND', 'Resource not found', StatusCodes.NOT_FOUND],
				['FORBIDDEN', 'Access denied', StatusCodes.FORBIDDEN],
				[
					'INTERNAL_SERVER_ERROR',
					'Server error',
					StatusCodes.INTERNAL_SERVER_ERROR,
				],
			])('should handle %s status', (statusName, message, statusCode) => {
				it(`should handle ${statusName} status`, () => {
					const result = validateData(
						false,
						message,
						mockLogContext,
						statusCode,
					)

					expect(result).toEqual({
						valid: false,
						error: {
							message,
							status: statusCode,
						},
					})
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
