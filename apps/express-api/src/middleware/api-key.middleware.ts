import { NextFunction, Request, Response } from 'express'

import { config } from '../../config/default.ts'
import { InternalError, UnauthorizedError } from '../utils/errors.ts'
import { pino } from '../utils/logger.ts'

const { logger } = pino

const API_KEY_HEADER = 'X-API-KEY'
const apiKey = config.apiKey

/**
 * Middleware to validate API key authentication
 * Uses Go-style error handling with centralized error middleware
 * Checks for API key in the X-API-KEY header
 */
const apiKeyAuth = (req: Request, res: Response, next: NextFunction) => {
	// Skip API key check for Swagger documentation
	if (req.path.startsWith('/api-docs')) {
		next()
		return
	}

	const clientApiKey = req.headers[API_KEY_HEADER.toLowerCase()] as
		| string
		| undefined

	if (!apiKey) {
		logger.error('[middleware - apiKeyAuth]: API key not configured')
		const error = new InternalError(
			'Server configuration error',
			'apiKeyAuth middleware',
		)
		next(error)
		return
	}

	if (!clientApiKey || clientApiKey !== apiKey) {
		logger.warn(
			`[apiKeyAuth]: Invalid API key attempt from IP: ${req.ip ?? ''}`,
		)
		const error = new UnauthorizedError(
			'Invalid API key',
			'apiKeyAuth middleware',
		)
		next(error)
		return
	}

	logger.debug('[middleware - apiKeyAuth]: API key validation successful')
	next()
}

export { apiKeyAuth }
