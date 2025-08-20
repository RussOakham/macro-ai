import type { TEnv } from '../src/utils/env.schema.ts'
import type { AppError } from '../src/utils/errors.ts'
import {
	type EnhancedConfig,
	loadConfig,
	loadRuntimeConfig,
} from '../src/utils/load-config.ts'
import { configureLogger } from '../src/utils/logger.ts'

/**
 * Async configuration loader that handles both runtime and build-time environments
 */
export const loadAppConfig = async () => {
	// Determine if we're in a runtime environment that needs Parameter Store
	const isRuntimeEnvironment =
		Boolean(process.env.PARAMETER_STORE_PREFIX) ||
		Boolean(process.env.APP_ENV?.startsWith('pr-'))

	let env: TEnv | EnhancedConfig | null
	let configError: AppError | null

	if (isRuntimeEnvironment) {
		// Use async configuration loading for runtime environments (EC2, preview)
		const [runtimeEnv, runtimeError] = await loadRuntimeConfig()
		env = runtimeEnv
		configError = runtimeError
	} else {
		// Use synchronous configuration loading for build-time environments
		const [syncEnv, syncError] = loadConfig()
		env = syncEnv
		configError = syncError
	}

	if (configError || !env) {
		console.error(
			'Failed to load configuration:',
			configError?.message ?? 'Unknown error',
		)
		process.exit(1)
	}

	// Configure logger with actual environment
	configureLogger(env.NODE_ENV)

	return {
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
		cookieDomain: env.COOKIE_DOMAIN,
		cookieEncryptionKey: env.COOKIE_ENCRYPTION_KEY,
		nonRelationalDatabaseUrl: env.NON_RELATIONAL_DATABASE_URL,
		relationalDatabaseUrl: env.RELATIONAL_DATABASE_URL,
		openaiApiKey: env.OPENAI_API_KEY,
		rateLimitWindowMs: env.RATE_LIMIT_WINDOW_MS,
		rateLimitMaxRequests: env.RATE_LIMIT_MAX_REQUESTS,
		authRateLimitWindowMs: env.AUTH_RATE_LIMIT_WINDOW_MS,
		authRateLimitMaxRequests: env.AUTH_RATE_LIMIT_MAX_REQUESTS,
		apiRateLimitWindowMs: env.API_RATE_LIMIT_WINDOW_MS,
		apiRateLimitMaxRequests: env.API_RATE_LIMIT_MAX_REQUESTS,
		redisUrl: env.REDIS_URL,
	}
}

// For backward compatibility with synchronous imports (build-time only)
// This will only be used for build processes, not runtime
const [buildEnv, buildConfigError] = loadConfig()

if (buildConfigError) {
	console.error('Failed to load build configuration:', buildConfigError.message)
	process.exit(1)
}

// Configure logger with actual environment
configureLogger(buildEnv.NODE_ENV)

const config = {
	apiKey: buildEnv.API_KEY,
	nodeEnv: buildEnv.NODE_ENV,
	appEnv: buildEnv.APP_ENV,
	port: buildEnv.SERVER_PORT,
	awsCognitoRegion: buildEnv.AWS_COGNITO_REGION,
	awsCognitoUserPoolId: buildEnv.AWS_COGNITO_USER_POOL_ID,
	awsCognitoUserPoolClientId: buildEnv.AWS_COGNITO_USER_POOL_CLIENT_ID,
	awsCognitoUserPoolSecretKey: buildEnv.AWS_COGNITO_USER_POOL_SECRET_KEY,
	awsCognitoAccessKey: buildEnv.AWS_COGNITO_ACCESS_KEY,
	awsCognitoSecretKey: buildEnv.AWS_COGNITO_SECRET_KEY,
	awsCognitoRefreshTokenExpiry: buildEnv.AWS_COGNITO_REFRESH_TOKEN_EXPIRY,
	cookieDomain: buildEnv.COOKIE_DOMAIN,
	cookieEncryptionKey: buildEnv.COOKIE_ENCRYPTION_KEY,
	nonRelationalDatabaseUrl: buildEnv.NON_RELATIONAL_DATABASE_URL,
	relationalDatabaseUrl: buildEnv.RELATIONAL_DATABASE_URL,
	openaiApiKey: buildEnv.OPENAI_API_KEY,
	rateLimitWindowMs: buildEnv.RATE_LIMIT_WINDOW_MS,
	rateLimitMaxRequests: buildEnv.RATE_LIMIT_MAX_REQUESTS,
	authRateLimitWindowMs: buildEnv.AUTH_RATE_LIMIT_WINDOW_MS,
	authRateLimitMaxRequests: buildEnv.AUTH_RATE_LIMIT_MAX_REQUESTS,
	apiRateLimitWindowMs: buildEnv.API_RATE_LIMIT_WINDOW_MS,
	apiRateLimitMaxRequests: buildEnv.API_RATE_LIMIT_MAX_REQUESTS,
	redisUrl: buildEnv.REDIS_URL,
}

export { config }
