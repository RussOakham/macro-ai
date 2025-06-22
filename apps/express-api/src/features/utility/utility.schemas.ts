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

// System information response schema
const systemInfoResponseSchema = registerZodSchema(
	'SystemInfoResponse',
	z.object({
		nodeVersion: z.string().openapi({
			description: 'Node.js version',
			example: 'v18.17.0',
		}),
		platform: z.string().openapi({
			description: 'Operating system platform',
			example: 'linux',
		}),
		architecture: z.string().openapi({
			description: 'System architecture',
			example: 'x64',
		}),
		uptime: z.number().openapi({
			description: 'System uptime in seconds',
			example: 3600,
		}),
		memoryUsage: z
			.object({
				rss: z.number().openapi({
					description: 'Resident Set Size in bytes',
					example: 50331648,
				}),
				heapTotal: z.number().openapi({
					description: 'Total heap size in bytes',
					example: 20971520,
				}),
				heapUsed: z.number().openapi({
					description: 'Used heap size in bytes',
					example: 15728640,
				}),
				external: z.number().openapi({
					description: 'External memory usage in bytes',
					example: 1048576,
				}),
			})
			.openapi({
				description: 'Memory usage statistics',
			}),
		cpuUsage: z
			.object({
				user: z.number().openapi({
					description: 'User CPU time in microseconds',
					example: 1000000,
				}),
				system: z.number().openapi({
					description: 'System CPU time in microseconds',
					example: 500000,
				}),
			})
			.openapi({
				description: 'CPU usage statistics',
			}),
		timestamp: z.string().openapi({
			description: 'ISO timestamp when the information was collected',
			example: '2024-01-01T12:00:00.000Z',
		}),
	}),
	'System information response',
)

// Error response for health check (keeping for backward compatibility)
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

export { healthErrorSchema, healthResponseSchema, systemInfoResponseSchema }
