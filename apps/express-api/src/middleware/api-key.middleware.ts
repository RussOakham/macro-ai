import { NextFunction, Request, Response } from 'express'

import { UnauthorizedError } from '../utils/errors.ts'
import { pino } from '../utils/logger.ts'

const { logger } = pino

const API_KEY_HEADER = 'X-API-KEY'

/**
 * API Key Authentication Middleware
 * Checks for API key in the X-API-KEY header
 */
const apiKeyAuth = (req: Request, res: Response, next: NextFunction): void => {
	// Skip API key check for health endpoints, Swagger documentation, and CORS preflight
	const isSwagger = req.path.startsWith('/api-docs')
	const isHealth = req.path.startsWith('/api/health')
	const isOptions = req.method === 'OPTIONS'
	if (isSwagger || isHealth || isOptions) {
		next()
		return
	}

	const apiKey = req.headers[API_KEY_HEADER.toLowerCase()] as string | undefined

	// Read configured key at request time so Parameter Store population is visible
	const configuredApiKey = process.env.API_KEY

	if (!configuredApiKey) {
		logger.error('[apiKeyAuth]: API_KEY environment variable not configured')
		next(
			new UnauthorizedError('API key not configured', 'apiKeyAuth middleware'),
		)
		return
	}

	if (!apiKey || apiKey !== configuredApiKey) {
		logger.warn(
			`[apiKeyAuth]: Invalid API key attempt from IP: ${req.ip ?? ''}`,
		)
		next(new UnauthorizedError('Invalid API key', 'apiKeyAuth middleware'))
		return
	}

	next()
}

export { apiKeyAuth }
