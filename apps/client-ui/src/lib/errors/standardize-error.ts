import { AxiosError } from 'axios'
import { ZodError } from 'zod'

import { IStandardizedError } from '../types'

export const standardizeError = (error: unknown): IStandardizedError => {
	const standardError: IStandardizedError = {
		type: 'UnknownError',
		name: 'UnknownError',
		message: 'An unknown error occurred',
		status: 500,
		stack: '',
	}

	if (error instanceof AxiosError) {
		standardError.type = 'AxiosError'
		standardError.name = error.name
		standardError.message =
			(error.response?.data as { message?: string }).message ?? error.message
		standardError.status = error.response?.status ?? 500
		standardError.stack = error.stack ?? ''
		standardError.details = error.response?.data
	} else if (error instanceof ZodError) {
		standardError.type = 'ZodError'
		standardError.name = error.name
		standardError.message = error.errors[0]?.message ?? 'Validation error'
		standardError.status = 400
		standardError.stack = error.stack ?? ''
		standardError.details = error.errors
	} else if (error instanceof Error) {
		standardError.type = 'Error'
		standardError.name = error.name
		standardError.message = error.message
		standardError.stack = error.stack ?? ''
	}

	return standardError
}
