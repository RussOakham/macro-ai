import { tryCatchSync } from '../../utils/error-handling/try-catch.ts'
import { InternalError, Result } from '../../utils/errors.ts'
import { pino } from '../../utils/logger.ts'

import { IUtilityService, THealthStatus, TSystemInfo } from './utility.types.ts'

const { logger } = pino

/**
 * UtilityService class that implements the IUtilityService interface
 * Handles business logic for utility operations like health checks
 */
class UtilityService implements IUtilityService {
	/**
	 * Get the health status of the API
	 * Performs basic health checks and returns status
	 * @returns Result tuple with health status or error
	 */
	getHealthStatus(): Result<THealthStatus> {
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
	getSystemInfo(): Result<TSystemInfo> {
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
}

// Create an instance of the UtilityService
const utilityService = new UtilityService()

export { utilityService }
