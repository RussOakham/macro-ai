/**
 * AWS Lambda Powertools Tracer Configuration
 * Provides centralized X-Ray tracing configuration with environment-based settings
 */

import { Tracer } from '@aws-lambda-powertools/tracer'

/**
 * Environment variables for tracer configuration
 */
const ENVIRONMENT = process.env.NODE_ENV ?? 'development'
const SERVICE_NAME =
	process.env.POWERTOOLS_SERVICE_NAME ?? 'macro-ai-lambda-api'
const SERVICE_VERSION = process.env.SERVICE_VERSION ?? 'lambda-api-v1.0.0'
const TRACING_ENABLED =
	process.env._X_AMZN_TRACE_ID !== undefined ||
	process.env.POWERTOOLS_TRACE_DISABLED !== 'true'

/**
 * Tracer configuration options
 */
const tracerConfig = {
	serviceName: SERVICE_NAME,
	serviceVersion: SERVICE_VERSION,
	enabled: TRACING_ENABLED,
	captureHTTPsRequests: true,
	captureResponse: ENVIRONMENT !== 'production', // Capture responses in non-production environments
	captureError: true,
}

/**
 * Centralized Powertools Tracer instance
 * Configured with service metadata and environment-specific settings
 */
export const tracer = new Tracer(tracerConfig)

/**
 * Tracer configuration for testing and debugging
 */
export const tracerSettings = {
	serviceName: SERVICE_NAME,
	serviceVersion: SERVICE_VERSION,
	environment: ENVIRONMENT,
	enabled: TRACING_ENABLED,
	captureHTTPsRequests: tracerConfig.captureHTTPsRequests,
	captureResponse: tracerConfig.captureResponse,
	captureError: tracerConfig.captureError,
} as const

/**
 * Common trace annotations for consistent metadata
 */
export const commonAnnotations = {
	service: SERVICE_NAME,
	version: SERVICE_VERSION,
	environment: ENVIRONMENT,
	runtime: 'nodejs22.x',
	architecture: process.env.AWS_LAMBDA_FUNCTION_ARCHITECTURE ?? 'x86_64',
} as const

/**
 * Common trace metadata for operational context
 */
export const commonMetadata = {
	framework: 'express',
	powertools: {
		logger: true,
		metrics: true,
		tracer: true,
	},
	features: {
		parameterStore: true,
		goStyleErrorHandling: true,
		structuredLogging: true,
		customMetrics: true,
	},
} as const

/**
 * Subsegment names for consistent tracing
 */
export const subsegmentNames = {
	// Lambda lifecycle
	COLD_START: 'lambda-cold-start',
	WARM_START: 'lambda-warm-start',
	LAMBDA_HANDLER: 'lambda-handler',

	// Express app
	EXPRESS_INIT: 'express-app-initialization',
	EXPRESS_MIDDLEWARE: 'express-middleware-setup',
	EXPRESS_ROUTES: 'express-routes-registration',

	// Parameter Store
	PARAMETER_STORE_GET: 'parameter-store-get',
	PARAMETER_STORE_GET_MULTIPLE: 'parameter-store-get-multiple',
	PARAMETER_STORE_INIT: 'parameter-store-initialization',
	PARAMETER_STORE_HEALTH: 'parameter-store-health-check',

	// Database operations
	DATABASE_CONNECT: 'database-connection',
	DATABASE_QUERY: 'database-query',
	DATABASE_TRANSACTION: 'database-transaction',
	DATABASE_HEALTH: 'database-health-check',

	// External API calls
	HTTP_REQUEST: 'http-request',
	API_CALL: 'external-api-call',
	WEBHOOK: 'webhook-call',

	// Configuration and setup
	CONFIG_LOAD: 'configuration-loading',
	VALIDATION: 'data-validation',
	AUTHENTICATION: 'authentication',
	AUTHORIZATION: 'authorization',
} as const

/**
 * Trace error types for consistent error categorization
 */
export const traceErrorTypes = {
	// Application errors
	VALIDATION_ERROR: 'ValidationError',
	AUTHENTICATION_ERROR: 'AuthenticationError',
	AUTHORIZATION_ERROR: 'AuthorizationError',
	BUSINESS_LOGIC_ERROR: 'BusinessLogicError',

	// Infrastructure errors
	PARAMETER_STORE_ERROR: 'ParameterStoreError',
	DATABASE_ERROR: 'DatabaseError',
	NETWORK_ERROR: 'NetworkError',
	TIMEOUT_ERROR: 'TimeoutError',

	// System errors
	CONFIGURATION_ERROR: 'ConfigurationError',
	DEPENDENCY_ERROR: 'DependencyError',
	RESOURCE_ERROR: 'ResourceError',
	UNKNOWN_ERROR: 'UnknownError',
} as const

/**
 * Helper function to add common annotations to the current trace
 */
export const addCommonAnnotations = (): void => {
	if (!TRACING_ENABLED) return

	try {
		tracer.putAnnotation('service', commonAnnotations.service)
		tracer.putAnnotation('version', commonAnnotations.version)
		tracer.putAnnotation('environment', commonAnnotations.environment)
		tracer.putAnnotation('runtime', commonAnnotations.runtime)
		tracer.putAnnotation('architecture', commonAnnotations.architecture)
	} catch (error) {
		// Silently handle annotation errors to prevent disrupting application flow
		console.warn('Failed to add common annotations:', error)
	}
}

/**
 * Helper function to add common metadata to the current trace
 */
export const addCommonMetadata = (): void => {
	if (!TRACING_ENABLED) return

	try {
		tracer.putMetadata('application', commonMetadata)
	} catch (error) {
		// Silently handle metadata errors to prevent disrupting application flow
		console.warn('Failed to add common metadata:', error)
	}
}

/**
 * Helper function to create a subsegment with common setup
 *
 * @param name - Subsegment name (use subsegmentNames constants)
 * @param operation - Function to execute within the subsegment
 * @param annotations - Additional annotations for this subsegment
 * @param metadata - Additional metadata for this subsegment
 * @returns Promise resolving to the operation result
 */
export const withSubsegment = async <T>(
	name: string,
	operation: () => Promise<T>,
	annotations?: Record<string, string | number | boolean>,
	metadata?: Record<string, unknown>,
): Promise<T> => {
	if (!TRACING_ENABLED) {
		return operation()
	}

	const subsegment = tracer.getSegment()?.addNewSubsegment(name)

	try {
		// Add common annotations
		if (subsegment) {
			subsegment.addAnnotation('service', commonAnnotations.service)
			subsegment.addAnnotation('environment', commonAnnotations.environment)

			// Add custom annotations
			if (annotations) {
				Object.entries(annotations).forEach(([key, value]) => {
					subsegment.addAnnotation(key, value)
				})
			}

			// Add custom metadata
			if (metadata) {
				subsegment.addMetadata('operation', metadata)
			}
		}

		const result = await operation()

		if (subsegment) {
			subsegment.close()
		}

		return result
	} catch (error) {
		if (subsegment) {
			subsegment.addError(error as Error)
			subsegment.close(error as Error)
		}
		throw error
	}
}

/**
 * Helper function to create a synchronous subsegment with common setup
 *
 * @param name - Subsegment name (use subsegmentNames constants)
 * @param operation - Function to execute within the subsegment
 * @param annotations - Additional annotations for this subsegment
 * @param metadata - Additional metadata for this subsegment
 * @returns The operation result
 */
export const withSubsegmentSync = <T>(
	name: string,
	operation: () => T,
	annotations?: Record<string, string | number | boolean>,
	metadata?: Record<string, unknown>,
): T => {
	if (!TRACING_ENABLED) {
		return operation()
	}

	const subsegment = tracer.getSegment()?.addNewSubsegment(name)

	try {
		// Add common annotations
		if (subsegment) {
			subsegment.addAnnotation('service', commonAnnotations.service)
			subsegment.addAnnotation('environment', commonAnnotations.environment)

			// Add custom annotations
			if (annotations) {
				Object.entries(annotations).forEach(([key, value]) => {
					subsegment.addAnnotation(key, value)
				})
			}

			// Add custom metadata
			if (metadata) {
				subsegment.addMetadata('operation', metadata)
			}
		}

		const result = operation()

		if (subsegment) {
			subsegment.close()
		}

		return result
	} catch (error) {
		if (subsegment) {
			subsegment.addError(error as Error)
			subsegment.close(error as Error)
		}
		throw error
	}
}

/**
 * Helper function to capture errors in the current trace
 *
 * @param error - Error to capture
 * @param errorType - Error type for categorization (use traceErrorTypes constants)
 * @param metadata - Additional error context
 */
export const captureError = (
	error: Error,
	errorType?: string,
	metadata?: Record<string, unknown>,
): void => {
	if (!TRACING_ENABLED) return

	try {
		tracer.addErrorAsMetadata(error)

		if (errorType) {
			tracer.putAnnotation('errorType', errorType)
		}

		if (metadata) {
			tracer.putMetadata('errorContext', metadata)
		}
	} catch (captureError) {
		// Silently handle capture errors to prevent disrupting application flow
		console.warn('Failed to capture error in trace:', captureError)
	}
}
