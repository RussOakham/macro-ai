import { config } from 'dotenv'
import { resolve } from 'path'
import { fromError } from 'zod-validation-error'

import { envSchema, TEnv } from './env.schema.ts'
import { AppError, Result } from './errors.ts'
import { pino } from './logger.ts'

const { logger } = pino

const loadConfig = (): Result<TEnv> => {
	const envPath = resolve(process.cwd(), '.env')
	const isTruthy = (v?: string) => /^(?:1|true|yes)$/i.test(v ?? '')
	const isLambdaEnvironment = Boolean(process.env.AWS_LAMBDA_FUNCTION_NAME)
	const isServerlessEnv =
		Boolean(process.env.AWS_LAMBDA_FUNCTION_NAME) ||
		Boolean(process.env.AWS_EXECUTION_ENV) ||
		Boolean(process.env.LAMBDA_TASK_ROOT)
	const isCiEnvironment =
		isTruthy(process.env.CI) ||
		isTruthy(process.env.GITHUB_ACTIONS) ||
		isTruthy(process.env.GITLAB_CI) ||
		isTruthy(process.env.CIRCLECI) ||
		Boolean(process.env.JENKINS_URL) ||
		isTruthy(process.env.BUILDKITE)

	const enableDebug =
		process.env.NODE_ENV !== 'production' && process.env.NODE_ENV !== 'test'

	// Only load .env file if not in serverless or CI environment
	if (!isServerlessEnv && !isCiEnvironment) {
		// Load environment variables from .env file
		const result = config({
			path: envPath,
			encoding: 'UTF-8',
			debug: enableDebug,
		})

		if (result.error) {
			const appError = AppError.validation(
				`Cannot parse .env file '${envPath}': ${result.error.message}`,
				{ envPath, error: result.error },
				'configLoader',
			)
			return [null, appError]
		}
	}

	// Validate environment variables
	const env = envSchema.safeParse(process.env)

	if (!env.success) {
		const validationError = fromError(env.error)
		const appError = AppError.validation(
			`Invalid environment configuration in '${envPath}': ${validationError.message}`,
			{ envPath, errors: validationError.details },
			'configLoader',
		)

		// In Lambda environment, don't fail immediately - let Parameter Store populate values first
		if (isLambdaEnvironment) {
			logger.warn(
				{
					operation: 'configValidationWarning',
					error: validationError.message,
				},
				'Configuration validation failed in Lambda environment, Parameter Store will populate missing values',
			)
			// Return a minimal config that won't crash the app
			return [
				{
					API_KEY: process.env.API_KEY ?? '',
					NODE_ENV: (process.env.NODE_ENV ?? 'production') as
						| 'production'
						| 'development'
						| 'test',
					APP_ENV: (process.env.APP_ENV ?? 'development') as
						| 'production'
						| 'staging'
						| 'development'
						| 'test',
					SERVER_PORT: Number(process.env.SERVER_PORT) || 3040,
					AWS_COGNITO_REGION: process.env.AWS_COGNITO_REGION ?? 'us-east-1',
					AWS_COGNITO_USER_POOL_ID: process.env.AWS_COGNITO_USER_POOL_ID ?? '',
					AWS_COGNITO_USER_POOL_CLIENT_ID:
						process.env.AWS_COGNITO_USER_POOL_CLIENT_ID ?? '',
					AWS_COGNITO_USER_POOL_SECRET_KEY:
						process.env.AWS_COGNITO_USER_POOL_SECRET_KEY ?? '',
					AWS_COGNITO_ACCESS_KEY: process.env.AWS_COGNITO_ACCESS_KEY ?? '',
					AWS_COGNITO_SECRET_KEY: process.env.AWS_COGNITO_SECRET_KEY ?? '',
					AWS_COGNITO_REFRESH_TOKEN_EXPIRY:
						Number(process.env.AWS_COGNITO_REFRESH_TOKEN_EXPIRY) || 30,
					COOKIE_DOMAIN: process.env.COOKIE_DOMAIN ?? 'localhost',
					COOKIE_ENCRYPTION_KEY: process.env.COOKIE_ENCRYPTION_KEY ?? '',
					NON_RELATIONAL_DATABASE_URL:
						process.env.NON_RELATIONAL_DATABASE_URL ?? '',
					RELATIONAL_DATABASE_URL: process.env.RELATIONAL_DATABASE_URL ?? '',
					OPENAI_API_KEY: process.env.OPENAI_API_KEY ?? '',
					RATE_LIMIT_WINDOW_MS:
						Number(process.env.RATE_LIMIT_WINDOW_MS) || 900000,
					RATE_LIMIT_MAX_REQUESTS:
						Number(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
					AUTH_RATE_LIMIT_WINDOW_MS:
						Number(process.env.AUTH_RATE_LIMIT_WINDOW_MS) || 3600000,
					AUTH_RATE_LIMIT_MAX_REQUESTS:
						Number(process.env.AUTH_RATE_LIMIT_MAX_REQUESTS) || 10,
					API_RATE_LIMIT_WINDOW_MS:
						Number(process.env.API_RATE_LIMIT_WINDOW_MS) || 60000,
					API_RATE_LIMIT_MAX_REQUESTS:
						Number(process.env.API_RATE_LIMIT_MAX_REQUESTS) || 60,
					REDIS_URL: process.env.REDIS_URL,
				},
				null,
			]
		}

		return [null, appError]
	}

	if (isServerlessEnv) {
		logger.info('Loaded configuration from serverless environment variables')
	} else if (isCiEnvironment) {
		logger.info('Loaded configuration from CI environment variables')
	} else {
		logger.info(`Loaded configuration from ${envPath}`)
	}

	return [env.data, null]
}

// Export the function instead of the loaded config
export { loadConfig }
