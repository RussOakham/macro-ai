import { z } from 'zod'

const envSchema = z.object({
	// API
	API_KEY: z
		.string({
			required_error: 'API key is required',
		})
		.min(32, 'API key must be at least 32 characters'),
	NODE_ENV: z
		.enum(['development', 'production', 'test'])
		.default('development'),
	SERVER_PORT: z.coerce.number().default(3040),

	// AWS Cognito
	AWS_COGNITO_REGION: z.string().min(1, 'AWS Cognito region is required'),
	AWS_COGNITO_USER_POOL_ID: z
		.string()
		.min(1, 'AWS Cognito user pool ID is required'),
	AWS_COGNITO_USER_POOL_CLIENT_ID: z
		.string()
		.min(1, 'AWS Cognito user pool client ID is required'),
	AWS_COGNITO_USER_POOL_SECRET_KEY: z
		.string()
		.min(1, 'AWS Cognito user pool secret key is required'),
	AWS_COGNITO_ACCESS_KEY: z
		.string()
		.min(1, 'AWS Cognito access key is required'),
	AWS_COGNITO_SECRET_KEY: z
		.string()
		.min(1, 'AWS Cognito secret key is required'),
	AWS_COGNITO_REFRESH_TOKEN_EXPIRY: z.coerce.number().default(30),

	// Cookie Settings
	COOKIE_DOMAIN: z.string().default('localhost'),
	COOKIE_ENCRYPTION_KEY: z
		.string({
			required_error: 'Cookie encryption key is required',
		})
		.min(32, 'Cookie encryption key must be at least 32 characters'),

	// Database
	NON_RELATIONAL_DATABASE_URL: z
		.string()
		.min(1, 'Non-relational database URL is required'),
	RELATIONAL_DATABASE_URL: z
		.string()
		.min(1, 'Relational database URL is required'),

	// OpenAI
	OPENAI_API_KEY: z
		.string()
		.min(1, 'OpenAI API key is required')
		.startsWith('sk-', 'OpenAI API key must start with sk-'),

	// Rate Limiting
	RATE_LIMIT_WINDOW_MS: z.coerce.number().default(900000), // 15 minutes
	RATE_LIMIT_MAX_REQUESTS: z.coerce.number().default(100),
	AUTH_RATE_LIMIT_WINDOW_MS: z.coerce.number().default(3600000), // 1 hour
	AUTH_RATE_LIMIT_MAX_REQUESTS: z.coerce.number().default(10),
	API_RATE_LIMIT_WINDOW_MS: z.coerce.number().default(60000), // 1 minute
	API_RATE_LIMIT_MAX_REQUESTS: z.coerce.number().default(60),
	REDIS_URL: z.string().optional(),
})

type TEnv = z.infer<typeof envSchema>

export { envSchema }
export type { TEnv }
