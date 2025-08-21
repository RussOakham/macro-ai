/**
 * Simplified Configuration System
 * Reads configuration from process.env with conditional dotenv loading and Zod validation
 *
 * This replaces the complex Parameter Store integration with a simple approach:
 * - Local dev: Uses .env files (dotenv loads only in non-production)
 * - EC2: Environment variables are pre-populated by infrastructure scripts
 * - All environments: Robust Zod validation of process.env
 */

import { config as dotenvConfig } from 'dotenv'
import { resolve } from 'path'
import { fromError } from 'zod-validation-error'

import { envSchema, type TEnv } from '../utils/env.schema.ts'
import { AppError, type Result } from '../utils/errors.ts'
import { pino } from '../utils/logger.ts'

const { logger } = pino

/**
 * Configuration loading options
 */
interface ConfigOptions {
	/** Whether to validate the schema (default: true) */
	validateSchema?: boolean
	/** Whether to log configuration details (default: true) */
	enableLogging?: boolean
	/** Custom .env file path (default: .env in project root) */
	envFilePath?: string
}

/**
 * Load configuration from environment variables with optional .env file loading
 *
 * @param options Configuration loading options
 * @returns Result tuple with configuration or error
 */
export const loadConfig = (options: ConfigOptions = {}): Result<TEnv> => {
	const {
		validateSchema = true,
		enableLogging = true,
		envFilePath = resolve(process.cwd(), '.env'),
	} = options

	try {
		// Only load .env file in non-production environments
		// In production (EC2), environment variables are set by infrastructure
		if (process.env.NODE_ENV !== 'production') {
			const dotenvResult = dotenvConfig({
				path: envFilePath,
				encoding: 'UTF-8',
			})

			if (dotenvResult.error) {
				// .env file not found is OK in some environments
				if (enableLogging) {
					logger.debug(
						{
							operation: 'loadConfig',
							envFilePath,
							error: dotenvResult.error.message,
						},
						'.env file not found or could not be parsed (this may be expected)',
					)
				}
			} else if (enableLogging) {
				logger.info(
					{
						operation: 'loadConfig',
						envFilePath,
						loadedVars: Object.keys(dotenvResult.parsed ?? {}).length,
					},
					'Loaded configuration from .env file',
				)
			}
		} else if (enableLogging) {
			logger.info(
				{
					operation: 'loadConfig',
					nodeEnv: process.env.NODE_ENV,
				},
				'Production environment detected - using pre-set environment variables',
			)
		}

		// Validate environment variables using Zod schema
		if (validateSchema) {
			const validationResult = envSchema.safeParse(process.env)

			if (!validationResult.success) {
				const validationError = fromError(validationResult.error)
				const appError = AppError.validation(
					`Invalid environment configuration: ${validationError.message}`,
					{
						zodError: validationResult.error,
						validationDetails: validationError.details,
					},
				)
				return [null, appError]
			}

			if (enableLogging) {
				logger.info(
					{
						operation: 'loadConfig',
						nodeEnv: validationResult.data.NODE_ENV,
						appEnv: validationResult.data.APP_ENV,
						port: validationResult.data.SERVER_PORT,
						validatedFields: Object.keys(validationResult.data).length,
					},
					'Configuration validation successful',
				)
			}

			return [validationResult.data, null]
		}

		// If validation is disabled, cast process.env to TEnv
		// This is not recommended but may be useful for testing
		if (enableLogging) {
			logger.warn(
				{
					operation: 'loadConfig',
					validateSchema: false,
				},
				'Schema validation disabled - configuration may be invalid',
			)
		}

		return [process.env as unknown as TEnv, null]
	} catch (error) {
		const appError = AppError.internal(
			`Failed to load configuration: ${error instanceof Error ? error.message : 'Unknown error'}`,
			'config',
		)
		return [null, appError]
	}
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

export const assertConfig = (): ConfigType => {
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

	logger.info(
		{
			operation: 'assertConfig',
		},
		'Configuration loaded and validated successfully',
	)
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
