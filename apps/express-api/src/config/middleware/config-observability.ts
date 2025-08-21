/**
 * Configuration Observability Middleware
 * Provides comprehensive logging and monitoring for configuration loading processes
 */

import { pino } from '../../utils/logger.ts'
import type { AppConfig } from '../core/config-types.ts'
import { ConfigEnvironment, ConfigSource } from '../core/config-types.ts'

const { logger } = pino

/**
 * Configuration loading stages for detailed tracking
 */
export enum ConfigLoadingStage {
	ENVIRONMENT_DETECTION = 'environment-detection',
	LOADER_CREATION = 'loader-creation',
	SOURCE_LOADING = 'source-loading',
	SCHEMA_VALIDATION = 'schema-validation',
	CONFIG_MAPPING = 'config-mapping',
	COMPLETION = 'completion',
}

/**
 * Configuration loading metrics
 */
export interface ConfigLoadingMetrics {
	environment: ConfigEnvironment
	stage: ConfigLoadingStage
	startTime: Date
	endTime?: Date
	duration?: number
	success: boolean
	error?: string
	metadata?: Record<string, unknown>
}

/**
 * Configuration source statistics
 */
export interface ConfigSourceStats {
	total: number
	bySource: Record<ConfigSource, number>
	optionalFields: Record<string, boolean>
	requiredFields: string[]
	missingFields: string[]
}

/**
 * Configuration observability tracker
 */
export class ConfigObservabilityTracker {
	private metrics: ConfigLoadingMetrics[] = []
	private currentStage?: ConfigLoadingMetrics

	/**
	 * Start tracking a configuration loading stage
	 */
	startStage(
		environment: ConfigEnvironment,
		stage: ConfigLoadingStage,
		metadata?: Record<string, unknown>,
	): void {
		const startTime = new Date()

		this.currentStage = {
			environment,
			stage,
			startTime,
			success: false,
			metadata,
		}

		logger.debug(
			{
				operation: 'configStageStart',
				environment,
				stage,
				startTime: startTime.toISOString(),
				metadata,
			},
			`Starting configuration loading stage: ${stage}`,
		)
	}

	/**
	 * Complete the current stage successfully
	 */
	completeStage(metadata?: Record<string, unknown>): void {
		if (!this.currentStage) {
			logger.warn('Attempted to complete stage without starting one')
			return
		}

		const endTime = new Date()
		const duration = endTime.getTime() - this.currentStage.startTime.getTime()

		this.currentStage.endTime = endTime
		this.currentStage.duration = duration
		this.currentStage.success = true
		this.currentStage.metadata = { ...this.currentStage.metadata, ...metadata }

		logger.debug(
			{
				operation: 'configStageComplete',
				environment: this.currentStage.environment,
				stage: this.currentStage.stage,
				duration,
				metadata: this.currentStage.metadata,
			},
			`Completed configuration loading stage: ${this.currentStage.stage}`,
		)

		this.metrics.push({ ...this.currentStage })
		this.currentStage = undefined
	}

	/**
	 * Fail the current stage with an error
	 */
	failStage(error: string, metadata?: Record<string, unknown>): void {
		if (!this.currentStage) {
			logger.warn('Attempted to fail stage without starting one')
			return
		}

		const endTime = new Date()
		const duration = endTime.getTime() - this.currentStage.startTime.getTime()

		this.currentStage.endTime = endTime
		this.currentStage.duration = duration
		this.currentStage.success = false
		this.currentStage.error = error
		this.currentStage.metadata = { ...this.currentStage.metadata, ...metadata }

		logger.error(
			{
				operation: 'configStageFailed',
				environment: this.currentStage.environment,
				stage: this.currentStage.stage,
				duration,
				error,
				metadata: this.currentStage.metadata,
			},
			`Failed configuration loading stage: ${this.currentStage.stage}`,
		)

		this.metrics.push({ ...this.currentStage })
		this.currentStage = undefined
	}

	/**
	 * Get all collected metrics
	 */
	getMetrics(): ConfigLoadingMetrics[] {
		return [...this.metrics]
	}

	/**
	 * Get summary of configuration loading performance
	 */
	getSummary(): {
		totalDuration: number
		stageCount: number
		successfulStages: number
		failedStages: number
		environment: ConfigEnvironment
		stages: Record<ConfigLoadingStage, { duration: number; success: boolean }>
	} {
		const totalDuration = this.metrics.reduce(
			(sum, metric) => sum + (metric.duration ?? 0),
			0,
		)
		const successfulStages = this.metrics.filter((m) => m.success).length
		const failedStages = this.metrics.filter((m) => !m.success).length
		const environment =
			this.metrics[0]?.environment ?? ('localhost' as ConfigEnvironment)

		const stages = this.metrics.reduce(
			(acc, metric) => {
				acc[metric.stage] = {
					duration: metric.duration ?? 0,
					success: metric.success,
				}
				return acc
			},
			{} as Record<ConfigLoadingStage, { duration: number; success: boolean }>,
		)

		return {
			totalDuration,
			stageCount: this.metrics.length,
			successfulStages,
			failedStages,
			environment,
			stages,
		}
	}

	/**
	 * Reset all metrics
	 */
	reset(): void {
		this.metrics = []
		this.currentStage = undefined
	}
}

/**
 * Analyze configuration sources and provide statistics
 */
export const analyzeConfigSources = (
	config: AppConfig,
	sources?: Record<string, ConfigSource>,
): ConfigSourceStats => {
	const configKeys = Object.keys(config) as (keyof AppConfig)[]
	const sourceStats: Record<ConfigSource, number> = {
		[ConfigSource.ENVIRONMENT]: 0,
		[ConfigSource.PARAMETER_STORE]: 0,
		[ConfigSource.ENV_FILE]: 0,
		[ConfigSource.BUILD_DEFAULT]: 0,
	}

	// Count sources
	if (sources) {
		Object.values(sources).forEach((source) => {
			sourceStats[source]++
		})
	} else {
		// If no source info, assume all from environment
		sourceStats[ConfigSource.ENVIRONMENT] = configKeys.length
	}

	// Identify optional fields
	const optionalFields = {
		redisUrl: !!config.redisUrl,
		corsAllowedOrigins: !!config.corsAllowedOrigins,
	}

	// Required fields (all except optional ones)
	const requiredFields = configKeys.filter(
		(key) => !['redisUrl', 'corsAllowedOrigins'].includes(key),
	)

	// Missing fields (required fields that are empty or placeholder values)
	const missingFields = requiredFields.filter((key) => {
		const value = config[key]
		return (
			!value ||
			(typeof value === 'string' && value.includes('build-time-placeholder')) ||
			(typeof value === 'string' && value.trim().length === 0)
		)
	})

	return {
		total: configKeys.length,
		bySource: sourceStats,
		optionalFields,
		requiredFields,
		missingFields,
	}
}

/**
 * Log comprehensive configuration summary
 */
export const logConfigurationSummary = (
	config: AppConfig,
	environment: ConfigEnvironment,
	loadTime: number,
	sources?: Record<string, ConfigSource>,
): void => {
	const sourceStats = analyzeConfigSources(config, sources)

	logger.info(
		{
			operation: 'configurationSummary',
			environment,
			loadTimeMs: loadTime,
			configStats: {
				totalFields: sourceStats.total,
				requiredFields: sourceStats.requiredFields.length,
				optionalFields: Object.keys(sourceStats.optionalFields).length,
				missingFields: sourceStats.missingFields.length,
			},
			sourceBreakdown: sourceStats.bySource,
			optionalFieldsPresent: sourceStats.optionalFields,
			missingRequiredFields: sourceStats.missingFields,
			coreConfig: {
				nodeEnv: config.nodeEnv,
				appEnv: config.appEnv,
				port: config.port,
			},
		},
		`Configuration loading completed for ${environment} environment`,
	)

	// Log warnings for missing required fields
	if (sourceStats.missingFields.length > 0) {
		logger.warn(
			{
				operation: 'configurationWarning',
				missingFields: sourceStats.missingFields,
				environment,
			},
			`Configuration has ${sourceStats.missingFields.length.toString()} missing or placeholder required fields`,
		)
	}
}

/**
 * Create a new observability tracker instance
 */
export const createConfigObservabilityTracker =
	(): ConfigObservabilityTracker => {
		return new ConfigObservabilityTracker()
	}

/**
 * Global tracker instance for convenience
 */
export const globalConfigTracker = createConfigObservabilityTracker()
