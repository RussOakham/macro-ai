/**
 * Error Handling Test Helpers
 * Comprehensive utilities for testing Go-style error handling patterns
 */

import { expect, vi } from 'vitest'

import { AppError, ErrorType, Result } from '../errors.js'

/**
 * Mock tryCatch helper for testing
 */
export const createMockTryCatch = () => {
	const mockTryCatch = vi.fn()

	// Success scenario
	mockTryCatch.mockImplementation(
		async <T>(operation: () => Promise<T>): Promise<Result<T>> => {
			try {
				const result = await operation()
				return [result, null]
			} catch (error) {
				return [null, AppError.from(error, 'test')]
			}
		},
	)

	return mockTryCatch
}

/**
 * Mock tryCatchSync helper for testing
 */
export const createMockTryCatchSync = () => {
	const mockTryCatchSync = vi.fn()

	mockTryCatchSync.mockImplementation(<T>(operation: () => T): Result<T> => {
		try {
			const result = operation()
			return [result, null]
		} catch (error) {
			return [null, AppError.from(error, 'test')]
		}
	})

	return mockTryCatchSync
}

/**
 * Mock tryCatchAsync helper for testing
 */
export const createMockTryCatchAsync = () => {
	const mockTryCatchAsync = vi.fn()

	mockTryCatchAsync.mockImplementation(
		async <T>(operation: () => T | Promise<T>): Promise<Result<T>> => {
			try {
				const result = await operation()
				return [result, null]
			} catch (error) {
				return [null, AppError.from(error, 'test')]
			}
		},
	)

	return mockTryCatchAsync
}

/**
 * Error factory for creating test errors
 */
export const createTestError = (
	type: ErrorType = ErrorType.InternalError,
	message = 'Test error',
	overrides: Partial<ConstructorParameters<typeof AppError>[0]> = {},
): AppError => {
	return new AppError({
		message,
		type,
		status: 500,
		service: 'test-service',
		...overrides,
	})
}

/**
 * Common test error scenarios
 */
export const testErrorScenarios = {
	/** Validation error */
	validation: {
		name: 'validation error',
		error: createTestError(ErrorType.ValidationError, 'Invalid input', {
			status: 400,
		}),
		expectedStatus: 400,
		expectedType: ErrorType.ValidationError,
	},

	/** Configuration error */
	configuration: {
		name: 'configuration error',
		error: createTestError(
			ErrorType.ConfigurationError,
			'Invalid configuration',
			{ status: 500 },
		),
		expectedStatus: 500,
		expectedType: ErrorType.ConfigurationError,
	},

	/** Parameter store error */
	parameterStore: {
		name: 'parameter store error',
		error: createTestError(
			ErrorType.ParameterStoreError,
			'Parameter not found',
			{ status: 500 },
		),
		expectedStatus: 500,
		expectedType: ErrorType.ParameterStoreError,
	},

	/** Internal error */
	internal: {
		name: 'internal error',
		error: createTestError(ErrorType.InternalError, 'Internal server error', {
			status: 500,
		}),
		expectedStatus: 500,
		expectedType: ErrorType.InternalError,
	},

	/** API error */
	api: {
		name: 'api error',
		error: createTestError(ErrorType.ApiError, 'API error', { status: 500 }),
		expectedStatus: 500,
		expectedType: ErrorType.ApiError,
	},

	/** Generic JavaScript error */
	generic: {
		name: 'generic JavaScript error',
		error: new Error('Generic error'),
		expectedStatus: 500,
		expectedType: 'Error',
	},
}

/**
 * Result assertion helpers for Go-style error handling
 */
export const resultAssertions = {
	/** Assert successful result */
	expectSuccess: <T>(result: Result<T>, expectedValue?: T) => {
		const [data, error] = result
		expect(error).toBeNull()
		expect(data).toBeDefined()
		if (expectedValue !== undefined) {
			expect(data).toEqual(expectedValue)
		}
		return data as T
	},

	/** Assert error result */
	expectError: <T>(result: Result<T>, expectedError?: Error | string) => {
		const [data, error] = result
		expect(data).toBeNull()
		expect(error).toBeDefined()
		if (expectedError) {
			if (typeof expectedError === 'string') {
				expect(error?.message).toBe(expectedError)
			} else {
				expect(error).toEqual(expectedError)
			}
		}
		return error as Error
	},

	/** Assert AppError result */
	expectAppError: <T>(
		result: Result<T>,
		expectedType: ErrorType,
		expectedMessage?: string,
	) => {
		const [data, error] = result
		expect(data).toBeNull()
		expect(error).toBeInstanceOf(AppError)
		// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
		expect(error!.type).toBe(expectedType)
		if (expectedMessage) {
			expect(error?.message).toBe(expectedMessage)
		}
		// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
		return error!
	},
}

/**
 * Mock error handling middleware setup
 */
export const setupErrorHandlingMocks = () => {
	const mockTryCatch = createMockTryCatch()
	const mockTryCatchSync = createMockTryCatchSync()
	const mockTryCatchAsync = createMockTryCatchAsync()

	// Mock the error handling utilities
	vi.mock('../utils.js', () => ({
		tryCatch: mockTryCatch,
		tryCatchSync: mockTryCatchSync,
		tryCatchAsync: mockTryCatchAsync,
	}))

	return {
		tryCatch: mockTryCatch,
		tryCatchSync: mockTryCatchSync,
		tryCatchAsync: mockTryCatchAsync,
	}
}

/**
 * Error handling test scenarios for middleware
 */
export const errorHandlingTestScenarios = {
	/** Test successful operation */
	success: {
		name: 'successful operation',
		operation: () => Promise.resolve('success'),
		expectedResult: ['success', null],
	},

	/** Test operation that throws AppError */
	appError: {
		name: 'operation throws AppError',
		operation: () =>
			Promise.reject(
				createTestError(ErrorType.ValidationError, 'Validation failed'),
			),
		expectedError: ErrorType.ValidationError,
	},

	/** Test operation that throws generic Error */
	genericError: {
		name: 'operation throws generic Error',
		operation: () => Promise.reject(new Error('Generic error')),
		expectedError: 'Generic error',
	},

	/** Test operation that throws string */
	stringError: {
		name: 'operation throws string',
		operation: () => Promise.reject(new Error('String error')),
		expectedError: 'String error',
	},

	/** Test synchronous operation */
	syncSuccess: {
		name: 'synchronous successful operation',
		operation: () => 'sync success',
		expectedResult: ['sync success', null],
	},

	/** Test synchronous operation that throws */
	syncError: {
		name: 'synchronous operation throws',
		operation: () => {
			throw new Error('Sync error')
		},
		expectedError: 'Sync error',
	},
}

/**
 * Error classification test helpers
 */
export const errorClassificationHelpers = {
	/** Test error classification */
	testErrorClassification: (
		error: Error,
		expectedCategory: string,
		expectedSeverity: string,
	) => {
		// This would integrate with your error classification logic
		// For now, providing the structure for testing
		return {
			category: expectedCategory,
			severity: expectedSeverity,
			isRetryable: expectedCategory !== 'client_error',
		}
	},

	/** Test error response creation */
	testErrorResponse: (error: Error, expectedStatusCode: number) => {
		const isAppError = error instanceof AppError
		return {
			statusCode: isAppError ? error.status : expectedStatusCode,
			headers: {
				'x-lambda-error': 'true',
				'x-error-type': isAppError ? error.type : 'Error',
			},
			body: JSON.stringify({
				error: {
					message: error.message,
					type: isAppError ? error.type : 'Error',
				},
			}),
		}
	},
}

/**
 * Complete error handling test suite
 */
export interface ErrorHandlingTestSuite {
	tryCatch: ReturnType<typeof createMockTryCatch>
	tryCatchSync: ReturnType<typeof createMockTryCatchSync>
	tryCatchAsync: ReturnType<typeof createMockTryCatchAsync>
	createError: typeof createTestError
	scenarios: typeof testErrorScenarios
	assertions: typeof resultAssertions
}

export const createErrorHandlingTestSuite = (): ErrorHandlingTestSuite => {
	const mocks = setupErrorHandlingMocks()

	return {
		...mocks,
		createError: createTestError,
		scenarios: testErrorScenarios,
		assertions: resultAssertions,
	}
}
