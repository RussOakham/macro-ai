import { config } from 'dotenv'
import { resolve } from 'path'
import { fromError } from 'zod-validation-error'

import { envSchema, TEnv } from './env.schema.ts'
import { AppError, Result } from './errors.ts'
import { pino } from './logger.ts'

const { logger } = pino

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
		return [null, appError]
	}

	if (isLambdaEnvironment) {
		logger.info('Loaded configuration from Lambda environment variables')
	} else {
		logger.info(`Loaded configuration from ${envPath}`)
	}

	return [env.data, null]
}

// Export the function instead of the loaded config
export { loadConfig }
