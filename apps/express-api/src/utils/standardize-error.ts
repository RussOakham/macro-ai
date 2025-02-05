import { z } from 'zod'
import { fromError, isValidationError } from 'zod-validation-error'

interface ICognitoError {
	$fault: 'client' | 'server'
	$metadata: {
		httpStatusCode: number
		requestId: string
		extendedRequestId?: string
		cfId?: string
		attempts: number
		totalRetryDelay: number
	}
	__type: string
	message?: string
}

const isCognitoError = (error: unknown): error is ICognitoError => {
	return (
		typeof error === 'object' &&
		error !== null &&
		'$fault' in error &&
		'$metadata' in error &&
		'__type' in error
	)
}

const getCognitoErrorMessage = (error: ICognitoError): string => {
	if (error.message) {
		return error.message
	}

	// Map common Cognito error types to user-friendly messages
	switch (error.__type) {
		case 'UsernameExistsException':
			return 'User already exists'
		case 'UserNotConfirmedException':
			return 'User is not confirmed'
		case 'UserNotFoundException':
			return 'User not found'
		case 'NotAuthorizedException':
			return 'Invalid username or password'
		case 'CodeMismatchException':
			return 'Invalid verification code'
		case 'ExpiredCodeException':
			return 'Verification code has expired'
		default:
			return `Cognito error: ${error.__type}`
	}
}

interface IStandardizedError extends Error {
	type: string
	name: string
	status: number
	message: string
	stack: string
	details?: unknown
}

const standardizeError = (err: unknown): IStandardizedError => {
	if (isCognitoError(err)) {
		return {
			type: 'CognitoError',
			name: err.__type,
			status: err.$metadata.httpStatusCode,
			message: getCognitoErrorMessage(err),
			stack: '',
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
