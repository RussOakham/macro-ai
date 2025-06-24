import { beforeEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'

import { AppError, ErrorType, Result } from '../../errors.ts'
import { pino } from '../../logger.ts'
import { createErrorScenarios } from '../../test-helpers/error-handling.mock.ts'
import { tryCatch, tryCatchSync } from '../try-catch.ts'

// Mock the logger module
vi.mock('../../logger.ts', () => ({
	pino: {
		logger: {
			error: vi.fn(),
			info: vi.fn(),
			warn: vi.fn(),
			debug: vi.fn(),
		},
	},
}))

describe('Error Handling Utilities', () => {
	const mockLogger = vi.mocked(pino.logger)

	beforeEach(() => {
		vi.clearAllMocks()
	})

	describe('tryCatch', () => {
		describe('Success Cases', () => {
			it('should return [data, null] when promise resolves successfully', async () => {
				// Arrange
				const testData = { id: '123', name: 'Test User' }
				const successPromise = Promise.resolve(testData)

				// Act
				const result: Result<typeof testData> = await tryCatch(
					successPromise,
					'testService',
				)

				// Assert
				expect(result).toEqual([testData, null])
				expect(mockLogger.error).not.toHaveBeenCalled()
			})

			it('should return [data, null] with default context when no context provided', async () => {
				// Arrange
				const testData = 'success result'
				const successPromise = Promise.resolve(testData)

				// Act
				const result = await tryCatch(successPromise)

				// Assert
				expect(result).toEqual([testData, null])
				expect(mockLogger.error).not.toHaveBeenCalled()
			})

			it('should handle different data types successfully', async () => {
				// Arrange & Act & Assert
				const stringResult = await tryCatch(Promise.resolve('test string'))
				expect(stringResult).toEqual(['test string', null])

				const numberResult = await tryCatch(Promise.resolve(42))
				expect(numberResult).toEqual([42, null])

				const booleanResult = await tryCatch(Promise.resolve(true))
				expect(booleanResult).toEqual([true, null])

				const arrayResult = await tryCatch(Promise.resolve([1, 2, 3]))
				expect(arrayResult).toEqual([[1, 2, 3], null])

				const objectResult = await tryCatch(Promise.resolve({ key: 'value' }))
				expect(objectResult).toEqual([{ key: 'value' }, null])
			})
		})

		describe('Error Cases', () => {
			it('should return [null, AppError] when promise rejects with Error', async () => {
				// Arrange
				const originalError = new Error('Test error message')
				const rejectedPromise = Promise.reject(originalError)

				// Act
				const result = await tryCatch(rejectedPromise, 'testService')

				// Assert
				expect(result[0]).toBeNull()
				expect(result[1]).toBeInstanceOf(AppError)
				expect(result[1]?.message).toBe('Test error message')
				expect(result[1]?.service).toBe('testService')
				expect(mockLogger.error).toHaveBeenCalledWith(
					'[testService]: Test error message',
				)
			})

			it('should handle AppError instances correctly', async () => {
				// Arrange
				const appError = createErrorScenarios.validation(
					'Validation failed',
					{ field: 'email' },
					'validationService',
				)
				const rejectedPromise = Promise.reject(appError)

				// Act
				const result = await tryCatch(rejectedPromise, 'testService')

				// Assert
				expect(result[0]).toBeNull()
				expect(result[1]).toBeInstanceOf(AppError)
				expect(result[1]?.message).toBe('Validation failed')
				expect(result[1]?.type).toBe(ErrorType.ValidationError)
				expect(mockLogger.error).toHaveBeenCalledWith(
					'[testService]: Validation failed',
				)
			})

			it('should handle unknown error types', async () => {
				// Arrange
				const unknownError = 'string error'
				const rejectedPromise = Promise.reject(new Error(unknownError))

				// Act
				const result = await tryCatch(rejectedPromise, 'testService')

				// Assert
				expect(result[0]).toBeNull()
				expect(result[1]).toBeInstanceOf(AppError)
				expect(result[1]?.type).toBe(ErrorType.Error)
				expect(result[1]?.service).toBe('testService')
				expect(mockLogger.error).toHaveBeenCalled()
			})

			it('should use default context when error occurs without context', async () => {
				// Arrange
				const originalError = new Error('Test error')
				const rejectedPromise = Promise.reject(originalError)

				// Act
				const result = await tryCatch(rejectedPromise)

				// Assert
				expect(result[0]).toBeNull()
				expect(result[1]).toBeInstanceOf(AppError)
				expect(result[1]?.message).toBe('Test error')
				expect(result[1]?.service).toBe('unknown')
				expect(mockLogger.error).toHaveBeenCalledWith('[unknown]: Test error')
			})
		})

		describe('Context Preservation', () => {
			it('should preserve context information in error logging', async () => {
				// Arrange
				const error = new Error('Context test error')
				const rejectedPromise = Promise.reject(error)
				const context = 'userService - getUserById'

				// Act
				const result = await tryCatch(rejectedPromise, context)

				// Assert
				expect(result[0]).toBeNull()
				expect(result[1]).toBeInstanceOf(AppError)
				expect(result[1]?.service).toBe(context)
				expect(mockLogger.error).toHaveBeenCalledWith(
					'[userService - getUserById]: Context test error',
				)
			})

			it('should handle complex context strings', async () => {
				// Arrange
				const error = new Error('Test error')
				const rejectedPromise = Promise.reject(error)
				const complexContext = 'authController - register - validatePassword'

				// Act
				const result = await tryCatch(rejectedPromise, complexContext)

				// Assert
				expect(result[0]).toBeNull()
				expect(result[1]).toBeInstanceOf(AppError)
				expect(result[1]?.service).toBe(complexContext)
				expect(mockLogger.error).toHaveBeenCalledWith(
					'[authController - register - validatePassword]: Test error',
				)
			})
		})

		describe('Type Safety', () => {
			it('should maintain proper TypeScript types for success case', async () => {
				// Arrange
				interface User {
					id: string
					email: string
					name: string
				}
				const user: User = {
					id: '123',
					email: 'test@example.com',
					name: 'Test',
				}
				const successPromise = Promise.resolve(user)

				// Act
				const result: Result<User> = await tryCatch(
					successPromise,
					'userService',
				)

				// Assert
				expect(result[0]).toEqual(user)
				expect(result[1]).toBeNull()
				// TypeScript should infer the correct types
				if (result[1] === null) {
					// result[0] should be User type
					expect(result[0].id).toBe('123')
					expect(result[0].email).toBe('test@example.com')
				}
			})

			it('should maintain proper TypeScript types for error case', async () => {
				// Arrange
				const error = new Error('Type test error')
				const rejectedPromise = Promise.reject(error)

				// Act
				const result: Result<string> = await tryCatch(
					rejectedPromise,
					'testService',
				)

				// Assert
				expect(result[0]).toBeNull()
				expect(result[1]).toBeInstanceOf(AppError)
				// TypeScript should infer the correct types
				if (result[1] !== null) {
					// result[1] should be AppError type
					expect(result[1].type).toBe(ErrorType.Error)
					expect(result[1].message).toBe('Type test error')
				}
			})
		})
	})

	describe('tryCatchSync', () => {
		describe('Success Cases', () => {
			it('should return [data, null] when function executes successfully', () => {
				// Arrange
				const testData = { config: 'value', setting: true }
				const successFunction = () => testData

				// Act
				const result: Result<typeof testData> = tryCatchSync(
					successFunction,
					'configService',
				)

				// Assert
				expect(result).toEqual([testData, null])
				expect(mockLogger.error).not.toHaveBeenCalled()
			})

			it('should return [data, null] with default context when no context provided', () => {
				// Arrange
				const testData = 'sync success result'
				const successFunction = () => testData

				// Act
				const result = tryCatchSync(successFunction)

				// Assert
				expect(result).toEqual([testData, null])
				expect(mockLogger.error).not.toHaveBeenCalled()
			})

			it('should handle different data types successfully', () => {
				// Arrange & Act & Assert
				const stringResult = tryCatchSync(() => 'test string')
				expect(stringResult).toEqual(['test string', null])

				const numberResult = tryCatchSync(() => 42)
				expect(numberResult).toEqual([42, null])

				const booleanResult = tryCatchSync(() => false)
				expect(booleanResult).toEqual([false, null])

				const arrayResult = tryCatchSync(() => ['a', 'b', 'c'])
				expect(arrayResult).toEqual([['a', 'b', 'c'], null])

				const objectResult = tryCatchSync(() => ({ sync: true }))
				expect(objectResult).toEqual([{ sync: true }, null])
			})

			it('should handle complex synchronous operations', () => {
				interface ResultData {
					parsed: { valid: string }
					timestamp: number
				}

				// Arrange
				const complexFunction = () => {
					const data = JSON.parse('{"valid": "json"}') as ResultData['parsed']
					return { parsed: data, timestamp: Date.now() } as ResultData
				}

				// Act
				const result = tryCatchSync(complexFunction, 'jsonService')

				// Assert
				expect(result[0]).toEqual({
					parsed: { valid: 'json' },
					timestamp: expect.any(Number) as number,
				})
				expect(result[1]).toBeNull()
			})
		})

		describe('Error Cases', () => {
			it('should return [null, AppError] when function throws Error', () => {
				// Arrange
				const originalError = new Error('Sync test error')
				const throwingFunction = () => {
					throw originalError
				}

				// Act
				const result = tryCatchSync(throwingFunction, 'syncTestService')

				// Assert
				expect(result[0]).toBeNull()
				expect(result[1]).toBeInstanceOf(AppError)
				expect(result[1]?.message).toBe('Sync test error')
				expect(result[1]?.service).toBe('syncTestService')
				expect(result[1]?.type).toBe(ErrorType.Error)
				expect(mockLogger.error).toHaveBeenCalledWith(
					'[syncTestService]: Sync test error',
				)
			})

			it('should handle JSON parsing errors', () => {
				// Arrange
				interface ParsedData {
					valid: string
				}

				const invalidJson = '{"invalid": json}'
				const jsonParsingFunction = () => JSON.parse(invalidJson) as ParsedData

				// Act
				const result = tryCatchSync(jsonParsingFunction, 'jsonService')

				// Assert
				expect(result[0]).toBeNull()
				expect(result[1]).toBeInstanceOf(AppError)
				expect(result[1]?.service).toBe('jsonService')
				expect(result[1]?.type).toBe(ErrorType.Error)
				expect(mockLogger.error).toHaveBeenCalled()
			})

			it('should handle Zod validation errors', () => {
				// Arrange
				const schema = z.object({ name: z.string(), age: z.number() })
				const invalidData = { name: 'John', age: 'not a number' }
				const validationFunction = () => schema.parse(invalidData)

				// Act
				const result = tryCatchSync(validationFunction, 'validationService')

				// Assert
				expect(result[0]).toBeNull()
				expect(result[1]).toBeInstanceOf(AppError)
				expect(result[1]?.service).toBe('validationService')
				expect(result[1]?.type).toBe(ErrorType.ZodError)
				expect(mockLogger.error).toHaveBeenCalled()
			})

			it('should use default context when error occurs without context', () => {
				// Arrange
				const originalError = new Error('Default context test')
				const throwingFunction = () => {
					throw originalError
				}

				// Act
				const result = tryCatchSync(throwingFunction)

				// Assert
				expect(result[0]).toBeNull()
				expect(result[1]).toBeInstanceOf(AppError)
				expect(result[1]?.message).toBe('Default context test')
				expect(result[1]?.service).toBe('unknown')
				expect(mockLogger.error).toHaveBeenCalledWith(
					'[unknown]: Default context test',
				)
			})
		})
	})
})
