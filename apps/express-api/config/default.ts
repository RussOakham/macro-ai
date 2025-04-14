import { loadConfig } from '../src/utils/load-config.ts'
import { configureLogger } from '../src/utils/logger.ts'

const env = loadConfig()

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
}

export { config }
