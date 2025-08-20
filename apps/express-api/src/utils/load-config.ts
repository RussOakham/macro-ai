/**
 * Unified Configuration Loader
 * Handles environment variable loading and validation for all deployment contexts
 * Integrates Parameter Store with traditional environment variable loading
 * Provides comprehensive validation and metadata tracking
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
 * Enhanced configuration with source metadata
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
 * Load configuration based on environment context:
 * - Local development: Load from .env file with full validation
 * - CI build-time: Use pre-loaded build env vars, skip validation for missing runtime secrets
 * - EC2 Runtime: Use environment variables from Parameter Store with full validation and metadata tracking
 */
/**
 * Synchronous configuration loader for build-time contexts
 * Used during CI builds when Parameter Store is not available
 */
const loadBuildTimeConfig = (): Result<TEnv> => {
	logger.info('Loading build-time configuration from environment variables')

	// Create minimal config with only values needed for build processes
	const buildConfig: TEnv = {
		// Required for swagger generation and build
		NODE_ENV: (process.env.NODE_ENV ?? 'development') as
			| 'production'
			| 'development'
			| 'test',
		APP_ENV: (process.env.APP_ENV ?? 'development') as
			| 'production'
			| 'staging'
			| 'development'
			| 'test',
		SERVER_PORT: Number(process.env.SERVER_PORT) || 3040,

		// Build-time placeholders for required fields (not used during build)
		API_KEY: 'build-time-not-required',
		AWS_COGNITO_REGION: process.env.AWS_COGNITO_REGION ?? 'us-east-1',
		AWS_COGNITO_USER_POOL_ID: 'build-time-not-required',
		AWS_COGNITO_USER_POOL_CLIENT_ID: 'build-time-not-required',
		AWS_COGNITO_USER_POOL_SECRET_KEY: 'build-time-not-required',
		AWS_COGNITO_ACCESS_KEY: 'build-time-not-required',
		AWS_COGNITO_SECRET_KEY: 'build-time-not-required',
		AWS_COGNITO_REFRESH_TOKEN_EXPIRY:
			Number(process.env.AWS_COGNITO_REFRESH_TOKEN_EXPIRY) || 30,
		COOKIE_DOMAIN: process.env.COOKIE_DOMAIN ?? 'localhost',
		COOKIE_ENCRYPTION_KEY: 'build-time-not-required',
		NON_RELATIONAL_DATABASE_URL: 'build-time-not-required',
		RELATIONAL_DATABASE_URL: 'build-time-not-required',
		OPENAI_API_KEY: 'build-time-not-required',

		// Rate limiting configs (used in swagger docs)
		RATE_LIMIT_WINDOW_MS: Number(process.env.RATE_LIMIT_WINDOW_MS) || 900000,
		RATE_LIMIT_MAX_REQUESTS: Number(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
		AUTH_RATE_LIMIT_WINDOW_MS:
			Number(process.env.AUTH_RATE_LIMIT_WINDOW_MS) || 3600000,
		AUTH_RATE_LIMIT_MAX_REQUESTS:
			Number(process.env.AUTH_RATE_LIMIT_MAX_REQUESTS) || 10,
		API_RATE_LIMIT_WINDOW_MS:
			Number(process.env.API_RATE_LIMIT_WINDOW_MS) || 60000,
		API_RATE_LIMIT_MAX_REQUESTS:
			Number(process.env.API_RATE_LIMIT_MAX_REQUESTS) || 60,
		REDIS_URL: process.env.REDIS_URL,
	}

	return [buildConfig, null]
}

/**
 * Asynchronous configuration loader with Parameter Store integration
 * Used for runtime environments (local development and EC2)
 */
const loadRuntimeConfig = async (): Promise<Result<EnhancedConfig>> => {
	const envPath = resolve(process.cwd(), '.env')
	const isEc2Environment = Boolean(process.env.PARAMETER_STORE_PREFIX)
	const isRuntimeEnvironment = isEc2Environment

	const enableDebug =
		process.env.NODE_ENV !== 'production' && process.env.NODE_ENV !== 'test'

	logger.info(
		{
			operation: 'loadRuntimeConfig',
			isEc2Environment,
			parameterStorePrefix: process.env.PARAMETER_STORE_PREFIX,
			envPath,
		},
		'Loading runtime configuration with Parameter Store integration',
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
				'configLoader',
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
				'configLoader',
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
				'configLoader',
			)
			return [null, appError]
		}

		// Standard validation error for non-EC2 environments
		const appError = AppError.validation(
			`Invalid runtime configuration: ${validationError.message}`,
			{ envPath, errors: validationError.details, sources },
			'configLoader',
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
	} else {
		logger.info('Loaded configuration from .env file')
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
 * Main configuration loader that determines the appropriate loading strategy
 * Based on environment context (build-time vs runtime)
 */
const loadConfig = (): Result<TEnv> => {
	const isTruthy = (v?: string) => /^(?:1|true|yes)$/i.test(v ?? '')
	const isCiEnvironment =
		isTruthy(process.env.CI) ||
		isTruthy(process.env.GITHUB_ACTIONS) ||
		isTruthy(process.env.GITLAB_CI) ||
		isTruthy(process.env.CIRCLECI) ||
		Boolean(process.env.JENKINS_URL) ||
		isTruthy(process.env.BUILDKITE)

	// Check if this is a build-time context (CI with build env loaded)
	const isBuildTime =
		isCiEnvironment && !isTruthy(process.env.RUNTIME_CONFIG_REQUIRED)

	// For build-time contexts, use synchronous loader
	if (isBuildTime) {
		return loadBuildTimeConfig()
	}

	// For runtime contexts, we need to handle the async nature
	// Since this function must be synchronous for backward compatibility,
	// we'll use the basic validation approach for now
	// TODO: Migrate callers to use loadRuntimeConfig() directly for enhanced features
	const isEc2Environment = Boolean(process.env.PARAMETER_STORE_PREFIX)
	const isRuntimeEnvironment = isEc2Environment

	const enableDebug =
		process.env.NODE_ENV !== 'production' && process.env.NODE_ENV !== 'test'

	// Load environment file for local development only (not EC2 or CI)
	if (!isRuntimeEnvironment && !isCiEnvironment) {
		const envPath = resolve(process.cwd(), '.env')
		const result = config({
			path: envPath,
			encoding: 'UTF-8',
			debug: enableDebug,
		})

		if (result.error) {
			const appError = AppError.validation(
				`Cannot parse .env file '${envPath}': ${result.error.message}`,
				{ envPath, error: result.error },
				'configLoader',
			)
			return [null, appError]
		}
	}

	// For runtime contexts (local dev, EC2), validate all environment variables
	const env = envSchema.safeParse(process.env)

	if (!env.success) {
		const validationError = fromError(env.error)
		const envPath = resolve(process.cwd(), '.env')

		// In EC2 environment, provide detailed validation error with Parameter Store context
		if (isEc2Environment) {
			logger.error(
				{
					operation: 'ec2ConfigValidationFailed',
					error: validationError.message,
					details: validationError.details,
					parameterStorePrefix: process.env.PARAMETER_STORE_PREFIX,
				},
				'Configuration validation failed in EC2 environment. Ensure all required environment variables are loaded from Parameter Store.',
			)

			const appError = AppError.validation(
				`EC2 environment configuration validation failed: ${validationError.message}. ` +
					`Check that Parameter Store contains all required values with prefix: ${process.env.PARAMETER_STORE_PREFIX ?? 'undefined'}`,
				{
					envPath,
					errors: validationError.details,
					parameterStorePrefix: process.env.PARAMETER_STORE_PREFIX,
					environment: 'ec2',
				},
				'configLoader',
			)
			return [null, appError]
		}

		// For local development environments
		const appError = AppError.validation(
			`Invalid environment configuration: ${validationError.message}. Environment file: ${envPath}`,
			{ envPath, errors: validationError.details },
			'configLoader',
		)
		return [null, appError]
	}

	if (isEc2Environment) {
		logger.info(
			{
				operation: 'configLoaded',
				environment: 'ec2',
				parameterStorePrefix: process.env.PARAMETER_STORE_PREFIX,
			},
			'Successfully loaded and validated configuration from EC2 environment variables',
		)
	} else if (isCiEnvironment) {
		logger.info('Loaded configuration from CI environment variables')
	} else {
		logger.info('Loaded configuration from .env file')
	}

	return [env.data, null]
}

/**
 * Enhanced configuration loader with Parameter Store integration and metadata
 * Use this for applications that need detailed configuration source tracking
 */
const loadEnhancedConfig = loadRuntimeConfig

/**
 * Utility functions for configuration management
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

const getConfigCacheStats = () => {
	return enhancedConfigService.getCacheStats()
}

// Export the main function and enhanced utilities
export {
	clearConfigCache,
	getConfigCacheStats,
	getConfigWithSource,
	loadConfig,
	loadEnhancedConfig,
}
export type { EnhancedConfig }
