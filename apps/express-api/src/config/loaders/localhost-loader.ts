/**
 * Localhost Configuration Loader
 * Synchronous loader for local development environments using .env files
 */

import { config } from 'dotenv'
import { accessSync, constants, existsSync, statSync } from 'fs'
import { resolve } from 'path'

import { envSchema } from '../../utils/env.schema.ts'
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
 * Localhost configuration loader
 * Loads configuration from .env files for local development
 */
export class LocalhostLoader implements ConfigLoader {
	private readonly envFilePath: string
	private readonly enableDebug: boolean

	constructor(envFilePath?: string, enableDebug?: boolean) {
		this.envFilePath = envFilePath ?? resolve(process.cwd(), '.env')
		this.enableDebug =
			enableDebug ??
			(process.env.NODE_ENV !== 'production' && process.env.NODE_ENV !== 'test')
	}

	getEnvironment(): ConfigEnvironment {
		return 'localhost' as ConfigEnvironment
	}

	/**
	 * Load localhost configuration synchronously from .env file
	 */
	load(): Result<AppConfig> {
		return tryCatchSync(() => {
			const startTime = Date.now()

			logger.info(
				{
					operation: 'localhostConfigLoad',
					environment: this.getEnvironment(),
					envFilePath: this.envFilePath,
					enableDebug: this.enableDebug,
					startTime: new Date(startTime).toISOString(),
				},
				'Starting localhost configuration loading from .env file',
			)
			// Load environment variables from .env file
			logger.debug(
				{
					operation: 'loadEnvFile',
					envFilePath: this.envFilePath,
					encoding: 'UTF-8',
					debug: this.enableDebug,
				},
				'Loading environment variables from .env file',
			)

			const dotenvResult = config({
				path: this.envFilePath,
				encoding: 'UTF-8',
				debug: this.enableDebug,
			})

			if (dotenvResult.error) {
				logger.error(
					{
						operation: 'envFileLoadFailed',
						envFilePath: this.envFilePath,
						error: dotenvResult.error.message,
					},
					'Failed to parse .env file',
				)

				throw new AppError({
					message: `Cannot parse .env file '${this.envFilePath}': ${dotenvResult.error.message}`,
					details: {
						envFilePath: this.envFilePath,
						error: dotenvResult.error,
					},
					service: 'LocalhostLoader',
				})
			}

			logger.debug(
				{
					operation: 'envFileLoaded',
					envFilePath: this.envFilePath,
					parsed: dotenvResult.parsed
						? Object.keys(dotenvResult.parsed).length
						: 0,
				},
				'Successfully loaded .env file',
			)

			// Validate environment variables against schema
			logger.debug(
				{
					operation: 'validateSchema',
					totalEnvVars: Object.keys(process.env).length,
				},
				'Validating environment variables against schema',
			)

			const validationResult = envSchema.safeParse(process.env)

			if (!validationResult.success) {
				const errorMessages = validationResult.error.errors
					.map((err) => `${err.path.join('.')}: ${err.message}`)
					.join(', ')

				logger.error(
					{
						operation: 'schemaValidationFailed',
						envFilePath: this.envFilePath,
						errorCount: validationResult.error.errors.length,
						errors: validationResult.error.errors.map((err) => ({
							path: err.path.join('.'),
							message: err.message,
							code: err.code,
						})),
					},
					'Schema validation failed for localhost configuration',
				)

				throw new AppError({
					message: `Invalid environment configuration: ${errorMessages}`,
					details: {
						envFilePath: this.envFilePath,
						errors: validationResult.error.errors,
					},
					service: 'LocalhostLoader',
				})
			}

			const loadTime = Date.now() - startTime
			const configFieldCount = Object.keys(validationResult.data).length

			logger.info(
				{
					operation: 'localhostConfigLoaded',
					environment: this.getEnvironment(),
					envFilePath: this.envFilePath,
					fieldsLoaded: configFieldCount,
					loadTimeMs: loadTime,
					configSources: {
						envFile: configFieldCount,
						environment: 0,
						parameterStore: 0,
						defaults: 0,
					},
				},
				'Successfully loaded localhost configuration from .env file',
			)

			// Map validated environment to app config
			const [appConfig, mappingError] = mapToAppConfig(validationResult.data)

			if (mappingError) {
				logger.error(
					{
						operation: 'configMappingFailed',
						error: mappingError.message,
						envFilePath: this.envFilePath,
					},
					'Failed to map environment variables to application config',
				)

				throw new AppError({
					message: `Configuration mapping failed: ${mappingError.message}`,
					details: {
						envFilePath: this.envFilePath,
						error: mappingError,
					},
					service: 'LocalhostLoader',
				})
			}

			logger.debug(
				{
					operation: 'configMapped',
					configFields: Object.keys(appConfig).length,
					optionalFields: {
						redisUrl: !!appConfig.redisUrl,
						corsAllowedOrigins: !!appConfig.corsAllowedOrigins,
					},
				},
				'Configuration successfully mapped to application config',
			)

			return appConfig
		}, 'LocalhostLoader.load')
	}

	/**
	 * Check if .env file exists and is readable
	 */
	public validateEnvFile(): Result<boolean> {
		return tryCatchSync(() => {
			if (!existsSync(this.envFilePath)) {
				throw new AppError({
					message: `Environment file not found: ${this.envFilePath}`,
					details: { envFilePath: this.envFilePath },
					service: 'LocalhostLoader',
				})
			}

			// Check if file is readable
			try {
				accessSync(this.envFilePath, constants.R_OK)
			} catch (error) {
				throw new AppError({
					message: `Environment file is not readable: ${this.envFilePath}`,
					details: { envFilePath: this.envFilePath, error },
					service: 'LocalhostLoader',
				})
			}

			return true
		}, 'LocalhostLoader.validateEnvFile')
	}

	/**
	 * Get information about the .env file for debugging
	 */
	public getEnvFileInfo(): {
		path: string
		exists: boolean
		readable: boolean
		size?: number
		modified?: Date
	} {
		const info = {
			path: this.envFilePath,
			exists: false,
			readable: false,
			size: undefined as number | undefined,
			modified: undefined as Date | undefined,
		}

		try {
			const stats = statSync(this.envFilePath)
			info.exists = true
			info.size = stats.size
			info.modified = stats.mtime

			try {
				accessSync(this.envFilePath, constants.R_OK)
				info.readable = true
			} catch {
				info.readable = false
			}
		} catch {
			info.exists = false
		}

		return info
	}

	/**
	 * Validate that we're in a localhost environment
	 */
	public static validateLocalhostEnvironment(): void {
		const isTruthy = (v?: string) => /^(?:1|true|yes)$/i.test(v ?? '')

		// Should not be in CI environment
		const isCiEnvironment =
			isTruthy(process.env.CI) ||
			isTruthy(process.env.GITHUB_ACTIONS) ||
			isTruthy(process.env.GITLAB_CI) ||
			isTruthy(process.env.CIRCLECI) ||
			Boolean(process.env.JENKINS_URL) ||
			isTruthy(process.env.BUILDKITE)

		if (isCiEnvironment && !isTruthy(process.env.RUNTIME_CONFIG_REQUIRED)) {
			throw new AppError({
				message:
					'LocalhostLoader should not be used in CI environments without RUNTIME_CONFIG_REQUIRED',
				service: 'LocalhostLoader',
			})
		}

		// Should not be in EC2/Lambda environment
		const isEc2Environment = Boolean(
			process.env.PARAMETER_STORE_PREFIX ??
				process.env.AWS_LAMBDA_FUNCTION_NAME,
		)

		if (isEc2Environment) {
			throw new AppError({
				message:
					'LocalhostLoader should not be used in EC2/Lambda environments',
				service: 'LocalhostLoader',
			})
		}
	}
}

/**
 * Factory function for creating localhost loader
 */
export const createLocalhostLoader = (
	envFilePath?: string,
	enableDebug?: boolean,
): LocalhostLoader => {
	LocalhostLoader.validateLocalhostEnvironment()
	return new LocalhostLoader(envFilePath, enableDebug)
}

/**
 * Convenience function for loading localhost configuration
 */
export const loadLocalhostConfig = (
	envFilePath?: string,
	enableDebug?: boolean,
): Result<AppConfig> => {
	const loader = createLocalhostLoader(envFilePath, enableDebug)
	return loader.load()
}
