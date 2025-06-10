import { ErrorType, IStandardizedError, standardizeError } from '../errors.ts'
import { pino } from '../logger.ts'

const { logger } = pino

// Types for the result object with discriminated union
interface Success<T> {
	data: T
	error: null
}

interface Failure<E extends IStandardizedError> {
	data: null
	error: E
}

type EnhancedResult<T, E extends IStandardizedError = IStandardizedError> =
	| Success<T>
	| Failure<E>

// Enhanced tryCatch with standardized errors and proper type narrowing
/**
 * Wraps an async operation in a try-catch block and returns a standardized result object
 * @param promise - The promise to be executed
 * @param context - The context/service name for error logging (defaults to 'unknown')
 * @returns An EnhancedResult object containing either the data or a standardized error
 *
 * @example
 * const { data: user, error } = await tryCatch(
 *   userRepository.findUserById({ id }),
 *   'userService - getUserById'
 * )
 *
 * if (error) {
 *   throw AppError.from(error, 'userService')
 * }
 *
 * return user
 */
const tryCatch = async <T, E extends IStandardizedError = IStandardizedError>(
	promise: Promise<T>,
	context = 'unknown',
): Promise<EnhancedResult<T, E>> => {
	try {
		const data = await promise
		return { data, error: null } as Success<T>
	} catch (error: unknown) {
		const standardizedError = standardizeError(error) as E

		// Add context if not already present
		standardizedError.service ??= context

		logger.error(`[${context}]: ${standardizedError.message}`)
		return { data: null, error: standardizedError } as Failure<E>
	}
}

/**
 * Synchronous version of tryCatch that wraps a function in a try-catch block and returns a standardized result object
 * @param func - The function to be executed
 * @param context - The context/service name for error logging (defaults to 'unknown')
 * @returns An EnhancedResult object containing either the data or a standardized error
 *
 * @example
 * const { data: config, error } = tryCatchSync(
 *   () => parseConfig(configFile),
 *   'configService - loadConfig'
 * )
 *
 * if (error) {
 *   throw AppError.from(error, 'configService')
 * }
 *
 * return config
 */
const tryCatchSync = <T, E extends IStandardizedError = IStandardizedError>(
	func: () => T,
	context = 'unknown',
): EnhancedResult<T, E> => {
	try {
		const data = func()
		return { data, error: null } as Success<T>
	} catch (error: unknown) {
		const standardizedError = standardizeError(error) as E

		// Add context if not already present
		standardizedError.service ??= context

		logger.error(`[${context}]: ${standardizedError.message}`)
		return { data: null, error: standardizedError } as Failure<E>
	}
}

export {
	type EnhancedResult,
	ErrorType,
	type IStandardizedError,
	tryCatch,
	tryCatchSync,
}
