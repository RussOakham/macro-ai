/**
 * Parameter Store Service for AWS Systems Manager Parameter Store integration
 * Implements secure parameter retrieval with 5-minute TTL caching for Lambda runtime
 */

import { GetParameterCommand, SSMClient } from '@aws-sdk/client-ssm'

import { tryCatch } from '../utils/error-handling/try-catch.ts'
import {
	AppError,
	InternalError,
	NotFoundError,
	Result,
} from '../utils/errors.ts'
import { pino } from '../utils/logger.ts'

import {
	CacheEntry,
	ParameterMetadata,
	ParameterStoreConfig,
} from './parameter-store.types.ts'

const { logger } = pino

/**
 * SecureHobbySecretsManager - Parameter Store service with caching
 * Handles secure retrieval of configuration parameters from AWS Systems Manager Parameter Store
 */
export class ParameterStoreService {
	private readonly ssmClient: SSMClient
	private readonly cache = new Map<string, CacheEntry>()
	private readonly config: ParameterStoreConfig

	// Critical secrets requiring advanced parameters
	private static readonly CRITICAL_SECRETS = [
		// Application
		'api-key',
		'cookie-encryption-key',
		// Cognito secrets
		'cognito-user-pool-secret-key',
		'cognito-access-key',
		'cognito-secret-key',
		// External services / databases
		'openai-api-key',
		'neon-database-url',
		'upstash-redis-url',
	] as const

	constructor(config?: Partial<ParameterStoreConfig>) {
		this.config = {
			region: config?.region ?? process.env.AWS_REGION ?? 'us-east-1',
			environment: config?.environment ?? process.env.APP_ENV ?? 'production',
			cacheEnabled: config?.cacheEnabled ?? true,
			cacheTtlMs: config?.cacheTtlMs ?? 5 * 60 * 1000, // 5 minutes
		}

		this.ssmClient = new SSMClient({
			region: this.config.region,
		})

		logger.info(
			{
				operation: 'parameterStoreInit',
				region: this.config.region,
				environment: this.config.environment,
				cacheEnabled: this.config.cacheEnabled,
				cacheTtlMs: this.config.cacheTtlMs,
			},
			'ParameterStoreService initialized',
		)
	}

	/**
	 * Get a parameter value from Parameter Store with caching
	 * @param parameterName The parameter name (without path prefix)
	 * @param useCache Whether to use caching (default: true)
	 * @returns Result tuple with parameter value or error
	 */
	public getParameter = async (
		parameterName: string,
		useCache = true,
	): Promise<Result<string>> => {
		const metadata = this.getParameterMetadata(parameterName)

		// Check cache first if enabled
		if (useCache && this.config.cacheEnabled) {
			const cached = this.cache.get(parameterName)
			if (cached && Date.now() < cached.expires) {
				logger.debug(
					{
						operation: 'getParameterFromCache',
						parameter: parameterName,
						category: metadata.category,
					},
					'Parameter retrieved from cache',
				)
				return [cached.value, null]
			}
		}

		// Retrieve from Parameter Store with fallback support
		const retrieveParameter = async (): Promise<string> => {
			// Try primary path first (flat structure)
			const tryPath = async (
				path: string,
				pathType: string,
			): Promise<string | null> => {
				try {
					const command = new GetParameterCommand({
						Name: path,
						WithDecryption: true,
					})

					logger.debug(
						{
							operation: 'getParameterFromStore',
							parameter: parameterName,
							fullPath: path,
							pathType,
							category: metadata.category,
						},
						`Retrieving parameter from Parameter Store (${pathType})`,
					)

					const response = await this.ssmClient.send(command)
					return response.Parameter?.Value ?? null
				} catch (error) {
					logger.debug(
						{
							operation: 'getParameterFailed',
							parameter: parameterName,
							fullPath: path,
							pathType,
							error: error instanceof Error ? error.message : 'Unknown error',
						},
						`Parameter not found at ${pathType} path`,
					)
					return null
				}
			}

			// Try flat structure first
			let parameterValue = await tryPath(metadata.fullPath, 'flat')

			// If not found and fallback path exists, try hierarchical structure
			if (!parameterValue && metadata.fallbackPath) {
				parameterValue = await tryPath(metadata.fallbackPath, 'hierarchical')
			}

			if (!parameterValue) {
				const paths = metadata.fallbackPath
					? `${metadata.fullPath}, ${metadata.fallbackPath}`
					: metadata.fullPath
				const notFoundError = new NotFoundError(
					`Parameter ${parameterName} not found in Parameter Store at paths: ${paths}`,
					'parameterStoreService',
				)
				throw notFoundError
			}

			return parameterValue
		}

		const [value, error] = await tryCatch(
			retrieveParameter(),
			'parameterStoreService - getParameter',
		)

		if (error) {
			// Log detailed error information for debugging
			logger.error(
				{
					operation: 'getParameterError',
					parameter: parameterName,
					fullPath: metadata.fullPath,
					errorName: error.name,
					errorMessage: error.message,
					errorType: error.type,
					errorStack: error.stack,
				},
				'Parameter Store error details',
			)

			// Handle specific AWS errors using error codes/names
			if (error.name === 'ParameterNotFound') {
				const notFoundError = new NotFoundError(
					`Parameter ${parameterName} not found`,
					'parameterStoreService',
				)
				return [null, notFoundError]
			}

			const internalError = new InternalError(
				`Failed to retrieve parameter ${parameterName}: ${error.message}`,
				'parameterStoreService',
			)
			return [null, internalError]
		}

		// Cache the value if caching is enabled
		if (useCache && this.config.cacheEnabled) {
			this.cache.set(parameterName, {
				value,
				expires: Date.now() + this.config.cacheTtlMs,
			})
		}

		// Log access for audit trail
		logger.info(
			{
				operation: 'getParameterSuccess',
				parameter: parameterName,
				category: metadata.category,
				cached: false,
				timestamp: new Date().toISOString(),
			},
			'Parameter retrieved successfully',
		)

		return [value, null]
	}

	/**
	 * Get multiple parameters in a single call
	 * @param parameterNames Array of parameter names
	 * @param useCache Whether to use caching (default: true)
	 * @returns Result tuple with parameter map or error
	 */
	public getParameters = async (
		parameterNames: string[],
		useCache = true,
	): Promise<Result<Record<string, string>>> => {
		const results: Record<string, string> = {}
		const errors: AppError[] = []

		for (const parameterName of parameterNames) {
			const [value, error] = await this.getParameter(parameterName, useCache)
			if (error) {
				errors.push(error)
			} else {
				results[parameterName] = value
			}
		}

		if (errors.length > 0) {
			const combinedError = new InternalError(
				`Failed to retrieve ${errors.length.toString()} parameters`,
				'parameterStoreService',
			)
			return [null, combinedError]
		}

		return [results, null]
	}

	/**
	 * Clear the cache for a specific parameter or all parameters
	 * @param parameterName Optional parameter name to clear, if not provided clears all
	 */
	public clearCache = (parameterName?: string): void => {
		if (parameterName) {
			this.cache.delete(parameterName)
			logger.debug(
				{
					operation: 'clearParameterCache',
					parameter: parameterName,
				},
				'Parameter cache cleared',
			)
		} else {
			this.cache.clear()
			logger.debug(
				{
					operation: 'clearAllParameterCache',
				},
				'All parameter cache cleared',
			)
		}
	}

	/**
	 * Get cache statistics for monitoring
	 */
	public getCacheStats = () => {
		const now = Date.now()
		const entries = Array.from(this.cache.entries())
		const expired = entries.filter(([, entry]) => now >= entry.expires).length
		const active = entries.length - expired

		return {
			totalEntries: entries.length,
			activeEntries: active,
			expiredEntries: expired,
			cacheEnabled: this.config.cacheEnabled,
			cacheTtlMs: this.config.cacheTtlMs,
		}
	}

	/**
	 * Get parameter metadata including full path and categorization
	 * @param parameterName The parameter name
	 * @returns Parameter metadata
	 */
	private readonly getParameterMetadata = (
		parameterName: string,
	): ParameterMetadata => {
		const isCritical = ParameterStoreService.CRITICAL_SECRETS.includes(
			parameterName as (typeof ParameterStoreService.CRITICAL_SECRETS)[number],
		)
		const category = isCritical ? 'critical' : 'standard'

		// Support both flat and hierarchical parameter structures
		// For preview environments (pr-*), use development prefix with flat structure
		const environment = this.config.environment.startsWith('pr-')
			? 'development'
			: this.config.environment

		// Try flat structure first (new approach), then hierarchical (legacy)
		const flatPath = `/macro-ai/${environment}/${parameterName.toUpperCase().replace(/-/g, '_')}`
		const hierarchicalPath = isCritical
			? `/macro-ai/${environment}/critical/${parameterName}`
			: `/macro-ai/${environment}/standard/${parameterName}`

		return {
			name: parameterName,
			fullPath: flatPath, // Use flat structure as primary
			fallbackPath: hierarchicalPath, // Keep hierarchical as fallback
			isCritical,
			category,
		}
	}
}

// Export singleton instance for use throughout the application
export const parameterStoreService = new ParameterStoreService()
