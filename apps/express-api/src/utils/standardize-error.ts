import { z } from 'zod'
import { fromError, isValidationError } from 'zod-validation-error'

import { AppError } from './errors.ts'

// Define an enum for error types
export enum ErrorType {
	ApiError = 'ApiError',
	AxiosError = 'AxiosError',
	CognitoError = 'CognitoError',
	ZodValidationError = 'ZodValidationError',
	ZodError = 'ZodError',
	ValidationError = 'ValidationError',
	NotFoundError = 'NotFoundError',
	UnauthorizedError = 'UnauthorizedError',
	ForbiddenError = 'ForbiddenError',
	ConflictError = 'ConflictError',
	InternalError = 'InternalError',
	Error = 'Error',
	UnknownError = 'UnknownError',
}

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
	type: ErrorType
	name: string
	status: number
	message: string
	stack: string
	details?: unknown
	service?: string
}

const standardizeError = (err: unknown): IStandardizedError => {
	if (isCognitoError(err)) {
		return {
			type: ErrorType.CognitoError,
			name: err.__type,
			status: err.$metadata.httpStatusCode,
			message: getCognitoErrorMessage(err),
			stack: '',
		}
	}
	if (err instanceof z.ZodError) {
		const validationError = fromError(err)
		return {
			type: ErrorType.ZodError,
			name: validationError.name,
			status: 400,
			message: validationError.message,
			stack: validationError.stack ?? '',
			details: validationError.details,
		}
	}
	if (isValidationError(err)) {
		return {
			type: ErrorType.ZodValidationError,
			name: err.name,
			status: 400,
			message: err.message,
			stack: err.stack ?? '',
			details: err.details,
		}
	}
	if (err instanceof AppError) {
		// Map AppError types to ErrorType enum
		let errorType: ErrorType
		switch (err.type) {
			case 'ValidationError':
				errorType = ErrorType.ValidationError
				break
			case 'NotFoundError':
				errorType = ErrorType.NotFoundError
				break
			case 'UnauthorizedError':
				errorType = ErrorType.UnauthorizedError
				break
			case 'ForbiddenError':
				errorType = ErrorType.ForbiddenError
				break
			case 'ConflictError':
				errorType = ErrorType.ConflictError
				break
			case 'InternalError':
				errorType = ErrorType.InternalError
				break
			default:
				errorType = ErrorType.ApiError
		}

		return {
			type: errorType,
			name: err.name,
			status: err.status,
			message: err.message,
			stack: err.stack ?? '',
			details: err.details,
			service: err.service,
		}
	}

	if (err instanceof Error) {
		return {
			type: ErrorType.Error,
			name: err.name,
			status: 500,
			message: err.message,
			stack: err.stack ?? '',
		}
	}
	return {
		type: ErrorType.UnknownError,
		name: 'UnknownError',
		status: 500,
		message: 'An unknown error occurred.',
		stack: '',
	}
}

export { type IStandardizedError, standardizeError }
