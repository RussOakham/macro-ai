import { StatusCodes } from 'http-status-codes'
import { z } from 'zod'
import { fromError, isValidationError } from 'zod-validation-error'

// Define an enum for error types - moved from standardize-error.ts
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

// Standardized error interface
export interface IStandardizedError extends Error {
	type: ErrorType
	name: string
	status: number
	message: string
	stack: string
	details?: unknown
	service?: string
}

interface IAppErrorParams {
	message: string
	status?: number
	type?: ErrorType
	details?: unknown
	service?: string
}

export class AppError extends Error implements IStandardizedError {
	readonly type: ErrorType
	readonly status: number
	readonly details?: unknown
	readonly service: string
	override readonly stack!: string

	constructor({
		message,
		status = StatusCodes.INTERNAL_SERVER_ERROR,
		type = ErrorType.ApiError,
		details,
		service = 'unknown',
	}: IAppErrorParams) {
		super(message)
		this.name = this.constructor.name
		this.type = type
		this.status = status
		this.details = details
		this.service = service

		Error.captureStackTrace(this, this.constructor)
	}

	/**
	 * Creates an AppError instance from an unknown error
	 * @param error The error to convert
	 * @returns AppError instance
	 */
	static from(error: unknown, service?: string): AppError {
		// Return as is if already an AppError
		if (error instanceof AppError) {
			return error
		}

		// Handle Cognito errors
		if (isCognitoError(error)) {
			return new AppError({
				type: ErrorType.CognitoError,
				message: getCognitoErrorMessage(error),
				status: error.$metadata.httpStatusCode,
				service,
			})
		}

		// Handle Zod errors
		if (error instanceof z.ZodError) {
			const validationError = fromError(error)
			return new AppError({
				type: ErrorType.ZodError,
				message: validationError.message,
				status: StatusCodes.BAD_REQUEST,
				details: validationError.details,
				service,
			})
		}

		// Handle Zod validation errors
		if (isValidationError(error)) {
			return new AppError({
				type: ErrorType.ZodValidationError,
				message: error.message,
				status: StatusCodes.BAD_REQUEST,
				details: error.details,
				service,
			})
		}

		// Handle standard errors
		if (error instanceof Error) {
			return new AppError({
				type: ErrorType.Error,
				message: error.message,
				status: StatusCodes.INTERNAL_SERVER_ERROR,
				service,
			})
		}

		// Handle unknown errors
		return new AppError({
			type: ErrorType.UnknownError,
			message: 'An unknown error occurred',
			status: StatusCodes.INTERNAL_SERVER_ERROR,
			service,
		})
	}

	/**
	 * Creates a not found error
	 * @param message Optional custom message
	 * @returns AppError instance
	 */
	static notFound(message = 'Resource not found', service?: string): AppError {
		return new AppError({
			type: ErrorType.NotFoundError,
			message,
			status: StatusCodes.NOT_FOUND,
			service,
		})
	}

	/**
	 * Creates an unauthorized error
	 * @param message Optional custom message
	 * @returns AppError instance
	 */
	static unauthorized(message = 'Unauthorized', service?: string): AppError {
		return new AppError({
			type: ErrorType.UnauthorizedError,
			message,
			status: StatusCodes.UNAUTHORIZED,
			service,
		})
	}

	/**
	 * Creates a forbidden error
	 * @param message Optional custom message
	 * @returns AppError instance
	 */
	static forbidden(message = 'Forbidden', service?: string): AppError {
		return new AppError({
			type: ErrorType.ForbiddenError,
			message,
			status: StatusCodes.FORBIDDEN,
			service,
		})
	}

	/**
	 * Creates a validation error
	 * @param message Error message
	 * @param details Optional validation details
	 * @returns AppError instance
	 */
	static validation(
		message: string,
		details?: unknown,
		service?: string,
	): AppError {
		return new AppError({
			type: ErrorType.ValidationError,
			message,
			status: StatusCodes.BAD_REQUEST,
			details,
			service,
		})
	}

	/**
	 * Creates a conflict error
	 * @param message Optional custom message
	 * @returns AppError instance
	 */
	static conflict(message = 'Resource conflict', service?: string): AppError {
		return new AppError({
			type: ErrorType.ConflictError,
			message,
			status: StatusCodes.CONFLICT,
			service,
		})
	}

	/**
	 * Creates an internal server error
	 * @param message Optional custom message
	 * @returns AppError instance
	 */
	static internal(
		message = 'Internal server error',
		service?: string,
	): AppError {
		return new AppError({
			type: ErrorType.InternalError,
			message,
			status: StatusCodes.INTERNAL_SERVER_ERROR,
			service,
		})
	}

	/**
	 * Converts this AppError to a standardized error object
	 * @returns Standardized error object
	 */
	toStandardized(): IStandardizedError {
		return {
			type: this.type,
			name: this.name,
			status: this.status,
			message: this.message,
			stack: this.stack,
			details: this.details,
			service: this.service,
		}
	}
}

// Cognito error handling - moved from standardize-error.ts
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

/**
 * Standardizes any error into a consistent format
 * @param err The error to standardize
 * @returns A standardized error object
 */
export const standardizeError = (err: unknown): IStandardizedError => {
	// If it's already an AppError, convert it to standardized format
	if (err instanceof AppError) {
		return err.toStandardized()
	}

	// Otherwise, create an AppError and then convert it
	return AppError.from(err).toStandardized()
}
