/**
 * Simplified Configuration Export
 * Replaces complex Parameter Store integration with simple environment variable loading
 *
 * This file maintains backward compatibility while using the new simplified configuration system.
 * All configuration now comes from process.env with optional .env file loading for development.
 */

import type { TEnv } from '../src/utils/env.schema.ts'
import {
	loadAppConfig as loadAppConfigNew,
	loadAppConfigSync as loadAppConfigSyncNew,
	getAppConfig as getAppConfigNew,
	getModuleConfig,
	getModuleConfigError,
	isModuleConfigAvailable,
	type AppConfig,
} from '../src/config/config.ts'

/**
 * Async configuration loader (maintains backward compatibility)
 */
export const loadAppConfig = loadAppConfigNew

/**
 * Synchronous configuration loader (maintains backward compatibility)
 */
export const loadAppConfigSync = loadAppConfigSyncNew

/**
 * Get configuration for immediate use (maintains backward compatibility)
 */
export const getAppConfig = getAppConfigNew

/**
 * Get the module-level configuration
 * This replaces the complex build-time vs runtime detection with simple module-level loading
 */
const moduleConfig = getModuleConfig()
const moduleConfigError = getModuleConfigError()

// Handle configuration loading errors at module level
if (moduleConfigError && !moduleConfig) {
	console.error('Failed to load configuration:', moduleConfigError.message)
	// Don't exit in test environments to allow test mocking
	if (process.env.NODE_ENV !== 'test') {
		process.exit(1)
	}
}

/**
 * Configuration object for backward compatibility
 * Maps TEnv properties to the expected config structure
 */
export const config = moduleConfig
	? {
			apiKey: moduleConfig.API_KEY,
			nodeEnv: moduleConfig.NODE_ENV,
			appEnv: moduleConfig.APP_ENV,
			port: moduleConfig.SERVER_PORT,
			awsCognitoRegion: moduleConfig.AWS_COGNITO_REGION,
			awsCognitoUserPoolId: moduleConfig.AWS_COGNITO_USER_POOL_ID,
			awsCognitoUserPoolClientId: moduleConfig.AWS_COGNITO_USER_POOL_CLIENT_ID,
			awsCognitoUserPoolSecretKey:
				moduleConfig.AWS_COGNITO_USER_POOL_SECRET_KEY,
			awsCognitoAccessKey: moduleConfig.AWS_COGNITO_ACCESS_KEY,
			awsCognitoSecretKey: moduleConfig.AWS_COGNITO_SECRET_KEY,
			awsCognitoRefreshTokenExpiry:
				moduleConfig.AWS_COGNITO_REFRESH_TOKEN_EXPIRY,
			cookieDomain: moduleConfig.COOKIE_DOMAIN,
			cookieEncryptionKey: moduleConfig.COOKIE_ENCRYPTION_KEY,
			nonRelationalDatabaseUrl: moduleConfig.NON_RELATIONAL_DATABASE_URL,
			relationalDatabaseUrl: moduleConfig.RELATIONAL_DATABASE_URL,
			openaiApiKey: moduleConfig.OPENAI_API_KEY,
			rateLimitWindowMs: moduleConfig.RATE_LIMIT_WINDOW_MS,
			rateLimitMaxRequests: moduleConfig.RATE_LIMIT_MAX_REQUESTS,
			authRateLimitWindowMs: moduleConfig.AUTH_RATE_LIMIT_WINDOW_MS,
			authRateLimitMaxRequests: moduleConfig.AUTH_RATE_LIMIT_MAX_REQUESTS,
			apiRateLimitWindowMs: moduleConfig.API_RATE_LIMIT_WINDOW_MS,
			apiRateLimitMaxRequests: moduleConfig.API_RATE_LIMIT_MAX_REQUESTS,
			redisUrl: moduleConfig.REDIS_URL,
		}
	: null

/**
 * Type guard to check if config is available
 */
export const isConfigAvailable = (
	configToCheck: typeof config,
): configToCheck is NonNullable<typeof config> => {
	return configToCheck !== null
}

/**
 * Get config with runtime assertion
 * Throws an error if config is not available
 */
export const getConfig = () => {
	if (!isConfigAvailable(config)) {
		throw new Error(
			'Configuration not available. Check environment variables and .env file.',
		)
	}
	return config
}

/**
 * Assert that config is available and return it
 * This is a convenience function for files that need guaranteed config access
 */
export const assertConfig = () => {
	if (!config) {
		throw new Error(
			'Configuration not available. Check environment variables and .env file.',
		)
	}
	return config
}

// Re-export types for backward compatibility
export type { AppConfig, TEnv }
