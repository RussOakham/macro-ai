import { StatusCodes } from 'http-status-codes'
import { z } from 'zod'
import { fromError, isValidationError } from 'zod-validation-error'

interface IAppErrorParams {
	message: string
	status?: number
	type?: string
	details?: unknown
}

export class AppError extends Error {
	readonly type: string
	readonly status: number
	readonly details?: unknown

	constructor({
		message,
		status = StatusCodes.INTERNAL_SERVER_ERROR,
		type = 'AppError',
		details,
	}: IAppErrorParams) {
		super(message)
		this.name = this.constructor.name
		this.type = type
		this.status = status
		this.details = details

		// Maintains proper stack trace for where error was thrown (only available on V8)
		// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
		if (Error.captureStackTrace) {
			Error.captureStackTrace(this, this.constructor)
		}
	}

	/**
	 * Creates an AppError instance from an unknown error
	 * @param error The error to convert
	 * @returns AppError instance
	 */
	static from(error: unknown): AppError {
		if (error instanceof AppError) {
			return error
		}

		if (error instanceof z.ZodError) {
			const validationError = fromError(error)
			return new AppError({
				type: 'ValidationError',
				message: validationError.message,
				status: StatusCodes.BAD_REQUEST,
				details: validationError.details,
			})
		}

		if (isValidationError(error)) {
			return new AppError({
				type: 'ValidationError',
				message: error.message,
				status: StatusCodes.BAD_REQUEST,
				details: error.details,
			})
		}

		if (error instanceof Error) {
			return new AppError({
				message: error.message,
				status: StatusCodes.INTERNAL_SERVER_ERROR,
			})
		}

		return new AppError({
			message: 'An unknown error occurred',
			status: StatusCodes.INTERNAL_SERVER_ERROR,
		})
	}

	/**
	 * Creates a not found error
	 * @param message Optional custom message
	 * @returns AppError instance
	 */
	static notFound(message = 'Resource not found'): AppError {
		return new AppError({
			type: 'NotFoundError',
			message,
			status: StatusCodes.NOT_FOUND,
		})
	}

	/**
	 * Creates an unauthorized error
	 * @param message Optional custom message
	 * @returns AppError instance
	 */
	static unauthorized(message = 'Unauthorized'): AppError {
		return new AppError({
			type: 'UnauthorizedError',
			message,
			status: StatusCodes.UNAUTHORIZED,
		})
	}

	/**
	 * Creates a forbidden error
	 * @param message Optional custom message
	 * @returns AppError instance
	 */
	static forbidden(message = 'Forbidden'): AppError {
		return new AppError({
			type: 'ForbiddenError',
			message,
			status: StatusCodes.FORBIDDEN,
		})
	}

	/**
	 * Creates a validation error
	 * @param message Error message
	 * @param details Optional validation details
	 * @returns AppError instance
	 */
	static validation(message: string, details?: unknown): AppError {
		return new AppError({
			type: 'ValidationError',
			message,
			status: StatusCodes.BAD_REQUEST,
			details,
		})
	}

	/**
	 * Creates a conflict error
	 * @param message Optional custom message
	 * @returns AppError instance
	 */
	static conflict(message = 'Resource conflict'): AppError {
		return new AppError({
			type: 'ConflictError',
			message,
			status: StatusCodes.CONFLICT,
		})
	}
}

// Re-export standardizeError with AppError support
export const standardizeError = (err: unknown): IStandardizedError => {
	if (err instanceof AppError) {
		return {
			type: err.type,
			name: err.name,
			status: err.status,
			message: err.message,
			stack: err.stack ?? '',
			details: err.details,
		}
	}

	const standardError = standardizeError(err)
	return standardError
}

export interface IStandardizedError extends Error {
	type: string
	name: string
	status: number
	message: string
	stack: string
	details?: unknown
}
