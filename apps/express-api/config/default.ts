import { loadConfig } from '../src/utils/load-config.ts'
import { configureLogger } from '../src/utils/logger.ts'

const [env, configError] = loadConfig()

if (configError) {
	console.error('Failed to load configuration:', configError.message)
	process.exit(1)
}

// Configure logger with actual environment
configureLogger(env.NODE_ENV)

const config = {
	apiKey: env.API_KEY,
	nodeEnv: env.NODE_ENV,
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
	rateLimitWindowMs: env.RATE_LIMIT_WINDOW_MS,
	rateLimitMaxRequests: env.RATE_LIMIT_MAX_REQUESTS,
	authRateLimitWindowMs: env.AUTH_RATE_LIMIT_WINDOW_MS,
	authRateLimitMaxRequests: env.AUTH_RATE_LIMIT_MAX_REQUESTS,
	apiRateLimitWindowMs: env.API_RATE_LIMIT_WINDOW_MS,
	apiRateLimitMaxRequests: env.API_RATE_LIMIT_MAX_REQUESTS,
	redisUrl: env.REDIS_URL,
}

export { config }
