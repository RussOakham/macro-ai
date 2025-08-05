/**
 * Tests for Error Handling Test Helpers
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { AppError, ErrorType } from '../../errors.js'
import {
	createErrorHandlingTestSuite,
	createMockTryCatch,
	createMockTryCatchAsync,
	createMockTryCatchSync,
	createTestError,
	errorClassificationHelpers,
	errorHandlingTestScenarios,
	resultAssertions,
	testErrorScenarios,
} from '../error-handling.mock.js'

describe('Error Handling Test Helpers', () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	afterEach(() => {
		vi.resetAllMocks()
	})

	describe('createMockTryCatch', () => {
		it('should create mock tryCatch function', () => {
			const mockTryCatch = createMockTryCatch()

			expect(mockTryCatch).toBeDefined()
			expect(typeof mockTryCatch).toBe('function')
		})

		it('should return success result for successful operation', async () => {
			const mockTryCatch = createMockTryCatch()
			const operation = () => Promise.resolve('success')

			const result = (await mockTryCatch(operation)) as [string, null]

			expect(result).toEqual(['success', null])
		})

		it('should return error result for failed operation', async () => {
			const mockTryCatch = createMockTryCatch()
			const error = new AppError({ message: 'test error' })
			const operation = () => Promise.reject(error)

			const result = (await mockTryCatch(operation)) as [null, Error]

			expect(result).toEqual([null, error])
		})

		it('should convert non-Error rejections to Error', async () => {
			const mockTryCatch = createMockTryCatch()
			const operation = () => Promise.reject(new Error('string error'))
			const result = (await mockTryCatch(operation)) as [null, Error]

			expect(result[0]).toBeNull()
			expect(result[1]).toBeInstanceOf(Error)
			expect(result[1].message).toBe('string error')
		})
	})

	describe('createMockTryCatchSync', () => {
		it('should create mock tryCatchSync function', () => {
			const mockTryCatchSync = createMockTryCatchSync()

			expect(mockTryCatchSync).toBeDefined()
			expect(typeof mockTryCatchSync).toBe('function')
		})

		it('should return success result for successful operation', () => {
			const mockTryCatchSync = createMockTryCatchSync()
			const operation = () => 'success'

			const result = mockTryCatchSync(operation) as [string, null]

			expect(result).toEqual(['success', null])
		})

		it('should return error result for failed operation', () => {
			const mockTryCatchSync = createMockTryCatchSync()
			const error = new AppError({ message: 'test error' })
			const operation = () => {
				throw error
			}

			const result = mockTryCatchSync(operation) as [null, Error]

			expect(result).toEqual([null, error])
		})
	})

	describe('createMockTryCatchAsync', () => {
		it('should create mock tryCatchAsync function', () => {
			const mockTryCatchAsync = createMockTryCatchAsync()

			expect(mockTryCatchAsync).toBeDefined()
			expect(typeof mockTryCatchAsync).toBe('function')
		})

		it('should handle async operations', async () => {
			const mockTryCatchAsync = createMockTryCatchAsync()
			const operation = () => Promise.resolve('async success')

			const result = (await mockTryCatchAsync(operation)) as [string, null]

			expect(result).toEqual(['async success', null])
		})

		it('should handle sync operations', async () => {
			const mockTryCatchAsync = createMockTryCatchAsync()
			const operation = () => 'sync success'

			const result = (await mockTryCatchAsync(operation)) as [string, null]

			expect(result).toEqual(['sync success', null])
		})
	})

	describe('createTestError', () => {
		it('should create AppError with default values', () => {
			const error = createTestError()

			expect(error).toBeInstanceOf(AppError)
			expect(error.type).toBe(ErrorType.InternalError)
			expect(error.message).toBe('Test error')
			expect(error.status).toBe(500)
			expect(error.service).toBe('test-service')
		})

		it('should create AppError with custom values', () => {
			const error = createTestError(
				ErrorType.ValidationError,
				'Custom message',
				{
					status: 400,
					service: 'custom-service',
				},
			)

			expect(error.type).toBe(ErrorType.ValidationError)
			expect(error.message).toBe('Custom message')
			expect(error.status).toBe(400)
			expect(error.service).toBe('custom-service')
		})

		it('should apply overrides correctly', () => {
			const error = createTestError(
				ErrorType.ValidationError,
				'Validation error',
				{
					status: 400,
					details: { reason: 'invalid input' },
				},
			)

			expect(error.type).toBe(ErrorType.ValidationError)
			expect(error.status).toBe(400)
			expect(error.details).toEqual({ reason: 'invalid input' })
		})
	})

	describe('testErrorScenarios', () => {
		it('should provide validation error scenario', () => {
			const scenario = testErrorScenarios.validation

			expect(scenario.name).toBe('validation error')
			expect(scenario.error).toBeInstanceOf(AppError)
			expect(scenario.error.type).toBe(ErrorType.ValidationError)
			expect(scenario.expectedStatus).toBe(400)
		})

		it('should provide configuration error scenario', () => {
			const scenario = testErrorScenarios.configuration

			expect(scenario.name).toBe('configuration error')
			expect(scenario.error.type).toBe(ErrorType.ConfigurationError)
			expect(scenario.expectedStatus).toBe(500)
		})

		it('should provide generic error scenario', () => {
			const scenario = testErrorScenarios.generic

			expect(scenario.name).toBe('generic JavaScript error')
			expect(scenario.error).toBeInstanceOf(Error)
			expect(scenario.error).not.toBeInstanceOf(AppError)
			expect(scenario.expectedStatus).toBe(500)
		})

		it('should cover all major error types', () => {
			const scenarios = Object.values(testErrorScenarios)
			const errorTypes = scenarios.map(
				(s) => s.expectedType || (s.error as AppError).type,
			)

			expect(errorTypes).toContain(ErrorType.ValidationError)
			expect(errorTypes).toContain(ErrorType.ConfigurationError)
			expect(errorTypes).toContain(ErrorType.ParameterStoreError)
			expect(errorTypes).toContain(ErrorType.InternalError)
			expect(errorTypes).toContain(ErrorType.ApiError)
		})
	})

	describe('resultAssertions', () => {
		describe('expectSuccess', () => {
			it('should assert successful result', () => {
				const result: [string, null] = ['success', null]

				const data = resultAssertions.expectSuccess(result)

				expect(data).toBe('success')
			})

			it('should assert successful result with expected value', () => {
				const result: [string, null] = ['expected', null]

				expect(() => {
					resultAssertions.expectSuccess(result, 'expected')
				}).not.toThrow()
			})

			it('should throw for error result', () => {
				const result: [null, AppError] = [null, AppError.from(new Error('test'), 'test')]

				expect(() => {
					resultAssertions.expectSuccess(result)
				}).toThrow()
			})
		})

		describe('expectError', () => {
			it('should assert error result', () => {
				const error = AppError.from(new Error('test error'), 'test')
				const result: [null, AppError] = [null, error]

				const resultError = resultAssertions.expectError(result)

				expect(resultError).toBe(error)
			})

			it('should assert error result with expected message', () => {
				const error = AppError.from(new Error('expected message'), 'test')
				const result: [null, AppError] = [null, error]

				expect(() => {
					resultAssertions.expectError(result, 'expected message')
				}).not.toThrow()
			})

			it('should throw for success result', () => {
				const result: [string, null] = ['success', null]

				expect(() => {
					resultAssertions.expectError(result)
				}).toThrow()
			})
		})

		describe('expectAppError', () => {
			it('should assert AppError result', () => {
				const error = createTestError(
					ErrorType.ValidationError,
					'validation failed',
				)
				const result: [null, AppError] = [null, error]

				const resultError = resultAssertions.expectAppError(
					result,
					ErrorType.ValidationError,
				)

				expect(resultError).toBe(error)
			})

			it('should assert AppError with expected message', () => {
				const error = createTestError(
					ErrorType.ValidationError,
					'expected message',
				)
				const result: [null, AppError] = [null, error]

				expect(() => {
					resultAssertions.expectAppError(
						result,
						ErrorType.ValidationError,
						'expected message',
					)
				}).not.toThrow()
			})

			it('should throw for non-AppError', () => {
				const error = AppError.from(new Error('generic error'), 'test')
				const result: [null, AppError] = [null, error]

				expect(() => {
					resultAssertions.expectAppError(result, ErrorType.ValidationError)
				}).toThrow()
			})
		})
	})

	describe('errorHandlingTestScenarios', () => {
		it('should provide success scenario', () => {
			const scenario = errorHandlingTestScenarios.success

			expect(scenario.name).toBe('successful operation')
			expect(scenario.expectedResult).toEqual(['success', null])
		})

		it('should provide AppError scenario', () => {
			const scenario = errorHandlingTestScenarios.appError

			expect(scenario.name).toBe('operation throws AppError')
			expect(scenario.expectedError).toBe(ErrorType.ValidationError)
		})

		it('should provide generic error scenario', () => {
			const scenario = errorHandlingTestScenarios.genericError

			expect(scenario.name).toBe('operation throws generic Error')
			expect(scenario.expectedError).toBe('Generic error')
		})

		it('should provide synchronous scenarios', () => {
			const syncSuccess = errorHandlingTestScenarios.syncSuccess
			const syncError = errorHandlingTestScenarios.syncError

			expect(syncSuccess.name).toBe('synchronous successful operation')
			expect(syncError.name).toBe('synchronous operation throws')
		})
	})

	describe('errorClassificationHelpers', () => {
		it('should test error classification', () => {
			const error = new Error('test error')
			const classification = errorClassificationHelpers.testErrorClassification(
				error,
				'server_error',
				'high',
			)

			expect(classification.category).toBe('server_error')
			expect(classification.severity).toBe('high')
			expect(classification.isRetryable).toBe(true)
		})

		it('should test error response creation', () => {
			const error = createTestError(
				ErrorType.ValidationError,
				'Invalid input',
				{ status: 400 },
			)
			const response = errorClassificationHelpers.testErrorResponse(error, 400)

			expect(response.statusCode).toBe(400)
			expect(response.headers['x-lambda-error']).toBe('true')
			expect(response.headers['x-error-type']).toBe(ErrorType.ValidationError)
			expect(JSON.parse(response.body)).toEqual({
				error: {
					message: 'Invalid input',
					type: ErrorType.ValidationError,
				},
			})
		})
	})

	describe('createErrorHandlingTestSuite', () => {
		it('should create complete error handling test suite', () => {
			const suite = createErrorHandlingTestSuite()

			expect(suite.tryCatch).toBeDefined()
			expect(suite.tryCatchSync).toBeDefined()
			expect(suite.tryCatchAsync).toBeDefined()
			expect(suite.createError).toBeDefined()
			expect(suite.scenarios).toBeDefined()
			expect(suite.assertions).toBeDefined()
		})

		it('should provide working mock functions', async () => {
			const suite = createErrorHandlingTestSuite()

			// Test tryCatch
			const successResult = (await suite.tryCatch(() =>
				Promise.resolve('test'),
			)) as [string, null]
			expect(successResult).toEqual(['test', null])

			// Test tryCatchSync
			const syncResult = suite.tryCatchSync(() => 'sync test') as [string, null]
			expect(syncResult).toEqual(['sync test', null])

			// Test createError
			const error = suite.createError(ErrorType.ValidationError, 'test error')
			expect(error).toBeInstanceOf(AppError)
			expect(error.type).toBe(ErrorType.ValidationError)
		})
	})
})
