import { StatusCodes } from 'http-status-codes'
import { z } from 'zod'
import { fromError, isValidationError } from 'zod-validation-error'

interface IAppErrorParams {
	message: string
	status?: number
	type?: string
	details?: unknown
	service?: string
}

export class AppError extends Error {
	readonly type: string
	readonly status: number
	readonly details?: unknown
	readonly service: string

	constructor({
		message,
		status = StatusCodes.INTERNAL_SERVER_ERROR,
		type = 'AppError',
		details,
		service = 'unknown', // Default value
	}: IAppErrorParams) {
		super(message)
		this.name = this.constructor.name
		this.type = type
		this.status = status
		this.details = details
		this.service = service

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
	static from(error: unknown, service?: string): AppError {
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
				service,
			})
		}

		if (isValidationError(error)) {
			return new AppError({
				type: 'ValidationError',
				message: error.message,
				status: StatusCodes.BAD_REQUEST,
				details: error.details,
				service,
			})
		}

		if (error instanceof Error) {
			return new AppError({
				message: error.message,
				status: StatusCodes.INTERNAL_SERVER_ERROR,
				service,
			})
		}

		return new AppError({
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
			type: 'NotFoundError',
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
			type: 'UnauthorizedError',
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
			type: 'ForbiddenError',
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
			type: 'ValidationError',
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
			type: 'ConflictError',
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
			type: 'InternalError',
			message,
			status: StatusCodes.INTERNAL_SERVER_ERROR,
			service,
		})
	}
}
