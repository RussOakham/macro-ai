import { z } from 'zod'

import { registerZodSchema } from '../../utils/swagger/openapi-registry.ts'

// Health check response schema
const healthResponseSchema = registerZodSchema(
	'HealthResponse',
	z.object({
		message: z.string().openapi({
			description: 'Health status message',
			example: 'Api Health Status: OK',
		}),
	}),
	'API health check response',
)

// Error response for health check
const healthErrorSchema = registerZodSchema(
	'HealthErrorResponse',
	z.object({
		message: z.string().openapi({
			description: 'Error message',
			example: 'Api Status: Error',
		}),
	}),
	'API health check error response',
)

export { healthErrorSchema, healthResponseSchema }
