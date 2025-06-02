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

// Enhanced tryCatch with standardized errors
const tryCatch = async <T, E extends IStandardizedError = IStandardizedError>(
	promise: Promise<T>,
	context = 'unknown',
): Promise<EnhancedResult<T, E>> => {
	try {
		const data = await promise
		return { data, error: null }
	} catch (error: unknown) {
		const standardizedError = standardizeError(error) as E

		// Add context if not already present
		standardizedError.service ??= context

		logger.error(`[${context}]: ${standardizedError.message}`)
		return { data: null, error: standardizedError }
	}
}

export { type EnhancedResult, ErrorType, type IStandardizedError, tryCatch }
