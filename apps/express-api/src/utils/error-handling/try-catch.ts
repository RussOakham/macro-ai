import { AppError, Result } from '../errors.ts'
import { pino } from '../logger.ts'

const { logger } = pino

/**
 * Wraps an async operation in a try-catch block and returns a Go-style Result tuple
 * @param promise - The promise to be executed
 * @param context - The context/service name for error logging (defaults to 'unknown')
 * @returns A Result tuple containing either [data, null] or [null, error]
 *
 * @example
 * const [user, error] = await tryCatch(
 *   userRepository.findUserById({ id }),
 *   'userService - getUserById'
 * )
 *
 * if (error) {
 *   return [null, error]
 * }
 *
 * return [user, null]
 */
const tryCatch = async <T>(
	promise: Promise<T>,
	context = 'unknown',
): Promise<Result<T>> => {
	try {
		const data = await promise
		return [data, null]
	} catch (error: unknown) {
		const appError = AppError.from(error, context)
		logger.error(`[${context}]: ${appError.message}`)
		return [null, appError]
	}
}

/**
 * Synchronous version of tryCatch that wraps a function in a try-catch block and returns a Go-style Result tuple
 * @param func - The function to be executed
 * @param context - The context/service name for error logging (defaults to 'unknown')
 * @returns A Result tuple containing either [data, null] or [null, error]
 *
 * @example
 * const [config, error] = tryCatchSync(
 *   () => parseConfig(configFile),
 *   'configService - loadConfig'
 * )
 *
 * if (error) {
 *   return [null, error]
 * }
 *
 * return [config, null]
 */
const tryCatchSync = <T>(func: () => T, context = 'unknown'): Result<T> => {
	try {
		const data = func()
		return [data, null]
	} catch (error: unknown) {
		const appError = AppError.from(error, context)
		logger.error(`[${context}]: ${appError.message}`)
		return [null, appError]
	}
}

export { tryCatch, tryCatchSync }
