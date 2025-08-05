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
import { withStandardizedErrorHandling } from './utils/lambda-error-handling-middleware.js'
import {
	applyMiddlewareWithTracing,
	createMiddlewareContext,
	createMiddlewareStack,
} from './utils/lambda-middleware.js'
import type { MiddlewareContext } from './utils/lambda-middleware-types.js'
import { withComprehensiveRequestResponseLogging } from './utils/lambda-request-response-logging-middleware.js'
import { createEnhancedLambdaContextInjection } from './utils/powertools-express-logger-coordination.js'
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

				// Dynamically import and create coordinated Express server with tracing
				const expressApp = await withSubsegment(
					subsegmentNames.EXPRESS_MIDDLEWARE,
					async () => {
						const { createLambdaExpressServer } = await import(
							'./utils/coordinated-express-server.js'
						)

						// Create coordinated Express app with Powertools integration
						return createLambdaExpressServer()
					},
					{
						operation: 'createCoordinatedExpressServer',
						coldStart: isColdStart,
						powertoolsCoordination: true,
					},
					{
						serverModule: 'coordinated-express-server',
						coldStart: isColdStart,
						powertoolsCoordination: true,
					},
				)

				logger.info(
					'Coordinated Express app initialized successfully for Lambda',
					{
						operation: 'coordinatedExpressAppInit',
						coldStart: isColdStart,
						powertoolsCoordination: true,
					},
				)

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
 * Initialize serverless-http handler with enhanced Powertools-Express coordination
 */
const initializeServerlessHandler = (
	expressApp: Express,
	middlewareContext: MiddlewareContext,
) => {
	return withSubsegmentSync(
		subsegmentNames.EXPRESS_ROUTES,
		() => {
			logger.info('Initializing serverless-http handler', {
				operation: 'initializeServerlessHandler',
			})

			return serverless(expressApp, {
				// Request/response transformation options
				binary: false,

				// Enhanced request transformation with Powertools coordination
				request: createEnhancedLambdaContextInjection(middlewareContext),

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

	// Create middleware context for coordination
	const middlewareContext = createMiddlewareContext(event, context)

	try {
		// Initialize Express app on cold start
		if (!app || !serverlessHandler) {
			try {
				logger.info(
					'Cold start - initializing Express app with Powertools coordination',
					{
						operation: 'coldStartInit',
						coldStart: middlewareContext.isColdStart,
						requestId: middlewareContext.requestId,
					},
				)

				app = await initializeExpressApp()
				serverlessHandler = initializeServerlessHandler(app, middlewareContext)
				isInitialized = true

				logger.info('Cold start completed with Powertools coordination', {
					operation: 'coldStartComplete',
					requestId: middlewareContext.requestId,
				})
			} catch (error) {
				throw error
			}
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
 * Create middleware stack with comprehensive observability and standardized error handling
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
 * Enhanced middleware stack with comprehensive logging and standardized error handling
 * Combines comprehensive request/response logging, standard middleware, and advanced error handling
 */
const enhancedMiddlewareStack = (handler: typeof coreHandler) => {
	// Apply comprehensive request/response logging first (innermost layer)
	const withComprehensiveLogging = withComprehensiveRequestResponseLogging({
		enabled: true,
		options: {
			enableHeaders: true,
			enableQueryParameters: true,
			enablePathParameters: true,
			enableTimingMetrics: true,
			enableSizeMetrics: true,
			enableXRayCorrelation: true,
			enableExpressCompatibility: true,
			enableRequestBody: false, // Security default
			enableResponseBody: false, // Security default
			redactFields: [
				'password',
				'token',
				'secret',
				'key',
				'authorization',
				'cookie',
				'x-api-key',
				'x-auth-token',
			],
			maxBodySize: 1024,
			maxHeaderSize: 512,
			requestLogLevel: 'info',
			responseLogLevel: 'info',
			errorLogLevel: 'error',
		},
	})

	// Apply standardized error handling (middle layer)
	const withErrorHandling = withStandardizedErrorHandling({
		enabled: true,
		options: {
			enableFullObservability: true,
			enableErrorMetrics: true,
			enableErrorTracing: true,
			enableStandardizedResponses: true,
			enableGoStyleIntegration: true,
			enableErrorClassification: true,
			includeStackTrace: process.env.NODE_ENV !== 'production',
		},
	})

	// Apply standard middleware stack (outermost layer)
	const withStandardMiddleware = middlewareStack

	// Combine all middleware layers: Standard -> Error Handling -> Comprehensive Logging -> Handler
	return withStandardMiddleware(
		withErrorHandling(withComprehensiveLogging(handler)),
	)
}

/**
 * Export the main handler with enhanced middleware and X-Ray tracing
 */
export const handler = applyMiddlewareWithTracing(
	coreHandler,
	enhancedMiddlewareStack,
	subsegmentNames.EXPRESS_ROUTES,
)

/**
 * Export core handler for testing
 * @internal This function is only intended for use in tests
 */
export const __coreHandlerForTesting = coreHandler

/**
 * Reset function for testing - resets module-level state
 * @internal This function is only intended for use in tests
 */
export const __resetForTesting = () => {
	app = null
	serverlessHandler = null
	isInitialized = false
}
