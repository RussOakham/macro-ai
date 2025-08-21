/**
 * Configuration Loader Factory
 * Automatically selects and creates the appropriate configuration loader based on environment
 */

import { pino } from '../../utils/logger.ts'
import type {
	ConfigLoader,
	ConfigLoadingOptions,
} from '../core/config-types.ts'
import { ConfigEnvironment } from '../core/config-types.ts'
import { detectEnvironment } from '../core/environment-detector.ts'

import { BuildTimeLoader } from './build-time-loader.ts'
import { Ec2Loader } from './ec2-loader.ts'
import { LocalhostLoader } from './localhost-loader.ts'

const { logger } = pino

/**
 * Create a configuration loader based on the current environment
 */
export const createConfigLoader = (
	options: ConfigLoadingOptions = {},
): ConfigLoader => {
	const environment = detectEnvironment()

	logger.info(
		{
			operation: 'createLoader',
			detectedEnvironment: environment,
			options: {
				enableMonitoring: options.enableMonitoring,
				enableCaching: options.enableCaching,
				validateSchema: options.validateSchema,
				includeMetadata: options.includeMetadata,
			},
		},
		`Creating configuration loader for ${environment} environment`,
	)

	let loader: ConfigLoader

	switch (environment) {
		case ConfigEnvironment.BUILD_TIME:
			loader = new BuildTimeLoader()
			logger.debug(
				{
					operation: 'loaderCreated',
					loaderType: 'BuildTimeLoader',
					isAsync: false,
				},
				'Build-time loader created',
			)
			break

		case ConfigEnvironment.LOCALHOST:
			loader = new LocalhostLoader(
				undefined, // Use default .env path
				options.validateSchema !== false, // Enable debug by default for localhost
			)
			logger.debug(
				{
					operation: 'loaderCreated',
					loaderType: 'LocalhostLoader',
					isAsync: false,
					validateSchema: options.validateSchema !== false,
				},
				'Localhost loader created',
			)
			break

		case ConfigEnvironment.EC2_RUNTIME:
			loader = new Ec2Loader(
				undefined, // Use default parameter store prefix
				undefined, // Use default app env
				options.enableMonitoring !== false, // Enable monitoring by default for EC2
			)
			logger.debug(
				{
					operation: 'loaderCreated',
					loaderType: 'Ec2Loader',
					isAsync: true,
					enableMonitoring: options.enableMonitoring !== false,
				},
				'EC2 loader created',
			)
			break

		default: {
			const error = new Error(
				`Unsupported configuration environment: ${String(environment)}`,
			)
			logger.error(
				{
					operation: 'loaderCreationFailed',
					environment: String(environment),
					error: error.message,
				},
				'Failed to create configuration loader',
			)
			throw error
		}
	}

	return loader
}

/**
 * Create a specific loader type (useful for testing or explicit control)
 */
export const createSpecificLoader = (
	environment: ConfigEnvironment,
	options: ConfigLoadingOptions = {},
): ConfigLoader => {
	switch (environment) {
		case ConfigEnvironment.BUILD_TIME:
			return new BuildTimeLoader()

		case ConfigEnvironment.LOCALHOST:
			return new LocalhostLoader(undefined, options.validateSchema !== false)

		case ConfigEnvironment.EC2_RUNTIME:
			return new Ec2Loader(
				undefined,
				undefined,
				options.enableMonitoring !== false,
			)

		default:
			throw new Error(
				`Unsupported configuration environment: ${String(environment)}`,
			)
	}
}

/**
 * Get information about available loaders
 */
export const getAvailableLoaders = (): {
	environment: ConfigEnvironment
	loaderClass: string
	description: string
	isAsync: boolean
}[] => {
	return [
		{
			environment: 'build-time' as ConfigEnvironment,
			loaderClass: 'BuildTimeLoader',
			description:
				'Synchronous loader for CI/build environments with minimal configuration',
			isAsync: false,
		},
		{
			environment: 'localhost' as ConfigEnvironment,
			loaderClass: 'LocalhostLoader',
			description: 'Synchronous loader for local development using .env files',
			isAsync: false,
		},
		{
			environment: 'ec2-runtime' as ConfigEnvironment,
			loaderClass: 'Ec2Loader',
			description:
				'Asynchronous loader for EC2/Lambda environments using Parameter Store',
			isAsync: true,
		},
	]
}

/**
 * Validate that a loader is appropriate for the current environment
 */
export const validateLoaderForEnvironment = (
	loader: ConfigLoader,
	expectedEnvironment?: ConfigEnvironment,
): boolean => {
	const currentEnvironment = detectEnvironment()
	const loaderEnvironment = loader.getEnvironment()
	const targetEnvironment = expectedEnvironment ?? currentEnvironment

	return loaderEnvironment === targetEnvironment
}

/**
 * Convenience function to load configuration using the appropriate loader
 */
export const loadConfiguration = async (options: ConfigLoadingOptions = {}) => {
	const loader = createConfigLoader(options)

	// Handle both sync and async loaders
	const result = loader.load()

	// If the result is a Promise, await it
	if (result instanceof Promise) {
		return await result
	}

	return result
}

/**
 * Type guard to check if a loader is asynchronous
 */
export const isAsyncLoader = (loader: ConfigLoader): boolean => {
	return loader.getEnvironment() === ConfigEnvironment.EC2_RUNTIME
}

/**
 * Type guard to check if a loader is synchronous
 */
export const isSyncLoader = (loader: ConfigLoader): boolean => {
	return !isAsyncLoader(loader)
}
