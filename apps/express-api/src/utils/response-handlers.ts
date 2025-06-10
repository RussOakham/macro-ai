import { Response } from 'express'
import { ReasonPhrases, StatusCodes } from 'http-status-codes'
import { z } from 'zod'
import { fromError } from 'zod-validation-error'

import { tryCatchSync } from './error-handling/try-catch.ts'
import { AppError, ErrorType, IStandardizedError } from './errors.ts'
import { pino } from './logger.ts'

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
 * Type for AWS service response metadata
 */
export interface TAwsServiceMetadata {
	$metadata?: {
		httpStatusCode?: number
		requestId?: string
		extendedRequestId?: string
		attempts?: number
	}
}

/**
 * Checks for error responses from AWS services
 * @param response AWS service response or its metadata
 * @param errorMessage Custom error message
 * @param logContext Context for logging
 * @returns Discriminated union indicating success or error details
 */
export const handleServiceError = (
	response: TAwsServiceMetadata | { $metadata: { httpStatusCode?: number } },
	errorMessage: string,
	logContext: string,
): TServiceErrorResult => {
	const metadata = response.$metadata

	if (
		metadata?.httpStatusCode !== undefined &&
		metadata.httpStatusCode !== 200
	) {
		logger.error(
			`[${logContext}]: ${errorMessage}: ${metadata.httpStatusCode.toString()}`,
		)
		return {
			success: false,
			error: {
				status: metadata.httpStatusCode,
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
			})
		case ErrorType.ForbiddenError:
			return res.status(StatusCodes.FORBIDDEN).json({
				message: 'Access denied',
			})
		case ErrorType.NotFoundError:
			return res.status(StatusCodes.NOT_FOUND).json({
				message: err.message || 'Resource not found',
			})
		case ErrorType.ValidationError:
			return res.status(StatusCodes.BAD_REQUEST).json({
				message: err.message,
			})
		case ErrorType.ConflictError:
			return res.status(StatusCodes.CONFLICT).json({
				message: err.message,
			})
		case ErrorType.InternalError:
			return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
				message: err.message,
			})
		case ErrorType.ApiError:
			return res.status(err.status).json({
				message: err.message,
			})
		case ErrorType.AxiosError:
			return res.status(err.status).json({
				message: err.message || 'External API error',
			})
		case ErrorType.CognitoError:
			return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
				message: 'A Cognito error occurred',
			})
		case ErrorType.ZodError:
			return res.status(StatusCodes.BAD_REQUEST).json({
				message: ReasonPhrases.BAD_REQUEST,
			})
		case ErrorType.ZodValidationError:
			return res.status(StatusCodes.BAD_REQUEST).json({
				message: ReasonPhrases.BAD_REQUEST,
			})
		default:
			return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
				message: 'An unknown error occurred',
			})
	}
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
	logContext: string,
	status: number = StatusCodes.BAD_REQUEST,
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

/**
 * Validates data against a Zod schema
 * @param data Data to validate
 * @param schema Zod schema to validate against
 * @param logContext Context for logging
 * @returns Object with validation result and parsed data or error details
 */
export const validateSchema = <T>(
	data: unknown,
	schema: z.ZodType<T>,
	logContext: string,
) => {
	return tryCatchSync(() => {
		return schema.parse(data)
	}, `${logContext} - validateSchema`)
}

/**
 * Safely validates data against a Zod schema without throwing
 * @param data Data to validate
 * @param schema Zod schema to validate against
 * @param logContext Context for logging
 * @returns Object with validation result and parsed data or error details
 */
export const safeValidateSchema = <T>(
	data: unknown,
	schema: z.ZodType<T>,
	logContext: string,
) => {
	return tryCatchSync(() => {
		const result = schema.safeParse(data)

		if (!result.success) {
			const validationError = fromError(result.error)
			throw AppError.validation(
				`Validation failed: ${validationError.message}`,
				{ details: validationError.details },
				logContext,
			)
		}

		return result.data
	}, `${logContext} - safeValidateSchema`)
}
