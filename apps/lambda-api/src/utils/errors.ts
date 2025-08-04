/**
 * Error handling utilities for Lambda API
 * Provides standardized error types and Go-style Result pattern
 */

import { z } from 'zod'
import { fromZodError } from 'zod-validation-error'

// Error types enum
export enum ErrorType {
	ValidationError = 'ValidationError',
	ConfigurationError = 'ConfigurationError',
	ParameterStoreError = 'ParameterStoreError',
	InternalError = 'InternalError',
	ApiError = 'ApiError',
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
		status = 500,
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
	 * @param service The service context
	 * @returns AppError instance
	 */
	static from(error: unknown, service?: string): AppError {
		// Return as is if already an AppError
		if (error instanceof AppError) {
			return error
		}

		// Handle Zod errors
		if (error instanceof z.ZodError) {
			const validationError = fromZodError(error)
			return new AppError({
				type: ErrorType.ValidationError,
				message: validationError.message,
				status: 400,
				details: validationError.details,
				service,
			})
		}

		// Handle standard errors
		if (error instanceof Error) {
			return new AppError({
				type: ErrorType.InternalError,
				message: error.message,
				status: 500,
				details: { originalError: error.name },
				service,
			})
		}

		// Handle unknown errors
		return new AppError({
			type: ErrorType.InternalError,
			message: 'An unknown error occurred',
			status: 500,
			details: { originalError: String(error) },
			service,
		})
	}

	/**
	 * Creates a validation error
	 * @param message Error message
	 * @param details Optional validation details
	 * @param service Service context
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
			status: 400,
			details,
			service,
		})
	}

	/**
	 * Creates a configuration error
	 * @param message Error message
	 * @param details Optional configuration details
	 * @param service Service context
	 * @returns AppError instance
	 */
	static configuration(
		message: string,
		details?: unknown,
		service?: string,
	): AppError {
		return new AppError({
			type: ErrorType.ConfigurationError,
			message,
			status: 500,
			details,
			service,
		})
	}

	/**
	 * Creates a parameter store error
	 * @param message Error message
	 * @param details Optional parameter store details
	 * @param service Service context
	 * @returns AppError instance
	 */
	static parameterStore(
		message: string,
		details?: unknown,
		service?: string,
	): AppError {
		return new AppError({
			type: ErrorType.ParameterStoreError,
			message,
			status: 500,
			details,
			service,
		})
	}

	/**
	 * Creates an internal server error
	 * @param message Optional custom message
	 * @param service Service context
	 * @returns AppError instance
	 */
	static internal(
		message = 'Internal server error',
		service?: string,
	): AppError {
		return new AppError({
			type: ErrorType.InternalError,
			message,
			status: 500,
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

// Go-style Result type
export type Result<T, E = AppError> = [T, null] | [null, E]

// Helper functions for working with Result type
export const ok = <T>(data: T): Result<T, never> => [data, null]
export const err = <E extends AppError>(error: E): Result<never, E> => [
	null,
	error,
]

// Type guards for Result type
export const isOk = <T, E extends AppError>(
	result: Result<T, E>,
): result is [T, null] => {
	return result[1] === null
}

export const isErr = <T, E extends AppError>(
	result: Result<T, E>,
): result is [null, E] => {
	return result[1] !== null
}

/**
 * Wraps an async operation in a try-catch block and returns a Go-style Result tuple
 * @param promise - The promise to be executed
 * @param context - The context/service name for error logging (defaults to 'unknown')
 * @returns A Result tuple containing either [data, null] or [null, error]
 */
export const tryCatch = async <T>(
	promise: Promise<T>,
	context = 'unknown',
): Promise<Result<T>> => {
	try {
		const data = await promise
		return [data, null]
	} catch (error: unknown) {
		const appError = AppError.from(error, context)
		return [null, appError]
	}
}

/**
 * Synchronous version of tryCatch that wraps a function in a try-catch block and returns a Go-style Result tuple
 * @param func - The function to be executed
 * @param context - The context/service name for error logging (defaults to 'unknown')
 * @returns A Result tuple containing either [data, null] or [null, error]
 */
export const tryCatchSync = <T>(
	func: () => T,
	context = 'unknown',
): Result<T> => {
	try {
		const data = func()
		return [data, null]
	} catch (error: unknown) {
		const appError = AppError.from(error, context)
		return [null, appError]
	}
}
