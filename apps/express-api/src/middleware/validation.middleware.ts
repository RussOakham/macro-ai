import { NextFunction, Request, Response } from 'express'
import { StatusCodes } from 'http-status-codes'
import { AnyZodObject, ZodEffects, ZodError } from 'zod'
import { fromError } from 'zod-validation-error'

import { standardizeError } from '../utils/errors.ts'
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

				res.status(StatusCodes.BAD_REQUEST).json({
					message: 'Validation Failed',
					details: validationError.details,
				})
				return
			}

			const err = standardizeError(error)

			logger.error({
				msg: '[middleware - validateRequest]: Error',
				path: req.path,
				error: err.message,
			})

			res
				.status(err.status)
				.json({ message: err.message, details: err.details })
			return
		}
	}
}

export { validate }
export type { ValidationTarget, ValidSchema }
