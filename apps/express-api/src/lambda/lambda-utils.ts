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
 * Get allowed CORS origins based on environment
 */
const getAllowedOrigins = (): string[] => {
	const rawEnv = process.env.CORS_ALLOWED_ORIGINS ?? ''
	const appEnv = process.env.APP_ENV ?? ''
	const isPreview = appEnv.startsWith('pr-')

	// Parse and normalize: trim whitespace and strip any trailing '/'
	const parsedCorsOrigins = rawEnv
		.split(',')
		.map((o) => o.trim())
		.filter((o) => o.length > 0)
		.map((o) => (o.endsWith('/') ? o.replace(/\/+$/, '') : o))

	// Log detailed diagnostics for observability
	console.log('[lambda-utils] CORS configuration diagnostics:')
	console.log(`  APP_ENV: "${appEnv}" (isPreview=${String(isPreview)})`)
	console.log(`  CORS_ALLOWED_ORIGINS (raw): "${rawEnv}"`)
	console.log(
		`  CORS_ALLOWED_ORIGINS (parsed/normalized): [${parsedCorsOrigins
			.map((o) => `"${o}"`)
			.join(', ')}]`,
	)

	// Safeguard: In preview environments, do NOT silently fall back to localhost
	if (isPreview && parsedCorsOrigins.length === 0) {
		console.error(
			'[lambda-utils] Preview environment detected (pr-*), but CORS_ALLOWED_ORIGINS is empty/invalid. Refusing to fall back to localhost origins. Ensure CI passes the exact Amplify preview origin.',
		)
		return []
	}

	const effectiveOrigins =
		parsedCorsOrigins.length > 0
			? parsedCorsOrigins
			: ['http://localhost:3000', 'http://localhost:3040']

	return effectiveOrigins
}

/**
 * Get the primary allowed CORS origin (first in the list)
 */
const getPrimaryAllowedOrigin = (): string => {
	const origins = getAllowedOrigins()
	const primary = origins[0] ?? 'http://localhost:3000'
	console.log(
		`[lambda-utils] Selected primary CORS origin: "${primary}" (all=[${origins
			.map((o) => `"${o}"`)
			.join(', ')}])`,
	)
	return primary
}

export const createLambdaResponse = (
	statusCode: number,
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	body: any,
	headers: Record<string, string> = {},
	context?: Context,
): APIGatewayProxyResult => {
	const __origin = getPrimaryAllowedOrigin()
	const defaultHeaders: Record<string, string> = {
		'Content-Type': 'application/json',
		'Access-Control-Allow-Origin': __origin,
		'Access-Control-Allow-Credentials': __origin === '*' ? 'false' : 'true',
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
		// Get the request origin
		const requestOrigin = event.headers.origin ?? event.headers.Origin
		const allowedOrigins = getAllowedOrigins()

		// Check if the request origin is allowed
		const isAllowedOrigin =
			allowedOrigins.includes(requestOrigin ?? '') ||
			allowedOrigins.includes('*')
		const responseOrigin = isAllowedOrigin
			? (requestOrigin ?? getPrimaryAllowedOrigin())
			: getPrimaryAllowedOrigin()

		const allowCreds = responseOrigin !== '*'

		return createLambdaResponse(
			200,
			'',
			{
				'Access-Control-Allow-Origin': responseOrigin,
				'Access-Control-Allow-Credentials': allowCreds ? 'true' : 'false',
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
