import { NextFunction, Request, Response } from 'express'

import { InternalError, UnauthorizedError } from '../utils/errors.ts'
import { pino } from '../utils/logger.ts'

const { logger } = pino

const API_KEY_HEADER = 'X-API-KEY'

/**
 * Middleware to validate API key authentication
 * Uses Go-style error handling with centralized error middleware
 * Checks for API key in the X-API-KEY header
 */
const apiKeyAuth = (req: Request, res: Response, next: NextFunction) => {
	// Skip API key check for health endpoints and Swagger documentation
	const isSwagger = req.path.startsWith('/api-docs')
	const isHealth = req.path === '/api/health' || req.path === '/health'
	if (isSwagger || isHealth) {
		next()
		return
	}

	const clientApiKey = req.headers[API_KEY_HEADER.toLowerCase()] as
		| string
		| undefined

	// Read configured key at request time so Parameter Store population is visible
	const configuredApiKey = process.env.API_KEY ?? ''

	if (!configuredApiKey) {
		logger.error('[middleware - apiKeyAuth]: API key not configured')
		const error = new InternalError(
			'Server configuration error',
			'apiKeyAuth middleware',
		)
		next(error)
		return
	}

	if (!clientApiKey || clientApiKey !== configuredApiKey) {
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
