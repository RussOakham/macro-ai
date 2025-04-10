import { config } from 'dotenv'
import { resolve } from 'path'

config({
	path: resolve(process.cwd(), '.env'),
	encoding: 'UTF-8',
	debug: true, // This will help us see what's happening with dotenv
})

export default {
	nodeEnv: process.env.NODE_ENV ?? 'development',
	port: process.env.SERVER_PORT ?? 3040,
	awsCognitoRegion: process.env.AWS_COGNITO_REGION ?? '',
	awsCognitoUserPoolId: process.env.AWS_COGNITO_USER_POOL_ID ?? '',
	awsCognitoUserPoolClientId: process.env.AWS_COGNITO_USER_POOL_CLIENT_ID ?? '',
	awsCognitoUserPoolSecretKey:
		process.env.AWS_COGNITO_USER_POOL_SECRET_KEY ?? '',
	awsCognitoAccessKey: process.env.AWS_COGNITO_ACCESS_KEY ?? '',
	awsCognitoSecretKey: process.env.AWS_COGNITO_SECRET_KEY ?? '',
	cookieDomain: process.env.COOKIE_DOMAIN ?? `localhost`,
}
