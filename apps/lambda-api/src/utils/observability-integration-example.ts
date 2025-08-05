/**
 * Observability Integration Example
 * Demonstrates how to use the centralized observability configuration system
 */

import type { APIGatewayProxyEvent, Context } from 'aws-lambda'

import { createMiddlewareStack } from './lambda-middleware.js'
import {
	type LogLevel,
	type ObservabilityConfig,
	observabilityConfig,
	updateObservabilityConfig,
} from './observability-config.js'
import {
	createCoordinationConfig,
	createMiddlewareConfig,
	createObservabilityTools,
	createObservabilityTools as createToolsFromFactory,
	createProductionTools,
	createTestTools,
} from './observability-factory.js'
import { powertoolsExpressCoordinationMiddleware } from './powertools-express-logger-coordination.js'

/**
 * Example 1: Basic observability setup with default configuration
 */
export const basicObservabilitySetup = () => {
	// Create observability tools with default configuration
	const tools = createToolsFromFactory()

	// Log service initialization
	tools.logger.info('Service initialized with basic observability', {
		operation: 'service-initialization',
		config: {
			environment: tools.config.service.environment,
			logLevel: tools.config.logger.logLevel,
			tracingEnabled: tools.config.tracer.enabled,
		},
	})

	return tools
}

/**
 * Example 2: Environment-specific observability setup
 */
export const environmentSpecificSetup = (
	environment: 'development' | 'production' | 'test',
) => {
	let tools

	switch (environment) {
		case 'production':
			tools = createProductionTools()
			break
		case 'test':
			tools = createTestTools()
			break
		default:
			tools = createToolsFromFactory()
	}

	// Add environment-specific annotations
	if (tools.config.tracer.enabled) {
		tools.tracer.putAnnotation('deployment_environment', environment)
		tools.tracer.putAnnotation(
			'service_tier',
			environment === 'production' ? 'critical' : 'standard',
		)
	}

	return tools
}

/**
 * Example 3: Custom observability configuration
 */
export const customObservabilitySetup = () => {
	// Create custom configuration
	const customConfig = updateObservabilityConfig({
		logger: {
			logLevel: 'DEBUG',
			sampleRate: 1.0, // Full sampling for debugging
			enableSensitiveDataRedaction: false, // Allow sensitive data for debugging
		},
		tracer: {
			captureResponse: true,
			enableAnnotations: true,
			commonAnnotations: {
				service: 'macro-ai-lambda-api',
				version: 'debug-v1.0.0',
				debug_mode: true,
			},
		},
		features: {
			enableDebugMode: true,
			enableAdvancedTracing: true,
			enableDetailedMetrics: true,
		},
	} as unknown as Partial<ObservabilityConfig>)

	// Create tools with custom configuration
	const tools = createObservabilityTools(customConfig)

	return { tools, config: customConfig }
}

/**
 * Example 4: Lambda handler with comprehensive observability
 */
export const createObservabilityAwareLambdaHandler = () => {
	// Initialize observability tools
	const nodeEnv =
		process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test'
			? process.env.NODE_ENV
			: 'production'
	const tools = environmentSpecificSetup(nodeEnv)

	// Create middleware configuration from observability config
	const middlewareConfig = createMiddlewareConfig(tools.config)

	// Create middleware stack
	const middlewareStack = createMiddlewareStack(middlewareConfig)

	// Create coordination configuration
	const coordinationConfig = createCoordinationConfig(tools.config)

	// Helper functions to reduce cognitive complexity
	const addTracingContext = (context: Context) => {
		if (!tools.config.tracer.enabled) return

		tools.tracer.putAnnotation('aws_request_id', context.awsRequestId)
		tools.tracer.putAnnotation('function_name', context.functionName)
		tools.tracer.putAnnotation('function_version', context.functionVersion)
		tools.tracer.putMetadata('lambda_context', {
			requestId: context.awsRequestId,
			functionName: context.functionName,
			functionVersion: context.functionVersion,
			memoryLimitInMB: context.memoryLimitInMB,
			remainingTimeMs: context.getRemainingTimeInMillis(), // cspell:disable-line
		})
	}

	const logRequestStart = (event: APIGatewayProxyEvent, context: Context) => {
		tools.logger.info('Lambda request started', {
			operation: 'lambda-request',
			requestId: context.awsRequestId,
			httpMethod: event.httpMethod,
			path: event.path,
			userAgent: event.headers['User-Agent'],
		})
	}

	const addRequestMetrics = (event: APIGatewayProxyEvent) => {
		if (!tools.config.metrics.enabled) return

		tools.metrics.addMetric('LambdaInvocation', 'Count', 1)
		const methodMetric = tools.metrics.singleMetric()
		methodMetric.addDimension('Method', event.httpMethod)
		methodMetric.addMetric('RequestMethod', 'Count', 1)
	}

	// Lambda handler with observability
	const handler = (event: APIGatewayProxyEvent, context: Context) => {
		addTracingContext(context)
		logRequestStart(event, context)
		addRequestMetrics(event)

		try {
			// Simulate business logic
			const response = {
				statusCode: 200,
				headers: {
					'Content-Type': 'application/json',
					'X-Request-ID': context.awsRequestId,
				},
				body: JSON.stringify({
					message: 'Success',
					requestId: context.awsRequestId,
					timestamp: new Date().toISOString(),
					observability: {
						tracingEnabled: tools.config.tracer.enabled,
						logLevel: tools.config.logger.logLevel,
						environment: tools.config.service.environment,
					},
				}),
			}

			// Log successful response
			tools.logger.info('Lambda request completed successfully', {
				operation: 'lambda-request',
				requestId: context.awsRequestId,
				statusCode: response.statusCode,
				responseSize: response.body.length,
			})

			// Add success metrics
			if (tools.config.metrics.enabled) {
				tools.metrics.addMetric('LambdaSuccess', 'Count', 1)
				tools.metrics.addMetric('ResponseSize', 'Bytes', response.body.length)
			}

			return response
		} catch (error) {
			// Log error with full observability
			tools.logger.error('Lambda request failed', {
				operation: 'lambda-request',
				requestId: context.awsRequestId,
				error: error instanceof Error ? error.message : String(error),
				stack: error instanceof Error ? error.stack : undefined,
			})

			// Add error to tracer
			if (tools.config.tracer.enabled && error instanceof Error) {
				tools.tracer.addErrorAsMetadata(error)
			}

			// Add error metrics
			if (tools.config.metrics.enabled) {
				tools.metrics.addMetric('LambdaError', 'Count', 1)

				// Add error type metric with dimension
				const errorMetric = tools.metrics.singleMetric()
				errorMetric.addDimension(
					'ErrorType',
					error instanceof Error ? error.constructor.name : 'Unknown',
				)
				errorMetric.addMetric('ErrorType', 'Count', 1)
			}

			throw error
		} finally {
			// Publish metrics
			if (tools.config.metrics.enabled) {
				tools.metrics.publishStoredMetrics()
			}
		}
	}

	return {
		handler,
		tools,
		middlewareStack,
		coordinationConfig,
	}
}

/**
 * Example 5: Express middleware integration
 */
export const createExpressObservabilityMiddleware = () => {
	// Get observability configuration
	const config = observabilityConfig

	// Create coordination configuration
	const coordinationConfig = createCoordinationConfig(config)

	// Create Express middleware
	const middleware = powertoolsExpressCoordinationMiddleware(coordinationConfig)

	return middleware
}

/**
 * Example 6: Runtime configuration updates
 */
export const demonstrateRuntimeConfigUpdates = () => {
	// Start with default configuration
	let tools = createToolsFromFactory()

	tools.logger.info('Initial configuration', {
		logLevel: tools.config.logger.logLevel,
		tracingEnabled: tools.config.tracer.enabled,
	})

	// Update configuration for debugging
	const debugConfig = updateObservabilityConfig({
		logger: {
			...observabilityConfig.logger,
			logLevel: 'DEBUG',
		},
		features: {
			...observabilityConfig.features,
			enableDebugMode: true,
		},
	})

	// Create new tools with updated configuration
	tools = createObservabilityTools(debugConfig)

	tools.logger.debug('Configuration updated for debugging', {
		logLevel: tools.config.logger.logLevel,
		debugMode: tools.config.features.enableDebugMode,
	})

	return tools
}

/**
 * Example 7: Configuration validation and error handling
 */
export const demonstrateConfigValidation = () => {
	try {
		// Attempt to create configuration with invalid settings
		const invalidConfig: Partial<ObservabilityConfig> = {
			logger: {
				...observabilityConfig.logger,
				logLevel: 'INVALID' as LogLevel, // This will be caught by validation
				enabled: true,
				sampleRate: -1, // Invalid sample rate
			},
		}

		const config = updateObservabilityConfig(invalidConfig)
		const tools = createObservabilityTools(config)

		return { success: true, tools }
	} catch (error) {
		console.error('Configuration validation failed:', error)

		// Fallback to default configuration
		const tools = createToolsFromFactory()

		tools.logger.warn('Using fallback configuration due to validation error', {
			error: error instanceof Error ? error.message : String(error),
		})

		return { success: false, tools, error }
	}
}

/**
 * Export all examples for easy testing and demonstration
 */
export const observabilityExamples = {
	basicSetup: basicObservabilitySetup,
	environmentSpecific: environmentSpecificSetup,
	customSetup: customObservabilitySetup,
	lambdaHandler: createObservabilityAwareLambdaHandler,
	expressMiddleware: createExpressObservabilityMiddleware,
	runtimeUpdates: demonstrateRuntimeConfigUpdates,
	configValidation: demonstrateConfigValidation,
}
