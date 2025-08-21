/**
 * Application Entry Point
 * Uses the modular configuration system with Zod validation and runtime type checking
 */

import { createServer as createHttpServer } from 'http'

import { loadAppConfig } from './config/index.ts'
import { pino } from './utils/logger.ts'
import { createServer } from './utils/server.ts'

const { logger } = pino

/**
 * Start the Express server with the new configuration system
 */
const startServer = async () => {
	try {
		// Load configuration using the new system
		// Automatically detects environment and uses appropriate loader
		const [config, configError] = await loadAppConfig({
			enableMonitoring: true,
			enableCaching: true,
			validateSchema: true,
			includeMetadata: false,
		})

		if (configError) {
			logger.error(
				{ error: configError.message },
				'Failed to load application configuration',
			)
			process.exit(1)
		}

		logger.info(
			{
				nodeEnv: config.nodeEnv,
				appEnv: config.appEnv,
				port: config.port,
			},
			'Configuration loaded successfully',
		)

		// Create and start the server
		const app = createServer()
		const httpServer = createHttpServer(app)

		httpServer.listen(config.port, () => {
			logger.info(
				`Server is running on port: ${config.port.toString()} in ${config.nodeEnv} environment`,
			)
		})

		// Graceful shutdown handling
		const gracefulShutdown = (signal: string) => {
			logger.info(`Received ${signal}, shutting down gracefully`)

			httpServer.close(() => {
				logger.info('Server closed')
				process.exit(0)
			})

			// Force close after 10 seconds
			setTimeout(() => {
				logger.error(
					'Could not close connections in time, forcefully shutting down',
				)
				process.exit(1)
			}, 10000)
		}

		process.on('SIGTERM', () => {
			gracefulShutdown('SIGTERM')
		})
		process.on('SIGINT', () => {
			gracefulShutdown('SIGINT')
		})
	} catch (error) {
		logger.error(
			{ error: error instanceof Error ? error.message : String(error) },
			'Failed to start server',
		)
		process.exit(1)
	}
}

// Start the server
startServer().catch((error: unknown) => {
	console.error('Unhandled error during server startup:', error)
	process.exit(1)
})
