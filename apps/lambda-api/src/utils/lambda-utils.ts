/**
 * Lambda Utility Functions
 * Common utilities for Lambda function operations
 */

import type {
	APIGatewayProxyEvent,
	APIGatewayProxyResult,
	Context,
} from 'aws-lambda'

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
 * Log request/response for debugging
 */
export const logRequest = (
	event: APIGatewayProxyEvent,
	context: Context,
): void => {
	if (process.env.NODE_ENV === 'development') {
		console.log('📥 Lambda Request:', {
			requestId: context.awsRequestId,
			method: event.httpMethod,
			path: event.path,
			headers: event.headers,
			queryParams: event.queryStringParameters,
			pathParams: event.pathParameters,
			bodySize: event.body ? event.body.length : 0,
		})
	}
}

/**
 * Log response for debugging
 */
export const logResponse = (
	response: APIGatewayProxyResult,
	context: Context,
): void => {
	if (process.env.NODE_ENV === 'development') {
		console.log('📤 Lambda Response:', {
			requestId: context.awsRequestId,
			statusCode: response.statusCode,
			headers: response.headers,
			bodySize: response.body ? response.body.length : 0,
		})
	}
}

/**
 * Measure execution time
 */
export const measureExecutionTime = async <T>(
	operation: () => Promise<T>,
	operationName: string,
): Promise<{ result: T; duration: number }> => {
	const startTime = Date.now()

	try {
		const result = await operation()
		const duration = Date.now() - startTime

		console.log(`⏱️ ${operationName} completed in ${String(duration)}ms`)
		return { result, duration }
	} catch (error) {
		const duration = Date.now() - startTime
		console.error(
			`❌ ${operationName} failed after ${String(duration)}ms:`,
			error,
		)
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
