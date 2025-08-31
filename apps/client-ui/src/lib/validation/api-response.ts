import {
	getChats_Response,
	getChatsId_Response,
	postChats_Response,
} from '@repo/macro-ai-api-client'
import { z } from 'zod'

import { logger } from '@/lib/logger/logger'

/**
 * Runtime validation utility for API responses using Zod schemas
 * Provides type safety and catches schema mismatches at runtime
 */

/**
 * Converts error and data to safe logging metadata to prevent PII/token leakage
 * @param error - Unknown error object
 * @param data - Unknown data object
 * @returns Safe metadata object for logging
 */
const toSafeValidationMeta = (error: unknown, data: unknown) => {
	// Safe error representation
	const safeError =
		error instanceof Error
			? { name: error.name, message: error.message }
			: typeof error === 'string'
				? error
				: 'Unknown error'

	// Safe data summary
	let safeData: string
	if (data === null || data === undefined) {
		safeData = String(data)
	} else if (typeof data === 'object') {
		const keys = Object.keys(data as Record<string, unknown>)
		const keyPreview = keys.slice(0, 3).join(', ')
		const keyCount = keys.length
		safeData = `object with ${keyCount.toString()} keys${keyCount > 0 ? ` (${keyPreview}${keyCount > 3 ? '...' : ''})` : ''}`
	} else {
		safeData = `${typeof data} value`
	}

	return { error: safeError, data: safeData }
}

// ============================================================================
// Chat Response Validators
// ============================================================================

export const validateGetChatsResponse = (data: unknown) => {
	try {
		return getChats_Response.parse(data)
	} catch (error: unknown) {
		logger.error(
			toSafeValidationMeta(error, data),
			'[API Validation] Invalid getChats response',
		)
		throw new Error('Invalid chat list response format')
	}
}

export const validateGetChatByIdResponse = (data: unknown) => {
	try {
		return getChatsId_Response.parse(data)
	} catch (error: unknown) {
		logger.error(
			toSafeValidationMeta(error, data),
			'[API Validation] Invalid getChatById response',
		)
		throw new Error('Invalid chat response format')
	}
}

export const validateCreateChatResponse = (data: unknown) => {
	try {
		return postChats_Response.parse(data)
	} catch (error: unknown) {
		logger.error(
			toSafeValidationMeta(error, data),
			'[API Validation] Invalid createChat response',
		)
		throw new Error('Invalid create chat response format')
	}
}



// ============================================================================
// Generic Response Validator
// ============================================================================

/**
 * Generic response validator that can be used with any Zod schema
 * @param schema - Zod schema to validate against
 * @param data - Data to validate
 * @param errorMessage - Custom error message for validation failures
 * @returns Parsed and validated data
 */
export const validateApiResponse = <T>(
	schema: z.ZodSchema<T>,
	data: unknown,
	errorMessage = 'Invalid API response format',
): T => {
	try {
		return schema.parse(data)
	} catch (error: unknown) {
		logger.error(
			toSafeValidationMeta(error, data),
			'[API Validation] Generic validation failed',
		)
		throw new Error(errorMessage)
	}
}

// ============================================================================
// Safe Response Validator (returns result object instead of throwing)
// ============================================================================

export type ValidationResult<T> =
	| { success: true; data: T }
	| { success: false; error: string }

/**
 * Safe response validator that returns a result object instead of throwing
 * @param schema - Zod schema to validate against
 * @param data - Data to validate
 * @returns Result object with success/error status
 */
export const safeValidateApiResponse = <T>(
	schema: z.ZodSchema<T>,
	data: unknown,
): ValidationResult<T> => {
	try {
		const validatedData = schema.parse(data)
		return { success: true, data: validatedData }
	} catch (error: unknown) {
		const errorMessage =
			error instanceof z.ZodError
				? `Validation failed: ${error.errors.map((e) => e.message).join(', ')}`
				: 'Unknown validation error'

		logger.error(
			toSafeValidationMeta(error, data),
			'[API Validation] Safe validation failed',
		)
		return { success: false, error: errorMessage }
	}
}
