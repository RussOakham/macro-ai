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
import { logger } from './utils/powertools-logger.js'
import {
	addMetric,
	measureAndRecordExecutionTime,
	MetricName,
	MetricUnit,
	recordColdStart,
	recordMemoryUsage,
} from './utils/powertools-metrics.js'

// Global variables for Lambda container reuse
let app: Express | null = null
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let serverlessHandler: any = null
let isInitialized = false

/**
 * Initialize Express application for Lambda environment
 */
const initializeExpressApp = async (): Promise<Express> => {
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

		// Dynamically import and create Express server
		const { createServer } = await import(
			'@repo/express-api/src/utils/server.js'
		)

		// Create Express app (createServer doesn't take parameters)
		const expressApp = createServer()

		logger.info('Express app initialized successfully for Lambda', {
			operation: 'expressAppInit',
			coldStart: isColdStart,
		})

		// Record successful initialization metric
		addMetric(MetricName.ExpressAppInitTime, MetricUnit.Count, 1, {
			Status: 'Success',
		})

		// eslint-disable-next-line @typescript-eslint/no-misused-promises
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

		// Custom request transformation
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		request: (request: any, event: APIGatewayProxyEvent, context: Context) => {
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
				response.headers['x-lambda-cold-start'] = (!isInitialized).toString()
			}

			// eslint-disable-next-line @typescript-eslint/no-unsafe-return
			return response
		},
	})
}

/**
 * Main Lambda handler function
 */
export const handler = async (
	event: APIGatewayProxyEvent,
	context: Context,
): Promise<APIGatewayProxyResult> => {
	// Configure Lambda context
	context.callbackWaitsForEmptyEventLoop = false

	const startTime = Date.now()
	const isColdStart = !isInitialized

	// Create child logger with request context
	const requestLogger = logger.createChild({
		persistentLogAttributes: {
			requestId: context.awsRequestId,
			functionName: context.functionName,
			coldStart: isColdStart,
		},
	})

	requestLogger.info('Lambda invocation started', {
		operation: 'lambdaHandler',
		coldStart: isColdStart,
		requestId: context.awsRequestId,
		functionName: context.functionName,
		functionVersion: context.functionVersion,
	})

	// Record cold start metrics with comprehensive dimensions
	recordColdStart(isColdStart)

	// Record additional cold start context metrics
	addMetric(MetricName.ColdStart, MetricUnit.Count, isColdStart ? 1 : 0, {
		Environment: process.env.NODE_ENV ?? 'unknown',
		FunctionName: context.functionName,
		FunctionVersion: context.functionVersion,
		Region: process.env.AWS_REGION ?? 'unknown',
	})

	// Record memory usage at start of invocation
	recordMemoryUsage()

	try {
		// Initialize Express app on cold start
		if (!app || !serverlessHandler) {
			requestLogger.info('Cold start - initializing Express app', {
				operation: 'coldStartInit',
			})

			app = await initializeExpressApp()
			serverlessHandler = initializeServerlessHandler(app)
			isInitialized = true

			const initTime = Date.now() - startTime
			requestLogger.info('Cold start completed', {
				operation: 'coldStartComplete',
				initTime,
				duration: `${String(initTime)}ms`,
			})

			// Record cold start initialization time metric with dimensions
			addMetric('ColdStartInitTime', MetricUnit.Milliseconds, initTime, {
				Environment: process.env.NODE_ENV ?? 'unknown',
				FunctionName: context.functionName,
				FunctionVersion: context.functionVersion,
				Region: process.env.AWS_REGION ?? 'unknown',
				InitPhase: 'Complete',
			})

			// Record memory usage after cold start initialization
			recordMemoryUsage()
		} else {
			// Update cold start flag for warm invocations
			lambdaConfig.setColdStart(false)
			requestLogger.info('Warm start - reusing existing Express app', {
				operation: 'warmStart',
			})

			// Record warm start metrics
			addMetric('WarmStart', MetricUnit.Count, 1, {
				Environment: process.env.NODE_ENV ?? 'unknown',
				FunctionName: context.functionName,
				FunctionVersion: context.functionVersion,
				Region: process.env.AWS_REGION ?? 'unknown',
			})
		}

		// Handle the request with serverless-http
		// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
		const result = await serverlessHandler(event, context)

		const totalTime = Date.now() - startTime

		requestLogger.info('Request completed successfully', {
			operation: 'requestComplete',
			totalTime,
			duration: `${String(totalTime)}ms`,
			coldStart: isColdStart,
		})

		// Record request metrics with cold start context
		addMetric('RequestDuration', MetricUnit.Milliseconds, totalTime, {
			ColdStart: String(isColdStart),
			Status: 'Success',
			Environment: process.env.NODE_ENV ?? 'unknown',
			FunctionName: context.functionName,
		})
		addMetric('RequestCount', MetricUnit.Count, 1, {
			Status: 'Success',
			ColdStart: String(isColdStart),
			Environment: process.env.NODE_ENV ?? 'unknown',
		})

		// Record memory usage
		const memoryUsage = process.memoryUsage()
		addMetric('MemoryUsed', 'Bytes', memoryUsage.heapUsed)

		// eslint-disable-next-line @typescript-eslint/no-unsafe-return
		return result
	} catch (error) {
		const totalTime = Date.now() - startTime
		const errorMessage =
			error instanceof Error ? error.message : 'Unknown error'

		requestLogger.error('Lambda handler error', {
			operation: 'requestError',
			error: errorMessage,
			errorType:
				error instanceof Error ? error.constructor.name : 'UnknownError',
			totalTime,
			duration: `${String(totalTime)}ms`,
			coldStart: isColdStart,
		})

		// Record error metrics with cold start context
		addMetric('RequestDuration', MetricUnit.Milliseconds, totalTime, {
			ColdStart: String(isColdStart),
			Status: 'Error',
			Environment: process.env.NODE_ENV ?? 'unknown',
			FunctionName: context.functionName,
		})
		addMetric('RequestCount', MetricUnit.Count, 1, {
			Status: 'Error',
			ColdStart: String(isColdStart),
			Environment: process.env.NODE_ENV ?? 'unknown',
		})
		addMetric('RequestError', MetricUnit.Count, 1, {
			ErrorType:
				error instanceof Error ? error.constructor.name : 'UnknownError',
			ColdStart: String(isColdStart),
			Environment: process.env.NODE_ENV ?? 'unknown',
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
 * Reset function for testing - resets module-level state
 * @internal This function is only intended for use in tests
 */
export const __resetForTesting = () => {
	app = null
	serverlessHandler = null
	isInitialized = false
}
