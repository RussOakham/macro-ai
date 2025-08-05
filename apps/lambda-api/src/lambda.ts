/**
 * AWS Lambda Handler for Macro AI Express API
 * Uses serverless-http to wrap the existing Express application
 */

import type {
	APIGatewayProxyEvent,
	APIGatewayProxyResult,
	Context,
} from 'aws-lambda'
import type { Express } from 'express'
import serverless from 'serverless-http'

import { lambdaConfig } from './services/lambda-config.service.js'
import {
	applyMiddlewareWithTracing,
	createMiddlewareStack,
} from './utils/lambda-middleware.js'
import { logger } from './utils/powertools-logger.js'
import {
	addMetric,
	measureAndRecordExecutionTime,
	MetricName,
	MetricUnit,
} from './utils/powertools-metrics.js'
import {
	captureError,
	subsegmentNames,
	traceErrorTypes,
	withSubsegment,
	withSubsegmentSync,
} from './utils/powertools-tracer.js'

// Global variables for Lambda container reuse
let app: Express | null = null
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let serverlessHandler: any = null
let isInitialized = false

/**
 * Initialize Express application for Lambda environment
 */
const initializeExpressApp = async (): Promise<Express> => {
	return withSubsegment(
		subsegmentNames.EXPRESS_INIT,
		async () => {
			logger.info('Initializing Express app for Lambda', {
				operation: 'initializeExpressApp',
				coldStart: !isInitialized,
			})

			try {
				// Initialize Lambda configuration with Parameter Store
				const isColdStart = !isInitialized

				// Measure configuration initialization time
				await measureAndRecordExecutionTime(
					() => lambdaConfig.initialize(isColdStart),
					MetricName.ConfigurationLoadTime,
					{ Operation: 'ParameterStoreInit' },
				)

				// Log configuration summary (without sensitive data)
				const configSummary = lambdaConfig.getConfigSummary()
				logger.info('Configuration loaded successfully', {
					operation: 'configurationLoad',
					configSummary,
					coldStart: isColdStart,
				})

				// Dynamically import and create Express server with tracing
				const expressApp = await withSubsegment(
					subsegmentNames.EXPRESS_MIDDLEWARE,
					async () => {
						const { createServer } = await import(
							'@repo/express-api/src/utils/server.js'
						)

						// Create Express app (createServer doesn't take parameters)
						return createServer()
					},
					{
						operation: 'createExpressServer',
						coldStart: isColdStart,
					},
					{
						serverModule: '@repo/express-api/src/utils/server.js',
						coldStart: isColdStart,
					},
				)

				logger.info('Express app initialized successfully for Lambda', {
					operation: 'expressAppInit',
					coldStart: isColdStart,
				})

				// Record successful initialization metric
				addMetric(MetricName.ExpressAppInitTime, MetricUnit.Count, 1, {
					Status: 'Success',
				})

				return expressApp
			} catch (error: unknown) {
				const errorMessage =
					error instanceof Error ? error.message : 'Unknown error'

				logger.error('Failed to initialize Express app', {
					operation: 'initializeExpressApp',
					error: errorMessage,
					errorType:
						error instanceof Error ? error.constructor.name : 'UnknownError',
					coldStart: !isInitialized,
				})

				// Record error metric
				addMetric(MetricName.ExpressAppInitError, MetricUnit.Count, 1, {
					ErrorType:
						error instanceof Error ? error.constructor.name : 'UnknownError',
				})

				// Capture error in X-Ray trace
				captureError(
					error instanceof Error ? error : new Error(errorMessage),
					traceErrorTypes.DEPENDENCY_ERROR,
					{
						operation: 'initializeExpressApp',
						coldStart: !isInitialized,
						errorType:
							error instanceof Error ? error.constructor.name : 'UnknownError',
					},
				)

				throw new Error(`Express app initialization failed: ${errorMessage}`)
			}
		},
		{
			operation: 'initializeExpressApp',
			coldStart: !isInitialized,
		},
		{
			coldStart: !isInitialized,
			expressModule: '@repo/express-api/src/utils/server.js',
		},
	)
}

/**
 * Initialize serverless-http handler
 */
const initializeServerlessHandler = (expressApp: Express) => {
	return withSubsegmentSync(
		subsegmentNames.EXPRESS_ROUTES,
		() => {
			logger.info('Initializing serverless-http handler', {
				operation: 'initializeServerlessHandler',
			})

			return serverless(expressApp, {
				// Request/response transformation options
				binary: false,

				// Custom request transformation
				request: (
					// eslint-disable-next-line @typescript-eslint/no-explicit-any
					request: any,
					event: APIGatewayProxyEvent,
					context: Context,
				) => {
					// Add Lambda context to request for potential use in Express middleware
					// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
					request.lambda = {
						event,
						context,
						isLambda: true,
						coldStart: !isInitialized,
						functionName: context.functionName,
						functionVersion: context.functionVersion,
						requestId: context.awsRequestId,
					}

					// Add custom headers for Lambda context
					// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
					request.headers['x-lambda-request-id'] = context.awsRequestId
					// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
					request.headers['x-lambda-function-name'] = context.functionName

					// eslint-disable-next-line @typescript-eslint/no-unsafe-return
					return request
				},

				// Custom response transformation
				response: (
					// eslint-disable-next-line @typescript-eslint/no-explicit-any
					response: any,
					_event: APIGatewayProxyEvent,
					context: Context,
				) => {
					// Add Lambda-specific headers
					// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
					if (response.headers) {
						// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
						response.headers['x-lambda-request-id'] = context.awsRequestId
						// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
						response.headers['x-lambda-cold-start'] =
							(!isInitialized).toString()
					}

					// eslint-disable-next-line @typescript-eslint/no-unsafe-return
					return response
				},
			})
		},
		{
			operation: 'initializeServerlessHandler',
		},
		{
			serverlessHttpModule: 'serverless-http',
			binaryMode: false,
		},
	)
}

/**
 * Health check handler (optional - for direct Lambda invocation)
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/require-await
export const healthCheck = async (_event: any, context: Context) => {
	return {
		statusCode: 200,
		headers: {
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({
			status: 'healthy',
			timestamp: new Date().toISOString(),
			functionName: context.functionName,
			functionVersion: context.functionVersion,
			requestId: context.awsRequestId,
			initialized: isInitialized,
			configStatus: lambdaConfig.isInitialized()
				? 'initialized'
				: 'not_initialized',
		}),
	}
}

/**
 * Core Lambda handler implementation (without middleware)
 * This handles Express app initialization and serverless-http integration
 */
const coreHandler = async (
	event: APIGatewayProxyEvent,
	context: Context,
): Promise<APIGatewayProxyResult> => {
	// Configure Lambda context
	context.callbackWaitsForEmptyEventLoop = false

	try {
		// Initialize Express app on cold start
		if (!app || !serverlessHandler) {
			logger.info('Cold start - initializing Express app', {
				operation: 'coldStartInit',
			})

			app = await initializeExpressApp()
			serverlessHandler = initializeServerlessHandler(app)
			isInitialized = true

			logger.info('Cold start completed', {
				operation: 'coldStartComplete',
			})
		} else {
			// Update cold start flag for warm invocations
			lambdaConfig.setColdStart(false)
			logger.info('Warm start - reusing existing Express app', {
				operation: 'warmStart',
			})
		}

		// Handle the request with serverless-http
		// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
		const result = await serverlessHandler(event, context)

		// eslint-disable-next-line @typescript-eslint/no-unsafe-return
		return result
	} catch (error) {
		const errorMessage =
			error instanceof Error ? error.message : 'Unknown error'

		logger.error('Lambda handler error', {
			operation: 'requestError',
			error: errorMessage,
			errorType:
				error instanceof Error ? error.constructor.name : 'UnknownError',
		})

		// Return error response
		return {
			statusCode: 500,
			headers: {
				'Content-Type': 'application/json',
				'Access-Control-Allow-Origin': '*',
				'Access-Control-Allow-Credentials': 'true',
				'x-lambda-request-id': context.awsRequestId,
				'x-lambda-error': 'true',
			},
			body: JSON.stringify({
				error: 'Internal Server Error',
				message: 'Lambda function encountered an error',
				requestId: context.awsRequestId,
				timestamp: new Date().toISOString(),
			}),
		}
	}
}

/**
 * Create middleware stack with comprehensive observability
 */
const middlewareStack = createMiddlewareStack({
	requestLogging: {
		enabled: true,
		options: {
			enableRequestBody: false, // Disabled for security
			enableResponseBody: false, // Disabled for security
			enableHeaders: true,
			maxBodySize: 1024,
		},
	},
	observability: {
		enabled: true,
		options: {
			enableRequestLogging: true,
			enablePerformanceMetrics: true,
			enableTracingAnnotations: true,
		},
	},
	performance: {
		enabled: true,
		options: {
			enableExecutionTime: true,
			enableMemoryUsage: true,
			enableColdStartTracking: true,
		},
	},
	errorHandling: {
		enabled: true,
		options: {
			enableFullObservability: true,
			enableErrorMetrics: true,
			enableErrorTracing: true,
		},
	},
})

/**
 * Export the main handler with middleware and X-Ray tracing
 */
export const handler = applyMiddlewareWithTracing(
	coreHandler,
	middlewareStack,
	subsegmentNames.EXPRESS_ROUTES,
)

/**
 * Reset function for testing - resets module-level state
 * @internal This function is only intended for use in tests
 */
export const __resetForTesting = () => {
	app = null
	serverlessHandler = null
	isInitialized = false
}
