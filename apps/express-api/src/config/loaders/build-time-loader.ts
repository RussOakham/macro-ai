/**
 * Build-Time Configuration Loader
 * Synchronous loader for CI/build environments with minimal configuration requirements
 */

import type { TEnv } from '../../utils/env.schema.ts'
import { tryCatchSync } from '../../utils/error-handling/try-catch.ts'
import { AppError } from '../../utils/errors.ts'
import { pino } from '../../utils/logger.ts'
import { mapToAppConfig } from '../core/config-mapper.ts'
import type {
	AppConfig,
	ConfigEnvironment,
	ConfigLoader,
	Result,
} from '../core/config-types.ts'

const { logger } = pino

/**
 * Build-time configuration loader
 * Provides minimal configuration needed for build processes
 */
export class BuildTimeLoader implements ConfigLoader {
	getEnvironment(): ConfigEnvironment {
		return 'build-time' as ConfigEnvironment
	}

	/**
	 * Load build-time configuration synchronously
	 * Only includes values needed for build processes like Swagger generation
	 */
	load(): Result<AppConfig> {
		return tryCatchSync(() => {
			const startTime = Date.now()

			logger.info(
				{
					operation: 'buildTimeConfigLoad',
					environment: this.getEnvironment(),
					startTime: new Date(startTime).toISOString(),
				},
				'Starting build-time configuration loading with minimal placeholders',
			)
			// Create minimal config with only values needed for build processes
			const buildEnv: TEnv = {
				// Core settings required for build
				NODE_ENV: this.getNodeEnv(),
				APP_ENV: this.getAppEnv(),
				SERVER_PORT: this.getServerPort(),

				// Build-time placeholders for required fields (not used during build)
				API_KEY: this.getBuildPlaceholder('API_KEY'),
				AWS_COGNITO_REGION: process.env.AWS_COGNITO_REGION ?? 'us-east-1',
				AWS_COGNITO_USER_POOL_ID: this.getBuildPlaceholder(
					'AWS_COGNITO_USER_POOL_ID',
				),
				AWS_COGNITO_USER_POOL_CLIENT_ID: this.getBuildPlaceholder(
					'AWS_COGNITO_USER_POOL_CLIENT_ID',
				),
				AWS_COGNITO_USER_POOL_SECRET_KEY: this.getBuildPlaceholder(
					'AWS_COGNITO_USER_POOL_SECRET_KEY',
				),
				AWS_COGNITO_ACCESS_KEY: this.getBuildPlaceholder(
					'AWS_COGNITO_ACCESS_KEY',
				),
				AWS_COGNITO_SECRET_KEY: this.getBuildPlaceholder(
					'AWS_COGNITO_SECRET_KEY',
				),
				AWS_COGNITO_REFRESH_TOKEN_EXPIRY:
					Number(process.env.AWS_COGNITO_REFRESH_TOKEN_EXPIRY) || 30,
				COOKIE_DOMAIN: process.env.COOKIE_DOMAIN ?? 'localhost',
				COOKIE_ENCRYPTION_KEY: this.getBuildPlaceholder(
					'COOKIE_ENCRYPTION_KEY',
				),
				NON_RELATIONAL_DATABASE_URL: this.getBuildPlaceholder(
					'NON_RELATIONAL_DATABASE_URL',
				),
				RELATIONAL_DATABASE_URL: this.getBuildPlaceholder(
					'RELATIONAL_DATABASE_URL',
				),
				OPENAI_API_KEY: this.getBuildPlaceholder('OPENAI_API_KEY'),

				// Rate limiting configs (used in swagger docs)
				RATE_LIMIT_WINDOW_MS:
					Number(process.env.RATE_LIMIT_WINDOW_MS) || 900000, // 15 minutes
				RATE_LIMIT_MAX_REQUESTS:
					Number(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
				AUTH_RATE_LIMIT_WINDOW_MS:
					Number(process.env.AUTH_RATE_LIMIT_WINDOW_MS) || 3600000, // 1 hour
				AUTH_RATE_LIMIT_MAX_REQUESTS:
					Number(process.env.AUTH_RATE_LIMIT_MAX_REQUESTS) || 10,
				API_RATE_LIMIT_WINDOW_MS:
					Number(process.env.API_RATE_LIMIT_WINDOW_MS) || 60000, // 1 minute
				API_RATE_LIMIT_MAX_REQUESTS:
					Number(process.env.API_RATE_LIMIT_MAX_REQUESTS) || 60,
				REDIS_URL: process.env.REDIS_URL,
				CORS_ALLOWED_ORIGINS: process.env.CORS_ALLOWED_ORIGINS,
			}

			const loadTime = Date.now() - startTime

			logger.info(
				{
					operation: 'buildTimeConfigLoaded',
					environment: this.getEnvironment(),
					loadTimeMs: loadTime,
					configSources: {
						envFile: 0,
						environment: 3, // NODE_ENV, APP_ENV, SERVER_PORT
						parameterStore: 0,
						defaults: Object.keys(buildEnv).length - 3, // All other fields are placeholders
					},
					placeholderFields: Object.keys(buildEnv).filter((key) =>
						buildEnv[key as keyof TEnv]
							?.toString()
							.startsWith('build-time-placeholder'),
					).length,
				},
				'Successfully loaded build-time configuration with placeholders',
			)

			// Map to app config using the centralized mapper
			const [appConfig, mappingError] = mapToAppConfig(buildEnv)

			if (mappingError) {
				logger.error(
					{
						operation: 'buildTimeConfigMappingFailed',
						error: mappingError.message,
					},
					'Failed to map build-time environment variables to application config',
				)

				throw new AppError({
					message: `Build-time configuration mapping failed: ${mappingError.message}`,
					details: { error: mappingError },
					service: 'BuildTimeLoader',
				})
			}

			logger.debug(
				{
					operation: 'buildTimeConfigMapped',
					configFields: Object.keys(appConfig).length,
					realValues: ['nodeEnv', 'appEnv', 'port'],
					placeholderValues: Object.keys(appConfig).filter((key) =>
						appConfig[key as keyof AppConfig]
							?.toString()
							.includes('build-time-placeholder'),
					).length,
				},
				'Build-time configuration mapped successfully',
			)

			return appConfig
		}, 'BuildTimeLoader.load')
	}

	/**
	 * Get NODE_ENV with validation for build context
	 */
	private getNodeEnv(): 'production' | 'development' | 'test' {
		const nodeEnv = process.env.NODE_ENV

		if (!nodeEnv) {
			return 'development'
		}

		if (!['production', 'development', 'test'].includes(nodeEnv)) {
			throw new AppError({
				message: `Invalid NODE_ENV for build context: ${nodeEnv}. Must be 'production', 'development', or 'test'`,
				service: 'BuildTimeLoader',
			})
		}

		return nodeEnv as 'production' | 'development' | 'test'
	}

	/**
	 * Get APP_ENV with validation for build context
	 */
	private getAppEnv(): string {
		const appEnv = process.env.APP_ENV

		if (!appEnv) {
			return 'development'
		}

		// Validate APP_ENV format
		const validAppEnvs = ['development', 'staging', 'production', 'test']
		const isPreviewEnv = /^pr-\d+$/.test(appEnv)

		if (!validAppEnvs.includes(appEnv) && !isPreviewEnv) {
			throw new AppError({
				message: `Invalid APP_ENV for build context: ${appEnv}. Must be one of ${validAppEnvs.join(', ')} or match pr-{number} pattern`,
				service: 'BuildTimeLoader',
			})
		}

		return appEnv
	}

	/**
	 * Get SERVER_PORT with validation
	 */
	private getServerPort(): number {
		const port = Number(process.env.SERVER_PORT) || 3040

		if (isNaN(port) || port <= 0 || port > 65535) {
			throw new AppError({
				message: `Invalid SERVER_PORT for build context: ${process.env.SERVER_PORT ?? ''}. Must be a valid port number`,
				service: 'BuildTimeLoader',
			})
		}

		return port
	}

	/**
	 * Generate build-time placeholder values
	 * These are not used during build but are required by the schema
	 */
	private getBuildPlaceholder(fieldName: string): string {
		return `build-time-placeholder-${fieldName.toLowerCase()}`
	}

	/**
	 * Validate that we're actually in a build environment
	 */
	public static validateBuildEnvironment(): void {
		const isTruthy = (v?: string) => /^(?:1|true|yes)$/i.test(v ?? '')

		const isCiEnvironment =
			isTruthy(process.env.CI) ||
			isTruthy(process.env.GITHUB_ACTIONS) ||
			isTruthy(process.env.GITLAB_CI) ||
			isTruthy(process.env.CIRCLECI) ||
			Boolean(process.env.JENKINS_URL) ||
			isTruthy(process.env.BUILDKITE)

		if (!isCiEnvironment) {
			throw new AppError({
				message: 'BuildTimeLoader should only be used in CI/build environments',
				service: 'BuildTimeLoader',
			})
		}

		if (isTruthy(process.env.RUNTIME_CONFIG_REQUIRED)) {
			throw new AppError({
				message:
					'BuildTimeLoader cannot be used when RUNTIME_CONFIG_REQUIRED is set',
				service: 'BuildTimeLoader',
			})
		}
	}
}

/**
 * Factory function for creating build-time loader
 */
export const createBuildTimeLoader = (): BuildTimeLoader => {
	BuildTimeLoader.validateBuildEnvironment()
	return new BuildTimeLoader()
}

/**
 * Convenience function for loading build-time configuration
 */
export const loadBuildTimeConfig = (): Result<AppConfig> => {
	const loader = createBuildTimeLoader()
	return loader.load()
}
