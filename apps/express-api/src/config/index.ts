/**
 * Main Configuration API
 * Provides a clean, simple interface for loading configuration across all environments
 */

import { configureLogger, pino } from '../utils/logger.ts'

import type {
	AppConfig,
	ConfigLoadingOptions,
	Result,
} from './core/config-types.ts'
import { ConfigEnvironment } from './core/config-types.ts'
import {
	detectEnvironment,
	getEnvironmentMetadata,
	validateEnvironmentDetection,
} from './core/environment-detector.ts'
import {
	createConfigLoader,
	isAsyncLoader,
	loadConfiguration,
} from './loaders/loader-factory.ts'
import {
	ConfigLoadingStage,
	globalConfigTracker,
	logConfigurationSummary,
} from './middleware/config-observability.ts'

const { logger } = pino

/**
 * Load application configuration
 * Automatically detects environment and uses appropriate loader
 *
 * @param options Configuration loading options
 * @returns Promise<Result<AppConfig>> for all environments (async for consistency)
 */
export const loadAppConfig = async (
	options: ConfigLoadingOptions = {},
): Promise<Result<AppConfig>> => {
	const startTime = Date.now()

	try {
		// Start observability tracking
		globalConfigTracker.reset()

		// Stage 1: Environment Detection
		const environment = detectEnvironment()

		logger.info(
			{
				operation: 'loadAppConfig',
				environment,
				options,
				startTime: new Date(startTime).toISOString(),
			},
			`Starting application configuration loading for ${environment} environment`,
		)

		// Stage 2: Configuration Loading
		globalConfigTracker.startStage(
			environment,
			ConfigLoadingStage.SOURCE_LOADING,
		)

		// Load configuration using appropriate loader
		const result = await loadConfiguration(options)

		globalConfigTracker.completeStage({
			configurationLoaded: result[0] !== null,
			hasError: result[1] !== null,
		})

		if (result[1]) {
			// Configuration loading failed
			const loadTime = Date.now() - startTime

			globalConfigTracker.failStage(result[1].message, {
				loadTimeMs: loadTime,
				environment,
			})

			logger.error(
				{
					operation: 'loadAppConfigFailed',
					environment,
					error: result[1].message,
					loadTimeMs: loadTime,
					trackerSummary: globalConfigTracker.getSummary(),
				},
				'Failed to load application configuration',
			)

			return result
		}

		const config = result[0]
		const loadTime = Date.now() - startTime

		// Stage 3: Configuration Completion
		globalConfigTracker.startStage(environment, ConfigLoadingStage.COMPLETION)

		// Configure logger with loaded environment
		configureLogger(config.nodeEnv)

		// Log comprehensive configuration summary
		logConfigurationSummary(config, environment, loadTime)

		globalConfigTracker.completeStage({
			configFields: Object.keys(config).length,
			nodeEnv: config.nodeEnv,
			appEnv: config.appEnv,
		})

		const trackerSummary = globalConfigTracker.getSummary()

		logger.info(
			{
				operation: 'loadAppConfigSuccess',
				environment,
				nodeEnv: config.nodeEnv,
				appEnv: config.appEnv,
				port: config.port,
				loadTimeMs: loadTime,
				configFields: Object.keys(config).length,
				optionalFields: {
					redisUrl: !!config.redisUrl,
					corsAllowedOrigins: !!config.corsAllowedOrigins,
				},
				performanceMetrics: {
					totalStages: trackerSummary.stageCount,
					successfulStages: trackerSummary.successfulStages,
					totalDuration: trackerSummary.totalDuration,
				},
			},
			`Configuration loaded successfully for ${environment} environment`,
		)

		return [config, null]
	} catch (error) {
		const loadTime = Date.now() - startTime
		const errorMessage =
			error instanceof Error ? error.message : 'Unknown error'

		logger.error(
			{
				operation: 'loadAppConfigError',
				error: errorMessage,
				loadTimeMs: loadTime,
			},
			'Unexpected error during configuration loading',
		)

		return [null, error instanceof Error ? error : new Error(errorMessage)]
	}
}

/**
 * Load configuration synchronously (only works for build-time and localhost environments)
 * Throws an error if called in an async environment (EC2)
 *
 * @param options Configuration loading options
 * @returns Result<AppConfig>
 */
export const loadAppConfigSync = (
	options: ConfigLoadingOptions = {},
): Result<AppConfig> => {
	try {
		const loader = createConfigLoader(options)

		if (isAsyncLoader(loader)) {
			throw new Error(
				'Synchronous configuration loading is not supported in EC2/Lambda environments. Use loadAppConfig() instead.',
			)
		}

		const result = loader.load() as Result<AppConfig>

		if (result[1]) {
			console.error('Failed to load configuration:', result[1].message)
			return result
		}

		const config = result[0]

		// Configure logger with loaded environment
		configureLogger(config.nodeEnv)

		console.log(
			`Configuration loaded successfully for ${loader.getEnvironment()} environment`,
		)

		return [config, null]
	} catch (error) {
		const errorMessage =
			error instanceof Error ? error.message : 'Unknown error'
		console.error('Failed to load configuration:', errorMessage)
		return [null, error instanceof Error ? error : new Error(errorMessage)]
	}
}

/**
 * Get configuration environment information
 * Useful for debugging and monitoring
 */
export const getConfigEnvironmentInfo = () => {
	return getEnvironmentMetadata()
}

/**
 * Validate current environment setup
 * Returns warnings and validation results
 */
export const validateConfigEnvironment = () => {
	return validateEnvironmentDetection()
}

// Re-export types and utilities for convenience
export type {
	AppConfig,
	ConfigLoadingOptions,
	Result,
} from './core/config-types.ts'
export { ConfigEnvironment, ConfigSource } from './core/config-types.ts'
export { detectEnvironment } from './core/environment-detector.ts'

// For backward compatibility - synchronous config export for build-time use
// This will only work in build-time and localhost environments
let _buildTimeConfig: AppConfig | null = null

try {
	const environment = detectEnvironment()

	if (
		environment === ConfigEnvironment.BUILD_TIME ||
		environment === ConfigEnvironment.LOCALHOST
	) {
		const [config, error] = loadAppConfigSync({ validateSchema: false })

		if (error) {
			console.error('Failed to load build-time configuration:', error.message)
			process.exit(1)
		}

		_buildTimeConfig = config
	}
} catch (error) {
	// In EC2 environments, this is expected - the config will be loaded asynchronously
	if (detectEnvironment() !== ConfigEnvironment.EC2_RUNTIME) {
		console.error('Failed to initialize build-time configuration:', error)
		process.exit(1)
	}
}

/**
 * Synchronous configuration export for backward compatibility
 * Only available in build-time and localhost environments
 */
export const config = _buildTimeConfig

/**
 * Check if synchronous config is available
 */
export const isSyncConfigAvailable = (): boolean => {
	return _buildTimeConfig !== null
}
