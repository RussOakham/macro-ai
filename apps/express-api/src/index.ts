/**
 * Application Entry Point
 * Uses the modular configuration system with Zod validation and runtime type checking
 */

import { createServer as createHttpServer } from 'node:http'
import { exit } from 'node:process'

import { assertConfig } from './config/simple-config.ts'
import { logger } from './utils/logger.ts'
import { createServer } from './utils/server.ts'

/**
 * Start the Express server with the simplified configuration system
 */
const startServer = () => {
	try {
		// Load configuration using the simplified system - ONCE at startup
		const config = assertConfig(true)

		logger.info(
			{
				nodeEnv: config.nodeEnv,
				appEnv: config.appEnv,
				port: config.port,
			},
			'Configuration loaded successfully',
		)

		// Create and start the server
		// Note: Using HTTP server as HTTPS termination is handled by AWS ALB/CloudFront
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
				exit(0)
			})

			// Force close after 10 seconds
			setTimeout(() => {
				logger.error(
					'Could not close connections in time, forcefully shutting down',
				)
				exit(1)
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
		exit(1)
	}
}

// Start the server
try {
	startServer()
} catch (error: unknown) {
	logger.error(error as Error, 'Unhandled error during server startup')
	exit(1)
}
