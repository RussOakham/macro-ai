import { AxiosError } from 'axios'
import { z } from 'zod'
import { fromError, isValidationError } from 'zod-validation-error'

export type TErrorType =
	| 'ApiError'
	| 'AxiosError'
	| 'ZodValidationError'
	| 'ZodError'
	| 'Error'
	| 'UnknownError'
interface IStandardizedError extends Error {
	type: TErrorType
	name: string
	status: number
	message: string
	stack: string
	details?: unknown
}

interface IApiErrorDetails {
	message: string
	[key: string]: unknown // Allow additional properties with unknown type
}

const isApiErrorResponse = (
	error: unknown,
): error is AxiosError<IApiErrorDetails> => {
	// eslint-disable-next-line @typescript-eslint/no-unsafe-return
	return (
		error instanceof AxiosError &&
		error.response?.data &&
		typeof error.response.data === 'object' &&
		'message' in error.response.data
	)
}

const isApiErrorDetails = (data: unknown): data is IApiErrorDetails => {
	return (
		typeof data === 'object' &&
		data !== null &&
		'message' in data &&
		typeof (data as IApiErrorDetails).message === 'string'
	)
}

const standardizeError = (err: unknown): IStandardizedError => {
	if (isApiErrorResponse(err)) {
		const errorDetails =
			err.response && isApiErrorDetails(err.response.data)
				? err.response.data
				: { message: 'Oops something went wrong!' }

		return {
			type: 'ApiError',
			name: err.name,
			status: err.response?.status ?? 500,
			message: err.response?.data.message ?? err.message,
			stack: err.stack ?? '',
			details: errorDetails,
		}
	}
	if (err instanceof AxiosError) {
		return {
			type: 'AxiosError',
			name: err.name,
			status: err.response?.status ?? 500,
			message: err.message,
			stack: err.stack ?? '',
			details: err.response?.data,
		}
	}

	if (err instanceof z.ZodError) {
		const validationError = fromError(err)
		return {
			type: 'ZodError',
			name: validationError.name,
			status: 400,
			message: validationError.message,
			stack: validationError.stack ?? '',
			details: validationError.details,
		}
	}

	if (isValidationError(err)) {
		return {
			type: 'ZodValidationError',
			name: err.name,
			status: 400,
			message: err.message,
			stack: err.stack ?? '',
			details: err.details,
		}
	}

	if (err instanceof Error) {
		return {
			type: 'Error',
			name: err.name,
			status: 500,
			message: err.message,
			stack: err.stack ?? '',
		}
	}

	return {
		type: 'UnknownError',
		name: 'UnknownError',
		status: 500,
		message: 'An unknown error occurred.',
		stack: '',
	}
}

export { type IStandardizedError, standardizeError }
