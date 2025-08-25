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

// Detailed health check response schema for ALB and monitoring
const detailedHealthResponseSchema = registerZodSchema(
	'DetailedHealthResponse',
	z.object({
		status: z.enum(['healthy', 'unhealthy', 'degraded']).openapi({
			description: 'Overall health status',
			example: 'healthy',
		}),
		message: z.string().openapi({
			description: 'Health status message',
			example: 'API Health Status: HEALTHY',
		}),
		timestamp: z.string().openapi({
			description: 'ISO timestamp when the health check was performed',
			example: '2024-01-01T12:00:00.000Z',
		}),
		uptime: z.number().openapi({
			description: 'Application uptime in seconds',
			example: 3600,
		}),
		version: z.string().openapi({
			description: 'Application version',
			example: '1.0.0',
		}),
		environment: z.string().openapi({
			description: 'Environment name',
			example: 'production',
		}),
		checks: z.object({
			database: z.object({
				status: z.enum(['healthy', 'unhealthy', 'unknown']).openapi({
					description: 'Database health status',
				}),
				responseTime: z.number().optional().openapi({
					description: 'Database response time in milliseconds',
				}),
				error: z.string().optional().openapi({
					description: 'Database error message if unhealthy',
				}),
			}),
			memory: z.object({
				status: z.enum(['healthy', 'unhealthy']).openapi({
					description: 'Memory health status',
				}),
				usagePercent: z.number().openapi({
					description: 'Memory usage percentage',
				}),
				usageMB: z.number().openapi({
					description: 'Memory usage in megabytes',
				}),
			}),
			disk: z.object({
				status: z.enum(['healthy', 'unhealthy']).openapi({
					description: 'Disk health status',
				}),
				usagePercent: z.number().optional().openapi({
					description: 'Disk usage percentage',
				}),
			}),
			dependencies: z.object({
				status: z.enum(['healthy', 'unhealthy', 'degraded']).openapi({
					description: 'Dependencies health status',
				}),
				services: z.array(
					z.object({
						name: z.string().openapi({
							description: 'Service name',
						}),
						status: z.enum(['healthy', 'unhealthy']).openapi({
							description: 'Service health status',
						}),
						responseTime: z.number().optional().openapi({
							description: 'Service response time in milliseconds',
						}),
						error: z.string().optional().openapi({
							description: 'Service error message if unhealthy',
						}),
					}),
				),
			}),
		}),
	}),
	'Detailed API health check response for ALB and monitoring',
)

// Readiness probe response schema
const readinessResponseSchema = registerZodSchema(
	'ReadinessResponse',
	z.object({
		ready: z.boolean().openapi({
			description: 'Whether the application is ready to receive traffic',
			example: true,
		}),
		message: z.string().openapi({
			description: 'Readiness status message',
			example: 'Application is ready',
		}),
		timestamp: z.string().openapi({
			description: 'ISO timestamp when the readiness check was performed',
			example: '2024-01-01T12:00:00.000Z',
		}),
		checks: z.object({
			database: z.boolean().openapi({
				description: 'Database readiness status',
			}),
			dependencies: z.boolean().openapi({
				description: 'Dependencies readiness status',
			}),
			configuration: z.boolean().openapi({
				description: 'Configuration readiness status',
			}),
		}),
	}),
	'Application readiness probe response',
)

// Liveness probe response schema
const livenessResponseSchema = registerZodSchema(
	'LivenessResponse',
	z.object({
		alive: z.boolean().openapi({
			description: 'Whether the application is alive',
			example: true,
		}),
		message: z.string().openapi({
			description: 'Liveness status message',
			example: 'Application is alive',
		}),
		timestamp: z.string().openapi({
			description: 'ISO timestamp when the liveness check was performed',
			example: '2024-01-01T12:00:00.000Z',
		}),
		uptime: z.number().openapi({
			description: 'Application uptime in seconds',
			example: 3600,
		}),
	}),
	'Application liveness probe response',
)

// Configuration validation response schema
const configurationResponseSchema = registerZodSchema(
	'ConfigurationResponse',
	z.object({
		status: z.enum(['healthy', 'unhealthy', 'degraded']).openapi({
			description: 'Overall configuration health status',
			example: 'healthy',
		}),
		message: z.string().openapi({
			description: 'Configuration status message',
			example: 'Configuration is healthy',
		}),
		timestamp: z.string().openapi({
			description: 'ISO timestamp when the configuration check was performed',
			example: '2024-01-01T12:00:00.000Z',
		}),
		checks: z.object({
			critical: z.object({
				ready: z.boolean().openapi({
					description: 'Critical configuration variables status',
				}),
				missing: z.array(z.string()).openapi({
					description: 'Missing critical configuration variables',
				}),
			}),
			important: z.object({
				ready: z.boolean().openapi({
					description: 'Important configuration variables status',
				}),
				missing: z.array(z.string()).openapi({
					description: 'Missing important configuration variables',
				}),
			}),
			optional: z.object({
				ready: z.boolean().openapi({
					description: 'Optional configuration variables status',
				}),
				missing: z.array(z.string()).openapi({
					description: 'Missing optional configuration variables',
				}),
			}),
		}),
	}),
	'Configuration validation response',
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

export {
	configurationResponseSchema,
	detailedHealthResponseSchema,
	healthErrorSchema,
	healthResponseSchema,
	livenessResponseSchema,
	readinessResponseSchema,
	systemInfoResponseSchema,
}
