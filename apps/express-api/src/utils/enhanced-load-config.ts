/**
 * Enhanced Configuration Loader for EC2 Environments
 * Integrates Parameter Store with traditional environment variable loading
 * Provides comprehensive validation for EC2 runtime environments
 */

import { config } from 'dotenv'
import { resolve } from 'path'
import { fromError } from 'zod-validation-error'

import { enhancedConfigService } from '../services/enhanced-config.service.ts'

import { envSchema, TEnv } from './env.schema.ts'
import { AppError, Result } from './errors.ts'
import { pino } from './logger.ts'

const { logger } = pino

/**
 * Configuration source types
 */
type ConfigSource = 'environment' | 'parameter-store' | 'fallback'

/**
 * Enhanced configuration with source metadata for EC2 environments
 */
interface EnhancedConfig extends TEnv {
	_metadata: {
		sources: Record<string, ConfigSource>
		isEc2Environment: boolean
		parameterStoreEnabled: boolean
		validationResults: {
			totalVariables: number
			parameterStoreVariables: number
			environmentVariables: number
			fallbackVariables: number
		}
	}
}

/**
 * Load configuration with Parameter Store integration for EC2 environments
 * Attempts to load sensitive values from Parameter Store first
 * Falls back to environment variables for all values
 * Provides comprehensive validation with detailed error reporting
 */
const loadEnhancedConfig = async (): Promise<Result<EnhancedConfig>> => {
	const envPath = resolve(process.cwd(), '.env')
	const isEc2Environment = Boolean(process.env.PARAMETER_STORE_PREFIX)
	const isRuntimeEnvironment = isEc2Environment

	const enableDebug =
		process.env.NODE_ENV !== 'production' && process.env.NODE_ENV !== 'test'

	// Only log during normal runtime, not during static analysis

	logger.info(
		{
			operation: 'loadEnhancedConfig',
			isEc2Environment,
			parameterStorePrefix: process.env.PARAMETER_STORE_PREFIX,
			envPath,
		},
		'Loading enhanced configuration for EC2 environment',
	)

	// Load environment variables from .env file (if not in runtime environment)
	if (!isRuntimeEnvironment) {
		const result = config({
			path: envPath,
			encoding: 'UTF-8',
			debug: enableDebug,
		})

		if (result.error) {
			const appError = AppError.validation(
				`Cannot parse .env file '${envPath}': ${result.error.message}`,
				{ envPath, error: result.error },
				'enhancedConfigLoader',
			)
			return [null, appError]
		}
	}

	// Create enhanced environment object
	const enhancedEnv: Record<string, string> = {}
	for (const [key, value] of Object.entries(process.env)) {
		if (value !== undefined) {
			enhancedEnv[key] = value
		}
	}
	const sources: Record<string, ConfigSource> = {}

	// Initialize validation counters
	let parameterStoreVariables = 0
	let environmentVariables = 0
	let fallbackVariables = 0

	// In EC2 runtime environment, load values from Parameter Store
	if (isRuntimeEnvironment) {
		logger.info(
			{
				operation: 'loadFromParameterStore',
				parameterStorePrefix: process.env.PARAMETER_STORE_PREFIX,
			},
			'EC2 runtime environment detected, loading from Parameter Store',
		)

		try {
			// Get all mapped configuration from Parameter Store with fallbacks
			const [configValues, configError] =
				await enhancedConfigService.getAllMappedConfig()

			if (configError) {
				logger.warn(
					{
						operation: 'parameterStorePartialFailure',
						error: configError.message,
						parameterStorePrefix: process.env.PARAMETER_STORE_PREFIX,
					},
					'Failed to load some configuration from Parameter Store',
				)
			} else {
				// Update environment with Parameter Store values
				for (const [envVar, configValue] of Object.entries(configValues)) {
					enhancedEnv[envVar] = configValue.value
					sources[envVar] = configValue.source

					// Count source types for validation reporting
					if (configValue.source === 'parameter-store') {
						parameterStoreVariables++
					} else if (configValue.source === 'environment') {
						environmentVariables++
					} else {
						fallbackVariables++
					}

					logger.debug(
						{
							operation: 'configLoaded',
							envVar,
							source: configValue.source,
							cached: configValue.cached,
						},
						'Configuration variable loaded',
					)
				}

				logger.info(
					{
						operation: 'parameterStoreLoadComplete',
						parameterStoreVariables,
						environmentVariables,
						fallbackVariables,
						totalVariables:
							parameterStoreVariables +
							environmentVariables +
							fallbackVariables,
					},
					'Parameter Store configuration loading completed',
				)
			}
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : 'Unknown error'
			logger.error(
				{
					operation: 'parameterStoreFailed',
					error: errorMessage,
					parameterStorePrefix: process.env.PARAMETER_STORE_PREFIX,
				},
				'Parameter Store integration failed completely',
			)

			// In EC2 environment, Parameter Store failure is critical
			const appError = AppError.validation(
				`Parameter Store integration failed in EC2 environment: ${errorMessage}. ` +
					`Check AWS credentials and Parameter Store prefix: ${process.env.PARAMETER_STORE_PREFIX ?? 'undefined'}`,
				{
					error: errorMessage,
					parameterStorePrefix: process.env.PARAMETER_STORE_PREFIX,
					environment: 'ec2',
				},
				'enhancedConfigLoader',
			)
			return [null, appError]
		}
	}

	// Mark remaining values as environment sourced and count them
	for (const key of Object.keys(enhancedEnv)) {
		if (!sources[key]) {
			sources[key] = 'environment'
			environmentVariables++
		}
	}

	const totalVariables =
		parameterStoreVariables + environmentVariables + fallbackVariables

	// Validate the enhanced environment against schema with comprehensive error reporting
	const env = envSchema.safeParse(enhancedEnv)

	if (!env.success) {
		const validationError = fromError(env.error)

		// Enhanced error reporting for EC2 environments
		if (isEc2Environment) {
			logger.error(
				{
					operation: 'ec2ConfigValidationFailed',
					error: validationError.message,
					details: validationError.details,
					parameterStorePrefix: process.env.PARAMETER_STORE_PREFIX,
					validationStats: {
						totalVariables,
						parameterStoreVariables,
						environmentVariables,
						fallbackVariables,
					},
					sources,
				},
				'Enhanced configuration validation failed in EC2 environment',
			)

			const appError = AppError.validation(
				`EC2 enhanced configuration validation failed: ${validationError.message}. ` +
					`Loaded ${String(parameterStoreVariables)} from Parameter Store, ${String(environmentVariables)} from environment, ${String(fallbackVariables)} fallbacks. ` +
					`Check Parameter Store prefix: ${process.env.PARAMETER_STORE_PREFIX ?? 'undefined'}`,
				{
					envPath,
					errors: validationError.details,
					sources,
					parameterStorePrefix: process.env.PARAMETER_STORE_PREFIX,
					validationStats: {
						totalVariables,
						parameterStoreVariables,
						environmentVariables,
						fallbackVariables,
					},
					environment: 'ec2',
				},
				'enhancedConfigLoader',
			)
			return [null, appError]
		}

		// Standard validation error for non-EC2 environments
		const appError = AppError.validation(
			`Invalid enhanced configuration: ${validationError.message}`,
			{ envPath, errors: validationError.details, sources },
			'enhancedConfigLoader',
		)
		return [null, appError]
	}

	// Log successful validation
	if (isEc2Environment) {
		logger.info(
			{
				operation: 'ec2ConfigValidationSuccess',
				validationStats: {
					totalVariables,
					parameterStoreVariables,
					environmentVariables,
					fallbackVariables,
				},
				parameterStorePrefix: process.env.PARAMETER_STORE_PREFIX,
			},
			'EC2 enhanced configuration validation completed successfully',
		)
	}

	// Create enhanced config with comprehensive metadata
	const enhancedConfig: EnhancedConfig = {
		...env.data,
		_metadata: {
			sources,
			isEc2Environment,
			parameterStoreEnabled: isRuntimeEnvironment,
			validationResults: {
				totalVariables,
				parameterStoreVariables,
				environmentVariables,
				fallbackVariables,
			},
		},
	}

	return [enhancedConfig, null]
}

/**
 * Get a specific configuration value with source information
 * Useful for debugging configuration issues
 */
const getConfigWithSource = async (
	envVar: string,
	options: {
		required?: boolean
		fallback?: string
	} = {},
): Promise<
	Result<{
		value: string
		source: 'environment' | 'parameter-store' | 'fallback'
		cached: boolean
	}>
> => {
	const [configValue, error] = await enhancedConfigService.getConfig(
		envVar,
		options,
	)

	if (error) {
		return [null, error]
	}

	return [
		{
			value: configValue.value,
			source: configValue.source,
			cached: configValue.cached,
		},
		null,
	]
}

/**
 * Clear Parameter Store cache
 * Useful for testing or when configuration needs to be refreshed
 */
const clearConfigCache = (parameterName?: string): void => {
	enhancedConfigService.clearCache(parameterName)
	logger.info(
		{
			operation: 'clearConfigCache',
			parameterName: parameterName ?? 'all',
		},
		'Configuration cache cleared',
	)
}

/**
 * Get configuration cache statistics
 * Useful for monitoring and debugging
 */
const getConfigCacheStats = () => {
	return enhancedConfigService.getCacheStats()
}

export {
	clearConfigCache,
	getConfigCacheStats,
	getConfigWithSource,
	loadEnhancedConfig,
}
export type { EnhancedConfig }
