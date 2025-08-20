import { config } from 'dotenv'
import { resolve } from 'path'
import { fromError } from 'zod-validation-error'

import { envSchema, TEnv } from './env.schema.ts'
import { AppError, Result } from './errors.ts'
import { pino } from './logger.ts'

const { logger } = pino

/**
 * Load configuration based on environment context:
 * - Local development: Load from .env file with full validation
 * - CI build-time: Use pre-loaded build env vars, skip validation for missing runtime secrets
 * - EC2 Runtime: Use environment variables from Parameter Store with full validation
 */
const loadConfig = (): Result<TEnv> => {
	const isTruthy = (v?: string) => /^(?:1|true|yes)$/i.test(v ?? '')
	const isEc2Environment = Boolean(process.env.PARAMETER_STORE_PREFIX)
	const isRuntimeEnvironment = isEc2Environment
	const isCiEnvironment =
		isTruthy(process.env.CI) ||
		isTruthy(process.env.GITHUB_ACTIONS) ||
		isTruthy(process.env.GITLAB_CI) ||
		isTruthy(process.env.CIRCLECI) ||
		Boolean(process.env.JENKINS_URL) ||
		isTruthy(process.env.BUILDKITE)

	// Check if this is a build-time context (CI with build env loaded)
	const isBuildTime =
		isCiEnvironment && !isTruthy(process.env.RUNTIME_CONFIG_REQUIRED)

	const enableDebug =
		process.env.NODE_ENV !== 'production' && process.env.NODE_ENV !== 'test'

	// Load environment file for local development only (not EC2 or CI)
	if (!isRuntimeEnvironment && !isCiEnvironment) {
		const envPath = resolve(process.cwd(), '.env')
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

	// For build-time context, create minimal config from available env vars
	// CI workflow should have loaded appropriate .env.build.* file
	if (isBuildTime) {
		logger.info('Loading build-time configuration from environment variables')

		// Create minimal config with only values needed for build processes
		const buildConfig: TEnv = {
			// Required for swagger generation and build
			NODE_ENV: (process.env.NODE_ENV ?? 'development') as
				| 'production'
				| 'development'
				| 'test',
			APP_ENV: (process.env.APP_ENV ?? 'development') as
				| 'production'
				| 'staging'
				| 'development'
				| 'test',
			SERVER_PORT: Number(process.env.SERVER_PORT) || 3040,

			// Build-time placeholders for required fields (not used during build)
			API_KEY: 'build-time-not-required',
			AWS_COGNITO_REGION: process.env.AWS_COGNITO_REGION ?? 'us-east-1',
			AWS_COGNITO_USER_POOL_ID: 'build-time-not-required',
			AWS_COGNITO_USER_POOL_CLIENT_ID: 'build-time-not-required',
			AWS_COGNITO_USER_POOL_SECRET_KEY: 'build-time-not-required',
			AWS_COGNITO_ACCESS_KEY: 'build-time-not-required',
			AWS_COGNITO_SECRET_KEY: 'build-time-not-required',
			AWS_COGNITO_REFRESH_TOKEN_EXPIRY:
				Number(process.env.AWS_COGNITO_REFRESH_TOKEN_EXPIRY) || 30,
			COOKIE_DOMAIN: process.env.COOKIE_DOMAIN ?? 'localhost',
			COOKIE_ENCRYPTION_KEY: 'build-time-not-required',
			NON_RELATIONAL_DATABASE_URL: 'build-time-not-required',
			RELATIONAL_DATABASE_URL: 'build-time-not-required',
			OPENAI_API_KEY: 'build-time-not-required',

			// Rate limiting configs (used in swagger docs)
			RATE_LIMIT_WINDOW_MS: Number(process.env.RATE_LIMIT_WINDOW_MS) || 900000,
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
		}

		return [buildConfig, null]
	}

	// For runtime contexts (local dev, EC2), validate all environment variables
	const env = envSchema.safeParse(process.env)

	if (!env.success) {
		const validationError = fromError(env.error)
		const envPath = resolve(process.cwd(), '.env')

		// In EC2 environment, provide detailed validation error with Parameter Store context
		if (isEc2Environment) {
			logger.error(
				{
					operation: 'ec2ConfigValidationFailed',
					error: validationError.message,
					details: validationError.details,
					parameterStorePrefix: process.env.PARAMETER_STORE_PREFIX,
				},
				'Configuration validation failed in EC2 environment. Ensure all required environment variables are loaded from Parameter Store.',
			)

			const appError = AppError.validation(
				`EC2 environment configuration validation failed: ${validationError.message}. ` +
					`Check that Parameter Store contains all required values with prefix: ${process.env.PARAMETER_STORE_PREFIX ?? 'undefined'}`,
				{
					envPath,
					errors: validationError.details,
					parameterStorePrefix: process.env.PARAMETER_STORE_PREFIX,
					environment: 'ec2',
				},
				'configLoader',
			)
			return [null, appError]
		}

		// For local development environments
		const appError = AppError.validation(
			`Invalid environment configuration: ${validationError.message}. Environment file: ${envPath}`,
			{ envPath, errors: validationError.details },
			'configLoader',
		)
		return [null, appError]
	}

	if (isEc2Environment) {
		logger.info(
			{
				operation: 'configLoaded',
				environment: 'ec2',
				parameterStorePrefix: process.env.PARAMETER_STORE_PREFIX,
			},
			'Successfully loaded and validated configuration from EC2 environment variables',
		)
	} else if (isCiEnvironment) {
		logger.info('Loaded configuration from CI environment variables')
	} else {
		logger.info('Loaded configuration from .env file')
	}

	return [env.data, null]
}

// Export the function instead of the loaded config
export { loadConfig }
