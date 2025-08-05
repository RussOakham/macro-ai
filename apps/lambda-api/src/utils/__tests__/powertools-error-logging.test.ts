/* eslint-disable @typescript-eslint/unbound-method */
/**
 * Tests for Powertools Error Logging Utilities
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { AppError } from '../errors.js'
import {
	logAppError,
	logGenericError,
	logOperationStart,
	logOperationSuccess,
	logResultError,
	type Result,
	resultFromPromise,
	resultFromSync,
} from '../powertools-error-logging.js'
// Import the mocked module to get reference to the mock function
import * as powertoolsLogger from '../powertools-logger.js'

// Mock Powertools Logger to suppress console output during tests
vi.mock('../powertools-logger.js', () => ({
	logger: {
		debug: vi.fn(),
		info: vi.fn(),
		warn: vi.fn(),
		error: vi.fn(),
		critical: vi.fn(),
		createChild: vi.fn().mockReturnValue({
			debug: vi.fn(),
			info: vi.fn(),
			warn: vi.fn(),
			error: vi.fn(),
			critical: vi.fn(),
		}),
	},
}))

describe('Powertools Error Logging Utilities', () => {
	let mockLogger: ReturnType<typeof vi.mocked<typeof powertoolsLogger.logger>>

	beforeEach(() => {
		vi.clearAllMocks()
		// Get reference to the mocked logger
		mockLogger = vi.mocked(powertoolsLogger.logger)
	})

	afterEach(() => {
		vi.resetAllMocks()
	})

	describe('logResultError', () => {
		it('should log error when Result contains error', () => {
			// Arrange
			const error = new Error('Test error')
			const result: Result<string> = [null, error]

			// Act
			logResultError(result, 'testOperation', { userId: '123' })

			// Assert
			expect(mockLogger.error).toHaveBeenCalledWith(
				'Operation failed',
				expect.objectContaining({
					operation: 'testOperation',
					error: 'Test error',
					errorType: 'Error',
					stack: expect.any(String) as string,
					userId: '123',
				}),
			)
		})

		it('should not log when Result contains success', () => {
			// Arrange
			const result: Result<string> = ['success', null]

			// Act
			logResultError(result, 'testOperation')

			// Assert
			expect(mockLogger.error).not.toHaveBeenCalled()
		})
	})

	describe('logAppError', () => {
		it('should log server errors with error level', () => {
			// Arrange
			const appError = new AppError({ message: 'Server error', status: 500 })

			// Act
			logAppError(appError, 'serverOperation', { requestId: 'req-123' })

			// Assert
			expect(mockLogger.error).toHaveBeenCalledWith(
				'Server error occurred',
				expect.objectContaining({
					operation: 'serverOperation',
					error: 'Server error',
					errorType: 'AppError',
					statusCode: 500,
					service: 'unknown',
					requestId: 'req-123',
				}),
			)
		})

		it('should log client errors with warn level', () => {
			// Arrange
			const appError = new AppError({ message: 'Bad request', status: 400 })

			// Act
			logAppError(appError, 'clientOperation')

			// Assert
			expect(mockLogger.warn).toHaveBeenCalledWith(
				'Client error occurred',
				expect.objectContaining({
					operation: 'clientOperation',
					error: 'Bad request',
					statusCode: 400,
					service: 'unknown',
				}),
			)
		})

		it('should log other errors with info level', () => {
			// Arrange
			const appError = new AppError({ message: 'Redirect', status: 302 })

			// Act
			logAppError(appError, 'redirectOperation')

			// Assert
			expect(mockLogger.info).toHaveBeenCalledWith(
				'Application error occurred',
				expect.objectContaining({
					operation: 'redirectOperation',
					error: 'Redirect',
					statusCode: 302,
					service: 'unknown',
				}),
			)
		})
	})

	describe('logGenericError', () => {
		it('should log generic errors with error level', () => {
			// Arrange
			const error = new TypeError('Type error')

			// Act
			logGenericError(error, 'typeOperation', { data: 'test' })

			// Assert
			expect(mockLogger.error).toHaveBeenCalledWith(
				'Unexpected error occurred',
				expect.objectContaining({
					operation: 'typeOperation',
					error: 'Type error',
					errorType: 'TypeError',
					stack: expect.any(String) as string,
					data: 'test',
				}),
			)
		})
	})

	describe('resultFromPromise', () => {
		it('should return success result and not log for successful promise', async () => {
			// Arrange
			const successPromise = Promise.resolve('success data')

			// Act
			const result = await resultFromPromise(
				successPromise,
				'promiseOperation',
				{ id: '123' },
			)

			// Assert
			expect(result).toEqual(['success data', null])
			expect(mockLogger.error).not.toHaveBeenCalled()
		})

		it('should return error result and log for failed promise', async () => {
			// Arrange
			const failedPromise = Promise.reject(new Error('Promise failed'))

			// Act
			const result = await resultFromPromise(
				failedPromise,
				'promiseOperation',
				{ id: '123' },
			)

			// Assert
			expect(result[0]).toBeNull()
			expect(result[1]).toBeInstanceOf(Error)
			expect(result[1]?.message).toBe('Promise failed')

			expect(mockLogger.error).toHaveBeenCalledWith(
				'Unexpected error occurred',
				expect.objectContaining({
					operation: 'promiseOperation',
					error: 'Promise failed',
					errorType: 'Error',
					id: '123',
				}),
			)
		})

		it('should handle non-Error rejections', async () => {
			// Arrange

			const failedPromise = Promise.reject(new Error('String error'))

			// Act
			const result = await resultFromPromise(failedPromise, 'stringErrorOp')

			// Assert
			expect(result[0]).toBeNull()
			expect(result[1]).toBeInstanceOf(Error)
			expect(result[1]?.message).toBe('String error')

			expect(mockLogger.error).toHaveBeenCalledWith(
				'Unexpected error occurred',
				expect.objectContaining({
					operation: 'stringErrorOp',
					error: 'String error',
					errorType: 'Error',
				}),
			)
		})
	})

	describe('resultFromSync', () => {
		it('should return success result and not log for successful function', () => {
			// Arrange
			const successFn = () => 'sync success'

			// Act
			const result = resultFromSync(successFn, 'syncOperation', {
				type: 'test',
			})

			// Assert
			expect(result).toEqual(['sync success', null])
			expect(mockLogger.error).not.toHaveBeenCalled()
		})

		it('should return error result and log for failed function', () => {
			// Arrange
			const failedFn = () => {
				throw new Error('Sync failed')
			}

			// Act
			const result = resultFromSync(failedFn, 'syncOperation', { type: 'test' })

			// Assert
			expect(result[0]).toBeNull()
			expect(result[1]).toBeInstanceOf(Error)
			expect(result[1]?.message).toBe('Sync failed')

			expect(mockLogger.error).toHaveBeenCalledWith(
				'Unexpected error occurred',
				expect.objectContaining({
					operation: 'syncOperation',
					error: 'Sync failed',
					errorType: 'Error',
					type: 'test',
				}),
			)
		})
	})

	describe('logOperationSuccess', () => {
		it('should log successful operations with info level', () => {
			// Act
			logOperationSuccess('successOperation', { duration: 150, userId: '456' })

			// Assert
			expect(mockLogger.info).toHaveBeenCalledWith(
				'Operation completed successfully',
				expect.objectContaining({
					operation: 'successOperation',
					duration: 150,
					userId: '456',
				}),
			)
		})
	})

	describe('logOperationStart', () => {
		it('should log operation start with debug level', () => {
			// Act
			logOperationStart('startOperation', { requestId: 'req-789' })

			// Assert
			expect(mockLogger.debug).toHaveBeenCalledWith(
				'Operation started',
				expect.objectContaining({
					operation: 'startOperation',
					requestId: 'req-789',
				}),
			)
		})
	})
})
