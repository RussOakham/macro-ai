/**
 * Simplified Configuration System (Enhanced)
 *
 * This module now uses the enhanced env-config system for better environment management:
 * - Environment-specific configuration files (.env.local, .env.development, etc.)
 * - Proper configuration precedence rules
 * - Enhanced validation and error reporting
 * - Better support for different deployment environments
 */

import { type TEnv } from '../utils/env.schema.ts'
import { type Result } from '../utils/errors.ts'
import { pino } from '../utils/logger.ts'

import {
	type EnvConfigOptions,
	getConfigPrecedence,
	getEnvInfo,
	loadEnvConfig,
} from './env-config.ts'

const { logger } = pino

/**
 * Configuration loading options (backward compatibility)
 */
interface ConfigOptions extends EnvConfigOptions {
	/** Custom .env file path (deprecated - use baseDir instead) */
	envFilePath?: string
}

/**
 * Load configuration from environment variables with optional .env file loading
 *
 * @param options Configuration loading options
 * @returns Result tuple with configuration or error
 */
export const loadConfig = (options: ConfigOptions = {}): Result<TEnv> => {
	// Convert legacy envFilePath option to baseDir
	const enhancedOptions: EnvConfigOptions = {
		...options,
	}

	// Handle legacy envFilePath option
	if (options.envFilePath && !options.baseDir) {
		// Extract directory from file path manually to avoid require() style import
		const lastSlashIndex = options.envFilePath.lastIndexOf('/')
		const lastBackslashIndex = options.envFilePath.lastIndexOf('\\')
		const lastSeparatorIndex = Math.max(lastSlashIndex, lastBackslashIndex)

		if (lastSeparatorIndex > 0) {
			enhancedOptions.baseDir = options.envFilePath.substring(
				0,
				lastSeparatorIndex,
			)
		}
	}

	// Use the enhanced configuration loader
	return loadEnvConfig(enhancedOptions)
}

/**
 * Async wrapper for loadConfig to maintain compatibility with existing async interfaces
 *
 * @param options Configuration loading options
 * @returns Promise resolving to Result tuple with configuration or error
 */
export const loadConfigAsync = async (
	options: ConfigOptions = {},
): Promise<Result<TEnv>> => {
	return Promise.resolve(loadConfig(options))
}

/**
 * Get configuration with error throwing (for cases where you want to fail fast)
 *
 * @param options Configuration loading options
 * @returns Configuration object
 * @throws AppError if configuration loading fails
 */
export const getConfig = (options: ConfigOptions = {}): TEnv => {
	const [config, error] = loadConfig(options)

	if (error) {
		throw error
	}

	return config
}

/**
 * Assert that configuration is valid and return it
 * This function ensures configuration is loaded and valid before the application starts
 * If configuration is invalid, the application will exit with an error in production
 * or throw an error in non-production environments
 */
/**
 * Configuration interface with camelCase properties for backward compatibility
 */
export interface ConfigType {
	apiKey: string
	nodeEnv: 'development' | 'production' | 'test'
	appEnv: string
	port: number
	awsCognitoRegion: string
	awsCognitoUserPoolId: string
	awsCognitoUserPoolClientId: string
	awsCognitoUserPoolSecretKey: string
	awsCognitoAccessKey: string
	awsCognitoSecretKey: string
	awsCognitoRefreshTokenExpiry: number
	openaiApiKey: string
	relationalDatabaseUrl: string
	nonRelationalDatabaseUrl: string
	redisUrl?: string
	cookieEncryptionKey: string
	cookieDomain: string
	corsAllowedOrigins?: string
	rateLimitWindowMs?: number
	rateLimitMaxRequests?: number
	authRateLimitWindowMs?: number
	authRateLimitMaxRequests?: number
	apiRateLimitWindowMs?: number
	apiRateLimitMaxRequests?: number
}

/**
 * Convert raw environment variables to camelCase config object
 */
const convertToConfigType = (env: TEnv): ConfigType => ({
	apiKey: env.API_KEY,
	nodeEnv: env.NODE_ENV,
	appEnv: env.APP_ENV,
	port: env.SERVER_PORT,
	awsCognitoRegion: env.AWS_COGNITO_REGION,
	awsCognitoUserPoolId: env.AWS_COGNITO_USER_POOL_ID,
	awsCognitoUserPoolClientId: env.AWS_COGNITO_USER_POOL_CLIENT_ID,
	awsCognitoUserPoolSecretKey: env.AWS_COGNITO_USER_POOL_SECRET_KEY,
	awsCognitoAccessKey: env.AWS_COGNITO_ACCESS_KEY,
	awsCognitoSecretKey: env.AWS_COGNITO_SECRET_KEY,
	awsCognitoRefreshTokenExpiry: env.AWS_COGNITO_REFRESH_TOKEN_EXPIRY,
	openaiApiKey: env.OPENAI_API_KEY,
	relationalDatabaseUrl: env.RELATIONAL_DATABASE_URL,
	nonRelationalDatabaseUrl: env.NON_RELATIONAL_DATABASE_URL,
	redisUrl: env.REDIS_URL,
	cookieEncryptionKey: env.COOKIE_ENCRYPTION_KEY,
	cookieDomain: env.COOKIE_DOMAIN,
	corsAllowedOrigins: env.CORS_ALLOWED_ORIGINS,
	rateLimitWindowMs: env.RATE_LIMIT_WINDOW_MS,
	rateLimitMaxRequests: env.RATE_LIMIT_MAX_REQUESTS,
	authRateLimitWindowMs: env.AUTH_RATE_LIMIT_WINDOW_MS,
	authRateLimitMaxRequests: env.AUTH_RATE_LIMIT_MAX_REQUESTS,
	apiRateLimitWindowMs: env.API_RATE_LIMIT_WINDOW_MS,
	apiRateLimitMaxRequests: env.API_RATE_LIMIT_MAX_REQUESTS,
})

export const assertConfig = (shouldLog = false): ConfigType => {
	const [config, error] = loadConfig()

	if (error) {
		logger.error(
			{
				operation: 'assertConfig',
				error: error.message,
			},
			'Configuration validation failed',
		)
		// In production, we want to fail fast if configuration is invalid
		if (process.env.NODE_ENV === 'production') {
			process.exit(1)
		}
		// In non-production, throw the error to be handled by tests
		throw error
	}

	// Only log if explicitly requested
	if (shouldLog) {
		logger.info(
			{
				operation: 'assertConfig',
			},
			'Configuration loaded and validated successfully',
		)
	}

	return convertToConfigType(config)
}

/**
 * Check if we're in a production environment
 */
export const isProduction = (): boolean => {
	return process.env.NODE_ENV === 'production'
}

/**
 * Check if we're in a development environment
 */
export const isDevelopment = (): boolean => {
	return process.env.NODE_ENV === 'development'
}

/**
 * Check if we're in a test environment
 */
export const isTest = (): boolean => {
	return process.env.NODE_ENV === 'test'
}

/**
 * Check if we're in a preview environment (pr-*)
 */
export const isPreviewEnvironment = (): boolean => {
	return Boolean(process.env.APP_ENV?.startsWith('pr-'))
}

/**
 * Get environment metadata for debugging
 */
export const getEnvironmentInfo = () => {
	return {
		nodeEnv: process.env.NODE_ENV,
		appEnv: process.env.APP_ENV,
		isProduction: isProduction(),
		isDevelopment: isDevelopment(),
		isTest: isTest(),
		isPreview: isPreviewEnvironment(),
		hasParameterStorePrefix: Boolean(process.env.PARAMETER_STORE_PREFIX),
	}
}

/**
 * Get enhanced environment information using the new env-config system
 */
export const getEnhancedEnvironmentInfo = () => {
	return getEnvInfo()
}

/**
 * Get configuration precedence information for debugging
 */
export const getConfigurationPrecedence = (): string[] => {
	return getConfigPrecedence()
}
