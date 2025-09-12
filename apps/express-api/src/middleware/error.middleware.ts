import type { ErrorRequestHandler, NextFunction, Request, Response } from 'express'

import { AppError } from '../utils/errors.ts'
import { pino } from '../utils/logger.ts'

const { logger } = pino

/**
 * Global error handling middleware for Go-style error handling
 * Catches all errors passed via next(error) and returns a standardized response
 * Works with all custom error classes (NotFoundError, UnauthorizedError, etc.)
 * since they extend AppError with proper statusCode fields
 */
const errorHandler: ErrorRequestHandler = (
	error: unknown,
	req: Request,
	res: Response,
	next: NextFunction,
) => {
	// Skip if headers already sent
	if (res.headersSent) {
		next(error)
		return
	}

	// Standardize the error
	const err =
		error instanceof AppError
			? error
			: AppError.from(error, 'globalErrorHandler')

	// Log the error with context
	logger.error(
		{
			path: req.path,
			method: req.method,
			status: err.status,
			type: err.type,
			service: err.service,
			stack: process.env.NODE_ENV !== 'production' ? err.stack : undefined,
		},
		`[ErrorHandler]: ${err.message}`,
	)

	// Determine appropriate response
	const responseBody = {
		message: err.message,
		// Only include details and type in non-production environments
		...(process.env.NODE_ENV !== 'production'
			? {
					details: err.details,
					type: err.type,
				}
			: {}),
	}

	// Send response with appropriate status code
	res.status(err.status).json(responseBody)
}

export { errorHandler }
