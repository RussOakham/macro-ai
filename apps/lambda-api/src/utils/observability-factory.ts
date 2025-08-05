/**
 * Observability Factory
 * Creates properly configured observability tools using centralized configuration
 */

import { Logger } from '@aws-lambda-powertools/logger'
import { Metrics } from '@aws-lambda-powertools/metrics'
import { Tracer } from '@aws-lambda-powertools/tracer'

import type { LambdaMiddlewareConfig } from './lambda-middleware-types.js'
import type { ObservabilityConfig } from './observability-config.js'
import { observabilityConfig } from './observability-config.js'
import type { PowertoolsExpressCoordinationConfig } from './powertools-express-logger-coordination.js'

/**
 * Observability tools interface
 */
export interface ObservabilityTools {
	logger: Logger
	metrics: Metrics
	tracer: Tracer
	config: ObservabilityConfig
}

/**
 * Create configured Logger instance
 */
export const createLogger = (
	config: ObservabilityConfig = observabilityConfig,
): Logger => {
	if (!config.logger.enabled) {
		// Return a no-op logger for disabled state
		return new Logger({
			serviceName: config.service.name,
			logLevel: 'CRITICAL',
			persistentLogAttributes: {},
		})
	}

	return new Logger({
		serviceName: config.service.name,
		logLevel: config.logger.logLevel,
		persistentLogAttributes: config.logger.persistentAttributes,
		sampleRateValue: config.logger.sampleRate,
	})
}

/**
 * Create configured Metrics instance
 */
export const createMetrics = (
	config: ObservabilityConfig = observabilityConfig,
): Metrics => {
	if (!config.metrics.enabled) {
		// Return a no-op metrics instance for disabled state
		return new Metrics({
			namespace: 'Disabled',
			serviceName: config.service.name,
			defaultDimensions: {},
		})
	}

	return new Metrics({
		namespace: config.metrics.namespace,
		serviceName: config.service.name,
		defaultDimensions: config.metrics.defaultDimensions,
		singleMetric: false, // Allow multiple metrics per invocation
	})
}

/**
 * Create configured Tracer instance
 */
export const createTracer = (
	config: ObservabilityConfig = observabilityConfig,
): Tracer => {
	if (!config.tracer.enabled) {
		// Return a disabled tracer for disabled state
		return new Tracer({
			serviceName: config.service.name,
			enabled: false,
		})
	}

	const tracer = new Tracer({
		serviceName: config.service.name,
		enabled: config.tracer.enabled,
		captureHTTPsRequests: config.tracer.captureHTTPsRequests,
	})

	// Add service version as annotation since it's not a constructor option
	tracer.putAnnotation('serviceVersion', config.service.version)

	return tracer
}

/**
 * Create complete observability tools suite
 */
export const createObservabilityTools = (
	config: ObservabilityConfig = observabilityConfig,
): ObservabilityTools => {
	const logger = createLogger(config)
	const metrics = createMetrics(config)
	const tracer = createTracer(config)

	// Log configuration summary (only in non-test environments)
	if (
		config.service.environment !== 'test' &&
		process.env.NODE_ENV !== 'test'
	) {
		try {
			logger.info('Observability tools initialized', {
				operation: 'observability-factory',
				config: {
					service: config.service.name,
					version: config.service.version,
					environment: config.service.environment,
					logLevel: config.logger.logLevel,
					tracingEnabled: config.tracer.enabled,
					metricsEnabled: config.metrics.enabled,
				},
			})
		} catch {
			// Ignore logging errors in tests
		}
	}

	return {
		logger,
		metrics,
		tracer,
		config,
	}
}

/**
 * Create middleware configuration from observability config
 */
export const createMiddlewareConfig = (
	config: ObservabilityConfig = observabilityConfig,
): LambdaMiddlewareConfig => {
	return {
		observability: {
			enabled: config.middleware.enableObservabilityIntegration,
			options: {
				enableRequestLogging: config.middleware.enableRequestLogging,
				enablePerformanceMetrics: config.metrics.enablePerformanceMetrics,
				enableTracingAnnotations: config.tracer.enableAnnotations,
				customAnnotations: config.tracer.commonAnnotations,
				customMetadata: config.tracer.commonMetadata,
			},
		},
		errorHandling: {
			enabled: config.middleware.enableErrorHandling,
			options: {
				enableFullObservability: true,
				enableErrorMetrics: config.metrics.enableErrorMetrics,
				enableErrorTracing: config.tracer.captureError,
			},
		},
		performance: {
			enabled: config.middleware.enablePerformanceTracking,
			options: {
				enableExecutionTime: config.metrics.enablePerformanceMetrics,
				enableMemoryUsage: config.metrics.enablePerformanceMetrics,
				enableColdStartTracking: config.metrics.enableColdStartMetrics,
			},
		},
		requestLogging: {
			enabled: config.middleware.enableRequestLogging,
			options: {
				enableRequestBody: !config.features.enableProductionOptimizations,
				enableResponseBody: config.middleware.enableResponseLogging,
				enableHeaders: true,
				maxBodySize: config.middleware.maxBodySize,
				redactFields: config.logger.redactFields,
			},
		},
	}
}

/**
 * Create Powertools-Express coordination configuration
 */
export const createCoordinationConfig = (
	config: ObservabilityConfig = observabilityConfig,
): PowertoolsExpressCoordinationConfig => {
	return {
		enabled: config.coordination.enabled,
		options: {
			enableRequestCorrelation: config.coordination.enableRequestCorrelation,
			enableTraceIdPropagation: config.coordination.enableTraceIdPropagation,
			enableSharedLogFormatting: config.coordination.enableUnifiedLogging,
			enablePinoEnhancement: config.coordination.enablePinoEnhancement,
			enableLambdaContextInjection: true,
			enableUnifiedErrorLogging: true,
			correlationIdHeader: config.coordination.correlationIdHeader,
			traceIdHeader: config.coordination.traceIdHeader,
			syncFields: config.coordination.syncFields,
			enableDebugLogging: config.coordination.enableDebugLogging,
		},
	}
}

/**
 * Update observability tools with new configuration
 */
export const updateObservabilityTools = (
	tools: ObservabilityTools,
	configUpdates: Partial<ObservabilityConfig>,
): ObservabilityTools => {
	const updatedConfig = {
		...tools.config,
		...configUpdates,
		service: { ...tools.config.service, ...configUpdates.service },
		logger: { ...tools.config.logger, ...configUpdates.logger },
		metrics: { ...tools.config.metrics, ...configUpdates.metrics },
		tracer: { ...tools.config.tracer, ...configUpdates.tracer },
		middleware: { ...tools.config.middleware, ...configUpdates.middleware },
		coordination: {
			...tools.config.coordination,
			...configUpdates.coordination,
		},
		features: { ...tools.config.features, ...configUpdates.features },
	}

	return createObservabilityTools(updatedConfig)
}

/**
 * Add common annotations to tracer
 */
export const addCommonObservabilityAnnotations = (
	tracer: Tracer,
	config: ObservabilityConfig = observabilityConfig,
): void => {
	if (!config.tracer.enabled || !config.tracer.enableAnnotations) {
		return
	}

	Object.entries(config.tracer.commonAnnotations).forEach(([key, value]) => {
		tracer.putAnnotation(key, value)
	})
}

/**
 * Add common metadata to tracer
 */
export const addCommonObservabilityMetadata = (
	tracer: Tracer,
	config: ObservabilityConfig = observabilityConfig,
): void => {
	if (!config.tracer.enabled || !config.tracer.enableMetadata) {
		return
	}

	Object.entries(config.tracer.commonMetadata).forEach(([key, value]) => {
		tracer.putMetadata(key, value)
	})
}

/**
 * Create child logger with additional context
 */
export const createChildLogger = (
	logger: Logger,
	additionalContext: Record<string, unknown>,
): Logger => {
	return logger.createChild({
		persistentLogAttributes: additionalContext,
	})
}

/**
 * Default observability tools instance
 * Pre-configured with centralized settings
 */
export const observabilityTools = createObservabilityTools()

/**
 * Export individual tools for backward compatibility
 */
export const { logger, metrics, tracer } = observabilityTools

/**
 * Export configuration helpers
 */
export const middlewareConfig = createMiddlewareConfig()
export const coordinationConfig = createCoordinationConfig()

/**
 * Environment-specific tool factories
 */
export const createDevelopmentTools = () =>
	createObservabilityTools(observabilityConfig)

export const createProductionTools = () =>
	createObservabilityTools({
		...observabilityConfig,
		service: { ...observabilityConfig.service, environment: 'production' },
		logger: {
			...observabilityConfig.logger,
			logLevel: 'INFO',
			sampleRate: 0.1,
		},
		tracer: { ...observabilityConfig.tracer, captureResponse: false },
		features: {
			...observabilityConfig.features,
			enableProductionOptimizations: true,
		},
	})

export const createTestTools = () =>
	createObservabilityTools({
		...observabilityConfig,
		service: { ...observabilityConfig.service, environment: 'test' },
		logger: { ...observabilityConfig.logger, logLevel: 'WARN' },
		tracer: { ...observabilityConfig.tracer, enabled: false },
		metrics: { ...observabilityConfig.metrics, enableCustomMetrics: false },
	})
