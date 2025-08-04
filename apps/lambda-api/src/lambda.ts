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

// Global variables for Lambda container reuse
let app: Express | null = null
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let serverlessHandler: any = null
let isInitialized = false

/**
 * Initialize Express application for Lambda environment
 */
const initializeExpressApp = async (): Promise<Express> => {
	console.log('🚀 Initializing Express app for Lambda...')

	try {
		// Initialize Lambda configuration with Parameter Store
		const isColdStart = !isInitialized
		await lambdaConfig.initialize(isColdStart)

		// Log configuration summary (without sensitive data)
		console.log('📋 Configuration summary:', lambdaConfig.getConfigSummary())

		// Dynamically import and create Express server
		const { createServer } = await import(
			'@repo/express-api/src/utils/server.js'
		)

		// Create Express app (createServer doesn't take parameters)
		const expressApp = createServer()

		console.log('✅ Express app initialized successfully for Lambda')
		// eslint-disable-next-line @typescript-eslint/no-misused-promises
		return expressApp
	} catch (error: unknown) {
		console.error(
			'❌ Failed to initialize Express app:',
			error instanceof Error ? error.message : 'Unknown error',
		)
		throw new Error(
			`Express app initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
		)
	}
}

/**
 * Initialize serverless-http handler
 */
const initializeServerlessHandler = (expressApp: Express) => {
	console.log('🔧 Initializing serverless-http handler...')

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

	console.log(
		`🔍 Lambda invocation - Cold start: ${String(isColdStart)}, Request ID: ${context.awsRequestId}`,
	)

	try {
		// Initialize Express app on cold start
		if (!app || !serverlessHandler) {
			console.log('❄️ Cold start - initializing Express app...')

			app = await initializeExpressApp()
			serverlessHandler = initializeServerlessHandler(app)
			isInitialized = true

			const initTime = Date.now() - startTime
			console.log(`✅ Cold start completed in ${String(initTime)}ms`)
		} else {
			// Update cold start flag for warm invocations
			lambdaConfig.setColdStart(false)
			console.log('🔥 Warm start - reusing existing Express app')
		}

		// Handle the request with serverless-http
		// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
		const result = await serverlessHandler(event, context)

		const totalTime = Date.now() - startTime
		console.log(
			`✅ Request completed in ${String(totalTime)}ms (Cold start: ${String(isColdStart)})`,
		)

		// eslint-disable-next-line @typescript-eslint/no-unsafe-return
		return result
	} catch (error) {
		console.error('❌ Lambda handler error:', error)

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
