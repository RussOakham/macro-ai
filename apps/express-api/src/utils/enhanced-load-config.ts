/**
 * Enhanced Configuration Loader
 * Integrates Parameter Store with traditional environment variable loading
 * Provides seamless fallback from Parameter Store to environment variables
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
 * Enhanced configuration with source metadata
 */
interface EnhancedConfig extends TEnv {
	_metadata: {
		sources: Record<string, 'environment' | 'parameter-store' | 'fallback'>
		isLambdaEnvironment: boolean
		parameterStoreEnabled: boolean
	}
}

/**
 * Load configuration with Parameter Store integration
 * In Lambda environments, attempts to load sensitive values from Parameter Store first
 * Falls back to environment variables for all values
 */
const loadEnhancedConfig = async (): Promise<Result<EnhancedConfig>> => {
	const envPath = resolve(process.cwd(), '.env')
	const isLambdaEnvironment = Boolean(process.env.AWS_LAMBDA_FUNCTION_NAME)

	const enableDebug =
		process.env.NODE_ENV !== 'production' && process.env.NODE_ENV !== 'test'

	// Only log during normal runtime, not during static analysis

	logger.info(
		{
			operation: 'loadEnhancedConfig',
			isLambdaEnvironment,
			envPath,
		},
		'Loading enhanced configuration',
	)

	// Load environment variables from .env file (if not in Lambda)
	if (!isLambdaEnvironment) {
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
	const sources: Record<
		string,
		'environment' | 'parameter-store' | 'fallback'
	> = {}

	// In Lambda environment, try to load sensitive values from Parameter Store
	if (isLambdaEnvironment) {
		logger.info(
			{
				operation: 'loadFromParameterStore',
			},
			'Lambda environment detected, loading from Parameter Store',
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
					},
					'Failed to load some configuration from Parameter Store',
				)
			} else {
				// Update environment with Parameter Store values
				for (const [envVar, configValue] of Object.entries(configValues)) {
					enhancedEnv[envVar] = configValue.value
					sources[envVar] = configValue.source

					logger.debug(
						{
							operation: 'configLoaded',
							envVar,
							source: configValue.source,
							cached: configValue.cached,
						},
						'Configuration loaded',
					)
				}
			}
		} catch (error) {
			logger.warn(
				{
					operation: 'parameterStoreFallback',
					error: error instanceof Error ? error.message : 'Unknown error',
				},
				'Parameter Store integration failed, using environment fallbacks',
			)
		}
	}

	// Mark remaining values as environment sourced
	for (const key of Object.keys(enhancedEnv)) {
		sources[key] ??= 'environment'
	}

	// Validate the enhanced environment against schema
	const env = envSchema.safeParse(enhancedEnv)

	if (!env.success) {
		const validationError = fromError(env.error)
		const appError = AppError.validation(
			`Invalid environment configuration: ${validationError.message}`,
			{ envPath, errors: validationError.details, sources },
			'enhancedConfigLoader',
		)
		return [null, appError]
	}

	// Create enhanced config with metadata
	const enhancedConfig: EnhancedConfig = {
		...env.data,
		_metadata: {
			sources,
			isLambdaEnvironment,
			parameterStoreEnabled: isLambdaEnvironment,
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
