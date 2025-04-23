import { ErrorRequestHandler, NextFunction, Request, Response } from 'express'

import { AppError } from '../utils/errors.ts'
import { pino } from '../utils/logger.ts'

const { logger } = pino

const errorHandler: ErrorRequestHandler = (
	error: Error,
	req: Request,
	res: Response,
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	_next: NextFunction,
) => {
	const err =
		error instanceof AppError
			? error
			: AppError.from(error, 'globalErrorHandler')

	logger.error(`[ErrorHandler]: ${err.message}`, {
		path: req.path,
		method: req.method,
		status: err.status,
		type: err.type,
		service: err.service,
		stack: err.stack,
	})

	res.status(err.status).json({
		message: err.message,
		details: err.details,
		type: err.type,
	})
}

export { errorHandler }
