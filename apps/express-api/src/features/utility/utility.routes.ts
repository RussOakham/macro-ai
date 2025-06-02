import { type Router } from 'express'
import { StatusCodes } from 'http-status-codes'

import { apiRateLimiter } from '../../middleware/rate-limit.middleware.ts'
import { pino } from '../../utils/logger.ts'
import { registry } from '../../utils/swagger/openapi-registry.ts'

import { healthErrorSchema, healthResponseSchema } from './utility.schemas.ts'
import { THealthErrorResponse, THealthResponse } from './utility.types.ts'

const { logger } = pino

// Register the health endpoint with OpenAPI
registry.registerPath({
	method: 'get',
	path: '/health',
	tags: ['Utility'],
	responses: {
		[StatusCodes.OK]: {
			description: 'Health check successful',
			content: {
				'application/json': {
					schema: healthResponseSchema,
				},
			},
		},
		[StatusCodes.TOO_MANY_REQUESTS]: {
			description: 'Too many requests - rate limit exceeded',
			content: {
				'application/json': {
					schema: healthErrorSchema,
				},
			},
		},
		[StatusCodes.INTERNAL_SERVER_ERROR]: {
			description: 'Health check failed',
			content: {
				'application/json': {
					schema: healthErrorSchema,
				},
			},
		},
	},
})

const utilityRouter = (router: Router) => {
	router.get('/health', apiRateLimiter, (req, res) => {
		try {
			const healthResponse: THealthResponse = {
				message: 'Api Health Status: OK',
			}

			res.status(200).json(healthResponse)
		} catch (error: unknown) {
			logger.error(
				`[utility-routes]: Error checking health status: ${(error as Error).message}`,
			)

			const healthErrorResponse: THealthErrorResponse = {
				message: 'Api Status: Error',
			}

			res.status(StatusCodes.INTERNAL_SERVER_ERROR).json(healthErrorResponse)
		}
	})
}

export { utilityRouter }
