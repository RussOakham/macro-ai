/**
 * Powertools Error Logging Utilities
 * Integrates AWS Lambda Powertools Logger with Go-style error handling patterns
 */

import type { AppError } from './errors.js'
import { logger } from './powertools-logger.js'

/**
 * Type definition for Go-style Result tuple
 */
export type Result<T> = [T, null] | [null, Error]

/**
 * Log errors from Result<T> tuples using structured logging
 *
 * @param result - The Result tuple to check for errors
 * @param operation - The operation name for context
 * @param context - Additional context to include in the log
 * @returns void
 *
 * @example
 * ```typescript
 * const [data, error] = await someOperation()
 * logResultError([data, error], 'getUserData', { userId: '123' })
 * ```
 */
export const logResultError = <T>(
	result: Result<T>,
	operation: string,
	context?: Record<string, unknown>,
): void => {
	const [, error] = result

	if (error) {
		logger.error('Operation failed', {
			operation,
			error: error.message,
			errorType: error.constructor.name,
			stack: error.stack,
			...context,
		})
	}
}

/**
 * Log AppError instances using structured logging with appropriate log levels
 *
 * @param error - The AppError instance to log
 * @param operation - The operation name for context
 * @param context - Additional context to include in the log
 * @returns void
 *
 * @example
 * ```typescript
 * try {
 *   // some operation
 * } catch (error) {
 *   if (error instanceof AppError) {
 *     logAppError(error, 'processUserRequest', { userId: '123' })
 *   }
 * }
 * ```
 */
export const logAppError = (
	error: AppError,
	operation: string,
	context?: Record<string, unknown>,
): void => {
	const logData = {
		operation,
		error: error.message,
		errorType: error.constructor.name,
		statusCode: error.status,
		errorDetails: error.details,
		service: error.service,
		stack: error.stack,
		...context,
	}

	// Use different log levels based on error severity
	if (error.status >= 500) {
		// Server errors - use error level
		logger.error('Server error occurred', logData)
	} else if (error.status >= 400) {
		// Client errors - use warn level
		logger.warn('Client error occurred', logData)
	} else {
		// Other errors - use info level
		logger.info('Application error occurred', logData)
	}
}

/**
 * Log generic Error instances using structured logging
 *
 * @param error - The Error instance to log
 * @param operation - The operation name for context
 * @param context - Additional context to include in the log
 * @returns void
 *
 * @example
 * ```typescript
 * try {
 *   // some operation
 * } catch (error) {
 *   logGenericError(error, 'processData', { dataId: '456' })
 * }
 * ```
 */
export const logGenericError = (
	error: Error,
	operation: string,
	context?: Record<string, unknown>,
): void => {
	logger.error('Unexpected error occurred', {
		operation,
		error: error.message,
		errorType: error.constructor.name,
		stack: error.stack,
		...context,
	})
}

/**
 * Create a Result tuple from a promise, automatically logging errors
 *
 * @param promise - The promise to wrap
 * @param operation - The operation name for logging context
 * @param context - Additional context to include in error logs
 * @returns Promise<Result<T>> - A promise that resolves to a Result tuple
 *
 * @example
 * ```typescript
 * const [data, error] = await resultFromPromise(
 *   fetchUserData(userId),
 *   'fetchUserData',
 *   { userId }
 * )
 *
 * if (error) {
 *   // Error was already logged
 *   return createErrorResponse(500, 'Failed to fetch user data')
 * }
 *
 * return createLambdaResponse(200, data)
 * ```
 */
export const resultFromPromise = async <T>(
	promise: Promise<T>,
	operation: string,
	context?: Record<string, unknown>,
): Promise<Result<T>> => {
	try {
		const data = await promise
		return [data, null]
	} catch (error) {
		const err = error instanceof Error ? error : new Error(String(error))

		// Log the error with context
		logGenericError(err, operation, context)

		return [null, err]
	}
}

/**
 * Wrap a synchronous function to return a Result tuple, automatically logging errors
 *
 * @param fn - The function to wrap
 * @param operation - The operation name for logging context
 * @param context - Additional context to include in error logs
 * @returns Result<T> - A Result tuple
 *
 * @example
 * ```typescript
 * const [parsed, error] = resultFromSync(
 *   () => JSON.parse(jsonString),
 *   'parseJsonData',
 *   { source: 'userInput' }
 * )
 *
 * if (error) {
 *   // Error was already logged
 *   return createErrorResponse(400, 'Invalid JSON format')
 * }
 * ```
 */
export const resultFromSync = <T>(
	fn: () => T,
	operation: string,
	context?: Record<string, unknown>,
): Result<T> => {
	try {
		const data = fn()
		return [data, null]
	} catch (error) {
		const err = error instanceof Error ? error : new Error(String(error))

		// Log the error with context
		logGenericError(err, operation, context)

		return [null, err]
	}
}

/**
 * Log successful operations for audit trails and debugging
 *
 * @param operation - The operation name
 * @param context - Context data to include in the log
 * @returns void
 *
 * @example
 * ```typescript
 * const [user, error] = await getUserById(userId)
 * if (!error) {
 *   logOperationSuccess('getUserById', {
 *     userId,
 *     userEmail: user.email,
 *     duration: Date.now() - startTime
 *   })
 * }
 * ```
 */
export const logOperationSuccess = (
	operation: string,
	context?: Record<string, unknown>,
): void => {
	logger.info('Operation completed successfully', {
		operation,
		...context,
	})
}

/**
 * Log operation start for debugging and performance monitoring
 *
 * @param operation - The operation name
 * @param context - Context data to include in the log
 * @returns void
 *
 * @example
 * ```typescript
 * logOperationStart('processUserData', { userId, requestId })
 * const [result, error] = await processUserData(userId)
 * ```
 */
export const logOperationStart = (
	operation: string,
	context?: Record<string, unknown>,
): void => {
	logger.debug('Operation started', {
		operation,
		...context,
	})
}
