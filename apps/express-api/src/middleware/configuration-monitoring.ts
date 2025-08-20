/**
 * Configuration Loading Monitoring Middleware
 *
 * This module provides comprehensive monitoring and alerting for configuration
 * loading failures to detect similar issues early in future deployments.
 *
 * Features:
 * - CloudWatch metrics for configuration loading success/failure
 * - Detailed error tracking and categorization
 * - Performance monitoring for configuration loading times
 * - Integration with existing monitoring infrastructure
 * - Early warning system for configuration issues
 */

import {
	CloudWatchClient,
	PutMetricDataCommand,
	StandardUnit,
} from '@aws-sdk/client-cloudwatch'

import { pino } from '../utils/logger.js'

const { logger } = pino

// CloudWatch client for metrics publishing
const cloudWatchClient = new CloudWatchClient({
	region: process.env.AWS_REGION ?? 'us-east-1',
})

// Configuration monitoring namespace
const METRICS_NAMESPACE = 'MacroAI/Configuration'

// Configuration error categories for better alerting
export enum ConfigurationErrorCategory {
	SCHEMA_VALIDATION = 'SchemaValidation',
	PARAMETER_STORE = 'ParameterStore',
	ENVIRONMENT_VARIABLES = 'EnvironmentVariables',
	FILE_SYSTEM = 'FileSystem',
	NETWORK = 'Network',
	PERMISSIONS = 'Permissions',
	UNKNOWN = 'Unknown',
}

// Configuration loading stages for detailed monitoring
export enum ConfigurationStage {
	INITIALIZATION = 'Initialization',
	ENV_FILE_LOADING = 'EnvFileLoading',
	SCHEMA_VALIDATION = 'SchemaValidation',
	PARAMETER_STORE_ACCESS = 'ParameterStoreAccess',
	PARAMETER_RETRIEVAL = 'ParameterRetrieval',
	CONFIGURATION_MERGE = 'ConfigurationMerge',
	VALIDATION_COMPLETE = 'ValidationComplete',
}

// Configuration monitoring data structure
interface ConfigurationMetrics {
	success: boolean
	duration: number
	stage: ConfigurationStage
	errorCategory?: ConfigurationErrorCategory
	errorMessage?: string
	appEnv?: string
	parameterStorePrefix?: string
	parametersLoaded?: number
	parametersFailedToLoad?: number
}

/**
 * Publish configuration loading metrics to CloudWatch
 */
export const publishConfigurationMetrics = async (
	metrics: ConfigurationMetrics,
): Promise<void> => {
	try {
		const timestamp = new Date()
		const dimensions = [
			{ Name: 'Environment', Value: metrics.appEnv ?? 'unknown' },
			{ Name: 'Stage', Value: metrics.stage },
			{ Name: 'Application', Value: 'macro-ai-express-api' },
		]

		const metricData = [
			{
				MetricName: 'ConfigurationLoadingSuccess',
				Value: metrics.success ? 1 : 0,
				Unit: StandardUnit.Count,
				Timestamp: timestamp,
				Dimensions: dimensions,
			},
			{
				MetricName: 'ConfigurationLoadingDuration',
				Value: metrics.duration,
				Unit: StandardUnit.Milliseconds,
				Timestamp: timestamp,
				Dimensions: dimensions,
			},
		]

		// Add error-specific metrics if configuration loading failed
		if (!metrics.success && metrics.errorCategory) {
			metricData.push({
				MetricName: 'ConfigurationLoadingErrors',
				Value: 1,
				Unit: StandardUnit.Count,
				Timestamp: timestamp,
				Dimensions: [
					...dimensions,
					{ Name: 'ErrorCategory', Value: metrics.errorCategory },
				],
			})
		}

		// Add parameter-specific metrics if available
		if (metrics.parametersLoaded !== undefined) {
			metricData.push({
				MetricName: 'ParametersLoaded',
				Value: metrics.parametersLoaded,
				Unit: StandardUnit.Count,
				Timestamp: timestamp,
				Dimensions: dimensions,
			})
		}

		if (
			metrics.parametersFailedToLoad !== undefined &&
			metrics.parametersFailedToLoad > 0
		) {
			metricData.push({
				MetricName: 'ParametersFailedToLoad',
				Value: metrics.parametersFailedToLoad,
				Unit: StandardUnit.Count,
				Timestamp: timestamp,
				Dimensions: dimensions,
			})
		}

		// Publish metrics to CloudWatch
		const command = new PutMetricDataCommand({
			Namespace: METRICS_NAMESPACE,
			MetricData: metricData,
		})

		await cloudWatchClient.send(command)

		logger.debug(
			{
				operation: 'publishConfigurationMetrics',
				success: metrics.success,
				stage: metrics.stage,
				duration: metrics.duration,
				errorCategory: metrics.errorCategory,
				parametersLoaded: metrics.parametersLoaded,
				parametersFailedToLoad: metrics.parametersFailedToLoad,
			},
			'Configuration metrics published to CloudWatch',
		)
	} catch (error) {
		logger.error(
			{
				operation: 'publishConfigurationMetrics',
				error: error instanceof Error ? error.message : 'Unknown error',
				metrics,
			},
			'Failed to publish configuration metrics to CloudWatch',
		)
	}
}

/**
 * Categorize configuration errors for better alerting
 */
export const categorizeConfigurationError = (
	error: Error,
): ConfigurationErrorCategory => {
	const errorMessage = error.message.toLowerCase()
	const errorStack = error.stack?.toLowerCase() ?? ''

	// Schema validation errors
	if (
		errorMessage.includes('validation') ||
		errorMessage.includes('schema') ||
		errorMessage.includes('zod') ||
		errorMessage.includes('invalid') ||
		errorMessage.includes('required')
	) {
		return ConfigurationErrorCategory.SCHEMA_VALIDATION
	}

	// Parameter Store errors
	if (
		errorMessage.includes('parameter store') ||
		errorMessage.includes('ssm') ||
		errorMessage.includes('parameter') ||
		errorMessage.includes('parameternotfound') ||
		errorStack.includes('aws-sdk')
	) {
		return ConfigurationErrorCategory.PARAMETER_STORE
	}

	// Environment variable errors
	if (
		errorMessage.includes('environment') ||
		errorMessage.includes('env') ||
		errorMessage.includes('process.env')
	) {
		return ConfigurationErrorCategory.ENVIRONMENT_VARIABLES
	}

	// File system errors
	if (
		errorMessage.includes('file') ||
		errorMessage.includes('enoent') ||
		errorMessage.includes('eacces') ||
		errorMessage.includes('path')
	) {
		return ConfigurationErrorCategory.FILE_SYSTEM
	}

	// Network errors
	if (
		errorMessage.includes('network') ||
		errorMessage.includes('timeout') ||
		errorMessage.includes('connection') ||
		errorMessage.includes('econnrefused') ||
		errorMessage.includes('enotfound')
	) {
		return ConfigurationErrorCategory.NETWORK
	}

	// Permission errors
	if (
		errorMessage.includes('permission') ||
		errorMessage.includes('access denied') ||
		errorMessage.includes('unauthorized') ||
		errorMessage.includes('forbidden')
	) {
		return ConfigurationErrorCategory.PERMISSIONS
	}

	return ConfigurationErrorCategory.UNKNOWN
}

/**
 * Configuration loading monitor wrapper
 * Use this to wrap configuration loading operations for automatic monitoring
 */
export const monitorConfigurationLoading = async <T>(
	stage: ConfigurationStage,
	operation: () => Promise<T>,
	context?: {
		appEnv?: string
		parameterStorePrefix?: string
	},
): Promise<T> => {
	const startTime = Date.now()

	try {
		logger.info(
			{
				operation: 'configurationLoadingStart',
				stage,
				appEnv: context?.appEnv,
				parameterStorePrefix: context?.parameterStorePrefix,
			},
			`Starting configuration loading stage: ${stage}`,
		)

		const result = await operation()
		const duration = Date.now() - startTime

		// Publish success metrics
		await publishConfigurationMetrics({
			success: true,
			duration,
			stage,
			appEnv: context?.appEnv,
			parameterStorePrefix: context?.parameterStorePrefix,
		})

		logger.info(
			{
				operation: 'configurationLoadingSuccess',
				stage,
				duration,
				appEnv: context?.appEnv,
			},
			`Configuration loading stage completed successfully: ${stage}`,
		)

		return result
	} catch (error) {
		const duration = Date.now() - startTime
		const configError =
			error instanceof Error ? error : new Error('Unknown configuration error')
		const errorCategory = categorizeConfigurationError(configError)

		// Publish failure metrics
		await publishConfigurationMetrics({
			success: false,
			duration,
			stage,
			errorCategory,
			errorMessage: configError.message,
			appEnv: context?.appEnv,
			parameterStorePrefix: context?.parameterStorePrefix,
		})

		logger.error(
			{
				operation: 'configurationLoadingFailure',
				stage,
				duration,
				errorCategory,
				error: configError.message,
				appEnv: context?.appEnv,
				parameterStorePrefix: context?.parameterStorePrefix,
			},
			`Configuration loading stage failed: ${stage}`,
		)

		throw error
	}
}

/**
 * Publish parameter loading statistics
 */
export const publishParameterLoadingStats = async (
	loaded: number,
	failed: number,
	appEnv?: string,
): Promise<void> => {
	await publishConfigurationMetrics({
		success: failed === 0,
		duration: 0, // Duration not applicable for stats
		stage: ConfigurationStage.PARAMETER_RETRIEVAL,
		parametersLoaded: loaded,
		parametersFailedToLoad: failed,
		appEnv,
	})

	logger.info(
		{
			operation: 'parameterLoadingStats',
			parametersLoaded: loaded,
			parametersFailedToLoad: failed,
			appEnv,
		},
		'Parameter loading statistics published',
	)
}

/**
 * Create configuration health check metric
 * Call this from health check endpoints to monitor configuration health
 */
export const publishConfigurationHealthMetric = async (
	isHealthy: boolean,
	configurationAge: number,
	appEnv?: string,
): Promise<void> => {
	await publishConfigurationMetrics({
		success: isHealthy,
		duration: configurationAge,
		stage: ConfigurationStage.VALIDATION_COMPLETE,
		appEnv,
	})

	logger.debug(
		{
			operation: 'configurationHealthCheck',
			isHealthy,
			configurationAge,
			appEnv,
		},
		'Configuration health metric published',
	)
}
