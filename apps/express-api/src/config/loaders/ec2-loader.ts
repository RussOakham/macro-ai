/**
 * EC2 Configuration Loader
 * Asynchronous loader for EC2 environments using AWS Parameter Store
 */

import { enhancedConfigService } from '../../services/enhanced-config.service.ts'
import { envSchema } from '../../utils/env.schema.ts'
import { tryCatch } from '../../utils/error-handling/try-catch.ts'
import { AppError } from '../../utils/errors.ts'
import { pino } from '../../utils/logger.ts'
import { mapToEnhancedAppConfig } from '../core/config-mapper.ts'
import type {
	AppConfig,
	ConfigEnvironment,
	ConfigLoader,
	EnhancedAppConfig,
	Result,
} from '../core/config-types.ts'
import { ConfigSource } from '../core/config-types.ts'

const { logger } = pino

/**
 * EC2 configuration loader
 * Loads configuration from AWS Parameter Store for production environments
 */
export class Ec2Loader implements ConfigLoader {
	private readonly parameterStorePrefix: string
	private readonly appEnv: string
	private readonly enableMonitoring: boolean

	constructor(
		parameterStorePrefix?: string,
		appEnv?: string,
		enableMonitoring = true,
	) {
		this.appEnv = appEnv ?? process.env.APP_ENV ?? 'development'
		this.parameterStorePrefix =
			parameterStorePrefix ?? this.getParameterStorePrefix(this.appEnv)
		this.enableMonitoring = enableMonitoring
	}

	getEnvironment(): ConfigEnvironment {
		return 'ec2-runtime' as ConfigEnvironment
	}

	/**
	 * Load EC2 configuration asynchronously from Parameter Store
	 */
	async load(): Promise<Result<AppConfig>> {
		const [enhancedConfig, error] = await this.loadEnhanced()
		if (error) {
			return [null, error]
		}

		// Return just the app config without metadata
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		const { _metadata, ...appConfig } = enhancedConfig
		return [appConfig as AppConfig, null]
	}

	/**
	 * Load enhanced configuration with metadata for monitoring
	 */
	async loadEnhanced(): Promise<Result<EnhancedAppConfig>> {
		return await tryCatch(
			(async (): Promise<EnhancedAppConfig> => {
				const startTime = Date.now()

				logger.info(
					{
						operation: 'ec2ConfigLoad',
						environment: this.getEnvironment(),
						appEnv: this.appEnv,
						parameterStorePrefix: this.parameterStorePrefix,
						enableMonitoring: this.enableMonitoring,
						startTime: new Date(startTime).toISOString(),
					},
					'Loading EC2 configuration from Parameter Store',
				)

				// Initialize environment object with current process.env
				const enhancedEnv: Record<string, string> = {}
				for (const [key, value] of Object.entries(process.env)) {
					if (value !== undefined) {
						enhancedEnv[key] = value
					}
				}

				const sources: Record<string, ConfigSource> = {}
				let parameterStoreVariables = 0
				let environmentVariables = 0
				let fallbackVariables = 0

				// Load configuration from Parameter Store with fallbacks
				logger.debug(
					{
						operation: 'loadParameterStore',
						parameterStorePrefix: this.parameterStorePrefix,
					},
					'Attempting to load configuration from Parameter Store',
				)

				const [configValues, configError] =
					await enhancedConfigService.getAllMappedConfig()

				if (configError) {
					logger.warn(
						{
							operation: 'parameterStorePartialFailure',
							error: configError.message,
							parameterStorePrefix: this.parameterStorePrefix,
							loadTimeMs: Date.now() - startTime,
						},
						'Failed to load some configuration from Parameter Store',
					)
				} else {
					// Update environment with Parameter Store values
					for (const [envVar, configValue] of Object.entries(configValues)) {
						enhancedEnv[envVar] = configValue.value
						sources[envVar] = configValue.source as ConfigSource

						// Count source types for validation reporting
						if (configValue.source === 'parameter-store') {
							parameterStoreVariables++
						} else if (configValue.source === 'environment') {
							environmentVariables++
						} else {
							fallbackVariables++
						}

						logger.debug(
							{
								operation: 'configLoaded',
								envVar,
								source: configValue.source,
								cached: configValue.cached,
							},
							'Configuration variable loaded',
						)
					}

					const parameterStoreLoadTime = Date.now() - startTime

					logger.info(
						{
							operation: 'parameterStoreLoadComplete',
							parameterStoreVariables,
							environmentVariables,
							fallbackVariables,
							totalVariables:
								parameterStoreVariables +
								environmentVariables +
								fallbackVariables,
							loadTimeMs: parameterStoreLoadTime,
							configSources: {
								parameterStore: parameterStoreVariables,
								environment: environmentVariables,
								fallback: fallbackVariables,
							},
						},
						'Parameter Store configuration loading completed',
					)
				}

				// Mark remaining values as environment sourced
				for (const key of Object.keys(enhancedEnv)) {
					if (!sources[key]) {
						sources[key] = ConfigSource.ENVIRONMENT
						environmentVariables++
					}
				}

				// Validate the enhanced environment against schema
				const validationResult = envSchema.safeParse(enhancedEnv)

				if (!validationResult.success) {
					const errorMessages = validationResult.error.errors
						.map((err) => `${err.path.join('.')}: ${err.message}`)
						.join(', ')

					logger.error(
						{
							operation: 'ec2ConfigValidationFailed',
							error: errorMessages,
							parameterStorePrefix: this.parameterStorePrefix,
							validationStats: {
								totalVariables:
									parameterStoreVariables +
									environmentVariables +
									fallbackVariables,
								parameterStoreVariables,
								environmentVariables,
								fallbackVariables,
							},
							sources,
						},
						'EC2 configuration validation failed',
					)

					throw new AppError({
						message:
							`EC2 configuration validation failed: ${errorMessages}. ` +
							`Loaded ${parameterStoreVariables.toString()} from Parameter Store, ${environmentVariables.toString()} from environment, ${fallbackVariables.toString()} fallbacks. ` +
							`Check Parameter Store prefix: ${this.parameterStorePrefix}`,
						details: {
							errors: validationResult.error.errors,
							sources,
							parameterStorePrefix: this.parameterStorePrefix,
							validationStats: {
								totalVariables:
									parameterStoreVariables +
									environmentVariables +
									fallbackVariables,
								parameterStoreVariables,
								environmentVariables,
								fallbackVariables,
							},
							environment: 'ec2',
						},
						service: 'Ec2Loader',
					})
				}

				const totalLoadTime = Date.now() - startTime
				const totalVariables =
					parameterStoreVariables + environmentVariables + fallbackVariables

				logger.info(
					{
						operation: 'ec2ConfigValidationSuccess',
						environment: this.getEnvironment(),
						validationStats: {
							totalVariables,
							parameterStoreVariables,
							environmentVariables,
							fallbackVariables,
						},
						parameterStorePrefix: this.parameterStorePrefix,
						totalLoadTimeMs: totalLoadTime,
						configSources: {
							parameterStore: parameterStoreVariables,
							environment: environmentVariables,
							fallback: fallbackVariables,
						},
					},
					'EC2 configuration validation completed successfully',
				)

				// Create enhanced config with comprehensive metadata
				const [enhancedConfig, mappingError] = mapToEnhancedAppConfig(
					validationResult.data,
					this.getEnvironment(),
					sources,
					{
						totalFields:
							parameterStoreVariables +
							environmentVariables +
							fallbackVariables,
						parameterStoreFields: parameterStoreVariables,
						environmentFields: environmentVariables,
						defaultFields: fallbackVariables,
					},
				)

				if (mappingError) {
					logger.error(
						{
							operation: 'ec2ConfigMappingFailed',
							error: mappingError.message,
							parameterStorePrefix: this.parameterStorePrefix,
						},
						'Failed to map EC2 environment variables to enhanced application config',
					)

					throw new AppError({
						message: `EC2 configuration mapping failed: ${mappingError.message}`,
						details: {
							error: mappingError,
							parameterStorePrefix: this.parameterStorePrefix,
						},
						service: 'Ec2Loader',
					})
				}

				return enhancedConfig
			})(),
			'Ec2Loader.loadEnhanced',
		)
	}

	/**
	 * Determine Parameter Store prefix based on APP_ENV
	 */
	private getParameterStorePrefix(appEnv: string): string {
		// Map preview environments to development parameters
		if (appEnv.startsWith('pr-')) {
			return '/macro-ai/development/'
		}

		// Use environment-specific prefixes for standard environments
		return `/macro-ai/${appEnv}/`
	}

	/**
	 * Validate that we're in an EC2 environment
	 */
	public static validateEc2Environment(): void {
		const isEc2Environment = Boolean(
			process.env.PARAMETER_STORE_PREFIX ??
				process.env.APP_ENV?.startsWith('pr-'),
		)

		if (!isEc2Environment) {
			throw new AppError({
				message: 'Ec2Loader should only be used in EC2 environments',
				service: 'Ec2Loader',
			})
		}
	}
}

/**
 * Factory function for creating EC2 loader
 */
export const createEc2Loader = (
	parameterStorePrefix?: string,
	appEnv?: string,
	enableMonitoring = true,
): Ec2Loader => {
	Ec2Loader.validateEc2Environment()
	return new Ec2Loader(parameterStorePrefix, appEnv, enableMonitoring)
}

/**
 * Convenience function for loading EC2 configuration
 */
export const loadEc2Config = async (
	parameterStorePrefix?: string,
	appEnv?: string,
	enableMonitoring = true,
): Promise<Result<AppConfig>> => {
	const loader = createEc2Loader(parameterStorePrefix, appEnv, enableMonitoring)
	return await loader.load()
}
