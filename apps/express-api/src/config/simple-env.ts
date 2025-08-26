/**
 * Simplified Environment Configuration
 *
 * This replaces the complex configuration system with a simple, predictable approach:
 * - Uses the existing load-config.ts and env.schema.ts
 * - NODE_ENV is automatically inferred from the environment
 * - Simple environment variable access
 * - No complex loading logic or Parameter Store integration
 * - Easy to test and reason about
 */

import { config } from '../utils/load-config.ts'

/**
 * Get environment-specific configuration
 */
export const getEnvConfig = () => {
	return {
		nodeEnv: config.NODE_ENV,
		appEnv: config.APP_ENV,
		isDevelopment: config.NODE_ENV === 'development',
		isTest: config.NODE_ENV === 'test',
		isProduction: config.NODE_ENV === 'production',

		// Environment variables from the validated config
		serverPort: config.SERVER_PORT.toString(),
		apiKey: config.API_KEY,
		awsCognitoRegion: config.AWS_COGNITO_REGION,
		awsCognitoUserPoolId: config.AWS_COGNITO_USER_POOL_ID,
		awsCognitoUserPoolClientId: config.AWS_COGNITO_USER_POOL_CLIENT_ID,
		awsCognitoUserPoolSecretKey: config.AWS_COGNITO_USER_POOL_SECRET_KEY,
		// Remove AWS credentials - now using IAM roles
		// awsCognitoAccessKey: config.AWS_COGNITO_ACCESS_KEY,
		// awsCognitoSecretKey: config.AWS_COGNITO_SECRET_KEY,
		awsCognitoRefreshTokenExpiry:
			config.AWS_COGNITO_REFRESH_TOKEN_EXPIRY.toString(),
		cookieDomain: config.COOKIE_DOMAIN,
		cookieEncryptionKey: config.COOKIE_ENCRYPTION_KEY,
		nonRelationalDatabaseUrl: config.NON_RELATIONAL_DATABASE_URL,
		relationalDatabaseUrl: config.RELATIONAL_DATABASE_URL,
		openaiApiKey: config.OPENAI_API_KEY,
		rateLimitWindowMs: config.RATE_LIMIT_WINDOW_MS.toString(),
		rateLimitMaxRequests: config.RATE_LIMIT_MAX_REQUESTS.toString(),
		authRateLimitWindowMs: config.AUTH_RATE_LIMIT_WINDOW_MS.toString(),
		authRateLimitMaxRequests: config.AUTH_RATE_LIMIT_MAX_REQUESTS.toString(),
		apiRateLimitWindowMs: config.API_RATE_LIMIT_WINDOW_MS.toString(),
		apiRateLimitMaxRequests: config.API_RATE_LIMIT_MAX_REQUESTS.toString(),
		redisUrl: config.REDIS_URL ?? 'redis://localhost:6379',
	}
}

/**
 * Get configuration with validation (for production use)
 */
export const getValidatedConfig = () => {
	// The config is already validated by load-config.ts
	return getEnvConfig()
}

// Re-export the main config for convenience
export type { Config } from '../utils/load-config.ts'
export { config } from '../utils/load-config.ts'
