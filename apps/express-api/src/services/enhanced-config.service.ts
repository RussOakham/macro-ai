/**
 * Enhanced Configuration Service
 * Integrates Parameter Store with environment variables for flexible configuration loading
 */

import { tryCatch } from '../utils/error-handling/try-catch.ts'
import { AppError, InternalError, Result } from '../utils/errors.ts'
import { pino } from '../utils/logger.ts'

import { ParameterStoreService } from './parameter-store.service.ts'

const { logger } = pino

/**
 * Configuration source types
 */
type ConfigSource = 'environment' | 'parameter-store' | 'fallback'

/**
 * Configuration value with metadata
 */
interface ConfigValue {
	value: string
	source: ConfigSource
	cached: boolean
}

/**
 * Configuration mapping for Parameter Store integration
 */
interface ParameterMapping {
	envVar: string
	parameterName: string
	required: boolean
	fallback?: string
}

/**
 * Enhanced Configuration Service
 * Provides seamless integration between environment variables and Parameter Store
 */
export class EnhancedConfigService {
	private readonly parameterStore: ParameterStoreService
	private readonly isLambdaEnvironment: boolean

	// Parameter mappings for sensitive configuration
	private static readonly PARAMETER_MAPPINGS: ParameterMapping[] = [
		// Critical parameters (SecureString)
		{
			envVar: 'API_KEY',
			parameterName: 'api-key',
			required: true,
		},
		{
			envVar: 'COOKIE_ENCRYPTION_KEY',
			parameterName: 'cookie-encryption-key',
			required: true,
		},
		{
			envVar: 'AWS_COGNITO_USER_POOL_SECRET_KEY',
			parameterName: 'cognito-user-pool-secret-key',
			required: true,
		},
		{
			envVar: 'AWS_COGNITO_ACCESS_KEY',
			parameterName: 'cognito-access-key',
			required: true,
		},
		{
			envVar: 'AWS_COGNITO_SECRET_KEY',
			parameterName: 'cognito-secret-key',
			required: true,
		},
		{
			envVar: 'OPENAI_API_KEY',
			parameterName: 'openai-api-key',
			required: true,
		},
		{
			envVar: 'RELATIONAL_DATABASE_URL',
			parameterName: 'neon-database-url',
			required: true,
		},
		// Standard parameters (String)
		{
			envVar: 'NON_RELATIONAL_DATABASE_URL',
			parameterName: 'upstash-redis-url',
			required: true,
		},
		{
			envVar: 'REDIS_URL',
			parameterName: 'upstash-redis-url',
			required: false,
		},
		{
			envVar: 'AWS_COGNITO_USER_POOL_ID',
			parameterName: 'cognito-user-pool-id',
			required: true,
		},
		{
			envVar: 'AWS_COGNITO_USER_POOL_CLIENT_ID',
			parameterName: 'cognito-user-pool-client-id',
			required: true,
		},
	]

	constructor(parameterStore?: ParameterStoreService) {
		this.parameterStore = parameterStore ?? new ParameterStoreService()
		this.isLambdaEnvironment = Boolean(process.env.AWS_LAMBDA_FUNCTION_NAME)

		logger.info(
			{
				operation: 'enhancedConfigInit',
				isLambdaEnvironment: this.isLambdaEnvironment,
				parameterMappings: EnhancedConfigService.PARAMETER_MAPPINGS.length,
			},
			'EnhancedConfigService initialized',
		)
	}

	/**
	 * Get configuration value with automatic fallback from Parameter Store to environment variables
	 * @param envVar Environment variable name
	 * @param options Configuration options
	 * @returns Result tuple with configuration value or error
	 */
	public getConfig = async (
		envVar: string,
		options: {
			required?: boolean
			fallback?: string
			useParameterStore?: boolean
		} = {},
	): Promise<Result<ConfigValue>> => {
		const { required = false, fallback, useParameterStore = true } = options

		// Find parameter mapping if it exists
		const mapping = EnhancedConfigService.PARAMETER_MAPPINGS.find(
			(m) => m.envVar === envVar,
		)

		// In Lambda environment, prefer Parameter Store for mapped parameters
		if (
			this.isLambdaEnvironment &&
			useParameterStore &&
			mapping?.parameterName
		) {
			logger.debug(
				{
					operation: 'getConfigFromParameterStore',
					envVar,
					parameterName: mapping.parameterName,
				},
				'Attempting Parameter Store retrieval',
			)

			const [parameterValue, parameterError] =
				await this.parameterStore.getParameter(mapping.parameterName)

			if (!parameterError && parameterValue) {
				return [
					{
						value: parameterValue,
						source: 'parameter-store',
						cached: true, // Parameter Store service handles caching
					},
					null,
				]
			}

			// Log Parameter Store failure but continue to fallback
			logger.warn(
				{
					operation: 'parameterStoreFallback',
					envVar,
					parameterName: mapping.parameterName,
					error: parameterError?.message,
				},
				'Parameter Store retrieval failed, falling back to environment',
			)
		}

		// Fallback to environment variable
		const envValue = process.env[envVar]
		if (envValue) {
			return [
				{
					value: envValue,
					source: 'environment',
					cached: false,
				},
				null,
			]
		}

		// Use provided fallback
		if (fallback !== undefined) {
			return [
				{
					value: fallback,
					source: 'fallback',
					cached: false,
				},
				null,
			]
		}

		// Use mapping fallback
		if (mapping?.fallback !== undefined) {
			return [
				{
					value: mapping.fallback,
					source: 'fallback',
					cached: false,
				},
				null,
			]
		}

		// Return error if required and no value found
		if (required) {
			const error = new InternalError(
				`Required configuration ${envVar} not found in Parameter Store or environment variables`,
				'enhancedConfigService',
			)
			return [null, error]
		}

		// Return empty string for optional values
		return [
			{
				value: '',
				source: 'fallback',
				cached: false,
			},
			null,
		]
	}

	/**
	 * Load all mapped parameters from Parameter Store
	 * Useful for warming up the cache during Lambda cold starts
	 * @returns Result tuple with loaded parameters or error
	 */
	public preloadParameters = async (): Promise<
		Result<Record<string, ConfigValue>>
	> => {
		const preloadOperation = async (): Promise<Record<string, ConfigValue>> => {
			const parameterNames = EnhancedConfigService.PARAMETER_MAPPINGS.map(
				(m) => m.parameterName,
			)

			logger.info(
				{
					operation: 'preloadParameters',
					parameterCount: parameterNames.length,
					parameters: parameterNames,
				},
				'Preloading parameters from Parameter Store',
			)

			const [parameters, parameterError] =
				await this.parameterStore.getParameters(parameterNames)

			if (parameterError) {
				throw parameterError
			}

			// Convert to ConfigValue format
			const configValues: Record<string, ConfigValue> = {}
			for (const [parameterName, value] of Object.entries(parameters)) {
				configValues[parameterName] = {
					value,
					source: 'parameter-store',
					cached: true,
				}
			}

			return configValues
		}

		const [results, error] = await tryCatch(
			preloadOperation(),
			'enhancedConfigService - preloadParameters',
		)

		if (error) {
			return [null, error]
		}

		logger.info(
			{
				operation: 'preloadParametersSuccess',
				loadedCount: Object.keys(results).length,
			},
			'Parameters preloaded successfully',
		)

		return [results, null]
	}

	/**
	 * Get configuration for all mapped parameters
	 * @returns Result tuple with all configuration values or error
	 */
	public getAllMappedConfig = async (): Promise<
		Result<Record<string, ConfigValue>>
	> => {
		const configValues: Record<string, ConfigValue> = {}
		const errors: AppError[] = []

		for (const mapping of EnhancedConfigService.PARAMETER_MAPPINGS) {
			const [configValue, error] = await this.getConfig(mapping.envVar, {
				required: mapping.required,
				fallback: mapping.fallback,
			})

			if (error) {
				errors.push(error)
			} else {
				configValues[mapping.envVar] = configValue
			}
		}

		if (errors.length > 0) {
			const combinedError = new InternalError(
				`Failed to load ${String(errors.length)} configuration values`,
				'enhancedConfigService',
			)
			return [null, combinedError]
		}

		return [configValues, null]
	}

	/**
	 * Clear Parameter Store cache
	 * @param parameterName Optional specific parameter to clear
	 */
	public clearCache = (parameterName?: string): void => {
		this.parameterStore.clearCache(parameterName)
		logger.debug(
			{
				operation: 'clearConfigCache',
				parameterName: parameterName ?? 'all',
			},
			'Configuration cache cleared',
		)
	}

	/**
	 * Get cache statistics
	 */
	public getCacheStats = () => {
		return this.parameterStore.getCacheStats()
	}

	/**
	 * Check if running in Lambda environment
	 */
	public isLambda = (): boolean => {
		return this.isLambdaEnvironment
	}

	/**
	 * Get parameter mappings for debugging
	 */
	public getParameterMappings = () => {
		return EnhancedConfigService.PARAMETER_MAPPINGS
	}
}

// Export singleton instance for use throughout the application
export const enhancedConfigService = new EnhancedConfigService()
