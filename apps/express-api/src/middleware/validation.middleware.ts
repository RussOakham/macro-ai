import { NextFunction, Request, Response } from 'express'
import { AnyZodObject, ZodEffects, ZodError } from 'zod'
import { fromError } from 'zod-validation-error'

import { InternalError, ValidationError } from '../utils/errors.ts'
import { pino } from '../utils/logger.ts'

const { logger } = pino

type ValidationTarget = 'body' | 'params' | 'query'
type ValidSchema<T> = AnyZodObject | ZodEffects<AnyZodObject, T, T>

const validate = <T>(
	schema: ValidSchema<T>,
	target: ValidationTarget = 'body',
) => {
	return async (req: Request, res: Response, next: NextFunction) => {
		try {
			const data = await schema.parseAsync(req[target])
			req[target] = data
			next()
		} catch (error: unknown) {
			if (error instanceof ZodError) {
				const validationError = fromError(error)

				logger.warn({
					msg: '[middleware - validateRequest]: Validation error',
					path: req.path,
					error: validationError.message,
				})

				// Use Go-style error handling with custom error class
				const validationErr = new ValidationError(
					'Validation Failed',
					validationError.details,
					'validation middleware',
				)
				next(validationErr)
				return
			}

			logger.error({
				msg: '[middleware - validateRequest]: Unexpected error',
				path: req.path,
				error: (error as Error).message,
			})

			// Use Go-style error handling with custom error class
			const internalErr = new InternalError(
				'Internal server error during validation',
				'validation middleware',
			)
			next(internalErr)
		}
	}
}

export { validate }
export type { ValidationTarget, ValidSchema }
