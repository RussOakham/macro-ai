/**
 * AWS Lambda Powertools Metrics Configuration
 * Provides CloudWatch custom metrics with proper dimensions and namespacing
 */

import { Metrics, MetricUnit } from '@aws-lambda-powertools/metrics'
import { MetricUnit as MetricUnitType } from '@aws-lambda-powertools/metrics/types'

import type { TEnv } from './env.schema.js'

/**
 * Metrics configuration interface
 */
interface MetricsConfig {
	namespace: string
	serviceName: string
	environment: string
	defaultDimensions: Record<string, string>
}

/**
 * Common metric names used throughout the Lambda API
 */
export enum MetricName {
	// Lambda execution metrics
	ColdStart = 'ColdStart',
	ExecutionTime = 'ExecutionTime',
	MemoryUsage = 'MemoryUsage',

	// Parameter Store metrics
	ParameterStoreCacheHit = 'ParameterStoreCacheHit',
	ParameterStoreCacheMiss = 'ParameterStoreCacheMiss',
	ParameterStoreRetrievalTime = 'ParameterStoreRetrievalTime',
	ParameterStoreError = 'ParameterStoreError',

	// Express app metrics
	ExpressAppInitTime = 'ExpressAppInitTime',
	ExpressAppInitError = 'ExpressAppInitError',

	// Request processing metrics
	RequestCount = 'RequestCount',
	RequestDuration = 'RequestDuration',
	RequestError = 'RequestError',

	// Configuration metrics
	ConfigurationLoadTime = 'ConfigurationLoadTime',
	ConfigurationError = 'ConfigurationError',
}

/**
 * Re-export MetricUnit for convenience
 */
export { MetricUnit }

/**
 * Create metrics configuration from environment variables
 */
const createMetricsConfig = (env?: Partial<TEnv>): MetricsConfig => {
	const nodeEnv = env?.NODE_ENV ?? process.env.NODE_ENV ?? 'production'
	const functionName =
		env?.AWS_LAMBDA_FUNCTION_NAME ??
		process.env.AWS_LAMBDA_FUNCTION_NAME ??
		'macro-ai-lambda'
	const awsRegion = env?.AWS_REGION ?? process.env.AWS_REGION ?? 'us-east-1'

	return {
		namespace: 'MacroAI/Lambda',
		serviceName: 'lambda-api',
		environment: nodeEnv,
		defaultDimensions: {
			Environment: nodeEnv,
			Service: 'lambda-api',
			FunctionName: functionName,
			Region: awsRegion,
		},
	}
}

/**
 * Create and configure Powertools Metrics instance
 */
const createPowertoolsMetrics = (config?: Partial<MetricsConfig>): Metrics => {
	const metricsConfig = createMetricsConfig()

	// Merge with provided config overrides
	const finalConfig = {
		...metricsConfig,
		...config,
		defaultDimensions: {
			...metricsConfig.defaultDimensions,
			...(config?.defaultDimensions ?? {}),
		},
	}

	return new Metrics({
		namespace: finalConfig.namespace,
		serviceName: finalConfig.serviceName,
		defaultDimensions: finalConfig.defaultDimensions,
	})
}

/**
 * Default metrics instance for the Lambda API
 * Configured with service metadata and environment-based dimensions
 */
export const metrics = createPowertoolsMetrics()

/**
 * Get trace context for metrics correlation
 */
const getTraceContext = (): Record<string, string> => {
	const traceId = process.env._X_AMZN_TRACE_ID
	if (traceId) {
		// Extract trace ID from X-Amzn-Trace-Id header format
		// Format: Root=1-5e1b4151-5ac6c58f5b5dbd6b5b5dbd6b;Parent=5ac6c58f5b5dbd6b;Sampled=1
		const traceIdRegex = /Root=([^;]+)/
		const traceIdMatch = traceIdRegex.exec(traceId)
		if (traceIdMatch?.[1]) {
			return {
				TraceId: traceIdMatch[1],
			}
		}
	}
	return {}
}

/**
 * Utility function to add a metric with common error handling and trace correlation
 */
export const addMetric = (
	name: MetricName | string,
	unit: MetricUnitType,
	value: number,
	additionalDimensions?: Record<string, string>,
): void => {
	try {
		// Combine additional dimensions with trace context
		const allDimensions = {
			...getTraceContext(),
			...additionalDimensions,
		}

		if (Object.keys(allDimensions).length > 0) {
			// Create a temporary metrics instance with additional dimensions
			const tempMetrics = metrics.singleMetric()
			Object.entries(allDimensions).forEach(([key, val]) => {
				tempMetrics.addDimension(key, val)
			})

			tempMetrics.addMetric(name, unit, value)
		} else {
			metrics.addMetric(name, unit, value)
		}
	} catch (error) {
		// Log error but don't throw to avoid breaking the main flow
		console.error('Failed to add metric:', {
			name,
			unit,
			value,
			error: error instanceof Error ? error.message : 'Unknown error',
		})
	}
}

/**
 * Utility function to measure and record execution time
 */
export const measureAndRecordExecutionTime = async <T>(
	operation: () => Promise<T>,
	metricName: MetricName | string,
	additionalDimensions?: Record<string, string>,
): Promise<T> => {
	const startTime = Date.now()

	try {
		const result = await operation()
		const duration = Date.now() - startTime

		addMetric(metricName, MetricUnit.Milliseconds, duration, {
			...additionalDimensions,
			Status: 'Success',
		})

		return result
	} catch (error) {
		const duration = Date.now() - startTime

		addMetric(metricName, MetricUnit.Milliseconds, duration, {
			...additionalDimensions,
			Status: 'Error',
		})

		throw error
	}
}

/**
 * Utility function to record cold start metrics
 */
export const recordColdStart = (isColdStart: boolean): void => {
	addMetric(MetricName.ColdStart, MetricUnit.Count, isColdStart ? 1 : 0)
}

/**
 * Utility function to record memory usage
 */
export const recordMemoryUsage = (): void => {
	const memoryUsage = process.memoryUsage()

	addMetric('MemoryUsed', MetricUnit.Bytes, memoryUsage.heapUsed)
	addMetric('MemoryHeapUsed', MetricUnit.Bytes, memoryUsage.heapUsed)
	addMetric('MemoryHeapTotal', MetricUnit.Bytes, memoryUsage.heapTotal)
	addMetric('MemoryRSS', MetricUnit.Bytes, memoryUsage.rss)
}

/**
 * Utility function to record Parameter Store cache metrics
 */
export const recordParameterStoreMetrics = (
	operation: 'hit' | 'miss' | 'error',
	parameterName?: string,
	duration?: number,
): void => {
	const dimensions = parameterName
		? { ParameterName: parameterName }
		: undefined

	switch (operation) {
		case 'hit':
			addMetric(
				MetricName.ParameterStoreCacheHit,
				MetricUnit.Count,
				1,
				dimensions,
			)
			break
		case 'miss':
			addMetric(
				MetricName.ParameterStoreCacheMiss,
				MetricUnit.Count,
				1,
				dimensions,
			)
			if (duration !== undefined) {
				addMetric(
					MetricName.ParameterStoreRetrievalTime,
					MetricUnit.Milliseconds,
					duration,
					dimensions,
				)
			}
			break
		case 'error':
			addMetric(MetricName.ParameterStoreError, MetricUnit.Count, 1, dimensions)
			break
	}
}

/**
 * Export configuration functions for testing and customization
 */
export { createMetricsConfig, createPowertoolsMetrics }
