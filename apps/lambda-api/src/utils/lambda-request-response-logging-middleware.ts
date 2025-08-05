/**
 * Comprehensive Request/Response Logging Middleware for AWS Lambda
 * Provides detailed request/response logging with Powertools integration, X-Ray correlation, and security controls
 */

import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda'

import { createMiddlewareContext } from './lambda-middleware.js'
import type {
	LambdaHandler,
	LambdaMiddleware,
	MiddlewareContext,
} from './lambda-middleware-types.js'
import { logger } from './powertools-logger.js'
import { addMetric, MetricUnit } from './powertools-metrics.js'
import { tracer } from './powertools-tracer.js'

/**
 * Configuration for comprehensive request/response logging middleware
 */
export interface ComprehensiveRequestLoggingConfig {
	/** Enable/disable the middleware */
	enabled: boolean
	/** Logging options */
	options?: {
		/** Enable request body logging */
		enableRequestBody?: boolean
		/** Enable response body logging */
		enableResponseBody?: boolean
		/** Enable headers logging */
		enableHeaders?: boolean
		/** Enable query parameters logging */
		enableQueryParameters?: boolean
		/** Enable path parameters logging */
		enablePathParameters?: boolean
		/** Enable timing metrics */
		enableTimingMetrics?: boolean
		/** Enable request/response size metrics */
		enableSizeMetrics?: boolean
		/** Enable X-Ray correlation */
		enableXRayCorrelation?: boolean
		/** Enable Express-style logging compatibility */
		enableExpressCompatibility?: boolean
		/** Sensitive fields to redact */
		redactFields?: string[]
		/** Maximum body size to log (bytes) */
		maxBodySize?: number
		/** Maximum header value size to log (bytes) */
		maxHeaderSize?: number
		/** Log level for requests */
		requestLogLevel?: 'debug' | 'info' | 'warn'
		/** Log level for responses */
		responseLogLevel?: 'debug' | 'info' | 'warn'
		/** Log level for errors */
		errorLogLevel?: 'warn' | 'error'
		/** Custom request transformer */
		customRequestTransformer?: (
			event: APIGatewayProxyEvent,
		) => Record<string, unknown>
		/** Custom response transformer */
		customResponseTransformer?: (
			result: APIGatewayProxyResult,
		) => Record<string, unknown>
	}
}

/**
 * Default configuration for comprehensive request/response logging
 */
export const defaultComprehensiveRequestLoggingConfig: ComprehensiveRequestLoggingConfig =
	{
		enabled: true,
		options: {
			enableRequestBody: false, // Disabled by default for security
			enableResponseBody: false, // Disabled by default for security
			enableHeaders: true,
			enableQueryParameters: true,
			enablePathParameters: true,
			enableTimingMetrics: true,
			enableSizeMetrics: true,
			enableXRayCorrelation: true,
			enableExpressCompatibility: true,
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
			maxBodySize: 1024, // 1KB max
			maxHeaderSize: 512, // 512 bytes max
			requestLogLevel: 'info',
			responseLogLevel: 'info',
			errorLogLevel: 'error',
		},
	}

/**
 * Redact sensitive information from headers, query parameters, or body
 */
export const redactSensitiveFields = (
	data: Record<string, unknown> | null | undefined,
	redactFields: string[] = [],
): Record<string, unknown> | null => {
	if (!data || typeof data !== 'object') {
		return null
	}

	const result: Record<string, unknown> = {}
	for (const [key, value] of Object.entries(data)) {
		const keyLower = key.toLowerCase()
		if (redactFields.some((field) => keyLower.includes(field.toLowerCase()))) {
			result[key] = '[REDACTED]'
		} else if (typeof value === 'object' && value !== null) {
			result[key] = redactSensitiveFields(
				value as Record<string, unknown>,
				redactFields,
			)
		} else {
			result[key] = value
		}
	}

	return result
}

/**
 * Truncate content if it exceeds the maximum size
 */
export const truncateContent = (
	content: string | null | undefined,
	maxSize: number,
): string | { truncated: string; originalSize: number } | null => {
	if (!content) {
		return null
	}

	const size = Buffer.byteLength(content, 'utf8')
	if (size <= maxSize) {
		return content
	}

	const truncated = content.substring(0, Math.floor(maxSize * 0.8))
	return {
		truncated: `${truncated}... [TRUNCATED]`,
		originalSize: size,
	}
}

/**
 * Extract request information with security controls
 */
export const extractRequestInfo = (
	event: APIGatewayProxyEvent,
	config: ComprehensiveRequestLoggingConfig,
): Record<string, unknown> => {
	const requestInfo: Record<string, unknown> = {
		httpMethod: event.httpMethod,
		path: event.path,
		resource: event.resource,
		stage: event.requestContext.stage,
		sourceIp: event.requestContext.identity.sourceIp,
		userAgent: event.headers['User-Agent'] ?? event.headers['user-agent'],
	}

	// Add query parameters if enabled
	if (config.options?.enableQueryParameters && event.queryStringParameters) {
		requestInfo.queryStringParameters = redactSensitiveFields(
			event.queryStringParameters,
			config.options.redactFields,
		)
	}

	// Add path parameters if enabled
	if (config.options?.enablePathParameters && event.pathParameters) {
		requestInfo.pathParameters = redactSensitiveFields(
			event.pathParameters,
			config.options.redactFields,
		)
	}

	// Add headers if enabled
	if (config.options?.enableHeaders) {
		const redactedHeaders = redactSensitiveFields(
			event.headers,
			config.options.redactFields,
		)

		// Truncate large header values
		const truncatedHeaders: Record<string, unknown> = {}
		for (const [key, value] of Object.entries(redactedHeaders ?? {})) {
			if (typeof value === 'string') {
				truncatedHeaders[key] = truncateContent(
					value,
					config.options.maxHeaderSize ?? 512,
				)
			} else {
				truncatedHeaders[key] = value
			}
		}
		requestInfo.headers = truncatedHeaders
	}

	// Add request body if enabled
	if (config.options?.enableRequestBody && event.body) {
		const maxSize = config.options.maxBodySize ?? 1024
		requestInfo.body = truncateContent(event.body, maxSize)
		requestInfo.bodySize = Buffer.byteLength(event.body, 'utf8')
	}

	// Add custom request transformation
	if (config.options?.customRequestTransformer) {
		const customData = config.options.customRequestTransformer(event)
		Object.assign(requestInfo, customData)
	}

	return requestInfo
}

/**
 * Extract response information with security controls
 */
export const extractResponseInfo = (
	result: APIGatewayProxyResult,
	config: ComprehensiveRequestLoggingConfig,
): Record<string, unknown> => {
	const responseInfo: Record<string, unknown> = {
		statusCode: result.statusCode,
		isBase64Encoded: result.isBase64Encoded,
	}

	// Add headers if enabled
	if (config.options?.enableHeaders && result.headers) {
		const redactedHeaders = redactSensitiveFields(
			result.headers,
			config.options.redactFields,
		)
		responseInfo.headers = redactedHeaders
	}

	// Add response body if enabled
	if (config.options?.enableResponseBody && result.body) {
		const maxSize = config.options.maxBodySize ?? 1024
		responseInfo.body = truncateContent(result.body, maxSize)
		responseInfo.bodySize = Buffer.byteLength(result.body, 'utf8')
	}

	// Add custom response transformation
	if (config.options?.customResponseTransformer) {
		const customData = config.options.customResponseTransformer(result)
		Object.assign(responseInfo, customData)
	}

	return responseInfo
}

/**
 * Add X-Ray correlation data
 */
export const addXRayCorrelation = (
	logData: Record<string, unknown>,
	context: MiddlewareContext,
): void => {
	// Add trace ID for correlation
	const traceId = process.env._X_AMZN_TRACE_ID
	if (traceId) {
		logData.traceId = traceId
	}

	// Add X-Ray annotations for searchability
	tracer.putAnnotation('httpMethod', String(logData.httpMethod))
	tracer.putAnnotation('statusCode', Number(logData.statusCode) || 0)
	tracer.putAnnotation('path', String(logData.path))

	// Add X-Ray metadata for detailed information
	tracer.putMetadata('request', {
		requestId: context.requestId,
		path: logData.path,
		method: logData.httpMethod,
		userAgent: logData.userAgent,
		sourceIp: logData.sourceIp,
	})
}

/**
 * Collect request/response metrics
 */
export const collectRequestResponseMetrics = (
	event: APIGatewayProxyEvent,
	result: APIGatewayProxyResult,
	executionTime: number,
	context: MiddlewareContext,
	config: ComprehensiveRequestLoggingConfig,
): void => {
	if (
		!config.options?.enableTimingMetrics &&
		!config.options?.enableSizeMetrics
	) {
		return
	}

	const dimensions = {
		HttpMethod: event.httpMethod,
		StatusCode: String(result.statusCode),
		ColdStart: String(context.isColdStart),
		FunctionName: context.functionName,
	}

	// Timing metrics
	if (config.options.enableTimingMetrics) {
		addMetric(
			'RequestDuration',
			MetricUnit.Milliseconds,
			executionTime,
			dimensions,
		)
		addMetric('RequestCount', MetricUnit.Count, 1, dimensions)
	}

	// Size metrics
	if (config.options.enableSizeMetrics) {
		if (event.body) {
			const requestSize = Buffer.byteLength(event.body, 'utf8')
			addMetric('RequestSize', 'Bytes', requestSize, dimensions)
		}

		if (result.body) {
			const responseSize = Buffer.byteLength(result.body, 'utf8')
			addMetric('ResponseSize', 'Bytes', responseSize, dimensions)
		}
	}
}

/**
 * Main comprehensive request/response logging middleware
 * Provides detailed logging with Powertools integration and X-Ray correlation
 */
export const withComprehensiveRequestResponseLogging = (
	config: ComprehensiveRequestLoggingConfig = defaultComprehensiveRequestLoggingConfig,
): LambdaMiddleware => {
	return (handler: LambdaHandler): LambdaHandler => {
		return async (event, context) => {
			if (!config.enabled) {
				return handler(event, context)
			}

			const middlewareContext = createMiddlewareContext(event, context)
			const startTime = Date.now()

			// Extract request information
			const requestInfo = extractRequestInfo(event, config)

			// Create base log data
			const baseLogData = {
				requestId: middlewareContext.requestId,
				functionName: middlewareContext.functionName,
				coldStart: middlewareContext.isColdStart,
				...requestInfo,
			}

			// Add X-Ray correlation if enabled
			if (config.options?.enableXRayCorrelation) {
				addXRayCorrelation(baseLogData, middlewareContext)
			}

			// Log request start
			const requestLogLevel = config.options?.requestLogLevel ?? 'info'
			logger[requestLogLevel]('Lambda request started', baseLogData)

			// Express-style compatibility logging
			if (config.options?.enableExpressCompatibility) {
				logger.info(`${event.httpMethod} ${event.path}`, {
					operation: 'request-start',
					requestId: middlewareContext.requestId,
					userAgent: event.headers['User-Agent'],
					sourceIp: event.requestContext.identity.sourceIp,
				})
			}

			try {
				// Execute the handler
				const result = await handler(event, context)
				const executionTime = Date.now() - startTime

				// Extract response information
				const responseInfo = extractResponseInfo(result, config)

				// Create response log data
				const responseLogData = {
					...baseLogData,
					...responseInfo,
					executionTime,
					duration: `${executionTime.toString()}ms`,
				}

				// Log successful response
				const responseLogLevel = config.options?.responseLogLevel ?? 'info'
				logger[responseLogLevel](
					'Lambda request completed successfully',
					responseLogData,
				)

				// Express-style compatibility logging
				if (config.options?.enableExpressCompatibility) {
					logger.info(
						`${event.httpMethod} ${event.path} ${result.statusCode.toString()}`,
						{
							operation: 'request-complete',
							requestId: middlewareContext.requestId,
							statusCode: result.statusCode,
							executionTime,
							responseTime: executionTime,
						},
					)
				}

				// Collect metrics
				collectRequestResponseMetrics(
					event,
					result,
					executionTime,
					middlewareContext,
					config,
				)

				return result
			} catch (error) {
				const executionTime = Date.now() - startTime
				const errorMessage =
					error instanceof Error ? error.message : String(error)

				// Create error log data
				const errorLogData = {
					...baseLogData,
					error: errorMessage,
					errorType:
						error instanceof Error ? error.constructor.name : 'UnknownError',
					executionTime,
					duration: `${executionTime.toString()}ms`,
				}

				// Log error
				const errorLogLevel = config.options?.errorLogLevel ?? 'error'
				logger[errorLogLevel]('Lambda request failed', errorLogData)

				// Express-style compatibility error logging
				if (config.options?.enableExpressCompatibility) {
					logger.error(`${event.httpMethod} ${event.path} ERROR`, {
						operation: 'request-error',
						requestId: middlewareContext.requestId,
						error: errorMessage,
						executionTime,
					})
				}

				// Re-throw the error to maintain existing error handling behavior
				throw error
			}
		}
	}
}

/**
 * Express-style request/response logging middleware
 * Mimics pino-http behavior for consistency with Express logging
 */
export const withExpressStyleRequestResponseLogging = (
	config: Partial<ComprehensiveRequestLoggingConfig> = {},
): LambdaMiddleware => {
	const expressConfig: ComprehensiveRequestLoggingConfig = {
		enabled: true,
		options: {
			...defaultComprehensiveRequestLoggingConfig.options,
			...config.options,
			enableExpressCompatibility: true,
			requestLogLevel: 'info',
			responseLogLevel: 'info',
			errorLogLevel: 'error',
			enableHeaders: true,
			enableQueryParameters: true,
			enableRequestBody: false, // Security default
			enableResponseBody: false, // Security default
		},
	}

	return withComprehensiveRequestResponseLogging(expressConfig)
}

/**
 * Debug-level request/response logging middleware
 * Provides detailed logging for development and debugging
 */
export const withDebugRequestResponseLogging = (
	config: Partial<ComprehensiveRequestLoggingConfig> = {},
): LambdaMiddleware => {
	const debugConfig: ComprehensiveRequestLoggingConfig = {
		enabled: true,
		options: {
			...defaultComprehensiveRequestLoggingConfig.options,
			...config.options,
			requestLogLevel: 'debug',
			responseLogLevel: 'debug',
			errorLogLevel: 'error',
			enableRequestBody: true,
			enableResponseBody: true,
			enableHeaders: true,
			enableQueryParameters: true,
			enablePathParameters: true,
			maxBodySize: 4096, // 4KB for debug
		},
	}

	return withComprehensiveRequestResponseLogging(debugConfig)
}

/**
 * Production-optimized request/response logging middleware
 * Minimal logging for production environments with security focus
 */
export const withProductionRequestResponseLogging = (
	config: Partial<ComprehensiveRequestLoggingConfig> = {},
): LambdaMiddleware => {
	const productionConfig: ComprehensiveRequestLoggingConfig = {
		enabled: true,
		options: {
			...defaultComprehensiveRequestLoggingConfig.options,
			...config.options,
			requestLogLevel: 'info',
			responseLogLevel: 'info',
			errorLogLevel: 'error',
			enableRequestBody: false,
			enableResponseBody: false,
			enableHeaders: false, // Disabled for security
			enableQueryParameters: false, // Disabled for security
			enablePathParameters: true,
			maxBodySize: 0, // No body logging
		},
	}

	return withComprehensiveRequestResponseLogging(productionConfig)
}
