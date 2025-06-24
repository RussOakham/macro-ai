import { type MockedFunction, vi } from 'vitest'

import { tryCatch, tryCatchSync } from '../error-handling/try-catch.ts'
import { AppError, Result } from '../errors.ts'

/**
 * Mock interfaces for error handling utilities
 * These interfaces provide type-safe mocking for tryCatch and tryCatchSync operations
 *
 * IMPLEMENTATION FOLLOWS TYPE INFERENCE PATTERN:
 * Types are inferred from the actual error handling utilities to ensure:
 * - Mock interfaces stay in sync with the real implementations
 * - TypeScript catches any mismatches between mocks and actual usage
 * - Automatic updates when error handling utilities change
 *
 * See: documentation/implementation/test-helpers-and-mocking-strategy.md
 */

/**
 * Infer the actual error handling utility types from the implementations
 * This ensures our mock types match the real function signatures
 */
type TryCatchType = typeof tryCatch
type TryCatchSyncType = typeof tryCatchSync

/**
 * Mock interface for error handling utilities
 * Inferred from the actual utility types for maximum type safety
 */
interface MockErrorHandling {
	tryCatch: MockedFunction<TryCatchType>
	tryCatchSync: MockedFunction<TryCatchSyncType>
}

/**
 * Factory function to create a mock error handling utilities object
 * All methods return basic vi.fn() mocks that can be configured per test
 * @returns MockErrorHandling with all methods as vi.fn()
 */
export const createErrorHandlingMock = (): MockErrorHandling => ({
	tryCatch: vi.fn(),
	tryCatchSync: vi.fn(),
})

/**
 * Mock factory for vi.mock() calls
 * Creates the complete module mock structure expected by the error handling module
 * @returns Object with tryCatch and tryCatchSync mocks for module mocking
 */
export const createErrorHandlingModuleMock = () => ({
	tryCatch: vi.fn(),
	tryCatchSync: vi.fn(),
})

/**
 * Setup function for beforeEach hooks
 * Clears all mocks and returns a fresh error handling mock
 * @returns Fresh MockErrorHandling instance
 */
export const setupErrorHandlingMock = (): MockErrorHandling => {
	vi.clearAllMocks()
	return createErrorHandlingMock()
}

/**
 * Helper function to create a success Result tuple
 * Useful for mocking successful operations
 * @param data - The data that should be returned in the success case
 * @returns Result tuple with [data, null]
 */
export const mockSuccessResult = <T>(data: T): Result<T> => [data, null]

/**
 * Helper function to create an error Result tuple
 * Useful for mocking error scenarios
 * @param error - The error that should be returned
 * @returns Result tuple with [null, error]
 */
export const mockErrorResult = <E extends AppError>(
	error: E,
): Result<never, E> => [null, error]

/**
 * Helper function to create a tryCatch mock with real implementation
 * Useful for testing actual error handling logic while still being able to spy on calls
 * @returns MockedFunction that behaves like the real tryCatch
 */
export const mockTryCatchWithRealImplementation =
	(): MockedFunction<TryCatchType> => {
		const mockTryCatch = vi.fn() as MockedFunction<TryCatchType>
		mockTryCatch.mockImplementation(
			async <T>(
				promise: Promise<T>,
				context = 'unknown',
			): Promise<Result<T>> => {
				try {
					const data = await promise
					return [data, null]
				} catch (error: unknown) {
					const appError = AppError.from(error, context)
					return [null, appError]
				}
			},
		)
		return mockTryCatch
	}

/**
 * Helper function to create a tryCatchSync mock with real implementation
 * Useful for testing actual error handling logic while still being able to spy on calls
 * @returns MockedFunction that behaves like the real tryCatchSync
 */
export const mockTryCatchSyncWithRealImplementation =
	(): MockedFunction<TryCatchSyncType> => {
		const mockTryCatchSync = vi.fn() as MockedFunction<TryCatchSyncType>
		mockTryCatchSync.mockImplementation(
			<T>(func: () => T, context = 'unknown'): Result<T> => {
				try {
					const data = func()
					return [data, null]
				} catch (error: unknown) {
					const appError = AppError.from(error, context)
					return [null, appError]
				}
			},
		)
		return mockTryCatchSync
	}

/**
 * Helper function to create common error scenarios for testing
 * Provides standardized error objects for consistent testing
 */
export const createErrorScenarios = {
	/**
	 * Creates a validation error scenario
	 * @param message - Error message
	 * @param details - Optional validation details
	 * @param service - Service context
	 * @returns AppError with validation type
	 */
	validation: (
		message = 'Validation failed',
		details?: unknown,
		service = 'test',
	): AppError => AppError.validation(message, details, service),

	/**
	 * Creates a not found error scenario
	 * @param message - Error message
	 * @param service - Service context
	 * @returns AppError with not found type
	 */
	notFound: (message = 'Resource not found', service = 'test'): AppError =>
		AppError.notFound(message, service),

	/**
	 * Creates an unauthorized error scenario
	 * @param message - Error message
	 * @param service - Service context
	 * @returns AppError with unauthorized type
	 */
	unauthorized: (message = 'Unauthorized', service = 'test'): AppError =>
		AppError.unauthorized(message, service),

	/**
	 * Creates an internal error scenario
	 * @param message - Error message
	 * @param service - Service context
	 * @returns AppError with internal type
	 */
	internal: (message = 'Internal server error', service = 'test'): AppError =>
		AppError.internal(message, service),

	/**
	 * Creates a conflict error scenario
	 * @param message - Error message
	 * @param service - Service context
	 * @returns AppError with conflict type
	 */
	conflict: (message = 'Resource conflict', service = 'test'): AppError =>
		AppError.conflict(message, service),
}

/**
 * Unified export object providing all error handling mock utilities
 * Follows the pattern established by logger.mock.ts and express-mocks.ts
 */
export const mockErrorHandling = {
	/** Create a basic error handling mock with all methods */
	create: createErrorHandlingMock,
	/** Create module mock for vi.mock() calls */
	createModule: createErrorHandlingModuleMock,
	/** Setup error handling mock for beforeEach hooks */
	setup: setupErrorHandlingMock,

	// Result helpers
	/** Create success Result tuple */
	successResult: mockSuccessResult,
	/** Create error Result tuple */
	errorResult: mockErrorResult,

	// Real implementation helpers
	/** Create tryCatch mock with real implementation */
	withRealTryCatch: mockTryCatchWithRealImplementation,
	/** Create tryCatchSync mock with real implementation */
	withRealTryCatchSync: mockTryCatchSyncWithRealImplementation,

	// Error scenario creators
	/** Create common error scenarios for testing */
	errors: createErrorScenarios,
}

// Export types for use in test files
export type { MockErrorHandling }
