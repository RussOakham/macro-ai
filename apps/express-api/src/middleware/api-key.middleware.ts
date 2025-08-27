import { Request, Response, NextFunction } from 'express'
import { UnauthorizedError } from '../utils/errors.js'
import { pino } from '../utils/logger.js'

const API_KEY_HEADER = 'X-API-KEY'

/**
 * API Key Authentication Middleware
 * Checks for API key in the X-API-KEY header
 */
const apiKeyAuth = (req: Request, res: Response, next: NextFunction): void => {
	// Skip API key check for health endpoints and Swagger documentation
	const isSwagger = req.path.startsWith('/api-docs')
	const isHealth = req.path.startsWith('/api/health') || req.path === '/health'
	if (isSwagger || isHealth) {
		next()
		return
	}

	const apiKey = req.headers[API_KEY_HEADER.toLowerCase()] as string | undefined

	// Read configured key at request time so Parameter Store population is visible
	const configuredApiKey = process.env.API_KEY

	console.log(`[apiKeyAuth] Comparison:`)
	console.log(`  - Configured API_KEY: ${configuredApiKey ?? 'undefined'}`)
	console.log(`  - Received API_KEY: ${apiKey ?? 'undefined'}`)
	console.log(`  - Keys match: ${apiKey === configuredApiKey}`)

	if (!configuredApiKey) {
		console.error('[apiKeyAuth]: API_KEY environment variable not configured')
		throw new UnauthorizedError('API key not configured')
	}

	if (!apiKey || apiKey !== configuredApiKey) {
		console.warn(
			`[apiKeyAuth]: Invalid API key attempt from IP: ${req.ip ?? ''}`,
		)
		throw new UnauthorizedError('Invalid API key')
	}

	console.log(`[apiKeyAuth] Authentication successful`)
	next()
}

export { apiKeyAuth }
