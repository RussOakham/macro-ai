import { beforeEach, describe, expect, it, vi } from 'vitest'

import { AppError, ErrorType } from '../../errors.ts'
import {
	createErrorHandlingMock,
	createErrorHandlingModuleMock,
	createErrorScenarios,
	type MockErrorHandling,
	mockErrorHandling,
	mockErrorResult,
	mockSuccessResult,
	mockTryCatchSyncWithRealImplementation,
	mockTryCatchWithRealImplementation,
	setupErrorHandlingMock,
} from '../error-handling.mock.ts'

describe('Error Handling Mock Helper', () => {
	describe('createErrorHandlingMock', () => {
		it('should create mock with all required methods', () => {
			// Act
			const mock = createErrorHandlingMock()

			// Assert
			expect(mock).toHaveProperty('tryCatch')
			expect(mock).toHaveProperty('tryCatchSync')
			expect(vi.isMockFunction(mock.tryCatch)).toBe(true)
			expect(vi.isMockFunction(mock.tryCatchSync)).toBe(true)
		})

		it('should create fresh mocks each time', () => {
			// Act
			const mock1 = createErrorHandlingMock()
			const mock2 = createErrorHandlingMock()

			// Assert
			expect(mock1.tryCatch).not.toBe(mock2.tryCatch)
			expect(mock1.tryCatchSync).not.toBe(mock2.tryCatchSync)
		})
	})

	describe('createErrorHandlingModuleMock', () => {
		it('should create module mock with correct structure', () => {
			// Act
			const moduleMock = createErrorHandlingModuleMock()

			// Assert
			expect(moduleMock).toHaveProperty('tryCatch')
			expect(moduleMock).toHaveProperty('tryCatchSync')
			expect(vi.isMockFunction(moduleMock.tryCatch)).toBe(true)
			expect(vi.isMockFunction(moduleMock.tryCatchSync)).toBe(true)
		})
	})

	// eslint-disable-next-line no-secrets/no-secrets
	describe('setupErrorHandlingMock', () => {
		let mock: MockErrorHandling

		beforeEach(() => {
			mock = setupErrorHandlingMock()
		})

		it('should create fresh mock and clear all mocks', async () => {
			// Arrange - Call a mock method to create call history
			mock.tryCatch.mockResolvedValue([null, new AppError({ message: 'test' })])
			await mock.tryCatch(Promise.resolve('test-data'), 'test-context')

			// Act - Setup again
			const newMock = setupErrorHandlingMock()

			// Assert
			expect(newMock).toHaveProperty('tryCatch')
			expect(newMock).toHaveProperty('tryCatchSync')
			expect(vi.isMockFunction(newMock.tryCatch)).toBe(true)
			expect(vi.isMockFunction(newMock.tryCatchSync)).toBe(true)
		})
	})

	describe('mockSuccessResult', () => {
		it('should create success result tuple with correct structure', () => {
			// Arrange
			const testData = { id: 1, name: 'test' }

			// Act
			const result = mockSuccessResult(testData)

			// Assert
			expect(result).toEqual([testData, null])
			expect(result[0]).toBe(testData)
			expect(result[1]).toBeNull()
		})

		it('should work with different data types', () => {
			// Test with string
			const stringResult = mockSuccessResult('test string')
			expect(stringResult).toEqual(['test string', null])

			// Test with number
			const numberResult = mockSuccessResult(42)
			expect(numberResult).toEqual([42, null])

			// Test with array
			const arrayResult = mockSuccessResult([1, 2, 3])
			expect(arrayResult).toEqual([[1, 2, 3], null])
		})
	})

	describe('mockErrorResult', () => {
		it('should create error result tuple with correct structure', () => {
			// Arrange
			const testError = new AppError({ message: 'Test error' })

			// Act
			const result = mockErrorResult(testError)

			// Assert
			expect(result).toEqual([null, testError])
			expect(result[0]).toBeNull()
			expect(result[1]).toBe(testError)
		})

		it('should work with different AppError types', () => {
			// Test with validation error
			const validationError = AppError.validation('Invalid input')
			const validationResult = mockErrorResult(validationError)
			expect(validationResult).toEqual([null, validationError])

			// Test with not found error
			const notFoundError = AppError.notFound('Resource not found')
			const notFoundResult = mockErrorResult(notFoundError)
			expect(notFoundResult).toEqual([null, notFoundError])
		})
	})

	// eslint-disable-next-line no-secrets/no-secrets
	describe('mockTryCatchWithRealImplementation', () => {
		it('should return success result for successful promise', async () => {
			// Arrange
			const mockTryCatch = mockTryCatchWithRealImplementation()
			const successPromise = Promise.resolve('success data')

			// Act
			const result = await mockTryCatch(successPromise, 'test-context')

			// Assert
			expect(result).toEqual(['success data', null])
			expect(mockTryCatch).toHaveBeenCalledWith(successPromise, 'test-context')
		})

		it('should return error result for rejected promise', async () => {
			// Arrange
			const mockTryCatch = mockTryCatchWithRealImplementation()
			const errorPromise = Promise.reject(new Error('Test error'))

			// Act
			const result = await mockTryCatch(errorPromise, 'test-context')

			// Assert
			expect(result[0]).toBeNull()
			expect(result[1]).toBeInstanceOf(AppError)
			expect(result[1]!.message).toBe('Test error')
			expect(result[1]!.service).toBe('test-context')
		})

		it('should use default context when none provided', async () => {
			// Arrange
			const mockTryCatch = mockTryCatchWithRealImplementation()
			const errorPromise = Promise.reject(new Error('Test error'))

			// Act
			const result = await mockTryCatch(errorPromise)

			// Assert
			expect(result[0]).toBeNull()
			expect(result[1]).toBeInstanceOf(AppError)
			expect(result[1]!.service).toBe('unknown')
		})
	})

	// eslint-disable-next-line no-secrets/no-secrets
	describe('mockTryCatchSyncWithRealImplementation', () => {
		it('should return success result for successful function', () => {
			// Arrange
			const mockTryCatchSync = mockTryCatchSyncWithRealImplementation()
			const successFunc = () => 'success data'

			// Act
			const result = mockTryCatchSync(successFunc, 'test-context')

			// Assert
			expect(result).toEqual(['success data', null])
			expect(mockTryCatchSync).toHaveBeenCalledWith(successFunc, 'test-context')
		})

		it('should return error result for throwing function', () => {
			// Arrange
			const mockTryCatchSync = mockTryCatchSyncWithRealImplementation()
			const errorFunc = () => {
				throw new Error('Test error')
			}

			// Act
			const result = mockTryCatchSync(errorFunc, 'test-context')

			// Assert
			expect(result[0]).toBeNull()
			expect(result[1]).toBeInstanceOf(AppError)
			expect(result[1]!.message).toBe('Test error')
			expect(result[1]!.service).toBe('test-context')
		})

		it('should use default context when none provided', () => {
			// Arrange
			const mockTryCatchSync = mockTryCatchSyncWithRealImplementation()
			const errorFunc = () => {
				throw new Error('Test error')
			}

			// Act
			const result = mockTryCatchSync(errorFunc)

			// Assert
			expect(result[0]).toBeNull()
			expect(result[1]).toBeInstanceOf(AppError)
			expect(result[1]!.service).toBe('unknown')
		})
	})

	describe('createErrorScenarios', () => {
		it('should create validation error with correct properties', () => {
			// Act
			const error = createErrorScenarios.validation(
				'Invalid data',
				{ field: 'email' },
				'userService',
			)

			// Assert
			expect(error).toBeInstanceOf(AppError)
			expect(error.type).toBe(ErrorType.ValidationError)
			expect(error.message).toBe('Invalid data')
			expect(error.details).toEqual({ field: 'email' })
			expect(error.service).toBe('userService')
			expect(error.status).toBe(400)
		})

		it('should create not found error with correct properties', () => {
			// Act
			const error = createErrorScenarios.notFound(
				'User not found',
				'userService',
			)

			// Assert
			expect(error).toBeInstanceOf(AppError)
			expect(error.type).toBe(ErrorType.NotFoundError)
			expect(error.message).toBe('User not found')
			expect(error.service).toBe('userService')
			expect(error.status).toBe(404)
		})

		it('should create unauthorized error with correct properties', () => {
			// Act
			const error = createErrorScenarios.unauthorized(
				'Invalid token',
				'authService',
			)

			// Assert
			expect(error).toBeInstanceOf(AppError)
			expect(error.type).toBe(ErrorType.UnauthorizedError)
			expect(error.message).toBe('Invalid token')
			expect(error.service).toBe('authService')
			expect(error.status).toBe(401)
		})

		it('should create internal error with correct properties', () => {
			// Act
			const error = createErrorScenarios.internal(
				'Database connection failed',
				'dbService',
			)

			// Assert
			expect(error).toBeInstanceOf(AppError)
			expect(error.type).toBe(ErrorType.InternalError)
			expect(error.message).toBe('Database connection failed')
			expect(error.service).toBe('dbService')
			expect(error.status).toBe(500)
		})

		it('should create conflict error with correct properties', () => {
			// Act
			const error = createErrorScenarios.conflict(
				'Email already exists',
				'userService',
			)

			// Assert
			expect(error).toBeInstanceOf(AppError)
			expect(error.type).toBe(ErrorType.ConflictError)
			expect(error.message).toBe('Email already exists')
			expect(error.service).toBe('userService')
			expect(error.status).toBe(409)
		})

		it('should use default values when not provided', () => {
			// Act
			const validationError = createErrorScenarios.validation()
			const notFoundError = createErrorScenarios.notFound()
			const unauthorizedError = createErrorScenarios.unauthorized()
			const internalError = createErrorScenarios.internal()
			const conflictError = createErrorScenarios.conflict()

			// Assert
			expect(validationError.message).toBe('Validation failed')
			expect(validationError.service).toBe('test')

			expect(notFoundError.message).toBe('Resource not found')
			expect(notFoundError.service).toBe('test')

			expect(unauthorizedError.message).toBe('Unauthorized')
			expect(unauthorizedError.service).toBe('test')

			expect(internalError.message).toBe('Internal server error')
			expect(internalError.service).toBe('test')

			expect(conflictError.message).toBe('Resource conflict')
			expect(conflictError.service).toBe('test')
		})
	})

	describe('mockErrorHandling unified export', () => {
		it('should export all helper functions', () => {
			// Assert
			expect(mockErrorHandling.create).toBe(createErrorHandlingMock)
			expect(mockErrorHandling.createModule).toBe(createErrorHandlingModuleMock)
			expect(mockErrorHandling.setup).toBe(setupErrorHandlingMock)
			expect(mockErrorHandling.successResult).toBe(mockSuccessResult)
			expect(mockErrorHandling.errorResult).toBe(mockErrorResult)
			expect(mockErrorHandling.withRealTryCatch).toBe(
				mockTryCatchWithRealImplementation,
			)
			expect(mockErrorHandling.withRealTryCatchSync).toBe(
				mockTryCatchSyncWithRealImplementation,
			)
			expect(mockErrorHandling.errors).toBe(createErrorScenarios)
		})

		it('should provide consistent API for all mock helpers', () => {
			// Assert - Check that the unified export follows the established pattern
			expect(typeof mockErrorHandling.create).toBe('function')
			expect(typeof mockErrorHandling.createModule).toBe('function')
			expect(typeof mockErrorHandling.setup).toBe('function')
			expect(typeof mockErrorHandling.successResult).toBe('function')
			expect(typeof mockErrorHandling.errorResult).toBe('function')
			expect(typeof mockErrorHandling.withRealTryCatch).toBe('function')
			expect(typeof mockErrorHandling.withRealTryCatchSync).toBe('function')
			expect(typeof mockErrorHandling.errors).toBe('object')
		})
	})
})
