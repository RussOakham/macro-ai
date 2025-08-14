import {
	CloudWatchClient,
	PutMetricDataCommand,
} from '@aws-sdk/client-cloudwatch'
import type { NextFunction, Request, Response } from 'express'

import { logger } from '../utils/logger.ts'

/**
 * CloudWatch client for metrics publishing
 */
const cloudWatchClient = new CloudWatchClient({
	region: process.env.AWS_REGION || 'us-east-1',
})

/**
 * Configuration for monitoring metrics middleware
 */
interface MonitoringMetricsConfig {
	/**
	 * Custom metric namespace (defaults to MacroAI/API)
	 */
	namespace?: string

	/**
	 * Environment name for metric dimensions
	 */
	environment?: string

	/**
	 * Application name for metric dimensions
	 */
	applicationName?: string

	/**
	 * Enable detailed request logging
	 */
	enableDetailedLogging?: boolean

	/**
	 * Sample rate for metrics (0.0 to 1.0, defaults to 1.0)
	 */
	sampleRate?: number
}

/**
 * Default configuration
 */
const defaultConfig: Required<MonitoringMetricsConfig> = {
	namespace: 'MacroAI/API',
	environment: process.env.NODE_ENV || 'development',
	applicationName: 'macro-ai-api',
	enableDetailedLogging: process.env.NODE_ENV === 'development',
	sampleRate: 1.0,
}

/**
 * Publish custom metric to CloudWatch
 */
export const publishMetric = async (
	metricName: string,
	value: number,
	unit: string = 'Count',
	dimensions: Record<string, string> = {},
	namespace?: string,
): Promise<void> => {
	try {
		const config = {
			...defaultConfig,
			namespace: namespace || defaultConfig.namespace,
		}

		// Add default dimensions
		const metricDimensions = {
			Environment: config.environment,
			Application: config.applicationName,
			...dimensions,
		}

		const command = new PutMetricDataCommand({
			Namespace: config.namespace,
			MetricData: [
				{
					MetricName: metricName,
					Value: value,
					Unit: unit,
					Timestamp: new Date(),
					Dimensions: Object.entries(metricDimensions).map(([Name, Value]) => ({
						Name,
						Value,
					})),
				},
			],
		})

		await cloudWatchClient.send(command)

		if (defaultConfig.enableDetailedLogging) {
			logger.debug({
				msg: '[monitoring-metrics]: Metric published',
				metricName,
				value,
				unit,
				dimensions: metricDimensions,
				namespace: config.namespace,
			})
		}
	} catch (error) {
		logger.error({
			msg: '[monitoring-metrics]: Failed to publish metric',
			metricName,
			value,
			unit,
			error: error instanceof Error ? error.message : 'Unknown error',
		})
	}
}

/**
 * Publish multiple metrics in a single batch
 */
export const publishMetricsBatch = async (
	metrics: Array<{
		name: string
		value: number
		unit?: string
		dimensions?: Record<string, string>
	}>,
	namespace?: string,
): Promise<void> => {
	try {
		const config = {
			...defaultConfig,
			namespace: namespace || defaultConfig.namespace,
		}

		const metricData = metrics.map((metric) => ({
			MetricName: metric.name,
			Value: metric.value,
			Unit: metric.unit || 'Count',
			Timestamp: new Date(),
			Dimensions: Object.entries({
				Environment: config.environment,
				Application: config.applicationName,
				...metric.dimensions,
			}).map(([Name, Value]) => ({
				Name,
				Value,
			})),
		}))

		const command = new PutMetricDataCommand({
			Namespace: config.namespace,
			MetricData: metricData,
		})

		await cloudWatchClient.send(command)

		if (defaultConfig.enableDetailedLogging) {
			logger.debug({
				msg: '[monitoring-metrics]: Batch metrics published',
				metricsCount: metrics.length,
				namespace: config.namespace,
			})
		}
	} catch (error) {
		logger.error({
			msg: '[monitoring-metrics]: Failed to publish batch metrics',
			metricsCount: metrics.length,
			error: error instanceof Error ? error.message : 'Unknown error',
		})
	}
}

/**
 * Express middleware for automatic API monitoring metrics
 *
 * This middleware automatically tracks:
 * - Request count
 * - Response time
 * - Error rates
 * - HTTP status code distribution
 * - Endpoint-specific metrics
 */
export const monitoringMetricsMiddleware = (
	config: MonitoringMetricsConfig = {},
) => {
	const mergedConfig = { ...defaultConfig, ...config }

	return (req: Request, res: Response, next: NextFunction): void => {
		const startTime = Date.now()

		// Skip metrics collection based on sample rate
		const shouldSample = Math.random() < mergedConfig.sampleRate

		// Track request start
		if (shouldSample) {
			publishMetric(
				'RequestCount',
				1,
				'Count',
				{
					Method: req.method,
					Route: req.route?.path || req.path,
				},
				mergedConfig.namespace,
			).catch(() => {
				// Silently handle metric publishing errors
			})
		}

		// Override res.end to capture response metrics
		const originalEnd = res.end
		res.end = function (chunk?: any, encoding?: any, cb?: any) {
			const duration = Date.now() - startTime
			const statusCode = res.statusCode

			if (shouldSample) {
				// Publish metrics batch for better performance
				const metrics = [
					{
						name: 'RequestDuration',
						value: duration,
						unit: 'Milliseconds',
						dimensions: {
							Method: req.method,
							Route: req.route?.path || req.path,
							StatusCode: statusCode.toString(),
						},
					},
				]

				// Add error metric if status code indicates error
				if (statusCode >= 400) {
					metrics.push({
						name: 'ErrorCount',
						value: 1,
						unit: 'Count',
						dimensions: {
							Method: req.method,
							Route: req.route?.path || req.path,
							StatusCode: statusCode.toString(),
							ErrorType: statusCode >= 500 ? 'ServerError' : 'ClientError',
						},
					})
				}

				// Add success metric for successful requests
				if (statusCode >= 200 && statusCode < 300) {
					metrics.push({
						name: 'SuccessCount',
						value: 1,
						unit: 'Count',
						dimensions: {
							Method: req.method,
							Route: req.route?.path || req.path,
							StatusCode: statusCode.toString(),
						},
					})
				}

				// Publish metrics batch
				publishMetricsBatch(metrics, mergedConfig.namespace).catch(() => {
					// Silently handle metric publishing errors
				})

				// Log detailed request information if enabled
				if (mergedConfig.enableDetailedLogging) {
					logger.info({
						msg: '[monitoring-metrics]: Request completed',
						method: req.method,
						path: req.path,
						statusCode,
						duration,
						userAgent: req.get('User-Agent'),
						ip: req.ip,
					})
				}
			}

			// Call original end method
			return originalEnd.call(this, chunk, encoding, cb)
		}

		next()
	}
}

/**
 * Health check metrics publisher
 * Call this from health check endpoints to track application health
 */
export const publishHealthCheckMetric = async (
	isHealthy: boolean,
	responseTime: number,
	checkDetails?: Record<string, any>,
): Promise<void> => {
	const metrics = [
		{
			name: 'HealthCheckSuccess',
			value: isHealthy ? 1 : 0,
			unit: 'Count',
		},
		{
			name: 'HealthCheckResponseTime',
			value: responseTime,
			unit: 'Milliseconds',
		},
	]

	// Add specific health check metrics if provided
	if (checkDetails) {
		Object.entries(checkDetails).forEach(([key, value]) => {
			if (typeof value === 'number') {
				metrics.push({
					name: `HealthCheck${key}`,
					value,
					unit: 'Count',
				})
			}
		})
	}

	await publishMetricsBatch(metrics)
}

/**
 * Database operation metrics publisher
 */
export const publishDatabaseMetric = async (
	operation: string,
	duration: number,
	success: boolean,
	recordCount?: number,
): Promise<void> => {
	const metrics = [
		{
			name: 'DatabaseQueryDuration',
			value: duration,
			unit: 'Milliseconds',
			dimensions: {
				Operation: operation,
				Success: success.toString(),
			},
		},
		{
			name: 'DatabaseQueryCount',
			value: 1,
			unit: 'Count',
			dimensions: {
				Operation: operation,
				Success: success.toString(),
			},
		},
	]

	if (!success) {
		metrics.push({
			name: 'DatabaseErrorCount',
			value: 1,
			unit: 'Count',
			dimensions: {
				Operation: operation,
			},
		})
	}

	if (recordCount !== undefined) {
		metrics.push({
			name: 'DatabaseRecordCount',
			value: recordCount,
			unit: 'Count',
			dimensions: {
				Operation: operation,
			},
		})
	}

	await publishMetricsBatch(metrics)
}

/**
 * Application uptime metric publisher
 * Call this periodically to track application uptime
 */
export const publishUptimeMetric = async (): Promise<void> => {
	const uptimeSeconds = process.uptime()

	await publishMetric('ApplicationUptime', uptimeSeconds, 'Seconds')
}
