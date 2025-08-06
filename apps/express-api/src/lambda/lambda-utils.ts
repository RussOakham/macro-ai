/**
 * Lambda Utility Functions (Simplified)
 * Essential utilities for Lambda function operations without complex Powertools coordination
 */

import type {
	APIGatewayProxyEvent,
	APIGatewayProxyResult,
	Context,
} from 'aws-lambda'

/**
 * Create a standardized Lambda response
 */
/**
 * Get allowed CORS origin based on environment
 */
const getAllowedOrigin = (): string => {
	const environment =
		process.env.NODE_ENV ?? process.env.ENVIRONMENT ?? 'development'
	const trustedOrigin = process.env.CORS_ALLOWED_ORIGIN

	// In production, use specific trusted origin if configured, otherwise restrict to known domains
	if (environment === 'production') {
		return trustedOrigin ?? 'https://your-production-domain.com'
	}

	// In staging, use staging-specific origin if configured
	if (environment === 'staging') {
		return trustedOrigin ?? 'https://your-staging-domain.com'
	}

	// In development/testing, allow all origins for easier development
	return '*'
}

export const createLambdaResponse = (
	statusCode: number,
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	body: any,
	headers: Record<string, string> = {},
	context?: Context,
): APIGatewayProxyResult => {
	const defaultHeaders: Record<string, string> = {
		'Content-Type': 'application/json',
		'Access-Control-Allow-Origin': getAllowedOrigin(),
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
		error: message,
		message: message,
		requestId: context?.awsRequestId,
		timestamp: new Date().toISOString(),
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

/**
 * Check if running in Lambda environment
 */
export const isLambdaEnvironment = (): boolean => {
	return !!(
		process.env.AWS_LAMBDA_FUNCTION_NAME ??
		process.env.AWS_LAMBDA_RUNTIME_API ??
		process.env.LAMBDA_RUNTIME_DIR
	)
}
