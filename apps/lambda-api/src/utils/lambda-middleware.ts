/**
 * AWS Lambda Middleware System
 * Provides composable middleware patterns for Lambda handlers with Powertools integration
 */

import type { APIGatewayProxyEvent, Context } from 'aws-lambda'

import type {
	CompositionOptions,
	ErrorHandlingConfig,
	LambdaHandler,
	LambdaMiddleware,
	LambdaMiddlewareConfig,
	MiddlewareContext,
	ObservabilityConfig,
	PerformanceConfig,
	RequestLoggingConfig,
} from './lambda-middleware-types.js'
import { defaultMiddlewareConfig } from './lambda-middleware-types.js'
import { logErrorWithFullObservability } from './powertools-error-logging.js'
import { logger } from './powertools-logger.js'
import {
	addMetric,
	measureAndRecordExecutionTime,
	MetricName,
	MetricUnit,
	recordColdStart,
	recordMemoryUsage,
} from './powertools-metrics.js'
import {
	addCommonAnnotations,
	addCommonMetadata,
	captureError,
	subsegmentNames,
	traceErrorTypes,
	tracer,
	withSubsegment,
} from './powertools-tracer.js'

/**
 * Global state tracking for cold start detection
 */
let isInitialized = false

/**
 * Reset function for testing - resets module-level state
 * @internal This function is only intended for use in tests
 */
export const __resetMiddlewareForTesting = () => {
	isInitialized = false
}

/**
 * Create middleware context from Lambda event and context
 */
export const createMiddlewareContext = (
	event: APIGatewayProxyEvent,
	context: Context,
): MiddlewareContext => {
	const isColdStart = !isInitialized
	if (!isInitialized) {
		isInitialized = true
	}

	return {
		startTime: Date.now(),
		isColdStart,
		requestId: context.awsRequestId,
		functionName: context.functionName,
		functionVersion: context.functionVersion,
		metadata: {
			httpMethod: event.httpMethod,
			path: event.path,
			userAgent: event.headers['User-Agent'],
			sourceIp: event.requestContext.identity.sourceIp,
		},
	}
}

/**
 * Observability middleware
 * Integrates with existing Powertools logger, metrics, and tracer
 */
export const withObservability = (
	// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
	config: ObservabilityConfig = defaultMiddlewareConfig.observability!,
): LambdaMiddleware => {
	return (handler: LambdaHandler): LambdaHandler => {
		return async (event, context) => {
			if (!config.enabled) {
				return handler(event, context)
			}

			const middlewareContext = createMiddlewareContext(event, context)

			// Add common trace annotations and metadata
			addCommonAnnotations()
			addCommonMetadata()

			// Add request-specific annotations
			tracer.putAnnotation('coldStart', middlewareContext.isColdStart)
			tracer.putAnnotation('requestId', middlewareContext.requestId)
			tracer.putAnnotation('functionName', middlewareContext.functionName)
			tracer.putAnnotation('httpMethod', event.httpMethod)
			tracer.putAnnotation('path', event.path)

			// Add custom annotations if provided
			if (config.options?.customAnnotations) {
				Object.entries(config.options.customAnnotations).forEach(
					([key, value]) => {
						tracer.putAnnotation(key, value)
					},
				)
			}

			// Add custom metadata if provided
			if (config.options?.customMetadata) {
				Object.entries(config.options.customMetadata).forEach(
					([key, value]) => {
						tracer.putMetadata(key, value)
					},
				)
			}

			// Log request start
			if (config.options?.enableRequestLogging) {
				logger.info('Lambda request started', {
					requestId: middlewareContext.requestId,
					httpMethod: event.httpMethod,
					path: event.path,
					coldStart: middlewareContext.isColdStart,
					userAgent: event.headers['User-Agent'],
				})
			}

			try {
				const result = await handler(event, context)

				// Log successful completion
				if (config.options?.enableRequestLogging) {
					logger.info('Lambda request completed successfully', {
						requestId: middlewareContext.requestId,
						statusCode: result.statusCode,
						executionTime: Date.now() - middlewareContext.startTime,
					})
				}

				return result
			} catch (error) {
				// Error handling is delegated to error handling middleware
				throw error
			}
		}
	}
}

/**
 * Error handling middleware
 * Integrates with existing Go-style error handling patterns
 */
export const withErrorHandling = (
	// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
	config: ErrorHandlingConfig = defaultMiddlewareConfig.errorHandling!,
): LambdaMiddleware => {
	return (handler: LambdaHandler): LambdaHandler => {
		return async (event, context) => {
			if (!config.enabled) {
				return handler(event, context)
			}

			const middlewareContext = createMiddlewareContext(event, context)

			try {
				return await handler(event, context)
			} catch (error) {
				const err = error instanceof Error ? error : new Error(String(error))

				// Use existing full observability error logging
				if (config.options?.enableFullObservability) {
					logErrorWithFullObservability(
						err,
						'lambda-middleware-error-handler',
						{
							requestId: middlewareContext.requestId,
							httpMethod: event.httpMethod,
							path: event.path,
							coldStart: middlewareContext.isColdStart,
						},
					)
				}

				// Add error metrics
				if (config.options?.enableErrorMetrics) {
					addMetric(MetricName.ExecutionTime, MetricUnit.Count, 1, {
						Status: 'Error',
						ErrorType: err.constructor.name,
					})
				}

				// Add error tracing
				if (config.options?.enableErrorTracing) {
					captureError(err, traceErrorTypes.DEPENDENCY_ERROR, {
						operation: 'lambda-middleware-error-handler',
						requestId: middlewareContext.requestId,
						httpMethod: event.httpMethod,
						path: event.path,
					})
				}

				// Re-throw the error to maintain existing error handling behavior
				throw err
			}
		}
	}
}

/**
 * Performance monitoring middleware
 * Tracks execution time, memory usage, and cold starts
 */
export const withPerformanceMonitoring = (
	// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
	config: PerformanceConfig = defaultMiddlewareConfig.performance!,
): LambdaMiddleware => {
	return (handler: LambdaHandler): LambdaHandler => {
		return async (event, context) => {
			if (!config.enabled) {
				return handler(event, context)
			}

			const middlewareContext = createMiddlewareContext(event, context)

			// Record cold start metrics
			if (
				config.options?.enableColdStartTracking &&
				middlewareContext.isColdStart
			) {
				recordColdStart(middlewareContext.isColdStart)
			}

			// Record memory usage
			if (config.options?.enableMemoryUsage) {
				recordMemoryUsage()
			}

			// Measure execution time
			if (config.options?.enableExecutionTime) {
				return measureAndRecordExecutionTime(
					() => handler(event, context),
					MetricName.ExecutionTime,
					{
						FunctionName: middlewareContext.functionName,
						HttpMethod: event.httpMethod,
						Path: event.path,
					},
				)
			}

			return handler(event, context)
		}
	}
}

/**
 * Request logging middleware
 * Provides detailed request/response logging with security considerations
 */
export const withRequestLogging = (
	// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
	config: RequestLoggingConfig = defaultMiddlewareConfig.requestLogging!,
): LambdaMiddleware => {
	return (handler: LambdaHandler): LambdaHandler => {
		return async (event, context) => {
			if (!config.enabled) {
				return handler(event, context)
			}

			const middlewareContext = createMiddlewareContext(event, context)

			// Log request details
			const requestLog: Record<string, unknown> = {
				requestId: middlewareContext.requestId,
				httpMethod: event.httpMethod,
				path: event.path,
				queryStringParameters: event.queryStringParameters,
			}

			// Add headers if enabled
			if (config.options?.enableHeaders) {
				requestLog.headers = event.headers
			}

			// Add request body if enabled and within size limits
			if (config.options?.enableRequestBody && event.body) {
				const bodySize = Buffer.byteLength(event.body, 'utf8')
				const maxSize = config.options.maxBodySize ?? 1024

				if (bodySize <= maxSize) {
					requestLog.body = event.body
				} else {
					requestLog.bodyTruncated = `Body too large (${bodySize.toString()} bytes, max ${maxSize.toString()})`
				}
			}

			logger.info('Lambda request details', requestLog)

			try {
				const result = await handler(event, context)

				// Log response details
				const responseLog: Record<string, unknown> = {
					requestId: middlewareContext.requestId,
					statusCode: result.statusCode,
					executionTime: Date.now() - middlewareContext.startTime,
				}

				// Add response body if enabled and within size limits
				if (config.options?.enableResponseBody && result.body) {
					const bodySize = Buffer.byteLength(result.body, 'utf8')
					const maxSize = config.options.maxBodySize ?? 1024

					if (bodySize <= maxSize) {
						responseLog.body = result.body
					} else {
						responseLog.bodyTruncated = `Body too large (${bodySize.toString()} bytes, max ${maxSize.toString()})`
					}
				}

				logger.info('Lambda response details', responseLog)

				return result
			} catch (error) {
				// Log error details
				logger.error('Lambda request failed', {
					requestId: middlewareContext.requestId,
					error: error instanceof Error ? error.message : String(error),
					executionTime: Date.now() - middlewareContext.startTime,
				})

				throw error
			}
		}
	}
}

/**
 * Compose multiple middleware functions into a single middleware
 * Middleware are applied in the order they are provided (left to right)
 *
 * @param middlewares - Array of middleware functions to compose
 * @param options - Composition options
 * @returns A single composed middleware function
 */
export const compose = (
	middlewares: LambdaMiddleware[],
	options: CompositionOptions = {},
): LambdaMiddleware => {
	return (handler: LambdaHandler): LambdaHandler => {
		// Apply middleware in reverse order so they execute in the correct order
		return middlewares.reduceRight((wrappedHandler, middleware) => {
			if (options.enableTiming) {
				// Wrap each middleware with timing information
				return (event, context) => {
					const startTime = Date.now()
					const result = middleware(wrappedHandler)(event, context)

					if (result instanceof Promise) {
						return result.finally(() => {
							logger.debug('Middleware execution time', {
								middleware: middleware.name || 'anonymous',
								executionTime: Date.now() - startTime,
							})
						})
					}

					logger.debug('Middleware execution time', {
						middleware: middleware.name || 'anonymous',
						executionTime: Date.now() - startTime,
					})

					return result
				}
			}

			return middleware(wrappedHandler)
		}, handler)
	}
}

/**
 * Create a complete middleware stack with all standard middleware
 * This is the recommended way to set up middleware for most use cases
 *
 * @param config - Complete middleware configuration
 * @param options - Composition options
 * @returns A composed middleware function with all standard middleware
 */
export const createMiddlewareStack = (
	config: LambdaMiddlewareConfig = defaultMiddlewareConfig,
	options: CompositionOptions = {},
): LambdaMiddleware => {
	const middlewares: LambdaMiddleware[] = []

	// Add middleware in execution order
	if (config.requestLogging?.enabled) {
		middlewares.push(withRequestLogging(config.requestLogging))
	}

	if (config.observability?.enabled) {
		middlewares.push(withObservability(config.observability))
	}

	if (config.performance?.enabled) {
		middlewares.push(withPerformanceMonitoring(config.performance))
	}

	if (config.errorHandling?.enabled) {
		middlewares.push(withErrorHandling(config.errorHandling))
	}

	return compose(middlewares, options)
}

/**
 * Apply middleware to a Lambda handler with X-Ray subsegment wrapping
 * This maintains compatibility with existing X-Ray tracing patterns
 *
 * @param handler - The Lambda handler to wrap
 * @param middleware - The middleware to apply
 * @param subsegmentName - Name for the X-Ray subsegment
 * @returns The wrapped handler with middleware and X-Ray tracing
 */
export const applyMiddlewareWithTracing = (
	handler: LambdaHandler,
	middleware: LambdaMiddleware,
	subsegmentName: string = subsegmentNames.EXPRESS_ROUTES,
): LambdaHandler => {
	const wrappedHandler = middleware(handler)

	return (event, context) => {
		return withSubsegment(subsegmentName, () => wrappedHandler(event, context))
	}
}
