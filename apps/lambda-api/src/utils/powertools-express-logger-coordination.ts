/**
 * Powertools-Express Logger Coordination
 * Provides seamless coordination between AWS Lambda Powertools logger and Express pino logger
 */

import type { Context } from 'aws-lambda'
import type { NextFunction, Request, Response } from 'express'

import type { MiddlewareContext } from './lambda-middleware-types.js'
import {
	createChildLogger,
	logger as powertoolsLogger,
} from './powertools-logger.js'

/**
 * Log level type for unified logging
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

/**
 * Pino logger interface for type safety
 */
export interface PinoLogger {
	debug: (obj: Record<string, unknown>, msg?: string) => void
	info: (obj: Record<string, unknown>, msg?: string) => void
	warn: (obj: Record<string, unknown>, msg?: string) => void
	error: (obj: Record<string, unknown>, msg?: string) => void
}

/**
 * Extended Express Request interface with Lambda context
 */
export interface LambdaAwareRequest extends Omit<Request, 'log'> {
	lambda?: {
		event: unknown
		context: Context
		isLambda: boolean
		coldStart: boolean
		functionName: string
		functionVersion: string
		requestId: string
		traceId?: string
		middlewareContext?: MiddlewareContext
	}
	// Add Powertools logger context
	powertoolsLogger?: typeof powertoolsLogger
	correlationId?: string
	traceId?: string
	// Override log property to be more flexible for pino-http
	log?: PinoLogger
	// Add unified logging helper
	unifiedLog?: (
		level: LogLevel,
		message: string,
		additionalData?: Record<string, unknown>,
	) => void
}

/**
 * Configuration for Powertools-Express logger coordination
 */
export interface PowertoolsExpressCoordinationConfig {
	/** Enable/disable coordination */
	enabled: boolean
	/** Coordination options */
	options?: {
		/** Enable request correlation between Lambda and Express */
		enableRequestCorrelation?: boolean
		/** Enable trace ID propagation */
		enableTraceIdPropagation?: boolean
		/** Enable shared log formatting */
		enableSharedLogFormatting?: boolean
		/** Enable Express pino enhancement with Powertools metadata */
		enablePinoEnhancement?: boolean
		/** Enable Lambda context injection into Express requests */
		enableLambdaContextInjection?: boolean
		/** Enable unified error logging */
		enableUnifiedErrorLogging?: boolean
		/** Custom correlation ID header name */
		correlationIdHeader?: string
		/** Custom trace ID header name */
		traceIdHeader?: string
		/** Fields to sync between loggers */
		syncFields?: string[]
		/** Enable debug logging for coordination */
		enableDebugLogging?: boolean
	}
}

/**
 * Default configuration for Powertools-Express coordination
 */
export const defaultPowertoolsExpressCoordinationConfig: PowertoolsExpressCoordinationConfig =
	{
		enabled: true,
		options: {
			enableRequestCorrelation: true,
			enableTraceIdPropagation: true,
			enableSharedLogFormatting: true,
			enablePinoEnhancement: true,
			enableLambdaContextInjection: true,
			enableUnifiedErrorLogging: true,
			correlationIdHeader: 'x-correlation-id',
			traceIdHeader: 'x-amzn-trace-id',
			syncFields: ['requestId', 'traceId', 'functionName', 'coldStart'],
			enableDebugLogging: false,
		},
	}

/**
 * Extract correlation data from Lambda context and X-Ray
 */
export const extractCorrelationData = (
	lambdaContext?: Context,
	middlewareContext?: MiddlewareContext,
): {
	requestId: string
	traceId?: string
	functionName?: string
	coldStart?: boolean
	correlationId: string
} => {
	const requestId =
		lambdaContext?.awsRequestId ?? middlewareContext?.requestId ?? 'unknown'
	const traceId = process.env._X_AMZN_TRACE_ID
	const functionName =
		lambdaContext?.functionName ?? middlewareContext?.functionName
	const coldStart = middlewareContext?.isColdStart

	// Create correlation ID from request ID and trace ID
	const correlationId = traceId
		? `${requestId}-${traceId.split('-')[1] ?? 'unknown'}`
		: requestId

	return {
		requestId,
		traceId,
		functionName,
		coldStart,
		correlationId,
	}
}

/**
 * Create shared log metadata for both Powertools and pino
 */
export const createSharedLogMetadata = (
	req: LambdaAwareRequest,
	config: PowertoolsExpressCoordinationConfig,
): Record<string, unknown> => {
	const correlationData = extractCorrelationData(
		req.lambda?.context,
		req.lambda?.middlewareContext,
	)

	const sharedMetadata: Record<string, unknown> = {
		service: 'macro-ai-lambda-api',
		layer: 'express',
		...correlationData,
	}

	// Add Lambda-specific metadata if available
	if (req.lambda) {
		sharedMetadata.lambda = {
			isLambda: req.lambda.isLambda,
			functionName: req.lambda.functionName,
			functionVersion: req.lambda.functionVersion,
			coldStart: req.lambda.coldStart,
		}
	}

	// Add request-specific metadata
	sharedMetadata.request = {
		method: req.method,
		path: req.path,
		url: req.url,
		userAgent: req.get('User-Agent'),
		ip: req.ip,
	}

	// Add custom sync fields if configured
	if (config.options?.syncFields) {
		for (const field of config.options.syncFields) {
			if (
				correlationData[field as keyof typeof correlationData] !== undefined
			) {
				sharedMetadata[field] =
					correlationData[field as keyof typeof correlationData]
			}
		}
	}

	return sharedMetadata
}

/**
 * Enhance Express request with Powertools logger context
 */
export const enhanceRequestWithPowertoolsContext = (
	req: LambdaAwareRequest,
	config: PowertoolsExpressCoordinationConfig,
): void => {
	if (!config.options?.enableLambdaContextInjection) {
		return
	}

	const correlationData = extractCorrelationData(
		req.lambda?.context,
		req.lambda?.middlewareContext,
	)

	// Add correlation data to request
	req.correlationId = correlationData.correlationId
	req.traceId = correlationData.traceId

	// Create child Powertools logger with request context
	const sharedMetadata = createSharedLogMetadata(req, config)
	req.powertoolsLogger = createChildLogger({
		correlationId: correlationData.correlationId,
		requestId: correlationData.requestId,
		traceId: correlationData.traceId ?? 'unknown',
		layer: 'express',
		...sharedMetadata,
	})

	// Add headers for downstream services
	if (config.options.correlationIdHeader && correlationData.correlationId) {
		req.headers[config.options.correlationIdHeader] =
			correlationData.correlationId
	}

	if (config.options.traceIdHeader && correlationData.traceId) {
		req.headers[config.options.traceIdHeader] = correlationData.traceId
	}
}

/**
 * Create unified log entry for both Powertools and pino
 */
export const createUnifiedLogEntry = (
	level: LogLevel,
	message: string,
	req: LambdaAwareRequest,
	additionalData?: Record<string, unknown>,
	config: PowertoolsExpressCoordinationConfig = defaultPowertoolsExpressCoordinationConfig,
): void => {
	if (!config.enabled) {
		return
	}

	const sharedMetadata = createSharedLogMetadata(req, config)
	const logData = {
		...sharedMetadata,
		...additionalData,
	}

	// Log to Powertools logger
	if (req.powertoolsLogger) {
		req.powertoolsLogger[level](message, logData)
	} else {
		powertoolsLogger[level](message, logData)
	}

	// Log to Express pino logger (if available)
	if (req.log) {
		req.log[level](logData, message)
	}

	// Debug logging for coordination
	if (config.options?.enableDebugLogging) {
		powertoolsLogger.debug('Unified log entry created', {
			operation: 'unified-logging',
			level,
			message,
			hasExpressLogger: !!req.log,
			hasPowertoolsLogger: !!req.powertoolsLogger,
			correlationId: req.correlationId,
		})
	}
}

/**
 * Express middleware for Powertools-Express logger coordination
 * Enhances Express requests with Powertools context and enables unified logging
 */
export const powertoolsExpressCoordinationMiddleware = (
	config: PowertoolsExpressCoordinationConfig = defaultPowertoolsExpressCoordinationConfig,
) => {
	return (req: LambdaAwareRequest, res: Response, next: NextFunction): void => {
		if (!config.enabled) {
			next()
			return
		}

		try {
			// Enhance request with Powertools context
			enhanceRequestWithPowertoolsContext(req, config)

			// Add unified logging helper to request
			req.unifiedLog = (
				level: LogLevel,
				message: string,
				additionalData?: Record<string, unknown>,
			) => {
				createUnifiedLogEntry(level, message, req, additionalData, config)
			}

			// Log request start with unified logging
			if (config.options?.enableRequestCorrelation) {
				createUnifiedLogEntry(
					'info',
					'Express request started',
					req,
					{
						operation: 'express-request-start',
						method: req.method,
						path: req.path,
						userAgent: req.get('User-Agent'),
					},
					config,
				)
			}

			// Enhance response with correlation headers
			if (config.options?.enableRequestCorrelation) {
				if (req.correlationId && config.options.correlationIdHeader) {
					res.setHeader(config.options.correlationIdHeader, req.correlationId)
				}

				if (req.traceId && config.options.traceIdHeader) {
					res.setHeader(config.options.traceIdHeader, req.traceId)
				}
			}

			next()
		} catch (error) {
			// Log coordination error
			powertoolsLogger.error('Powertools-Express coordination error', {
				operation: 'coordination-middleware',
				error: error instanceof Error ? error.message : String(error),
				path: req.path,
				method: req.method,
			})

			// Continue without coordination
			next()
		}
	}
}

/**
 * Enhanced pino-http configuration with Powertools coordination
 * Creates a pino-http configuration that coordinates with Powertools logger
 */
export const createCoordinatedPinoHttpConfig = (
	config: PowertoolsExpressCoordinationConfig = defaultPowertoolsExpressCoordinationConfig,
) => {
	return {
		// Use quiet mode to prevent duplicate logging
		quietReqLogger: true,
		quietResLogger: true,

		// Custom log level based on response status
		customLogLevel: (_req: LambdaAwareRequest, res: Response, err?: Error) => {
			if (err || res.statusCode >= 500) return 'error'
			if (res.statusCode >= 400) return 'warn'
			return 'info'
		},

		// Custom request serializer with Powertools coordination
		serializers: {
			req: (req: LambdaAwareRequest) => {
				const baseReq = {
					method: req.method,
					url: req.url,
					path: req.path,
					headers: req.headers,
					remoteAddress: req.ip,
					remotePort: req.socket.remotePort,
				}

				// Add Lambda context if available
				if (req.lambda && config.options?.enableLambdaContextInjection) {
					return {
						...baseReq,
						lambda: {
							requestId: req.lambda.requestId,
							functionName: req.lambda.functionName,
							coldStart: req.lambda.coldStart,
							traceId: req.traceId,
						},
						correlationId: req.correlationId,
					}
				}

				return baseReq
			},

			res: (res: Response) => ({
				statusCode: res.statusCode,
				headers: res.getHeaders(),
			}),
		},

		// Custom success message
		customSuccessMessage: (req: LambdaAwareRequest, res: Response) => {
			const correlationInfo = req.correlationId ? ` [${req.correlationId}]` : ''
			return `${req.method} ${req.path} ${res.statusCode.toString()}${correlationInfo}`
		},

		// Custom error message
		customErrorMessage: (
			req: LambdaAwareRequest,
			res: Response,
			err: Error,
		) => {
			const correlationInfo = req.correlationId ? ` [${req.correlationId}]` : ''
			return `${req.method} ${req.path} ${res.statusCode.toString()} ERROR${correlationInfo}: ${err.message}`
		},

		// Custom attribute keys for consistency with Powertools
		customAttributeKeys: {
			req: 'request',
			res: 'response',
			err: 'error',
			responseTime: 'responseTime',
		},
	}
}

/**
 * Unified error logging for both Powertools and Express
 * Ensures consistent error logging across both logging systems
 */
export const logUnifiedError = (
	error: Error,
	req: LambdaAwareRequest,
	operation: string,
	additionalContext?: Record<string, unknown>,
	config: PowertoolsExpressCoordinationConfig = defaultPowertoolsExpressCoordinationConfig,
): void => {
	if (!config.enabled || !config.options?.enableUnifiedErrorLogging) {
		return
	}

	const correlationData = extractCorrelationData(
		req.lambda?.context,
		req.lambda?.middlewareContext,
	)

	const errorContext = {
		operation,
		error: error.message,
		errorType: error.constructor.name,
		stack: error.stack,
		path: req.path,
		method: req.method,
		userAgent: req.get('User-Agent'),
		...correlationData,
		...additionalContext,
	}

	// Log to Powertools logger
	if (req.powertoolsLogger) {
		req.powertoolsLogger.error('Express operation failed', errorContext)
	} else {
		powertoolsLogger.error('Express operation failed', errorContext)
	}

	// Log to Express pino logger (if available)
	if (req.log) {
		req.log.error(errorContext, `Express operation failed: ${operation}`)
	}

	// Debug logging
	if (config.options.enableDebugLogging) {
		powertoolsLogger.debug('Unified error logged', {
			operation: 'unified-error-logging',
			hasExpressLogger: !!req.log,
			hasPowertoolsLogger: !!req.powertoolsLogger,
			correlationId: correlationData.correlationId,
		})
	}
}

/**
 * Create Lambda context injection for serverless-http
 * Enhances the existing Lambda context injection with Powertools coordination
 */
export const createEnhancedLambdaContextInjection = (
	middlewareContext: MiddlewareContext,
	config: PowertoolsExpressCoordinationConfig = defaultPowertoolsExpressCoordinationConfig,
) => {
	return (request: LambdaAwareRequest, event: unknown, context: Context) => {
		// Add enhanced Lambda context to request
		request.lambda = {
			event,
			context,
			isLambda: true,
			coldStart: middlewareContext.isColdStart,
			functionName: context.functionName,
			functionVersion: context.functionVersion,
			requestId: context.awsRequestId,
			traceId: process.env._X_AMZN_TRACE_ID,
			middlewareContext,
		}

		// Add Powertools coordination if enabled
		if (config.enabled && config.options?.enableLambdaContextInjection) {
			const correlationData = extractCorrelationData(context, middlewareContext)

			// Add correlation headers
			if (config.options.correlationIdHeader) {
				request.headers[config.options.correlationIdHeader] =
					correlationData.correlationId
			}

			if (config.options.traceIdHeader && correlationData.traceId) {
				request.headers[config.options.traceIdHeader] = correlationData.traceId
			}
		}

		return request
	}
}
