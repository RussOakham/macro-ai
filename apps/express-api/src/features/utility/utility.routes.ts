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
	configurationResponseSchema,
	detailedHealthResponseSchema,
	healthResponseSchema,
	livenessResponseSchema,
	readinessResponseSchema,
	systemInfoResponseSchema,
} from './utility.schemas.ts'

// Register the health endpoint with OpenAPI
registry.registerPath({
	method: 'get',
	path: '/health',
	tags: ['Utility'],
	summary: 'Health check endpoint',
	description:
		'Returns the current health status of the API service. No rate limiting applied to ensure ALB health checks work reliably.',
	responses: {
		[StatusCodes.OK]: {
			description: 'Health check successful',
			content: {
				'application/json': {
					schema: healthResponseSchema,
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

// Register the detailed health endpoint with OpenAPI
registry.registerPath({
	method: 'get',
	path: '/health/detailed',
	tags: ['Utility'],
	summary: 'Detailed health check endpoint for ALB and monitoring',
	description:
		'Returns comprehensive health status including database, memory, disk, and dependencies checks. No rate limiting applied to ensure ALB health checks work reliably.',
	responses: {
		[StatusCodes.OK]: {
			description: 'Detailed health check successful',
			content: {
				'application/json': {
					schema: detailedHealthResponseSchema,
				},
			},
		},
		[StatusCodes.SERVICE_UNAVAILABLE]: {
			description: 'Service is unhealthy',
			content: {
				'application/json': {
					schema: detailedHealthResponseSchema,
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

// Register the readiness endpoint with OpenAPI
registry.registerPath({
	method: 'get',
	path: '/health/ready',
	tags: ['Utility'],
	summary: 'Readiness probe endpoint',
	description:
		'Returns whether the application is ready to receive traffic (Kubernetes-style readiness probe). No rate limiting applied to ensure ALB health checks work reliably.',
	responses: {
		[StatusCodes.OK]: {
			description: 'Application is ready',
			content: {
				'application/json': {
					schema: readinessResponseSchema,
				},
			},
		},
		[StatusCodes.SERVICE_UNAVAILABLE]: {
			description: 'Application is not ready',
			content: {
				'application/json': {
					schema: readinessResponseSchema,
				},
			},
		},
		[StatusCodes.INTERNAL_SERVER_ERROR]: {
			description: 'Readiness check failed - internal server error',
			content: {
				'application/json': {
					schema: InternalServerErrorSchema,
				},
			},
		},
	},
})

// Register the public readiness endpoint with OpenAPI
registry.registerPath({
	method: 'get',
	path: '/health/ready/public',
	tags: ['Utility'],
	summary: 'Public readiness probe endpoint',
	description:
		'Returns minimal readiness information without detailed error messages in production. Suitable for public ALB health checks. No rate limiting applied.',
	responses: {
		[StatusCodes.OK]: {
			description: 'Application is ready',
			content: {
				'application/json': {
					schema: readinessResponseSchema,
				},
			},
		},
		[StatusCodes.SERVICE_UNAVAILABLE]: {
			description: 'Application is not ready',
			content: {
				'application/json': {
					schema: readinessResponseSchema,
				},
			},
		},
		[StatusCodes.INTERNAL_SERVER_ERROR]: {
			description: 'Readiness check failed - internal server error',
			content: {
				'application/json': {
					schema: InternalServerErrorSchema,
				},
			},
		},
	},
})

// Register the liveness endpoint with OpenAPI
registry.registerPath({
	method: 'get',
	path: '/health/live',
	tags: ['Utility'],
	summary: 'Liveness probe endpoint',
	description:
		'Returns whether the application is alive and should not be restarted (Kubernetes-style liveness probe). No rate limiting applied to ensure ALB health checks work reliably.',
	responses: {
		[StatusCodes.OK]: {
			description: 'Application is alive',
			content: {
				'application/json': {
					schema: livenessResponseSchema,
				},
			},
		},
		[StatusCodes.SERVICE_UNAVAILABLE]: {
			description: 'Application is not alive',
			content: {
				'application/json': {
					schema: livenessResponseSchema,
				},
			},
		},
		[StatusCodes.INTERNAL_SERVER_ERROR]: {
			description: 'Liveness check failed - internal server error',
			content: {
				'application/json': {
					schema: InternalServerErrorSchema,
				},
			},
		},
	},
})

// Register the configuration health endpoint with OpenAPI
registry.registerPath({
	method: 'get',
	path: '/health/config',
	tags: ['Utility'],
	summary: 'Configuration validation endpoint',
	description:
		'Returns detailed configuration validation status for debugging deployment issues. No rate limiting applied to ensure ALB health checks work reliably.',
	responses: {
		[StatusCodes.OK]: {
			description: 'Configuration validation successful',
			content: {
				'application/json': {
					schema: configurationResponseSchema,
				},
			},
		},
		[StatusCodes.INTERNAL_SERVER_ERROR]: {
			description: 'Configuration validation failed - internal server error',
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
	// NOTE: No rate limiting on health endpoints to prevent ALB health check failures
	router.get('/health', utilityController.getHealthStatus)

	// System info endpoint using Go-style error handling
	router.get('/system-info', apiRateLimiter, utilityController.getSystemInfo)

	// Detailed health check endpoint for ALB and monitoring
	// NOTE: No rate limiting on health endpoints to prevent ALB health check failures
	router.get('/health/detailed', utilityController.getDetailedHealthStatus)

	// Readiness probe endpoint (Kubernetes-style)
	// NOTE: No rate limiting on health endpoints to prevent ALB health check failures
	router.get('/health/ready', utilityController.getReadinessStatus)

	// Public readiness probe endpoint (minimal info, production-safe)
	// NOTE: No rate limiting on health endpoints to prevent ALB health check failures
	router.get('/health/ready/public', utilityController.getPublicReadinessStatus)

	// Liveness probe endpoint (Kubernetes-style)
	// NOTE: No rate limiting on health endpoints to prevent ALB health check failures
	router.get('/health/live', utilityController.getLivenessStatus)

	// Configuration validation endpoint for debugging
	// NOTE: No rate limiting on health endpoints to prevent ALB health check failures
	router.get('/health/config', utilityController.getConfigurationStatus)
}

export { utilityRouter }
