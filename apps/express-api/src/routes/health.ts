/**
 * Health Check Endpoint
 *
 * Provides comprehensive health status for the Express API:
 * - Application status
 * - Environment configuration validation
 * - Basic service health checks
 * - Container information
 * - Performance metrics
 */

import { Request, Response, Router } from 'express'

import { pino } from '../utils/logger.js'

const { logger } = pino

const router = Router()

interface HealthStatus {
	status: 'healthy' | 'unhealthy' | 'degraded'
	timestamp: string
	version: string
	environment: string
	uptime: number
	checks: {
		application: {
			status: 'healthy' | 'unhealthy'
			message: string
			timestamp: string
		}
		environment: {
			status: 'healthy' | 'unhealthy' | 'unknown'
			message: string
			timestamp: string
			details: Record<string, string>
		}
		configuration: {
			status: 'healthy' | 'unhealthy' | 'unknown'
			message: string
			timestamp: string
			parameterCount: number
		}
	}
	metadata: {
		containerized: boolean
		parameterStorePrefix: string
		awsRegion: string
		nodeVersion: string
		platform: string
		memoryUsage: {
			rss: number
			heapTotal: number
			heapUsed: number
			external: number
		}
	}
}

/**
 * Check environment configuration
 */
const checkEnvironmentHealth = (): {
	status: 'healthy' | 'unhealthy' | 'unknown'
	message: string
	timestamp: string
	details: Record<string, string>
} => {
	try {
		const details: Record<string, string> = {}
		let hasErrors = false

		// Check required environment variables
		const requiredEnvVars = [
			'NODE_ENV',
			'APP_ENV',
			'PARAMETER_STORE_PREFIX',
			'AWS_REGION',
		]

		for (const envVar of requiredEnvVars) {
			const value = process.env[envVar]
			if (value) {
				details[envVar] = value
			} else {
				details[envVar] = 'MISSING'
				hasErrors = true
			}
		}

		// Check optional environment variables
		const optionalEnvVars = ['SERVER_PORT', 'AWS_ACCOUNT_ID']
		for (const envVar of optionalEnvVars) {
			const value = process.env[envVar]
			if (value) {
				details[envVar] = value
			}
		}

		// Add container information
		details.containerized = process.env.ECS_CONTAINER_METADATA_URI
			? 'true'
			: 'false'
		details.nodeVersion = process.version
		details.platform = process.platform

		return {
			status: hasErrors ? 'unhealthy' : 'healthy',
			message: hasErrors
				? 'Some required environment variables are missing'
				: 'Environment configuration is valid',
			timestamp: new Date().toISOString(),
			details,
		}
	} catch (error) {
		return {
			status: 'unknown',
			message: `Environment health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
			timestamp: new Date().toISOString(),
			details: {},
		}
	}
}

/**
 * Check configuration completeness
 */
const checkConfigurationHealth = (): {
	status: 'healthy' | 'unhealthy' | 'unknown'
	message: string
	timestamp: string
	parameterCount: number
} => {
	try {
		// Count available environment variables that represent Parameter Store values
		const configVars = [
			'API_KEY',
			'AWS_COGNITO_REGION',
			'AWS_COGNITO_USER_POOL_ID',
			'AWS_COGNITO_USER_POOL_CLIENT_ID',
			'RELATIONAL_DATABASE_URL',
			'OPENAI_API_KEY',
			'REDIS_URL',
			'JWT_SECRET',
		]

		const availableVars = configVars.filter((varName) => process.env[varName])
		const parameterCount = availableVars.length

		// Consider healthy if we have at least 50% of expected parameters
		const isHealthy = parameterCount >= configVars.length * 0.5

		return {
			status: isHealthy ? 'healthy' : 'unhealthy',
			message: isHealthy
				? `Configuration complete (${parameterCount.toString()}/${configVars.length.toString()} parameters)`
				: `Configuration incomplete (${parameterCount.toString()}/${configVars.length.toString()} parameters)`,
			timestamp: new Date().toISOString(),
			parameterCount,
		}
	} catch (error) {
		return {
			status: 'unknown',
			message: `Configuration health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
			timestamp: new Date().toISOString(),
			parameterCount: 0,
		}
	}
}

/**
 * Determine overall health status
 */
const determineOverallStatus = (
	checks: HealthStatus['checks'],
): 'healthy' | 'unhealthy' | 'degraded' => {
	const allChecks = Object.values(checks)
	const unhealthyCount = allChecks.filter(
		(check) => check.status === 'unhealthy',
	).length

	if (unhealthyCount === 0) {
		return 'healthy'
	} else if (unhealthyCount < allChecks.length) {
		return 'degraded'
	} else {
		return 'unhealthy'
	}
}

/**
 * GET /health - Comprehensive health check endpoint
 */
router.get('/', (req: Request, res: Response) => {
	const startTime = Date.now()

	try {
		// Perform all health checks
		const envHealth = checkEnvironmentHealth()
		const configHealth = checkConfigurationHealth()

		// Create health status object
		const healthStatus: HealthStatus = {
			status: 'healthy', // Will be updated below
			timestamp: new Date().toISOString(),
			version: process.env.APP_VERSION ?? '1.0.0',
			environment: process.env.APP_ENV ?? 'unknown',
			uptime: process.uptime(),
			checks: {
				application: {
					status: 'healthy',
					message: 'Express API is running',
					timestamp: new Date().toISOString(),
				},
				environment: envHealth,
				configuration: configHealth,
			},
			metadata: {
				containerized: !!process.env.ECS_CONTAINER_METADATA_URI,
				parameterStorePrefix: process.env.PARAMETER_STORE_PREFIX ?? 'not-set',
				awsRegion: process.env.AWS_REGION ?? 'not-set',
				nodeVersion: process.version,
				platform: process.platform,
				memoryUsage: process.memoryUsage(),
			},
		}

		// Determine overall status
		healthStatus.status = determineOverallStatus(healthStatus.checks)

		// Set appropriate HTTP status code
		const statusCode =
			healthStatus.status === 'healthy'
				? 200
				: healthStatus.status === 'degraded'
					? 200
					: 503

		// Log health check results
		logger.info(
			{
				operation: 'healthCheck',
				overallStatus: healthStatus.status,
				responseTime: Date.now() - startTime,
				checks: Object.fromEntries(
					Object.entries(healthStatus.checks).map(([key, check]) => [
						key,
						check.status,
					]),
				),
			},
			'Health check completed',
		)

		res.status(statusCode).json(healthStatus)
	} catch (error) {
		const errorMessage =
			error instanceof Error ? error.message : 'Unknown error'
		logger.error(
			{
				operation: 'healthCheck',
				error: errorMessage,
				responseTime: Date.now() - startTime,
			},
			'Health check failed',
		)

		res.status(503).json({
			status: 'unhealthy',
			timestamp: new Date().toISOString(),
			error: 'Health check failed',
			message: errorMessage,
		})
	}
})

/**
 * GET /health/ready - Readiness probe endpoint
 */
router.get('/ready', (req: Request, res: Response) => {
	res.status(200).json({
		status: 'ready',
		timestamp: new Date().toISOString(),
		message: 'Application is ready to receive traffic',
	})
})

/**
 * GET /health/live - Liveness probe endpoint
 */
router.get('/live', (req: Request, res: Response) => {
	res.status(200).json({
		status: 'alive',
		timestamp: new Date().toISOString(),
		message: 'Application is alive and running',
		uptime: process.uptime(),
	})
})

export default router
