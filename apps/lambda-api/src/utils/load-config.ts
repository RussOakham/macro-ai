/**
 * Configuration loader for Lambda API
 * Validates environment variables and provides type-safe configuration
 */

import { config } from 'dotenv'
import { resolve } from 'path'
import { fromZodError } from 'zod-validation-error'

import { envSchema, TEnv } from './env.schema.js'
import { AppError, Result } from './errors.js'

/**
 * Loads and validates environment configuration
 * Uses dotenv for local development and validates all environment variables
 * @returns Result tuple with validated config or error
 */
const loadConfig = (): Result<TEnv> => {
	// In Lambda environment, we don't need to load .env files
	// Environment variables are set by AWS Lambda runtime
	const isLambdaEnvironment = !!(
		(process.env.AWS_LAMBDA_FUNCTION_NAME ?? '') ||
		(process.env.AWS_LAMBDA_RUNTIME_API ?? '') ||
		(process.env.LAMBDA_RUNTIME_DIR ?? '')
	)

	// Only load .env file in non-Lambda environments (local development/testing)
	if (!isLambdaEnvironment) {
		const envPath = resolve(process.cwd(), '.env')

		const enableDebug =
			process.env.NODE_ENV !== 'production' && process.env.NODE_ENV !== 'test'

		// Load environment variables from .env file
		const result = config({
			path: envPath,
			encoding: 'UTF-8',
			debug: enableDebug,
		})

		if (result.error) {
			const appError = AppError.configuration(
				`Cannot parse .env file '${envPath}': ${result.error.message}`,
				{ envPath, error: result.error },
				'configLoader',
			)
			return [null, appError]
		}

		console.log(`📁 Loaded environment variables from ${envPath}`)
	} else {
		console.log(
			'☁️ Running in Lambda environment - using AWS environment variables',
		)
	}

	// Validate environment variables against schema
	const env = envSchema.safeParse(process.env)

	if (!env.success) {
		const validationError = fromZodError(env.error)
		const appError = AppError.validation(
			`Invalid environment configuration: ${validationError.message}`,
			{ errors: validationError.details },
			'configLoader',
		)
		return [null, appError]
	}

	// Log successful configuration load (without sensitive data)
	const configSummary = {
		nodeEnv: env.data.NODE_ENV,
		awsRegion: env.data.AWS_REGION,
		lambdaFunctionName: env.data.AWS_LAMBDA_FUNCTION_NAME,
		logLevel: env.data.LOG_LEVEL,
		isLambdaEnvironment,
	}

	console.log(
		'✅ Environment configuration validated successfully:',
		configSummary,
	)

	return [env.data, null]
}

// Export the function instead of the loaded config
export { loadConfig }
