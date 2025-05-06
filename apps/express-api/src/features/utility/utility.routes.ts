import { type Router } from 'express'

import { pino } from '../../utils/logger.ts'
import { registry } from '../../utils/swagger/openapi-registry.ts'

import { healthErrorSchema, healthResponseSchema } from './utility.schemas.ts'

const { logger } = pino

// Register the health endpoint with OpenAPI
registry.registerPath({
	method: 'get',
	path: '/health',
	tags: ['Utility'],
	responses: {
		200: {
			description: 'Health check successful',
			content: {
				'application/json': {
					schema: healthResponseSchema,
				},
			},
		},
		500: {
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
	router.get('/health', (req, res) => {
		try {
			res.status(200).json({ message: 'Api Health Status: OK' })
		} catch (error: unknown) {
			logger.error(
				`[utility-routes]: Error checking health status: ${(error as Error).message}`,
			)
			res.status(500).json({ message: 'Api Status: Error' })
		}
	})
}

export { utilityRouter }
