/**
 * AWS Lambda Handler for Macro AI Express API
 * Simplified serverless-http wrapper without complex Powertools coordination
 */

import { Logger } from '@aws-lambda-powertools/logger'
import type {
	APIGatewayProxyEvent,
	APIGatewayProxyResult,
	Context,
} from 'aws-lambda'
import type { Express, Response } from 'express'
import serverless from 'serverless-http'

import { enhancedConfigService } from './services/enhanced-config.service.ts'
import { validateConfigAfterParameterStore } from './utils/load-config.ts'
import { createServer } from './utils/server.ts'

// Initialize Powertools Logger for Lambda
const logger = new Logger({
	serviceName: 'macro-ai-express-api',
	logLevel:
		(process.env.LOG_LEVEL as
			| 'DEBUG'
			| 'INFO'
			| 'WARN'
			| 'ERROR'
			| undefined) ?? 'INFO',
	environment: process.env.NODE_ENV ?? 'production',
})

// Force cold start for testing - version 1.1
logger.info('Lambda handler version 1.1 - testing Parameter Store fix')

// Global variables for Lambda container reuse
let app: Express | null = null
let serverlessHandler: ReturnType<typeof serverless> | null = null
let isInitialized = false

/**
 * Initialize Express application for Lambda environment
 */
const initializeExpressApp = (): Express => {
	logger.info('Initializing Express app for Lambda', {
		operation: 'initializeExpressApp',
		coldStart: !isInitialized,
	})

	try {
		// Create the Express server using the existing createServer function
		const expressApp = createServer()

		logger.info('Express app initialized successfully for Lambda', {
			operation: 'expressAppInit',
			coldStart: !isInitialized,
		})

		return expressApp
	} catch (error) {
		const errorMessage =
			error instanceof Error ? error.message : 'Unknown error'

		logger.error('Failed to initialize Express app', {
			operation: 'initializeExpressApp',
			error: errorMessage,
			coldStart: !isInitialized,
		})

		throw new Error(`Express app initialization failed: ${errorMessage}`)
	}
}

/**
 * Initialize serverless-http handler
 */
const initializeServerlessHandler = (expressApp: Express) => {
	logger.info('Initializing serverless-http handler', {
		operation: 'initializeServerlessHandler',
	})

	return serverless(expressApp, {
		// Request/response transformation options
		binary: false,

		// Request transformation
		request: (
			request: Express.Request,
			event: APIGatewayProxyEvent,
			context: Context,
		) => {
			// Add Lambda context to request for potential use in middleware
			request.lambda = {
				event,
				context,
			}

			// Add request ID for tracing
			request.requestId = context.awsRequestId

			logger.debug('Processing Lambda request', {
				operation: 'requestTransformation',
				requestId: context.awsRequestId,
				httpMethod: event.httpMethod,
				path: event.path,
			})
		},

		// Response transformation
		response: (
			response: Response,
			event: APIGatewayProxyEvent,
			context: Context,
		) => {
			logger.debug('Processing Lambda response', {
				operation: 'responseTransformation',
				requestId: context.awsRequestId,
				statusCode: response.statusCode,
			})
		},
	})
}

/**
 * AWS Lambda Handler
 * Entry point for all API Gateway requests
 */
export const handler = async (
	event: APIGatewayProxyEvent,
	context: Context,
): Promise<APIGatewayProxyResult> => {
	// Set up request context for logging
	logger.addContext(context)

	logger.info('Lambda invocation started', {
		operation: 'lambdaInvocation',
		httpMethod: event.httpMethod,
		path: event.path,
		coldStart: !isInitialized,
		requestId: context.awsRequestId,
	})

	try {
		// Initialize Express app on cold start
		if (!app || !serverlessHandler) {
			logger.info('Cold start - initializing Express app', {
				operation: 'coldStartInit',
				requestId: context.awsRequestId,
			})

			// Load parameters from Parameter Store and populate process.env
			logger.info('Loading parameters from Parameter Store', {
				operation: 'loadParameters',
				requestId: context.awsRequestId,
			})

			const [configValues, configError] =
				await enhancedConfigService.getAllMappedConfig()

			if (configError) {
				logger.warn(
					'Parameter Store loading failed, continuing with environment variables',
					{
						operation: 'loadParametersFailed',
						requestId: context.awsRequestId,
						error: configError.message,
					},
				)
			} else {
				// Populate process.env with Parameter Store values
				for (const [envVar, configValue] of Object.entries(configValues)) {
					process.env[envVar] = configValue.value
					logger.debug('Environment variable populated from Parameter Store', {
						operation: 'envVarPopulated',
						envVar,
						source: configValue.source,
					})
				}

				logger.info('Parameters loaded and environment populated', {
					operation: 'loadParametersSuccess',
					requestId: context.awsRequestId,
					parametersLoaded: Object.keys(configValues).length,
				})

				// Re-validate configuration after Parameter Store has populated values
				const [, validationError] = validateConfigAfterParameterStore()
				if (validationError) {
					logger.error(
						'Configuration validation failed after Parameter Store loading',
						{
							operation: 'postParameterStoreValidationFailed',
							requestId: context.awsRequestId,
							error: validationError.message,
						},
					)
					throw new Error(
						`Configuration validation failed: ${validationError.message}`,
					)
				}

				logger.info(
					'Configuration validated successfully after Parameter Store loading',
					{
						operation: 'postParameterStoreValidationSuccess',
						requestId: context.awsRequestId,
					},
				)
			}

			app = initializeExpressApp()
			serverlessHandler = initializeServerlessHandler(app)
			isInitialized = true

			logger.info('Cold start completed', {
				operation: 'coldStartComplete',
				requestId: context.awsRequestId,
			})
		} else {
			logger.info('Warm start - reusing existing Express app', {
				operation: 'warmStart',
				requestId: context.awsRequestId,
			})
		}

		// Process the request through serverless-http
		const response = (await serverlessHandler(
			event,
			context,
		)) as APIGatewayProxyResult

		logger.info('Lambda invocation completed successfully', {
			operation: 'lambdaInvocationComplete',
			statusCode: response.statusCode,
			requestId: context.awsRequestId,
		})

		return response
	} catch (error) {
		const errorMessage =
			error instanceof Error ? error.message : 'Unknown error'

		logger.error('Lambda invocation failed', {
			operation: 'lambdaInvocationError',
			error: errorMessage,
			requestId: context.awsRequestId,
		})

		// Return a proper API Gateway error response
		return {
			statusCode: 500,
			headers: {
				'Content-Type': 'application/json',
				'Access-Control-Allow-Origin': '*',
				'Access-Control-Allow-Headers':
					'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
				'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
			},
			body: JSON.stringify({
				error: 'Internal Server Error',
				message: 'An unexpected error occurred',
				requestId: context.awsRequestId,
			}),
		}
	}
}

// Export for testing
export { initializeExpressApp, initializeServerlessHandler }
