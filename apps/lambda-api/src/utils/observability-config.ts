/**
 * Comprehensive Observability Configuration
 * Centralizes configuration for all observability tools (logger, metrics, tracer)
 * with environment-specific settings and feature toggles
 */

import type { TEnv } from './env.schema.js'

/**
 * Log level type for consistent logging configuration
 */
export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'CRITICAL'

/**
 * Environment type for configuration
 */
export type Environment = 'development' | 'production' | 'test'

/**
 * Comprehensive observability configuration interface
 */
export interface ObservabilityConfig {
	/** Service identification */
	service: {
		name: string
		version: string
		environment: Environment
		functionName: string
		region: string
		architecture: string
		runtime: string
	}

	/** Logger configuration */
	logger: {
		enabled: boolean
		logLevel: LogLevel
		sampleRate: number
		persistentAttributes: Record<string, string | number | boolean>
		enableCorrelationIds: boolean
		enableStructuredLogging: boolean
		enableSensitiveDataRedaction: boolean
		redactFields: string[]
	}

	/** Metrics configuration */
	metrics: {
		enabled: boolean
		namespace: string
		defaultDimensions: Record<string, string>
		enableColdStartMetrics: boolean
		enablePerformanceMetrics: boolean
		enableErrorMetrics: boolean
		enableCustomMetrics: boolean
		sampleRate: number
	}

	/** Tracer configuration */
	tracer: {
		enabled: boolean
		captureHTTPsRequests: boolean
		captureResponse: boolean
		captureError: boolean
		enableAnnotations: boolean
		enableMetadata: boolean
		commonAnnotations: Record<string, string | number | boolean>
		commonMetadata: Record<string, unknown>
	}

	/** Middleware coordination configuration */
	middleware: {
		enableRequestLogging: boolean
		enableResponseLogging: boolean
		enableErrorHandling: boolean
		enablePerformanceTracking: boolean
		enableObservabilityIntegration: boolean
		maxBodySize: number
		maxHeaderSize: number
		redactSensitiveHeaders: boolean
		sensitiveHeaders: string[]
	}

	/** Express-Powertools coordination */
	coordination: {
		enabled: boolean
		enableRequestCorrelation: boolean
		enableTraceIdPropagation: boolean
		enableUnifiedLogging: boolean
		enablePinoEnhancement: boolean
		correlationIdHeader: string
		traceIdHeader: string
		syncFields: string[]
		enableDebugLogging: boolean
	}

	/** Feature toggles */
	features: {
		enableAdvancedTracing: boolean
		enableDetailedMetrics: boolean
		enableDebugMode: boolean
		enableProductionOptimizations: boolean
		enableExperimentalFeatures: boolean
	}
}

/**
 * Create observability configuration from environment variables
 */
export const createObservabilityConfig = (
	env?: Partial<TEnv>,
): ObservabilityConfig => {
	// Extract environment variables with defaults
	const nodeEnv = (env?.NODE_ENV ??
		process.env.NODE_ENV ??
		'production') as Environment
	const logLevel = (
		env?.LOG_LEVEL ??
		process.env.LOG_LEVEL ??
		'info'
	).toUpperCase() as LogLevel
	const functionName =
		env?.AWS_LAMBDA_FUNCTION_NAME ??
		process.env.AWS_LAMBDA_FUNCTION_NAME ??
		'macro-ai-lambda'
	const awsRegion = env?.AWS_REGION ?? process.env.AWS_REGION ?? 'us-east-1'
	const architecture = process.env.AWS_LAMBDA_FUNCTION_ARCHITECTURE ?? 'x86_64'
	const runtime = 'nodejs22.x'

	// Service configuration
	const serviceName = 'macro-ai-lambda-api'
	const serviceVersion = 'lambda-api-v1.0.0'

	// Environment-specific settings
	const isProduction = nodeEnv === 'production'
	const isDevelopment = nodeEnv === 'development'
	const isTest = nodeEnv === 'test'

	// X-Ray tracing availability
	const tracingEnabled =
		process.env._X_AMZN_TRACE_ID !== undefined &&
		process.env.POWERTOOLS_TRACE_DISABLED !== 'true'

	return {
		service: {
			name: serviceName,
			version: serviceVersion,
			environment: nodeEnv,
			functionName,
			region: awsRegion,
			architecture,
			runtime,
		},

		logger: {
			enabled: true,
			logLevel,
			sampleRate: isProduction ? 0.1 : 1.0, // Reduce sampling in production
			persistentAttributes: {
				service: serviceName,
				version: serviceVersion,
				environment: nodeEnv,
				functionName,
				region: awsRegion,
				runtime,
			},
			enableCorrelationIds: true,
			enableStructuredLogging: true,
			enableSensitiveDataRedaction: isProduction,
			redactFields: [
				'password',
				'token',
				'apiKey',
				'authorization',
				'cookie',
				'x-api-key',
				'x-auth-token',
			],
		},

		metrics: {
			enabled: true,
			namespace: 'MacroAI/LambdaAPI',
			defaultDimensions: {
				Service: serviceName,
				Environment: nodeEnv,
				FunctionName: functionName,
				Region: awsRegion,
				Version: serviceVersion,
			},
			enableColdStartMetrics: true,
			enablePerformanceMetrics: true,
			enableErrorMetrics: true,
			enableCustomMetrics: !isTest, // Disable custom metrics in tests
			sampleRate: isProduction ? 0.1 : 1.0,
		},

		tracer: {
			enabled: tracingEnabled && !isTest, // Disable tracing in tests
			captureHTTPsRequests: true,
			captureResponse: !isProduction, // Don't capture responses in production
			captureError: true,
			enableAnnotations: true,
			enableMetadata: !isProduction,
			commonAnnotations: {
				service: serviceName,
				version: serviceVersion,
				environment: nodeEnv,
				runtime,
				architecture,
			},
			commonMetadata: {
				functionName,
				region: awsRegion,
				coldStart: false, // Will be updated dynamically
			},
		},

		middleware: {
			enableRequestLogging: true,
			enableResponseLogging: !isProduction, // Reduce logging in production
			enableErrorHandling: true,
			enablePerformanceTracking: true,
			enableObservabilityIntegration: true,
			maxBodySize: isProduction ? 512 : 1024, // Smaller in production
			maxHeaderSize: 256,
			redactSensitiveHeaders: true,
			sensitiveHeaders: [
				'authorization',
				'cookie',
				'x-api-key',
				'x-auth-token',
				'x-access-token',
			],
		},

		coordination: {
			enabled: true,
			enableRequestCorrelation: true,
			enableTraceIdPropagation: tracingEnabled,
			enableUnifiedLogging: true,
			enablePinoEnhancement: true,
			correlationIdHeader: 'x-correlation-id',
			traceIdHeader: 'x-amzn-trace-id',
			syncFields: ['requestId', 'traceId', 'functionName', 'coldStart'],
			enableDebugLogging: isDevelopment,
		},

		features: {
			enableAdvancedTracing: !isProduction && tracingEnabled,
			enableDetailedMetrics: !isProduction,
			enableDebugMode: isDevelopment,
			enableProductionOptimizations: isProduction,
			enableExperimentalFeatures: isDevelopment,
		},
	}
}

/**
 * Default observability configuration instance
 */
export const observabilityConfig = createObservabilityConfig()

/**
 * Environment-specific configuration presets
 */
export const observabilityPresets = {
	development: createObservabilityConfig({
		NODE_ENV: 'development',
		LOG_LEVEL: 'debug',
	}),
	production: createObservabilityConfig({
		NODE_ENV: 'production',
		LOG_LEVEL: 'info',
	}),
	test: createObservabilityConfig({ NODE_ENV: 'test', LOG_LEVEL: 'warn' }),
} as const satisfies Record<string, ObservabilityConfig>

/**
 * Configuration validation helpers
 */
export const validateObservabilityConfig = (
	config: ObservabilityConfig,
): boolean => {
	// Basic validation checks
	if (!config.service.name || !config.service.version) {
		return false
	}

	if (
		!['DEBUG', 'INFO', 'WARN', 'ERROR', 'CRITICAL'].includes(
			config.logger.logLevel,
		)
	) {
		return false
	}

	if (
		!['development', 'production', 'test'].includes(config.service.environment)
	) {
		return false
	}

	return true
}

/**
 * Get configuration summary for logging
 */
export const getConfigSummary = (config: ObservabilityConfig) => ({
	service: config.service.name,
	version: config.service.version,
	environment: config.service.environment,
	logLevel: config.logger.logLevel,
	tracingEnabled: config.tracer.enabled,
	metricsEnabled: config.metrics.enabled,
	coordinationEnabled: config.coordination.enabled,
	features: {
		debugMode: config.features.enableDebugMode,
		productionOptimizations: config.features.enableProductionOptimizations,
		advancedTracing: config.features.enableAdvancedTracing,
	},
})

/**
 * Update configuration at runtime
 */
export const updateObservabilityConfig = (
	updates: Partial<ObservabilityConfig>,
): ObservabilityConfig => {
	return {
		...observabilityConfig,
		...updates,
		service: { ...observabilityConfig.service, ...updates.service },
		logger: { ...observabilityConfig.logger, ...updates.logger },
		metrics: { ...observabilityConfig.metrics, ...updates.metrics },
		tracer: { ...observabilityConfig.tracer, ...updates.tracer },
		middleware: { ...observabilityConfig.middleware, ...updates.middleware },
		coordination: {
			...observabilityConfig.coordination,
			...updates.coordination,
		},
		features: { ...observabilityConfig.features, ...updates.features },
	}
}
