/**
 * Configuration Mapper
 * Single source of truth for mapping validated environment variables to application configuration
 */

import type { TEnv } from '../../utils/env.schema.ts'

import {
	type AppConfig,
	ConfigEnvironment,
	ConfigSource,
	type EnhancedAppConfig,
	type Result,
	validateAppConfig,
} from './config-types.ts'

/**
 * Map validated environment variables to application configuration
 * This is the ONLY place where environment variables are mapped to app config
 * Returns a Result tuple with validation using Zod schema
 */
export const mapToAppConfig = (env: TEnv): Result<AppConfig> => {
	const configData = {
		// Core application settings
		apiKey: env.API_KEY,
		nodeEnv: env.NODE_ENV,
		appEnv: env.APP_ENV,
		port: env.SERVER_PORT,

		// AWS Cognito configuration
		awsCognitoRegion: env.AWS_COGNITO_REGION,
		awsCognitoUserPoolId: env.AWS_COGNITO_USER_POOL_ID,
		awsCognitoUserPoolClientId: env.AWS_COGNITO_USER_POOL_CLIENT_ID,
		awsCognitoUserPoolSecretKey: env.AWS_COGNITO_USER_POOL_SECRET_KEY,
		awsCognitoAccessKey: env.AWS_COGNITO_ACCESS_KEY,
		awsCognitoSecretKey: env.AWS_COGNITO_SECRET_KEY,
		awsCognitoRefreshTokenExpiry: env.AWS_COGNITO_REFRESH_TOKEN_EXPIRY,

		// Security settings
		cookieDomain: env.COOKIE_DOMAIN,
		cookieEncryptionKey: env.COOKIE_ENCRYPTION_KEY,

		// Database configuration
		nonRelationalDatabaseUrl: env.NON_RELATIONAL_DATABASE_URL,
		relationalDatabaseUrl: env.RELATIONAL_DATABASE_URL,

		// External API keys
		openaiApiKey: env.OPENAI_API_KEY,

		// Rate limiting configuration
		rateLimitWindowMs: env.RATE_LIMIT_WINDOW_MS,
		rateLimitMaxRequests: env.RATE_LIMIT_MAX_REQUESTS,
		authRateLimitWindowMs: env.AUTH_RATE_LIMIT_WINDOW_MS,
		authRateLimitMaxRequests: env.AUTH_RATE_LIMIT_MAX_REQUESTS,
		apiRateLimitWindowMs: env.API_RATE_LIMIT_WINDOW_MS,
		apiRateLimitMaxRequests: env.API_RATE_LIMIT_MAX_REQUESTS,

		// Optional services
		redisUrl: env.REDIS_URL,
		corsAllowedOrigins: env.CORS_ALLOWED_ORIGINS,
	}

	// Validate the mapped configuration using Zod schema
	return validateAppConfig(configData)
}

/**
 * Create enhanced configuration with metadata
 * Used for debugging and monitoring purposes
 */
export const mapToEnhancedAppConfig = (
	env: TEnv,
	environment: ConfigEnvironment,
	sources: Record<string, ConfigSource> = {},
	validationResults?: {
		totalFields: number
		parameterStoreFields: number
		environmentFields: number
		defaultFields: number
	},
): Result<EnhancedAppConfig> => {
	const [appConfig, error] = mapToAppConfig(env)

	if (error) {
		return [null, error]
	}

	// Map sources to app config field names
	const configSources: Record<keyof AppConfig, ConfigSource> = {
		apiKey: sources.API_KEY ?? ConfigSource.ENVIRONMENT,
		nodeEnv: sources.NODE_ENV ?? ConfigSource.ENVIRONMENT,
		appEnv: sources.APP_ENV ?? ConfigSource.ENVIRONMENT,
		port: sources.SERVER_PORT ?? ConfigSource.ENVIRONMENT,
		awsCognitoRegion: sources.AWS_COGNITO_REGION ?? ConfigSource.ENVIRONMENT,
		awsCognitoUserPoolId:
			sources.AWS_COGNITO_USER_POOL_ID ?? ConfigSource.ENVIRONMENT,
		awsCognitoUserPoolClientId:
			sources.AWS_COGNITO_USER_POOL_CLIENT_ID ?? ConfigSource.ENVIRONMENT,
		awsCognitoUserPoolSecretKey:
			sources.AWS_COGNITO_USER_POOL_SECRET_KEY ?? ConfigSource.ENVIRONMENT,
		awsCognitoAccessKey:
			sources.AWS_COGNITO_ACCESS_KEY ?? ConfigSource.ENVIRONMENT,
		awsCognitoSecretKey:
			sources.AWS_COGNITO_SECRET_KEY ?? ConfigSource.ENVIRONMENT,
		awsCognitoRefreshTokenExpiry:
			sources.AWS_COGNITO_REFRESH_TOKEN_EXPIRY ?? ConfigSource.ENVIRONMENT,
		cookieDomain: sources.COOKIE_DOMAIN ?? ConfigSource.ENVIRONMENT,
		cookieEncryptionKey:
			sources.COOKIE_ENCRYPTION_KEY ?? ConfigSource.ENVIRONMENT,
		nonRelationalDatabaseUrl:
			sources.NON_RELATIONAL_DATABASE_URL ?? ConfigSource.ENVIRONMENT,
		relationalDatabaseUrl:
			sources.RELATIONAL_DATABASE_URL ?? ConfigSource.ENVIRONMENT,
		openaiApiKey: sources.OPENAI_API_KEY ?? ConfigSource.ENVIRONMENT,
		rateLimitWindowMs: sources.RATE_LIMIT_WINDOW_MS ?? ConfigSource.ENVIRONMENT,
		rateLimitMaxRequests:
			sources.RATE_LIMIT_MAX_REQUESTS ?? ConfigSource.ENVIRONMENT,
		authRateLimitWindowMs:
			sources.AUTH_RATE_LIMIT_WINDOW_MS ?? ConfigSource.ENVIRONMENT,
		authRateLimitMaxRequests:
			sources.AUTH_RATE_LIMIT_MAX_REQUESTS ?? ConfigSource.ENVIRONMENT,
		apiRateLimitWindowMs:
			sources.API_RATE_LIMIT_WINDOW_MS ?? ConfigSource.ENVIRONMENT,
		apiRateLimitMaxRequests:
			sources.API_RATE_LIMIT_MAX_REQUESTS ?? ConfigSource.ENVIRONMENT,
		redisUrl: sources.REDIS_URL ?? ConfigSource.ENVIRONMENT,
		corsAllowedOrigins:
			sources.CORS_ALLOWED_ORIGINS ?? ConfigSource.ENVIRONMENT,
	}

	const enhancedConfig: EnhancedAppConfig = {
		...appConfig,
		_metadata: {
			environment,
			sources: configSources,
			loadedAt: new Date(),
			validationResults,
		},
	}

	return [enhancedConfig, null]
}

/**
 * Get configuration field mapping for documentation and debugging
 * Returns the mapping between environment variable names and app config field names
 */
export const getConfigFieldMapping = (): Record<keyof AppConfig, string> => ({
	apiKey: 'API_KEY',
	nodeEnv: 'NODE_ENV',
	appEnv: 'APP_ENV',
	port: 'SERVER_PORT',
	awsCognitoRegion: 'AWS_COGNITO_REGION',
	awsCognitoUserPoolId: 'AWS_COGNITO_USER_POOL_ID',
	awsCognitoUserPoolClientId: 'AWS_COGNITO_USER_POOL_CLIENT_ID',
	awsCognitoUserPoolSecretKey: 'AWS_COGNITO_USER_POOL_SECRET_KEY',
	awsCognitoAccessKey: 'AWS_COGNITO_ACCESS_KEY',
	awsCognitoSecretKey: 'AWS_COGNITO_SECRET_KEY',
	awsCognitoRefreshTokenExpiry: 'AWS_COGNITO_REFRESH_TOKEN_EXPIRY',
	cookieDomain: 'COOKIE_DOMAIN',
	cookieEncryptionKey: 'COOKIE_ENCRYPTION_KEY',
	nonRelationalDatabaseUrl: 'NON_RELATIONAL_DATABASE_URL',
	relationalDatabaseUrl: 'RELATIONAL_DATABASE_URL',
	openaiApiKey: 'OPENAI_API_KEY',
	rateLimitWindowMs: 'RATE_LIMIT_WINDOW_MS',
	rateLimitMaxRequests: 'RATE_LIMIT_MAX_REQUESTS',
	authRateLimitWindowMs: 'AUTH_RATE_LIMIT_WINDOW_MS',
	authRateLimitMaxRequests: 'AUTH_RATE_LIMIT_MAX_REQUESTS',
	apiRateLimitWindowMs: 'API_RATE_LIMIT_WINDOW_MS',
	apiRateLimitMaxRequests: 'API_RATE_LIMIT_MAX_REQUESTS',
	redisUrl: 'REDIS_URL',
	corsAllowedOrigins: 'CORS_ALLOWED_ORIGINS',
})

/**
 * Validate that all required configuration fields are present
 * Used for debugging configuration issues
 */
export const validateConfigMapping = (
	config: AppConfig,
): {
	isValid: boolean
	missingFields: string[]
	invalidFields: string[]
} => {
	const missingFields: string[] = []
	const invalidFields: string[] = []

	// Check required string fields
	const requiredStringFields: (keyof AppConfig)[] = [
		'apiKey',
		'nodeEnv',
		'appEnv',
		'awsCognitoRegion',
		'awsCognitoUserPoolId',
		'awsCognitoUserPoolClientId',
		'awsCognitoUserPoolSecretKey',
		'awsCognitoAccessKey',
		'awsCognitoSecretKey',
		'cookieDomain',
		'cookieEncryptionKey',
		'nonRelationalDatabaseUrl',
		'relationalDatabaseUrl',
		'openaiApiKey',
	]

	for (const field of requiredStringFields) {
		const value = config[field]
		if (!value || typeof value !== 'string' || value.trim().length === 0) {
			missingFields.push(field)
		}
	}

	// Check required number fields
	const requiredNumberFields: (keyof AppConfig)[] = [
		'port',
		'awsCognitoRefreshTokenExpiry',
		'rateLimitWindowMs',
		'rateLimitMaxRequests',
		'authRateLimitWindowMs',
		'authRateLimitMaxRequests',
		'apiRateLimitWindowMs',
		'apiRateLimitMaxRequests',
	]

	for (const field of requiredNumberFields) {
		const value = config[field]
		if (typeof value !== 'number' || isNaN(value) || value <= 0) {
			invalidFields.push(field)
		}
	}

	return {
		isValid: missingFields.length === 0 && invalidFields.length === 0,
		missingFields,
		invalidFields,
	}
}
