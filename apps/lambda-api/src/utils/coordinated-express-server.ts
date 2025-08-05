/**
 * Coordinated Express Server for Lambda
 * Creates an Express server with Powertools-Express logger coordination
 * This approach enhances the original Express server with coordination middleware
 */

import type { Express } from 'express'

// Import Powertools coordination
import { powertoolsExpressCoordinationMiddleware } from './powertools-express-logger-coordination.js'
import { logger as powertoolsLogger } from './powertools-logger.js'

/**
 * Configuration for the coordinated Express server
 */
export interface CoordinatedExpressServerConfig {
	/** Enable Powertools-Express coordination */
	enableCoordination?: boolean
	/** Enable debug logging for coordination */
	enableDebugLogging?: boolean
}

/**
 * Default configuration for coordinated Express server
 */
export const defaultCoordinatedExpressServerConfig: CoordinatedExpressServerConfig =
	{
		enableCoordination: true,
		enableDebugLogging: false,
	}

/**
 * Enhance an existing Express server with Powertools coordination
 * This function adds coordination middleware to an existing Express app
 */
export const enhanceExpressServerWithCoordination = (
	app: Express,
	config: CoordinatedExpressServerConfig = defaultCoordinatedExpressServerConfig,
): Express => {
	if (!config.enableCoordination) {
		powertoolsLogger.info('Powertools-Express coordination disabled', {
			operation: 'enhanceExpressServerWithCoordination',
		})
		return app
	}

	powertoolsLogger.info(
		'Enhancing Express server with Powertools coordination',
		{
			operation: 'enhanceExpressServerWithCoordination',
			debugLogging: config.enableDebugLogging,
		},
	)

	// Add Powertools-Express coordination middleware at the beginning
	// This should be added before other middleware to ensure proper context
	app.use(
		powertoolsExpressCoordinationMiddleware({
			enabled: true,
			options: {
				enableRequestCorrelation: true,
				enableTraceIdPropagation: true,
				enableSharedLogFormatting: true,
				enablePinoEnhancement: true,
				enableLambdaContextInjection: true,
				enableUnifiedErrorLogging: true,
				enableDebugLogging: config.enableDebugLogging,
			},
		}),
	)

	powertoolsLogger.info('Powertools-Express coordination middleware added', {
		operation: 'enhanceExpressServerWithCoordination',
		middlewareAdded: true,
	})

	return app
}

/**
 * Create Lambda Express server with coordination
 * This function creates an Express server using the original createServer function
 * and enhances it with Powertools coordination
 */
export const createLambdaExpressServer = async (): Promise<Express> => {
	powertoolsLogger.info('Creating Lambda Express server with coordination', {
		operation: 'createLambdaExpressServer',
	})

	// Import and create the original Express server
	const { createServer } = await import('@repo/express-api/src/utils/server.js')
	const app = createServer()

	// Enhance with coordination
	const enhancedApp = enhanceExpressServerWithCoordination(app, {
		enableCoordination: true,
		enableDebugLogging: process.env.NODE_ENV !== 'production',
	})

	powertoolsLogger.info('Lambda Express server created with coordination', {
		operation: 'createLambdaExpressServer',
		coordinationEnabled: true,
	})

	return enhancedApp
}
