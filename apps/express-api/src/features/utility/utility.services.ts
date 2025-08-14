import { readFileSync } from 'fs'
import { join } from 'path'

import { tryCatchSync } from '../../utils/error-handling/try-catch.ts'
import { InternalError, Result } from '../../utils/errors.ts'
import { pino } from '../../utils/logger.ts'

import {
	IUtilityService,
	TDetailedHealthStatus,
	THealthStatus,
	TLivenessStatus,
	TReadinessStatus,
	TSystemInfo,
} from './utility.types.ts'

const { logger } = pino

/**
 * UtilityService class that implements the IUtilityService interface
 * Handles business logic for utility operations like health checks
 */
class UtilityService implements IUtilityService {
	/**
	 * Get application version from package.json or environment variable
	 * @returns Application version string
	 */
	private getApplicationVersion(): string {
		// Try environment variable first (useful for CI/CD)
		const envVersion =
			process.env.APP_VERSION ?? process.env.npm_package_version
		if (envVersion) {
			return envVersion
		}

		// Fallback to reading package.json
		try {
			const packageJsonPath = join(process.cwd(), 'package.json')
			const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as {
				version?: string
			}
			return packageJson.version ?? '0.0.0'
		} catch (error) {
			logger.warn({
				msg: '[utilityService - getApplicationVersion]: Failed to read version from package.json',
				error: error instanceof Error ? error.message : 'Unknown error',
			})
			return '0.0.0'
		}
	}

	/**
	 * Get the health status of the API
	 * Performs basic health checks and returns status
	 * @returns Result tuple with health status or error
	 */
	getHealthStatus = (): Result<THealthStatus> => {
		// Perform basic health checks using tryCatchSync
		const [healthCheck, error] = tryCatchSync(() => {
			// Basic health checks - can be extended with database, external service checks, etc.
			const currentTime = new Date()
			const uptime = process.uptime()

			// Check if basic Node.js process is healthy
			if (uptime < 0) {
				throw new InternalError('Process uptime is invalid', 'utilityService')
			}

			// Check memory usage (basic check)
			const memoryUsage = process.memoryUsage()
			const memoryUsageMB = memoryUsage.heapUsed / 1024 / 1024

			// Log health check details
			logger.info({
				msg: '[utilityService - getHealthStatus]: Health check performed',
				uptime: `${Math.floor(uptime).toString()}s`,
				memoryUsage: `${Math.round(memoryUsageMB).toString()}MB`,
				timestamp: currentTime.toISOString(),
			})

			return {
				message: 'Api Health Status: OK',
				timestamp: currentTime.toISOString(),
				uptime: Math.floor(uptime),
				memoryUsageMB: Math.round(memoryUsageMB),
			}
		}, 'utilityService - getHealthStatus')

		if (error) {
			logger.error({
				msg: '[utilityService - getHealthStatus]: Health check failed',
				error: error.message,
			})
			return [null, error]
		}

		return [healthCheck, null]
	}

	/**
	 * Get detailed system information
	 * Returns more comprehensive system health data
	 * @returns Result tuple with system info or error
	 */
	getSystemInfo = (): Result<TSystemInfo> => {
		const [systemInfo, error] = tryCatchSync(() => {
			const memoryUsage = process.memoryUsage()
			const cpuUsage = process.cpuUsage()

			const systemInfo: TSystemInfo = {
				nodeVersion: process.version,
				platform: process.platform,
				architecture: process.arch,
				uptime: process.uptime(),
				memoryUsage: {
					rss: Math.round(memoryUsage.rss / 1024 / 1024),
					heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024),
					heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024),
					external: Math.round(memoryUsage.external / 1024 / 1024),
				},
				cpuUsage: {
					user: cpuUsage.user,
					system: cpuUsage.system,
				},
				timestamp: new Date().toISOString(),
			}

			return systemInfo
		}, 'utilityService - getSystemInfo')

		if (error) {
			logger.error({
				msg: '[utilityService - getSystemInfo]: Failed to get system info',
				error: error.message,
			})
			return [null, error]
		}

		return [systemInfo, null]
	}

	/**
	 * Get detailed health status for ALB and monitoring
	 * Performs comprehensive health checks including dependencies
	 * @returns Result tuple with detailed health status or error
	 */
	getDetailedHealthStatus = (): Result<TDetailedHealthStatus> => {
		const [healthStatus, error] = tryCatchSync(() => {
			const currentTime = new Date()
			const uptime = process.uptime()
			const memoryUsage = process.memoryUsage()
			const memoryUsageMB = Math.round(memoryUsage.heapUsed / 1024 / 1024)
			const memoryUsagePercent = memoryUsage.heapTotal
				? Math.round((memoryUsage.heapUsed / memoryUsage.heapTotal) * 100)
				: 0

			// Determine overall health status
			let overallStatus: 'healthy' | 'unhealthy' | 'degraded' = 'healthy'
			const checks = {
				database: this.checkDatabaseHealth(),
				memory: this.checkMemoryHealth(memoryUsagePercent, memoryUsageMB),
				disk: this.checkDiskHealth(),
				dependencies: this.checkDependenciesHealth(),
			}

			// Determine overall status based on individual checks
			if (
				checks.database.status === 'unhealthy' ||
				checks.memory.status === 'unhealthy' ||
				checks.disk.status === 'unhealthy' ||
				checks.dependencies.status === 'unhealthy'
			) {
				overallStatus = 'unhealthy'
			} else if (
				checks.database.status === 'unknown' ||
				checks.dependencies.status === 'degraded'
			) {
				overallStatus = 'degraded'
			}

			const healthStatus: TDetailedHealthStatus = {
				status: overallStatus,
				message: `API Health Status: ${overallStatus.toUpperCase()}`,
				timestamp: currentTime.toISOString(),
				uptime: Math.floor(uptime),
				version: this.getApplicationVersion(),
				environment: process.env.NODE_ENV ?? 'development',
				checks,
			}

			logger.info({
				msg: '[utilityService - getDetailedHealthStatus]: Detailed health check performed',
				status: overallStatus,
				uptime: `${Math.floor(uptime).toString()}s`,
				memoryUsage: `${memoryUsageMB.toString()}MB`,
				timestamp: currentTime.toISOString(),
			})

			return healthStatus
		}, 'utilityService - getDetailedHealthStatus')

		if (error) {
			logger.error({
				msg: '[utilityService - getDetailedHealthStatus]: Detailed health check failed',
				error: error.message,
			})
			return [null, error]
		}

		return [healthStatus, null]
	}

	/**
	 * Get readiness status for Kubernetes-style readiness probes
	 * Checks if the application is ready to receive traffic
	 * @returns Result tuple with readiness status or error
	 */
	getReadinessStatus = (): Result<TReadinessStatus> => {
		const [readinessStatus, error] = tryCatchSync(() => {
			const currentTime = new Date()

			// Check readiness criteria
			const databaseReady = this.isDatabaseReady()
			const dependenciesReady = this.areDependenciesReady()
			const configurationReady = this.isConfigurationReady()

			const ready = databaseReady && dependenciesReady && configurationReady

			const readinessStatus: TReadinessStatus = {
				ready,
				message: ready ? 'Application is ready' : 'Application is not ready',
				timestamp: currentTime.toISOString(),
				checks: {
					database: databaseReady,
					dependencies: dependenciesReady,
					configuration: configurationReady,
				},
			}

			logger.info({
				msg: '[utilityService - getReadinessStatus]: Readiness check performed',
				ready,
				timestamp: currentTime.toISOString(),
			})

			return readinessStatus
		}, 'utilityService - getReadinessStatus')

		if (error) {
			logger.error({
				msg: '[utilityService - getReadinessStatus]: Readiness check failed',
				error: error.message,
			})
			return [null, error]
		}

		return [readinessStatus, null]
	}

	/**
	 * Get liveness status for Kubernetes-style liveness probes
	 * Checks if the application is alive and should not be restarted
	 * @returns Result tuple with liveness status or error
	 */
	getLivenessStatus = (): Result<TLivenessStatus> => {
		const [livenessStatus, error] = tryCatchSync(() => {
			const currentTime = new Date()
			const uptime = process.uptime()

			// Basic liveness check - if we can execute this code, we're alive
			const alive = uptime > 0

			const livenessStatus: TLivenessStatus = {
				alive,
				message: alive
					? 'Application is alive'
					: 'Application is not responding',
				timestamp: currentTime.toISOString(),
				uptime: Math.floor(uptime),
			}

			return livenessStatus
		}, 'utilityService - getLivenessStatus')

		if (error) {
			logger.error({
				msg: '[utilityService - getLivenessStatus]: Liveness check failed',
				error: error.message,
			})
			return [null, error]
		}

		return [livenessStatus, null]
	}

	/**
	 * Check database health
	 * @returns Database health status
	 */
	private checkDatabaseHealth = (): {
		status: 'healthy' | 'unhealthy' | 'unknown'
		responseTime?: number
		error?: string
	} => {
		// For now, we'll check if database connection string is configured
		// In a real implementation, you would ping the database
		// TODO: Use proper config management for database URL
		const databaseUrl = process.env.DATABASE_URL

		if (!databaseUrl) {
			return {
				status: 'unknown',
				error: 'Database URL not configured',
			}
		}

		// TODO: Implement actual database ping when database is integrated
		// For now, assume healthy if URL is configured
		return {
			status: 'healthy',
			responseTime: 0, // Would be actual response time
		}
	}

	/**
	 * Check memory health
	 * @param usagePercent Memory usage percentage
	 * @param usageMB Memory usage in MB
	 * @returns Memory health status
	 */
	private checkMemoryHealth = (
		usagePercent: number,
		usageMB: number,
	): {
		status: 'healthy' | 'unhealthy'
		usagePercent: number
		usageMB: number
	} => {
		// Consider unhealthy if memory usage is above 90%
		const status = usagePercent > 90 ? 'unhealthy' : 'healthy'

		return {
			status,
			usagePercent,
			usageMB,
		}
	}

	/**
	 * Check disk health
	 * @returns Disk health status
	 */
	private checkDiskHealth = (): {
		status: 'healthy' | 'unhealthy'
		usagePercent?: number
	} => {
		// TODO: Implement actual disk space monitoring using fs.statSync or similar
		// For now, return healthy status without usage percentage to avoid misleading data
		return {
			status: 'healthy',
			usagePercent: undefined, // Explicitly undefined until real implementation
		}
	}

	/**
	 * Check dependencies health
	 * @returns Dependencies health status
	 */
	private checkDependenciesHealth = () => {
		// Check external dependencies like OpenAI API, Redis, etc.
		const services = [
			{
				name: 'OpenAI API',
				status: this.checkOpenAIHealth(),
			},
			{
				name: 'Redis',
				status: this.checkRedisHealth(),
			},
		]

		const unhealthyServices = services.filter(
			(s) => s.status.status === 'unhealthy',
		)
		let overallStatus: 'healthy' | 'unhealthy' | 'degraded' = 'healthy'

		if (unhealthyServices.length === services.length) {
			overallStatus = 'unhealthy'
		} else if (unhealthyServices.length > 0) {
			overallStatus = 'degraded'
		}

		return {
			status: overallStatus,
			services: services.map((s) => ({
				name: s.name,
				status: s.status.status,
				responseTime: s.status.responseTime,
				error: s.status.error,
			})),
		}
	}

	/**
	 * Check if database is ready
	 * @returns Boolean indicating database readiness
	 */
	private isDatabaseReady = (): boolean => {
		// Check if database connection is available and ready
		// TODO: Use proper config management for database URL
		const databaseUrl = process.env.DATABASE_URL
		return Boolean(databaseUrl)
	}

	/**
	 * Check if dependencies are ready
	 * @returns Boolean indicating dependencies readiness
	 */
	private areDependenciesReady = (): boolean => {
		// Check if critical dependencies are available
		const openAIKey = process.env.OPENAI_API_KEY
		return Boolean(openAIKey)
	}

	/**
	 * Check if configuration is ready
	 * @returns Boolean indicating configuration readiness
	 */
	private isConfigurationReady = (): boolean => {
		// Check if critical configuration is available
		const requiredEnvVars = ['NODE_ENV', 'PORT']
		return requiredEnvVars.every((envVar) => process.env[envVar])
	}

	/**
	 * Check OpenAI API health
	 * @returns OpenAI health status
	 */
	private checkOpenAIHealth = () => {
		const apiKey = process.env.OPENAI_API_KEY

		if (!apiKey) {
			return {
				status: 'unhealthy' as const,
				error: 'OpenAI API key not configured',
			}
		}

		// TODO: Implement actual OpenAI API ping
		// For now, assume healthy if API key is configured
		return {
			status: 'healthy' as const,
			responseTime: 0,
		}
	}

	/**
	 * Check Redis health
	 * @returns Redis health status
	 */
	private checkRedisHealth = () => {
		// TODO: Use proper config management for Redis URL
		const redisUrl = process.env.REDIS_URL

		if (!redisUrl) {
			return {
				status: 'unhealthy' as const,
				error: 'Redis URL not configured',
			}
		}

		// TODO: Implement actual Redis ping
		// For now, assume healthy if URL is configured
		return {
			status: 'healthy' as const,
			responseTime: 0,
		}
	}
}

// Create an instance of the UtilityService
const utilityService = new UtilityService()

export { utilityService }
