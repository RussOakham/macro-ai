/**
 * Centralized Environment Configuration Management
 *
 * This module provides enhanced configuration management with:
 * - Environment-specific configuration loading
 * - Configuration precedence rules
 * - Validation and error reporting
 * - Development/production environment detection
 */

import { access } from 'node:fs'
import { resolve } from 'node:path'
import { promisify } from 'node:util'

import { config as dotenvConfig } from 'dotenv'
import { fromError } from 'zod-validation-error'

import { envSchema, type TEnv } from '../utils/env.schema.ts'
import { AppError, type Result } from '../utils/errors.ts'
import { pino } from '../utils/logger.ts'

const { logger } = pino

/**
 * Environment types
 */
export type EnvironmentType =
	| 'development'
	| 'preview'
	| 'production'
	| 'staging'
	| 'test'

/**
 * Configuration loading options
 */
export interface EnvConfigOptions {
	/** Custom base directory for .env files (default: project root) */
	baseDir?: string
	/** Whether to log configuration details (default: true) */
	enableLogging?: boolean
	/** Force a specific environment type */
	forceEnvironment?: EnvironmentType
	/** Whether to validate the schema (default: true) */
	validateSchema?: boolean
}

/**
 * Environment file configuration
 */
interface EnvFileConfig {
	description: string
	path: string
	required: boolean
}

/**
 * Get the current environment type
 */
export const getEnvironmentType = (
	forceEnvironment?: EnvironmentType,
): EnvironmentType => {
	if (forceEnvironment) {
		return forceEnvironment
	}

	const nodeEnv = process.env.NODE_ENV
	const appEnv = process.env.APP_ENV

	// Check for preview environment (pr-123 pattern)
	if (appEnv?.match(/^pr-\d+$/)) {
		return 'preview'
	}

	// Map NODE_ENV to environment types
	switch (nodeEnv) {
		case 'development':
			return 'development'
		case 'test':
			return 'test'
		case 'production':
			// In production, check APP_ENV for more specific environment
			switch (appEnv) {
				case 'production':
					return 'production'
				case 'staging':
					return 'staging'
				default:
					return 'production'
			}
		default:
			return 'development'
	}
}

/**
 * Get environment file paths based on environment type
 */
const getEnvFilePaths = (
	envType: EnvironmentType,
	baseDir: string,
): EnvFileConfig[] => {
	const configs: EnvFileConfig[] = []

	// Always try to load base .env file first (lowest priority)
	configs.push({
		path: resolve(baseDir, '.env'),
		required: false,
		description: 'Base environment file',
	})

	// Environment-specific files (higher priority)
	switch (envType) {
		case 'development':
			configs.push(
				{
					path: resolve(baseDir, '.env.local'),
					required: false,
					description: 'Local development environment file',
				},
				{
					path: resolve(baseDir, '.env.development'),
					required: false,
					description: 'Development environment file',
				},
			)
			break

		case 'preview':
			// Preview environments use CDK-generated configuration
			// No .env files should be loaded in preview environments
			break

		case 'production':
			// In production, we expect environment variables to be pre-set
			// No .env files should be loaded
			break

		case 'staging':
			configs.push({
				path: resolve(baseDir, '.env.staging'),
				required: false,
				description: 'Staging environment file',
			})
			break

		case 'test':
			configs.push({
				path: resolve(baseDir, '.env.test'),
				required: false,
				description: 'Test environment file',
			})
			break
	}

	return configs
}

/**
 * Load environment variables from files based on environment type
 */
const loadEnvFiles = async (
	envType: EnvironmentType,
	baseDir: string,
	enableLogging: boolean,
	// eslint-disable-next-line sonarjs/cognitive-complexity
): Promise<void> => {
	const envFiles = getEnvFilePaths(envType, baseDir)

	// In production or preview, don't load any .env files
	if (envType === 'production' || envType === 'preview') {
		if (enableLogging) {
			logger.info(
				{
					operation: 'loadEnvFiles',
					environmentType: envType,
				},
				`${envType} environment detected - using pre-set environment variables`,
			)
		}
		return
	}

	let loadedAny = false

	// Load files in order (later files override earlier ones)
	const accessAsync = promisify(access)
	for (const envFile of envFiles) {
		try {
			await accessAsync(envFile.path)
			const result = dotenvConfig({
				path: envFile.path,
				override: false, // Don't override existing environment variables
				encoding: 'utf8',
			})

			if (result.error) {
				if (enableLogging) {
					logger.warn(
						{
							operation: 'loadEnvFiles',
							filePath: envFile.path,
							error: result.error.message,
						},
						`Failed to load ${envFile.description}`,
					)
				}
			} else {
				loadedAny = true
				if (enableLogging) {
					logger.info(
						{
							operation: 'loadEnvFiles',
							filePath: envFile.path,
							loadedVars: Object.keys(result.parsed ?? {}).length,
						},
						`Loaded ${envFile.description}`,
					)
				}
			}
		} catch {
			// File doesn't exist
			if (envFile.required) {
				throw new AppError({
					message: `Required environment file not found: ${envFile.path} - Config file missing, ${envFile.description}`,
				})
			}
		}
	}

	if (!loadedAny && enableLogging) {
		logger.info(
			{
				operation: 'loadEnvFiles',
				environmentType: envType,
				searchedPaths: envFiles.map((f) => f.path),
			},
			'No environment files found - using process.env only',
		)
	}
}

/**
 * Enhanced configuration loader with environment-specific support
 */

export const loadEnvConfig = async (
	options: EnvConfigOptions = {},
	// eslint-disable-next-line sonarjs/cognitive-complexity
): Promise<Result<TEnv>> => {
	const {
		validateSchema = true,
		enableLogging = false,
		forceEnvironment,
		baseDir = process.cwd(),
	} = options

	try {
		// Determine environment type
		const envType = getEnvironmentType(forceEnvironment)

		if (enableLogging) {
			logger.info(
				{
					operation: 'loadEnvConfig',
					environmentType: envType,
					nodeEnv: process.env.NODE_ENV,
					appEnv: process.env.APP_ENV,
				},
				'Loading environment configuration',
			)
		}

		// Load environment files based on environment type
		await loadEnvFiles(envType, baseDir, enableLogging)

		// Validate environment variables using Zod schema
		if (validateSchema) {
			const validationResult = envSchema.safeParse(process.env)

			if (!validationResult.success) {
				const validationError = fromError(validationResult.error)

				if (enableLogging) {
					logger.error(
						{
							operation: 'loadEnvConfig',
							environmentType: envType,
							validationErrors: validationResult.error.issues,
						},
						'Environment validation failed',
					)
				}

				return [
					null,
					new AppError({
						message: `Environment validation failed: ${validationError.message}`,
						details: validationError.details,
					}),
				]
			}

			if (enableLogging) {
				logger.info(
					{
						operation: 'loadEnvConfig',
						environmentType: envType,
						validatedVars: Object.keys(validationResult.data).length,
					},
					'Environment validation successful',
				)
			}

			return [validationResult.data, null]
		}
		// Return unvalidated process.env (cast to TEnv)
		return [process.env as unknown as TEnv, null]
	} catch (error) {
		const appError =
			error instanceof AppError
				? error
				: new AppError({
						message: `Failed to load environment configuration: ${error instanceof Error ? error.message : 'Unknown error'} - CONFIG_LOAD_ERROR`,
					})

		if (enableLogging) {
			logger.error(
				{
					operation: 'loadEnvConfig',
					error: appError.message,
					stack: appError.stack,
				},
				'Configuration loading failed',
			)
		}

		return [null, appError]
	}
}

/**
 * Get environment information
 */
export const getEnvInfo = () => {
	const envType = getEnvironmentType()
	const nodeEnv = process.env.NODE_ENV
	const appEnv = process.env.APP_ENV

	return {
		environmentType: envType,
		nodeEnv,
		appEnv,
		isProduction: envType === 'production',
		isDevelopment: envType === 'development',
		isTest: envType === 'test',
		isStaging: envType === 'staging',
		isPreview: envType === 'preview',
	}
}

/**
 * Create environment-specific configuration precedence summary
 */
export const getConfigPrecedence = (
	baseDir: string = process.cwd(),
): string[] => {
	const envType = getEnvironmentType()
	const envFiles = getEnvFilePaths(envType, baseDir)

	const reversedEnvFiles = Array.from(envFiles).reverse()
	const precedence = [
		'process.env (highest priority)',
		...reversedEnvFiles.map((f) => `${f.path} (${f.description})`),
		'schema defaults (lowest priority)',
	]

	return precedence
}
