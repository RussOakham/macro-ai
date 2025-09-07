import type { IStandardizedError } from '@/lib/types'

import { standardizeError } from '@/lib/errors/standardize-error'
import { logger } from '@/lib/logger/logger'

// Go-style Result type for client-side error handling
export type Result<T, E = IStandardizedError> = [T, null] | [null, E]

/**
 * Client-side wrapper for async operations using Go-style error handling
 * Integrates with our standardized error handling patterns
 *
 * @param promise - The promise to be executed
 * @param context - The context/service name for error logging (defaults to 'unknown')
 * @returns A Result tuple containing either [data, null] or [null, error]
 *
 * @example
 * const [response, error] = await tryCatch(
 *   userClient.get('/users'),
 *   'userService - fetchUsers'
 * )
 *
 * if (error) {
 *   logger.error('Failed to fetch users', { error })
 *   return
 * }
 *
 * // Use response safely
 * console.log(response.data)
 */
const tryCatch = async <T>(
	promise: Promise<T>,
	context = 'unknown',
): Promise<Result<T>> => {
	try {
		const data = await promise
		return [data, null]
	} catch (error: unknown) {
		const standardizedError = standardizeError(error)

		// Log error with context
		logger.error(
			{
				error: standardizedError,
				context,
			},
			`[${context}]: ${standardizedError.message}`,
		)

		return [null, standardizedError]
	}
}

/**
 * Client-side synchronous version of tryCatch for non-async operations
 *
 * @param func - The function to be executed
 * @param context - The context/service name for error logging (defaults to 'unknown')
 * @returns A Result tuple containing either [data, null] or [null, error]
 *
 * @example
 * const [parsedData, error] = tryCatchSync(
 *   () => JSON.parse(jsonString),
 *   'dataService - parseJSON'
 * )
 *
 * if (error) {
 *   logger.error('Failed to parse JSON', { error })
 *   return
 * }
 *
 * // Use parsedData safely
 * console.log(parsedData)
 */
const tryCatchSync = <T>(func: () => T, context = 'unknown'): Result<T> => {
	try {
		const data = func()
		return [data, null]
	} catch (error: unknown) {
		const standardizedError = standardizeError(error)

		// Log error with context
		logger.error(
			{
				error: standardizedError,
				context,
			},
			`[${context}]: ${standardizedError.message}`,
		)

		return [null, standardizedError]
	}
}

/**
 * Helper function to create a success Result tuple
 * Useful for consistent return patterns
 * @param data - The successful data to wrap in a Result tuple
 * @returns Result tuple with success data and null error
 */
export const ok = <T>(data: T): Result<T, never> => [data, null]

/**
 * Helper function to create an error Result tuple
 * Useful for consistent return patterns
 * @param error - The error to wrap in a Result tuple
 * @returns Result tuple with null data and error
 */
export const err = <E extends IStandardizedError>(
	error: E,
): Result<never, E> => [null, error]

export { tryCatch, tryCatchSync }
