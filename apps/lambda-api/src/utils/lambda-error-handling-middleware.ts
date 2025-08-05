/**
 * Standardized Error Handling Middleware for AWS Lambda
 * Provides comprehensive error handling with Go-style patterns, observability, and standardized responses
 */

import type { APIGatewayProxyResult } from 'aws-lambda'

import { AppError, ErrorType, tryCatch, tryCatchSync } from './errors.js'
import { createMiddlewareContext } from './lambda-middleware.js'
import type {
	LambdaHandler,
	LambdaMiddleware,
	MiddlewareContext,
} from './lambda-middleware-types.js'
import {
	logAppError,
	logErrorWithFullObservability,
} from './powertools-error-logging.js'
import { logger } from './powertools-logger.js'
import { addMetric, MetricUnit } from './powertools-metrics.js'
import { captureError, traceErrorTypes, tracer } from './powertools-tracer.js'

/**
 * Configuration for standardized error handling middleware
 */
export interface StandardizedErrorHandlingConfig {
	/** Enable/disable the middleware */
	enabled: boolean
	/** Error handling options */
	options?: {
		/** Enable comprehensive observability for all errors */
		enableFullObservability?: boolean
		/** Enable error metrics collection */
		enableErrorMetrics?: boolean
		/** Enable X-Ray error tracing */
		enableErrorTracing?: boolean
		/** Enable standardized error responses */
		enableStandardizedResponses?: boolean
		/** Enable Go-style error handling integration */
		enableGoStyleIntegration?: boolean
		/** Enable error classification and routing */
		enableErrorClassification?: boolean
		/** Custom error response transformer */
		customErrorTransformer?: (
			error: AppError,
			context: MiddlewareContext,
		) => APIGatewayProxyResult
		/** Sensitive fields to redact from error details */
		redactFields?: string[]
		/** Include stack traces in responses (development only) */
		includeStackTrace?: boolean
	}
}

/**
 * Default configuration for standardized error handling
 */
export const defaultStandardizedErrorHandlingConfig: StandardizedErrorHandlingConfig =
	{
		enabled: true,
		options: {
			enableFullObservability: true,
			enableErrorMetrics: true,
			enableErrorTracing: true,
			enableStandardizedResponses: true,
			enableGoStyleIntegration: true,
			enableErrorClassification: true,
			redactFields: ['password', 'token', 'secret', 'key', 'authorization'],
			includeStackTrace: process.env.NODE_ENV !== 'production',
		},
	}

/**
 * Error classification utility
 * Classifies errors into categories for better handling and metrics
 */
export const classifyError = (
	error: unknown,
): {
	category: string
	severity: 'low' | 'medium' | 'high' | 'critical'
	isRetryable: boolean
	statusCode: number
} => {
	if (error instanceof AppError) {
		switch (error.type) {
			case ErrorType.ValidationError:
				return {
					category: 'client_error',
					severity: 'low',
					isRetryable: false,
					statusCode: error.status,
				}
			case ErrorType.ConfigurationError:
				return {
					category: 'configuration_error',
					severity: 'high',
					isRetryable: false,
					statusCode: error.status,
				}
			case ErrorType.ParameterStoreError:
				return {
					category: 'infrastructure_error',
					severity: 'medium',
					isRetryable: true,
					statusCode: error.status,
				}
			case ErrorType.InternalError:
				return {
					category: 'server_error',
					severity: 'high',
					isRetryable: false,
					statusCode: error.status,
				}
			case ErrorType.ApiError:
			default:
				return {
					category: 'api_error',
					severity: 'medium',
					isRetryable: false,
					statusCode: error.status,
				}
		}
	}

	// Handle standard errors
	if (error instanceof Error) {
		return {
			category: 'unexpected_error',
			severity: 'critical',
			isRetryable: false,
			statusCode: 500,
		}
	}

	// Handle unknown errors
	return {
		category: 'unknown_error',
		severity: 'critical',
		isRetryable: false,
		statusCode: 500,
	}
}

/**
 * Redact sensitive information from error details
 */
export const redactSensitiveData = (
	data: unknown,
	redactFields: string[] = [],
): unknown => {
	if (!data || typeof data !== 'object') {
		return data
	}

	if (Array.isArray(data)) {
		return data.map((item) => redactSensitiveData(item, redactFields))
	}

	const result: Record<string, unknown> = {}
	for (const [key, value] of Object.entries(data)) {
		if (
			redactFields.some((field) =>
				key.toLowerCase().includes(field.toLowerCase()),
			)
		) {
			result[key] = '[REDACTED]'
		} else if (typeof value === 'object' && value !== null) {
			result[key] = redactSensitiveData(value, redactFields)
		} else {
			result[key] = value
		}
	}

	return result
}

/**
 * Create standardized error response
 */
export const createStandardizedErrorResponse = (
	error: AppError,
	context: MiddlewareContext,
	config: StandardizedErrorHandlingConfig,
): APIGatewayProxyResult => {
	const classification = classifyError(error)
	const isProduction = process.env.NODE_ENV === 'production'

	// Base response structure
	const responseBody: Record<string, unknown> = {
		error: true,
		message: error.message,
		type: error.type,
		requestId: context.requestId,
		timestamp: new Date().toISOString(),
	}

	// Add additional details in non-production environments
	if (!isProduction) {
		responseBody.details = config.options?.redactFields
			? redactSensitiveData(error.details, config.options.redactFields)
			: error.details

		if (config.options?.includeStackTrace) {
			responseBody.stack = error.stack
		}

		responseBody.service = error.service
		responseBody.classification = classification
	}

	// Add retry information for retryable errors
	if (classification.isRetryable) {
		responseBody.retryable = true
		responseBody.retryAfter = 1000 // 1 second default
	}

	return {
		statusCode: classification.statusCode,
		headers: {
			'Content-Type': 'application/json',
			'Access-Control-Allow-Origin': '*',
			'Access-Control-Allow-Credentials': 'true',
			'x-lambda-request-id': context.requestId,
			'x-lambda-error': 'true',
			'x-error-type': error.type,
			'x-error-category': classification.category,
			'x-error-severity': classification.severity,
			...(classification.isRetryable && { 'x-retry-after': '1000' }),
		},
		body: JSON.stringify(responseBody),
	}
}

/**
 * Comprehensive error metrics collection
 */
export const collectErrorMetrics = (
	error: AppError,
	context: MiddlewareContext,
	classification: ReturnType<typeof classifyError>,
): void => {
	// Basic error count metric
	addMetric('ErrorCount', MetricUnit.Count, 1, {
		ErrorType: error.type,
		ErrorCategory: classification.category,
		ErrorSeverity: classification.severity,
		StatusCode: String(classification.statusCode),
		ColdStart: String(context.isColdStart),
		FunctionName: context.functionName,
	})

	// Error rate by category
	addMetric('ErrorRate', MetricUnit.Count, 1, {
		Category: classification.category,
		Severity: classification.severity,
	})

	// Retryable error tracking
	if (classification.isRetryable) {
		addMetric('RetryableErrorCount', MetricUnit.Count, 1, {
			ErrorType: error.type,
			Category: classification.category,
		})
	}

	// Service-specific error tracking
	if (error.service && error.service !== 'unknown') {
		addMetric('ServiceErrorCount', MetricUnit.Count, 1, {
			Service: error.service,
			ErrorType: error.type,
		})
	}
}

/**
 * Enhanced X-Ray error tracing
 */
export const traceErrorWithContext = (
	error: AppError,
	context: MiddlewareContext,
	classification: ReturnType<typeof classifyError>,
): void => {
	// Add error annotations
	tracer.putAnnotation('error', true)
	tracer.putAnnotation('errorType', error.type)
	tracer.putAnnotation('errorCategory', classification.category)
	tracer.putAnnotation('errorSeverity', classification.severity)
	tracer.putAnnotation('statusCode', classification.statusCode)
	tracer.putAnnotation('retryable', classification.isRetryable)

	// Add error metadata
	tracer.putMetadata('error', {
		message: error.message,
		type: error.type,
		service: error.service,
		classification,
		context: {
			requestId: context.requestId,
			functionName: context.functionName,
			coldStart: context.isColdStart,
		},
	})

	// Capture error in trace
	const traceErrorType =
		classification.severity === 'critical'
			? traceErrorTypes.DEPENDENCY_ERROR
			: traceErrorTypes.PARAMETER_STORE_ERROR

	captureError(error, traceErrorType, {
		operation: 'standardized-error-handler',
		category: classification.category,
		severity: classification.severity,
		retryable: classification.isRetryable,
		...context.metadata,
	})
}

/**
 * Go-style error handling wrapper for Lambda handlers
 * Integrates tryCatch patterns with Lambda middleware
 */
export const withGoStyleErrorHandling = <T>(
	operation: () => Promise<T>,
	context: string,
): Promise<[T, null] | [null, AppError]> => {
	return tryCatch(operation(), context)
}

/**
 * Synchronous Go-style error handling wrapper
 */
export const withGoStyleErrorHandlingSync = <T>(
	operation: () => T,
	context: string,
): [T, null] | [null, AppError] => {
	return tryCatchSync(operation, context)
}

/**
 * Main standardized error handling middleware
 * Provides comprehensive error handling with observability, classification, and standardized responses
 */
export const withStandardizedErrorHandling = (
	config: StandardizedErrorHandlingConfig = defaultStandardizedErrorHandlingConfig,
): LambdaMiddleware => {
	return (handler: LambdaHandler): LambdaHandler => {
		return async (event, context) => {
			if (!config.enabled) {
				return handler(event, context)
			}

			const middlewareContext = createMiddlewareContext(event, context)

			// Use Go-style error handling if enabled
			if (config.options?.enableGoStyleIntegration) {
				const [result, error] = await withGoStyleErrorHandling(
					() => handler(event, context),
					'standardized-error-handler',
				)

				if (error) {
					return handleError(error, middlewareContext, config)
				}

				return result
			}

			// Traditional try-catch approach
			try {
				return await handler(event, context)
			} catch (error) {
				const appError =
					error instanceof AppError
						? error
						: AppError.from(error, 'standardized-error-handler')

				return handleError(appError, middlewareContext, config)
			}
		}
	}
}

/**
 * Centralized error handling logic
 */
const handleError = (
	error: AppError,
	context: MiddlewareContext,
	config: StandardizedErrorHandlingConfig,
): APIGatewayProxyResult => {
	// Classify the error
	const classification = config.options?.enableErrorClassification
		? classifyError(error)
		: {
				category: 'unclassified',
				severity: 'medium' as const,
				isRetryable: false,
				statusCode: error.status,
			}

	// Log the error with appropriate observability
	if (config.options?.enableFullObservability) {
		logErrorWithFullObservability(error, 'standardized-error-handler', {
			requestId: context.requestId,
			httpMethod: context.metadata.httpMethod,
			path: context.metadata.path,
			coldStart: context.isColdStart,
			classification,
		})
	} else {
		// Use AppError-specific logging
		logAppError(error, 'standardized-error-handler', {
			requestId: context.requestId,
			classification,
		})
	}

	// Collect error metrics
	if (config.options?.enableErrorMetrics) {
		collectErrorMetrics(error, context, classification)
	}

	// Add error tracing
	if (config.options?.enableErrorTracing) {
		traceErrorWithContext(error, context, classification)
	}

	// Create standardized response
	if (config.options?.enableStandardizedResponses) {
		if (config.options.customErrorTransformer) {
			return config.options.customErrorTransformer(error, context)
		}
		return createStandardizedErrorResponse(error, context, config)
	}

	// Fallback to basic error response
	return {
		statusCode: error.status,
		headers: {
			'Content-Type': 'application/json',
			'Access-Control-Allow-Origin': '*',
			'Access-Control-Allow-Credentials': 'true',
			'x-lambda-request-id': context.requestId,
			'x-lambda-error': 'true',
		},
		body: JSON.stringify({
			error: true,
			message: error.message,
			requestId: context.requestId,
			timestamp: new Date().toISOString(),
		}),
	}
}

/**
 * Express-style error handling middleware adapter
 * Allows using Express error handling patterns in Lambda
 */
export const withExpressStyleErrorHandling = (
	config: StandardizedErrorHandlingConfig = defaultStandardizedErrorHandlingConfig,
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
				// Convert to AppError if needed
				const appError =
					error instanceof AppError
						? error
						: AppError.from(error, 'express-style-error-handler')

				// Log error similar to Express error middleware
				logger.error('Lambda request failed', {
					operation: 'express-style-error-handler',
					path: middlewareContext.metadata.path ?? 'unknown',
					method: middlewareContext.metadata.httpMethod ?? 'unknown',
					status: appError.status,
					type: appError.type,
					service: appError.service,
					error: appError.message,
					stack:
						process.env.NODE_ENV !== 'production' ? appError.stack : undefined,
					requestId: middlewareContext.requestId,
				})

				// Return Express-style error response
				const responseBody: Record<string, unknown> = {
					message: appError.message,
				}

				// Add details in non-production
				if (process.env.NODE_ENV !== 'production') {
					responseBody.details = appError.details
					responseBody.type = appError.type
				}

				return {
					statusCode: appError.status,
					headers: {
						'Content-Type': 'application/json',
						'Access-Control-Allow-Origin': '*',
						'Access-Control-Allow-Credentials': 'true',
						'x-lambda-request-id': middlewareContext.requestId,
					},
					body: JSON.stringify(responseBody),
				}
			}
		}
	}
}
