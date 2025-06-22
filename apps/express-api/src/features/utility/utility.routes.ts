import { type Router } from 'express'
import { StatusCodes } from 'http-status-codes'

import { apiRateLimiter } from '../../middleware/rate-limit.middleware.ts'
import {
	InternalServerErrorSchema,
	RateLimitErrorSchema,
	registry,
} from '../../utils/swagger/openapi-registry.ts'

import { utilityController } from './utility.controller.ts'
import {
	healthResponseSchema,
	systemInfoResponseSchema,
} from './utility.schemas.ts'

// Register the health endpoint with OpenAPI
registry.registerPath({
	method: 'get',
	path: '/health',
	tags: ['Utility'],
	summary: 'Health check endpoint',
	description: 'Returns the current health status of the API service',
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
					schema: RateLimitErrorSchema,
				},
			},
		},
		[StatusCodes.INTERNAL_SERVER_ERROR]: {
			description: 'Health check failed - internal server error',
			content: {
				'application/json': {
					schema: InternalServerErrorSchema,
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
	summary: 'System information endpoint',
	description:
		'Returns detailed system information including Node.js version, platform, memory usage, and CPU statistics',
	responses: {
		[StatusCodes.OK]: {
			description: 'System information retrieved successfully',
			content: {
				'application/json': {
					schema: systemInfoResponseSchema,
				},
			},
		},
		[StatusCodes.TOO_MANY_REQUESTS]: {
			description: 'Too many requests - rate limit exceeded',
			content: {
				'application/json': {
					schema: RateLimitErrorSchema,
				},
			},
		},
		[StatusCodes.INTERNAL_SERVER_ERROR]: {
			description:
				'Failed to retrieve system information - internal server error',
			content: {
				'application/json': {
					schema: InternalServerErrorSchema,
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
