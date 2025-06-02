import { Response } from 'express'
import { StatusCodes } from 'http-status-codes'

import { pino } from './logger.ts'
import { ErrorType, IStandardizedError } from './standardize-error.ts'

const { logger } = pino

/**
 * Handles successful API responses
 * @param res Express response object
 * @param data Response data of type TData
 * @param status HTTP status code (defaults to 200 OK)
 * @returns The Express response object for chaining
 */
// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
export const sendSuccess = <TData>(
	res: Response,
	data: TData,
	status: number = StatusCodes.OK,
): Response => {
	return res.status(status).json(data)
}

/**
 * Type for service error check results
 */
export type TServiceErrorResult =
	| { success: true }
	| { success: false; error: { status: number; message: string } }

/**
 * Checks for error responses from AWS services
 * @param response AWS service response
 * @param errorMessage Custom error message
 * @param logContext Context for logging
 * @returns Discriminated union indicating success or error details
 */
export const handleServiceError = (
	response: { $metadata: { httpStatusCode?: number } },
	errorMessage: string,
	logContext: string,
): TServiceErrorResult => {
	if (
		response.$metadata.httpStatusCode !== undefined &&
		response.$metadata.httpStatusCode !== 200
	) {
		logger.error(
			`[${logContext}]: ${errorMessage}: ${response.$metadata.httpStatusCode.toString()}`,
		)
		return {
			success: false,
			error: {
				status: response.$metadata.httpStatusCode,
				message: errorMessage,
			},
		}
	}
	return { success: true }
}

/**
 * Handles standardized errors
 * @param res Express response object
 * @param err Standardized error object
 * @param logContext Context for logging
 * @returns The Express response object for chaining
 */
export const handleError = (
	res: Response,
	err: IStandardizedError,
	logContext: string,
): Response => {
	logger.error(
		`[${logContext}]: Error: ${err.status.toString()} ${err.message}`,
	)

	// Handle specific error cases
	switch (err.type) {
		case ErrorType.UnauthorizedError:
			return res.status(StatusCodes.UNAUTHORIZED).json({
				message: 'Authentication required',
				details: err.details,
			})
		case ErrorType.ForbiddenError:
			return res.status(StatusCodes.FORBIDDEN).json({
				message: 'Access denied',
				details: err.details,
			})
		case ErrorType.NotFoundError:
			return res.status(StatusCodes.NOT_FOUND).json({
				message: err.message || 'Resource not found',
				details: err.details,
			})
	}

	return res
		.status(err.status)
		.json({ message: err.message, details: err.details })
}

type TValidationResult =
	| { valid: true }
	| { valid: false; error: { message: string; status: number } }

/**
 * Validates required data exists
 * @param condition Condition to check
 * @param errorMessage Error message if condition fails
 * @param status HTTP status code to return if condition fails
 * @param logContext Context for logging
 * @returns Object with validation result and error details if validation failed
 */
export const validateData = (
	condition: boolean,
	errorMessage: string,
	status: number = StatusCodes.BAD_REQUEST,
	logContext: string,
): TValidationResult => {
	if (!condition) {
		logger.error(`[${logContext}]: ${errorMessage}`)
		return {
			valid: false,
			error: {
				message: errorMessage,
				status,
			},
		}
	}
	return { valid: true }
}
