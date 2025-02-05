import { AxiosError } from 'axios'
import { z } from 'zod'
import { fromError, isValidationError } from 'zod-validation-error'

interface IStandardizedError extends Error {
	type: string
	name: string
	status: number
	message: string
	stack: string
	details?: unknown
}

const standardizeError = (err: unknown): IStandardizedError => {
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
