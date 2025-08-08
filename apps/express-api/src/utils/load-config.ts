import { config } from 'dotenv'
import { resolve } from 'path'
import { fromError } from 'zod-validation-error'

import { envSchema, TEnv } from './env.schema.ts'
import { AppError, Result } from './errors.ts'
import { pino } from './logger.ts'

const { logger } = pino

/**
 * Create minimal configuration for Lambda startup
 * Contains only the absolutely required keys to prevent crashes
 * Parameter Store will populate the rest, then we'll re-validate
 */
const createMinimalLambdaConfig = (): TEnv => {
	// Use envSchema defaults where available, minimal fallbacks otherwise
	const minimalEnv = {
		// Required for basic app startup
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

		// AWS region for Parameter Store access
		AWS_COGNITO_REGION: process.env.AWS_COGNITO_REGION ?? 'us-east-1',

		// Placeholder values - Parameter Store will populate these
		API_KEY: process.env.API_KEY ?? 'placeholder-will-be-populated',
		AWS_COGNITO_USER_POOL_ID:
			process.env.AWS_COGNITO_USER_POOL_ID ?? 'placeholder',
		AWS_COGNITO_USER_POOL_CLIENT_ID:
			process.env.AWS_COGNITO_USER_POOL_CLIENT_ID ?? 'placeholder',
		AWS_COGNITO_USER_POOL_SECRET_KEY:
			process.env.AWS_COGNITO_USER_POOL_SECRET_KEY ?? 'placeholder',
		AWS_COGNITO_ACCESS_KEY: process.env.AWS_COGNITO_ACCESS_KEY ?? 'placeholder',
		AWS_COGNITO_SECRET_KEY: process.env.AWS_COGNITO_SECRET_KEY ?? 'placeholder',
		COOKIE_ENCRYPTION_KEY:
			process.env.COOKIE_ENCRYPTION_KEY ??
			'placeholder-32-chars-minimum-length',
		NON_RELATIONAL_DATABASE_URL:
			process.env.NON_RELATIONAL_DATABASE_URL ?? 'placeholder',
		RELATIONAL_DATABASE_URL:
			process.env.RELATIONAL_DATABASE_URL ?? 'placeholder',
		OPENAI_API_KEY: process.env.OPENAI_API_KEY ?? 'sk-placeholder',
	}

	// Parse through schema to get defaults for remaining fields
	const schemaDefaults = envSchema.parse(minimalEnv)
	return schemaDefaults
}

/**
 * Re-validate configuration after Parameter Store has populated environment variables
 * This ensures all required values are present and correctly typed
 */
const validateConfigAfterParameterStore = (): Result<TEnv> => {
	const env = envSchema.safeParse(process.env)

	if (!env.success) {
		const validationError = fromError(env.error)
		const appError = AppError.validation(
			`Configuration validation failed after Parameter Store loading: ${validationError.message}`,
			{ errors: validationError.details },
			'configLoader',
		)
		return [null, appError]
	}

	return [env.data, null]
}

const loadConfig = (): Result<TEnv> => {
	const envPath = resolve(process.cwd(), '.env')
	const isLambdaEnvironment = Boolean(process.env.AWS_LAMBDA_FUNCTION_NAME)

	const enableDebug =
		process.env.NODE_ENV !== 'production' && process.env.NODE_ENV !== 'test'

	// Only load .env file if not in Lambda environment
	if (!isLambdaEnvironment) {
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
				'Configuration validation failed in Lambda environment, Parameter Store will populate missing values',
				{
					operation: 'configValidationWarning',
					error: validationError.message,
				},
			)
			// Return a minimal config with only absolutely required keys for Lambda startup
			// Parameter Store will populate the rest, then we'll re-validate
			return [createMinimalLambdaConfig(), null]
		}

		return [null, appError]
	}

	if (isLambdaEnvironment) {
		logger.info('Loaded configuration from Lambda environment variables')
	} else {
		logger.info(`Loaded configuration from ${envPath}`)
	}

	return [env.data, null]
}

// Export the functions
export { loadConfig, validateConfigAfterParameterStore }
