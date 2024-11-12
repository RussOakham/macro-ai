import { config } from 'dotenv'
import { resolve } from 'path'

config({
	path: resolve(process.cwd(), '.env'),
	debug: true, // This will help us see what's happening with dotenv
})

export default {
	port: process.env.SERVER_PORT ?? 3040,
	awsCognitoUserPoolId: process.env.AWS_COGNITO_USER_POOL_ID ?? '',
	awsCognitoUserPoolClientId: process.env.AWS_COGNITO_USER_POOL_CLIENT_ID ?? '',
	awsCognitoUserPoolSecretKey:
		process.env.AWS_COGNITO_USER_POOL_SECRET_KEY ?? '',
}
