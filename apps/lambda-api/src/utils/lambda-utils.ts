/**
 * Lambda Utility Functions
 * Common utilities for Lambda function operations
 */

import type {
	APIGatewayProxyEvent,
	APIGatewayProxyResult,
	Context,
} from 'aws-lambda'

import { logger } from './powertools-logger.js'
import { addMetric } from './powertools-metrics.js'

/**
 * Create a standardized Lambda response
 */
export const createLambdaResponse = (
	statusCode: number,
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	body: any,
	headers: Record<string, string> = {},
	context?: Context,
): APIGatewayProxyResult => {
	const defaultHeaders: Record<string, string> = {
		'Content-Type': 'application/json',
		'Access-Control-Allow-Origin': '*',
		'Access-Control-Allow-Credentials': 'true',
		'Access-Control-Allow-Headers':
			'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
		'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS,PATCH',
	}

	// Add Lambda context headers if available
	if (context) {
		defaultHeaders['x-lambda-request-id'] = context.awsRequestId
		defaultHeaders['x-lambda-function-name'] = context.functionName
	}

	return {
		statusCode,
		headers: { ...defaultHeaders, ...headers },
		body: typeof body === 'string' ? body : JSON.stringify(body),
	}
}

/**
 * Create an error response
 */
export const createErrorResponse = (
	statusCode: number,
	message: string,
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	error?: any,
	context?: Context,
	nodeEnv?: string,
): APIGatewayProxyResult => {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const errorBody: any = {
		error: true,
		message,
		statusCode,
		timestamp: new Date().toISOString(),
		requestId: context?.awsRequestId,
	}

	// Add error details in development
	if (nodeEnv !== 'production' && error) {
		// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
		errorBody.details = error instanceof Error ? error.message : error
		// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
		errorBody.stack = error instanceof Error ? error.stack : undefined
	}

	return createLambdaResponse(statusCode, errorBody, {}, context)
}

/**
 * Extract request information from API Gateway event
 */
export const extractRequestInfo = (event: APIGatewayProxyEvent) => {
	return {
		method: event.httpMethod,
		path: event.path,
		pathParameters: event.pathParameters,
		queryStringParameters: event.queryStringParameters,
		headers: event.headers,
		body: event.body,
		isBase64Encoded: event.isBase64Encoded,
		requestContext: {
			requestId: event.requestContext.requestId,
			stage: event.requestContext.stage,
			httpMethod: event.requestContext.httpMethod,
			resourcePath: event.requestContext.resourcePath,
			identity: {
				sourceIp: event.requestContext.identity.sourceIp,
				userAgent: event.requestContext.identity.userAgent,
			},
		},
	}
}

/**
 * Parse JSON body safely
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const parseJsonBody = (body: string | null): any => {
	if (!body) return null

	try {
		return JSON.parse(body)
	} catch {
		throw new Error('Invalid JSON in request body')
	}
}

/**
 * Validate required environment variables
 */
export const validateEnvironment = (requiredVars: string[]): void => {
	const missing = requiredVars.filter((varName) => !process.env[varName])

	if (missing.length > 0) {
		throw new Error(
			`Missing required environment variables: ${missing.join(', ')}`,
		)
	}
}

/**
 * Get Lambda execution context information
 */
export const getLambdaContext = (context: Context) => {
	return {
		functionName: context.functionName,
		functionVersion: context.functionVersion,
		invokedFunctionArn: context.invokedFunctionArn,
		memoryLimitInMB: context.memoryLimitInMB,
		awsRequestId: context.awsRequestId,
		logGroupName: context.logGroupName,
		logStreamName: context.logStreamName,
		remainingTimeInMillis: context.getRemainingTimeInMillis(),
		identity: context.identity,
		clientContext: context.clientContext,
	}
}

/**
 * Log request information with structured logging
 */
export const logRequest = (
	event: APIGatewayProxyEvent,
	context: Context,
): void => {
	const requestInfo = {
		operation: 'lambdaRequest',
		requestId: context.awsRequestId,
		method: event.httpMethod,
		path: event.path,
		queryParams: event.queryStringParameters,
		pathParams: event.pathParameters,
		bodySize: event.body ? event.body.length : 0,
		userAgent: event.headers['User-Agent'] ?? event.headers['user-agent'],
		sourceIp: event.requestContext.identity.sourceIp,
		stage: event.requestContext.stage,
	}

	// Log with appropriate level based on environment
	if (process.env.NODE_ENV === 'development') {
		logger.debug('Lambda request received', {
			...requestInfo,
			headers: event.headers, // Include full headers in development
		})
	} else {
		logger.info('Lambda request received', requestInfo)
	}

	// Record request metrics
	addMetric('RequestReceived', 'Count', 1, {
		Method: event.httpMethod,
		Path: event.path,
		Stage: event.requestContext.stage,
	})
}

/**
 * Log response information with structured logging
 */
export const logResponse = (
	response: APIGatewayProxyResult,
	context: Context,
): void => {
	const responseInfo = {
		operation: 'lambdaResponse',
		requestId: context.awsRequestId,
		statusCode: response.statusCode,
		bodySize: response.body ? response.body.length : 0,
		isError: response.statusCode >= 400,
	}

	// Log with appropriate level based on status code
	if (response.statusCode >= 500) {
		logger.error('Lambda response sent', {
			...responseInfo,
			headers: response.headers,
		})
	} else if (response.statusCode >= 400) {
		logger.warn('Lambda response sent', responseInfo)
	} else if (process.env.NODE_ENV === 'development') {
		logger.debug('Lambda response sent', {
			...responseInfo,
			headers: response.headers, // Include full headers in development
		})
	} else {
		logger.info('Lambda response sent', responseInfo)
	}

	// Record response metrics
	const getStatusClass = (statusCode: number): string => {
		if (statusCode >= 500) return '5xx'
		if (statusCode >= 400) return '4xx'
		if (statusCode >= 300) return '3xx'
		return '2xx'
	}

	addMetric('ResponseSent', 'Count', 1, {
		StatusCode: String(response.statusCode),
		StatusClass: getStatusClass(response.statusCode),
	})

	// Record response size metric
	if (response.body) {
		addMetric('ResponseSize', 'Bytes', response.body.length)
	}
}

/**
 * Measure execution time with structured logging and metrics
 */
export const measureExecutionTime = async <T>(
	operation: () => Promise<T>,
	operationName: string,
): Promise<{ result: T; duration: number }> => {
	const startTime = Date.now()

	logger.debug('Operation started', {
		operation: 'measureExecutionTime',
		operationName,
		startTime,
	})

	try {
		const result = await operation()
		const duration = Date.now() - startTime

		logger.info('Operation completed successfully', {
			operation: 'measureExecutionTime',
			operationName,
			duration,
			durationMs: `${String(duration)}ms`,
		})

		// Record success metrics
		addMetric('OperationDuration', 'Milliseconds', duration, {
			OperationName: operationName,
			Status: 'Success',
		})

		addMetric('OperationCount', 'Count', 1, {
			OperationName: operationName,
			Status: 'Success',
		})

		return { result, duration }
	} catch (error) {
		const duration = Date.now() - startTime
		const errorMessage = error instanceof Error ? error.message : String(error)

		logger.error('Operation failed', {
			operation: 'measureExecutionTime',
			operationName,
			duration,
			durationMs: `${String(duration)}ms`,
			error: errorMessage,
			errorType:
				error instanceof Error ? error.constructor.name : 'UnknownError',
		})

		// Record error metrics
		addMetric('OperationDuration', 'Milliseconds', duration, {
			OperationName: operationName,
			Status: 'Error',
		})

		addMetric('OperationCount', 'Count', 1, {
			OperationName: operationName,
			Status: 'Error',
		})

		addMetric('OperationError', 'Count', 1, {
			OperationName: operationName,
			ErrorType:
				error instanceof Error ? error.constructor.name : 'UnknownError',
		})

		throw error instanceof Error ? error : new Error(String(error))
	}
}

/**
 * Check if running in Lambda environment
 */
export const isLambdaEnvironment = (
	lambdaFunctionName?: string,
	lambdaRuntimeApi?: string,
	lambdaRuntimeDir?: string,
): boolean => {
	return !!(
		lambdaFunctionName ??
		lambdaRuntimeApi ??
		lambdaRuntimeDir ??
		process.env.AWS_LAMBDA_FUNCTION_NAME ??
		process.env.AWS_LAMBDA_RUNTIME_API ??
		process.env.LAMBDA_RUNTIME_DIR
	)
}

/**
 * Get memory usage information
 */
export const getMemoryUsage = () => {
	const usage = process.memoryUsage()
	return {
		rss: Math.round(usage.rss / 1024 / 1024), // MB
		heapTotal: Math.round(usage.heapTotal / 1024 / 1024), // MB
		heapUsed: Math.round(usage.heapUsed / 1024 / 1024), // MB
		external: Math.round(usage.external / 1024 / 1024), // MB
		arrayBuffers: Math.round(usage.arrayBuffers / 1024 / 1024), // MB
	}
}

/**
 * CORS preflight handler
 */
export const handleCorsPreflightRequest = (
	event: APIGatewayProxyEvent,
	context: Context,
): APIGatewayProxyResult | null => {
	if (event.httpMethod === 'OPTIONS') {
		return createLambdaResponse(
			200,
			'',
			{
				'Access-Control-Allow-Origin': '*',
				'Access-Control-Allow-Headers':
					'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
				'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS,PATCH',
				'Access-Control-Max-Age': '86400',
			},
			context,
		)
	}

	return null
}
