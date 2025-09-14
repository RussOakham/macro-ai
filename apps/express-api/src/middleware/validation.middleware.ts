import type { NextFunction, Request, Response } from 'express'
import type { z } from 'zod'

import { tryCatch } from '../utils/error-handling/try-catch.ts'
import { ErrorType, ValidationError } from '../utils/errors.ts'
import { pino } from '../utils/logger.ts'

const { logger } = pino

type ValidationTarget = 'body' | 'params' | 'query'
type ValidSchema<T> = z.ZodType<T>

const validate = <T>(
	schema: ValidSchema<T>,
	target: ValidationTarget = 'body',
) => {
	return async (req: Request, res: Response, next: NextFunction) => {
		const [data, error] = await tryCatch(
			() => schema.parseAsync(req[target]),
			`validation middleware - ${target}`,
		)

		if (error) {
			// Check if it's a ZodError for specific handling
			if (error.type === ErrorType.ZodError) {
				// Log validation error as warning
				logger.warn({
					msg: '[middleware - validateRequest]: Validation error',
					path: req.path,
					error: error.message,
				})

				// Convert to ValidationError for consistent handling
				const validationErr = new ValidationError(
					'Validation Failed',
					error.details,
					'validation middleware',
				)
				next(validationErr)
				return
			}

			// For other errors, pass the already standardized error from tryCatch
			next(error)
			return
		}

		// Success case - update request and continue
		req[target] = data
		next()
	}
}

export { validate }
