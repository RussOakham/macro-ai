import type { Response } from 'express'
import { StatusCodes } from 'http-status-codes'
import type { z } from 'zod'
import { fromError } from 'zod-validation-error'

import { tryCatchSync } from './error-handling/try-catch.ts'
import { ValidationError } from './errors.ts'
import { pino } from './logger.ts'

const { logger } = pino

/**
 * Handles successful API responses
 * @param res Express response object
 * @param data Response data of type TData
 * @param status HTTP status code (defaults to 200 OK)
 * @returns The Express response object for chaining
 */

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
 * Validates required data exists
 * @param condition Condition to check
 * @param errorMessage Error message if condition fails
 * @param logContext Context for logging
 * @param status HTTP status code to return if condition fails
 * @returns Object with validation result and error details if validation failed
 */
export const validateData = (
	condition: boolean,
	errorMessage: string,
	logContext: string,
	status: number = StatusCodes.BAD_REQUEST,
) => {
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
			throw new ValidationError(
				`Validation failed: ${validationError.message}`,
				{ details: validationError.details },
				logContext,
			)
		}

		return result.data
	}, `${logContext} - safeValidateSchema`)
}
