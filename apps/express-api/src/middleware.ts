import { NextFunction, Request, Response } from 'express'
import { StatusCodes } from 'http-status-codes'

import { config } from '../config/default.ts'

import { pino } from './utils/logger.ts'

const { logger } = pino

const API_KEY_HEADER = 'X-API-KEY'
const apiKey = config.apiKey

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
		res
			.status(StatusCodes.INTERNAL_SERVER_ERROR)
			.json({ message: 'Server configuration error' })
		return
	}

	if (!clientApiKey || clientApiKey !== apiKey) {
		logger.warn(
			`[apiKeyAuth]: Invalid API key attempt from IP: ${req.ip ?? ''}`,
		)
		res.status(StatusCodes.UNAUTHORIZED).json({ message: 'Invalid API key' })
		return
	}

	next()
}

export { apiKeyAuth }
