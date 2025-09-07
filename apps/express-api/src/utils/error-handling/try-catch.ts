import { AppError, Result } from '../errors.ts'
import { pino } from '../logger.ts'

const { logger } = pino

/**
 * Wraps an async operation in a try-catch block and returns a Go-style Result tuple
 * @param promiseOrFunction - The promise or function to be executed
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
	promiseOrFunction: Promise<T> | (() => Promise<T>),
	context = 'unknown',
): Promise<Result<T>> => {
	try {
		const promise =
			typeof promiseOrFunction === 'function'
				? promiseOrFunction()
				: promiseOrFunction
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

/**
 * Specialized wrapper for streaming operations that processes chunks immediately
 * while maintaining Go-style error handling. This prevents buffering issues
 * where the entire stream must complete before any data is sent to the client.
 *
 * @param stream - The AsyncIterable stream to process
 * @param onChunk - Function to process each chunk immediately (enables streaming)
 * @param context - The context/service name for error logging (defaults to 'unknown')
 * @returns A Result tuple containing either [accumulated_content, null] or [null, error]
 *
 * @example
 * const [fullResponse, error] = await tryCatchStream(
 *   aiResponseStream,
 *   (chunk) => res.write(chunk), // Immediate processing for streaming
 *   'chatController - streamResponse'
 * )
 *
 * if (error) {
 *   return [null, error]
 * }
 *
 * // fullResponse contains the complete accumulated content
 * await saveMessageContent(fullResponse)
 */
const tryCatchStream = async <T>(
	stream: AsyncIterable<T>,
	onChunk: (chunk: T) => void,
	context = 'unknown',
): Promise<Result<string>> => {
	let accumulated = ''
	try {
		for await (const chunk of stream) {
			// Process chunk immediately - this enables real-time streaming
			onChunk(chunk)
			// Accumulate for final result
			accumulated += String(chunk)
		}
		return [accumulated, null]
	} catch (error: unknown) {
		const appError = AppError.from(error, context)
		logger.error(`[${context}]: ${appError.message}`)
		return [null, appError]
	}
}

export { tryCatch, tryCatchStream, tryCatchSync }
