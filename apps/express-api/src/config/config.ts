/**
 * Main Configuration Module
 * Simplified configuration system that replaces the complex Parameter Store integration
 *
 * This module provides a clean interface for accessing configuration throughout the application.
 * Configuration is loaded from environment variables with optional .env file support for development.
 */

import type { TEnv } from '../utils/env.schema.ts'
import type { Result } from '../utils/errors.ts'
import { AppError } from '../utils/errors.ts'
import { configureLogger, pino } from '../utils/logger.ts'

import {
	getConfig as getSimpleConfig,
	getEnvironmentInfo,
	isDevelopment,
	isPreviewEnvironment,
	isProduction,
	isTest,
	loadConfig as loadSimpleConfig,
	loadConfigAsync,
} from './simple-config.ts'

const { logger } = pino

/**
 * Configuration loading options for backward compatibility
 */
interface ConfigLoadingOptions {
	/** Enable monitoring/logging (default: true) */
	enableMonitoring?: boolean
	/** Enable caching (ignored in simplified system) */
	enableCaching?: boolean
	/** Validate schema (default: true) */
	validateSchema?: boolean
	/** Include metadata (ignored in simplified system) */
	includeMetadata?: boolean
}

/**
 * Application configuration type (alias for TEnv for backward compatibility)
 */
export type AppConfig = TEnv

/**
 * Load application configuration (async version for backward compatibility)
 *
 * @param options Configuration loading options
 * @returns Promise resolving to Result tuple with configuration or error
 */
export const loadAppConfig = async (
	options: ConfigLoadingOptions = {},
): Promise<Result<AppConfig>> => {
	const { enableMonitoring = true, validateSchema = true } = options

	if (enableMonitoring) {
		const envInfo = getEnvironmentInfo()
		logger.info(
			{
				operation: 'loadAppConfig',
				...envInfo,
			},
			'Loading application configuration',
		)
	}

	const result = await loadConfigAsync({
		validateSchema,
		enableLogging: enableMonitoring,
	})

	if (enableMonitoring) {
		const [config, error] = result
		if (error) {
			logger.error(
				{
					operation: 'loadAppConfig',
					error: error.message,
				},
				'Failed to load application configuration',
			)
		} else {
			logger.info(
				{
					operation: 'loadAppConfig',
					nodeEnv: config.NODE_ENV,
					appEnv: config.APP_ENV,
					port: config.SERVER_PORT,
				},
				'Application configuration loaded successfully',
			)
		}
	}

	return result
}

/**
 * Load application configuration (sync version for backward compatibility)
 *
 * @param options Configuration loading options
 * @returns Result tuple with configuration or error
 */
export const loadAppConfigSync = (
	options: ConfigLoadingOptions = {},
): Result<AppConfig> => {
	const { enableMonitoring = true, validateSchema = true } = options

	if (enableMonitoring) {
		const envInfo = getEnvironmentInfo()
		logger.info(
			{
				operation: 'loadAppConfigSync',
				...envInfo,
			},
			'Loading application configuration (sync)',
		)
	}

	const result = loadSimpleConfig({
		validateSchema,
		enableLogging: enableMonitoring,
	})

	if (enableMonitoring) {
		const [config, error] = result
		if (error) {
			logger.error(
				{
					operation: 'loadAppConfigSync',
					error: error.message,
				},
				'Failed to load application configuration (sync)',
			)
		} else {
			logger.info(
				{
					operation: 'loadAppConfigSync',
					nodeEnv: config.NODE_ENV,
					appEnv: config.APP_ENV,
					port: config.SERVER_PORT,
				},
				'Application configuration loaded successfully (sync)',
			)
		}
	}

	return result
}

/**
 * Get configuration with error throwing (for cases where you want to fail fast)
 *
 * @param options Configuration loading options
 * @returns Configuration object
 * @throws AppError if configuration loading fails
 */
export const getAppConfig = (options: ConfigLoadingOptions = {}): AppConfig => {
	const { validateSchema = true } = options

	return getSimpleConfig({
		validateSchema,
		enableLogging: false, // Disable logging for getter function
	})
}

// Load configuration at module level for immediate use
// This replaces the complex build-time vs runtime detection
let _moduleConfig: AppConfig | null = null
let _configError: AppError | null = null

try {
	const [config, error] = loadSimpleConfig({
		validateSchema: true,
		enableLogging: false, // Will be logged when explicitly loaded
	})

	_moduleConfig = config
	_configError = error

	if (config && !isTest()) {
		// Configure logger with loaded environment
		configureLogger(config.NODE_ENV)
	}
} catch (error) {
	_configError =
		error instanceof Error
			? new AppError({
					message: `Failed to load module-level configuration: ${error.message}`,
					service: 'config',
				})
			: new AppError({
					message: 'Failed to load module-level configuration: Unknown error',
					service: 'config',
				})
}

/**
 * Get the module-level configuration (for backward compatibility with config/default.ts)
 * Returns null if configuration failed to load
 */
export const getModuleConfig = (): AppConfig | null => {
	return _moduleConfig
}

/**
 * Get the module-level configuration error (if any)
 */
export const getModuleConfigError = (): AppError | null => {
	return _configError
}

/**
 * Check if module-level configuration is available
 */
export const isModuleConfigAvailable = (): boolean => {
	return _moduleConfig !== null && _configError === null
}

// Re-export utility functions
export {
	getEnvironmentInfo,
	isDevelopment,
	isPreviewEnvironment,
	isProduction,
	isTest,
}

// Re-export types
export type { AppError, ConfigLoadingOptions, Result, TEnv }
