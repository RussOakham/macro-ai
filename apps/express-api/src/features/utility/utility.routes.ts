import { type Router } from 'express'
import { StatusCodes } from 'http-status-codes'

import { apiRateLimiter } from '../../middleware/rate-limit.middleware.ts'
import { registry } from '../../utils/swagger/openapi-registry.ts'

import { utilityController } from './utility.controller.ts'
import { healthErrorSchema, healthResponseSchema } from './utility.schemas.ts'

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

// Register the system info endpoint with OpenAPI
registry.registerPath({
	method: 'get',
	path: '/system-info',
	tags: ['Utility'],
	responses: {
		[StatusCodes.OK]: {
			description: 'System information retrieved successfully',
			content: {
				'application/json': {
					schema: {
						type: 'object',
						properties: {
							nodeVersion: { type: 'string' },
							platform: { type: 'string' },
							architecture: { type: 'string' },
							uptime: { type: 'number' },
							memoryUsage: { type: 'object' },
							cpuUsage: { type: 'object' },
							timestamp: { type: 'string' },
						},
					},
				},
			},
		},
		[StatusCodes.INTERNAL_SERVER_ERROR]: {
			description: 'Failed to retrieve system information',
			content: {
				'application/json': {
					schema: healthErrorSchema,
				},
			},
		},
	},
})

const utilityRouter = (router: Router) => {
	// Health check endpoint using Go-style error handling
	router.get('/health', apiRateLimiter, utilityController.getHealthStatus)

	// System info endpoint using Go-style error handling
	router.get('/system-info', apiRateLimiter, utilityController.getSystemInfo)
}

export { utilityRouter }
