/**
 * AWS Lambda Middleware Types and Interfaces
 * Provides type-safe middleware patterns for Lambda handlers with Powertools integration
 */

import type {
	APIGatewayProxyEvent,
	APIGatewayProxyResult,
	Context,
} from 'aws-lambda'

/**
 * Standard Lambda handler type for API Gateway proxy integration
 */
export type LambdaHandler = (
	event: APIGatewayProxyEvent,
	context: Context,
) => Promise<APIGatewayProxyResult>

/**
 * Lambda middleware function type
 * Takes a handler and returns a wrapped handler with additional functionality
 */
export type LambdaMiddleware = (handler: LambdaHandler) => LambdaHandler

/**
 * Middleware execution context
 * Provides additional context and utilities for middleware functions
 */
export interface MiddlewareContext {
	/** Start time of the request for performance monitoring */
	startTime: number
	/** Whether this is a cold start invocation */
	isColdStart: boolean
	/** Request ID for correlation */
	requestId: string
	/** Function name */
	functionName: string
	/** Function version */
	functionVersion: string
	/** Additional metadata for middleware */
	metadata: Record<string, unknown>
}

/**
 * Middleware configuration options
 */
export interface MiddlewareConfig {
	/** Enable/disable specific middleware features */
	enabled: boolean
	/** Middleware-specific configuration */
	options?: Record<string, unknown>
}

/**
 * Observability middleware configuration
 */
export interface ObservabilityConfig extends MiddlewareConfig {
	options?: {
		/** Enable request/response logging */
		enableRequestLogging?: boolean
		/** Enable performance metrics */
		enablePerformanceMetrics?: boolean
		/** Enable X-Ray tracing annotations */
		enableTracingAnnotations?: boolean
		/** Custom trace annotations */
		customAnnotations?: Record<string, string | number | boolean>
		/** Custom trace metadata */
		customMetadata?: Record<string, unknown>
	}
}

/**
 * Error handling middleware configuration
 */
export interface ErrorHandlingConfig extends MiddlewareConfig {
	options?: {
		/** Enable full observability for errors */
		enableFullObservability?: boolean
		/** Enable error metrics */
		enableErrorMetrics?: boolean
		/** Enable error tracing */
		enableErrorTracing?: boolean
		/** Custom error response format */
		customErrorResponse?: boolean
	}
}

/**
 * Performance monitoring middleware configuration
 */
export interface PerformanceConfig extends MiddlewareConfig {
	options?: {
		/** Enable execution time tracking */
		enableExecutionTime?: boolean
		/** Enable memory usage tracking */
		enableMemoryUsage?: boolean
		/** Enable cold start tracking */
		enableColdStartTracking?: boolean
		/** Performance thresholds for alerting */
		thresholds?: {
			executionTimeMs?: number
			memoryUsageMB?: number
		}
	}
}

/**
 * Request logging middleware configuration
 */
export interface RequestLoggingConfig extends MiddlewareConfig {
	options?: {
		/** Enable request body logging */
		enableRequestBody?: boolean
		/** Enable response body logging */
		enableResponseBody?: boolean
		/** Enable headers logging */
		enableHeaders?: boolean
		/** Sensitive fields to redact */
		redactFields?: string[]
		/** Maximum body size to log (bytes) */
		maxBodySize?: number
	}
}

/**
 * Comprehensive request/response logging middleware configuration
 */
export interface ComprehensiveRequestLoggingConfig extends MiddlewareConfig {
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
	}
}

/**
 * Complete middleware configuration
 */
export interface LambdaMiddlewareConfig {
	observability?: ObservabilityConfig
	errorHandling?: ErrorHandlingConfig
	performance?: PerformanceConfig
	requestLogging?: RequestLoggingConfig
	comprehensiveRequestLogging?: ComprehensiveRequestLoggingConfig
}

/**
 * Middleware execution result
 * Used for middleware that need to return additional information
 */
export interface MiddlewareResult<T = unknown> {
	success: boolean
	data?: T
	error?: Error
	metadata?: Record<string, unknown>
}

/**
 * Middleware hook types for lifecycle management
 */
export interface MiddlewareHooks {
	/** Called before handler execution */
	beforeHandler?: (
		event: APIGatewayProxyEvent,
		context: Context,
		middlewareContext: MiddlewareContext,
	) => Promise<void> | void

	/** Called after successful handler execution */
	afterHandler?: (
		event: APIGatewayProxyEvent,
		context: Context,
		result: APIGatewayProxyResult,
		middlewareContext: MiddlewareContext,
	) => Promise<void> | void

	/** Called when handler throws an error */
	onError?: (
		event: APIGatewayProxyEvent,
		context: Context,
		error: Error,
		middlewareContext: MiddlewareContext,
	) => Promise<void> | void

	/** Called after middleware execution (success or error) */
	onFinally?: (
		event: APIGatewayProxyEvent,
		context: Context,
		middlewareContext: MiddlewareContext,
	) => Promise<void> | void
}

/**
 * Advanced middleware interface for complex middleware implementations
 */
export interface AdvancedMiddleware {
	/** Middleware name for debugging */
	name: string
	/** Middleware configuration */
	config: MiddlewareConfig
	/** Middleware hooks */
	hooks: MiddlewareHooks
	/** The actual middleware function */
	middleware: LambdaMiddleware
}

/**
 * Middleware composition options
 */
export interface CompositionOptions {
	/** Enable middleware execution timing */
	enableTiming?: boolean
	/** Enable middleware error isolation */
	enableErrorIsolation?: boolean
	/** Global middleware configuration */
	globalConfig?: LambdaMiddlewareConfig
}

/**
 * Type guard to check if a value is a LambdaHandler
 */
export const isLambdaHandler = (value: unknown): value is LambdaHandler => {
	return typeof value === 'function'
}

/**
 * Type guard to check if a value is a LambdaMiddleware
 */
export const isLambdaMiddleware = (
	value: unknown,
): value is LambdaMiddleware => {
	return typeof value === 'function'
}

/**
 * Default middleware configuration
 */
export const defaultMiddlewareConfig: LambdaMiddlewareConfig = {
	observability: {
		enabled: true,
		options: {
			enableRequestLogging: true,
			enablePerformanceMetrics: true,
			enableTracingAnnotations: true,
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
	performance: {
		enabled: true,
		options: {
			enableExecutionTime: true,
			enableMemoryUsage: true,
			enableColdStartTracking: true,
		},
	},
	requestLogging: {
		enabled: true,
		options: {
			enableRequestBody: false, // Disabled by default for security
			enableResponseBody: false, // Disabled by default for security
			enableHeaders: true,
			maxBodySize: 1024, // 1KB max
		},
	},
	comprehensiveRequestLogging: {
		enabled: false, // Disabled by default, use explicit configuration
		options: {
			enableRequestBody: false,
			enableResponseBody: false,
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
			maxBodySize: 1024,
			maxHeaderSize: 512,
			requestLogLevel: 'info' as const,
			responseLogLevel: 'info' as const,
			errorLogLevel: 'error' as const,
		},
	},
} as const
