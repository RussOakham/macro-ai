/**
 * Parameter Store Service for Lambda Environment
 * Handles secure parameter loading with caching for optimal Lambda performance
 */

import type {
	GetParameterCommandOutput,
	GetParametersCommandOutput,
} from '@aws-sdk/client-ssm'
import {
	GetParameterCommand,
	GetParametersCommand,
	SSMClient,
} from '@aws-sdk/client-ssm'
import { z } from 'zod'
import { fromZodError } from 'zod-validation-error'

import { logger } from '../utils/powertools-logger.js'
import { recordParameterStoreMetrics } from '../utils/powertools-metrics.js'

interface CachedParameter {
	value: string
	expires: number
}

interface ParameterConfig {
	name: string
	required: boolean
	encrypted: boolean
}

/**
 * Basic Zod schema for Parameter Store data integrity validation
 * Ensures all parameters are non-empty strings with basic format validation
 */
const ParameterStoreDataSchema = z.object({
	'macro-ai-database-url': z
		.string()
		.min(1, 'Database URL cannot be empty')
		.url('Database URL must be a valid URL'),
	'macro-ai-redis-url': z
		.string()
		.min(1, 'Redis URL cannot be empty')
		.url('Redis URL must be a valid URL'),
	'macro-ai-openai-key': z
		.string()
		.min(1, 'OpenAI API key cannot be empty')
		.regex(/^sk-/, 'OpenAI API key must start with "sk-"'),
	'macro-ai-cognito-user-pool-id': z
		.string()
		.min(1, 'Cognito User Pool ID cannot be empty'),
	'macro-ai-cognito-user-pool-client-id': z
		.string()
		.min(1, 'Cognito User Pool Client ID cannot be empty'),
})

/**
 * Type for validated parameters from Parameter Store
 */
type ValidatedParameterStoreData = z.infer<typeof ParameterStoreDataSchema>

export class ParameterStoreService {
	private static instance: ParameterStoreService | undefined
	private readonly ssmClient: SSMClient
	private readonly cache = new Map<string, CachedParameter>()
	private readonly CACHE_TTL = 5 * 60 * 1000 // 5 minutes
	private readonly AWS_REGION = process.env.AWS_REGION ?? 'us-east-1'

	// Parameter configuration for Macro AI
	private readonly PARAMETERS: ParameterConfig[] = [
		{ name: 'macro-ai-openai-key', required: true, encrypted: true },
		{ name: 'macro-ai-database-url', required: true, encrypted: true },
		{ name: 'macro-ai-redis-url', required: true, encrypted: true },
		{ name: 'macro-ai-cognito-user-pool-id', required: true, encrypted: false },
		{
			name: 'macro-ai-cognito-user-pool-client-id',
			required: true,
			encrypted: false,
		},
	]

	private constructor() {
		this.ssmClient = new SSMClient({
			region: this.AWS_REGION,
			maxAttempts: 3,
			retryMode: 'adaptive',
		})
	}

	/**
	 * Get singleton instance
	 */
	public static getInstance(): ParameterStoreService {
		ParameterStoreService.instance ??= new ParameterStoreService()
		return ParameterStoreService.instance
	}

	/**
	 * Reset singleton instance (for testing purposes only)
	 * @internal
	 */
	public static resetInstance(): void {
		ParameterStoreService.instance = undefined
	}

	/**
	 * Get a single parameter with caching and metrics tracking
	 */
	public async getParameter(
		name: string,
		withDecryption = true,
	): Promise<string> {
		const startTime = Date.now()

		// Check cache first
		const cached = this.cache.get(name)
		if (cached && cached.expires > Date.now()) {
			logger.debug('Parameter cache hit', {
				operation: 'getParameter',
				parameterName: name,
				cacheExpires: new Date(cached.expires).toISOString(),
			})

			// Record cache hit metric
			recordParameterStoreMetrics('hit', name)
			return cached.value
		}

		logger.debug('Parameter cache miss, fetching from Parameter Store', {
			operation: 'getParameter',
			parameterName: name,
			withDecryption,
		})

		try {
			const command = new GetParameterCommand({
				Name: name,
				WithDecryption: withDecryption,
			})

			const response: GetParameterCommandOutput =
				await this.ssmClient.send(command)
			const value = response.Parameter?.Value

			if (!value) {
				const errorMessage = `Parameter ${name} not found or has no value`
				logger.error('Parameter retrieval failed', {
					operation: 'getParameter',
					parameterName: name,
					error: errorMessage,
				})

				// Record error metric
				recordParameterStoreMetrics('error', name)
				throw new Error(errorMessage)
			}

			const duration = Date.now() - startTime

			// Cache the parameter
			this.cache.set(name, {
				value,
				expires: Date.now() + this.CACHE_TTL,
			})

			logger.info('Parameter retrieved successfully', {
				operation: 'getParameter',
				parameterName: name,
				duration,
				cached: true,
			})

			// Record cache miss and retrieval time metrics
			recordParameterStoreMetrics('miss', name, duration)

			return value
		} catch (error) {
			const duration = Date.now() - startTime
			const errorMessage =
				error instanceof Error ? error.message : 'Unknown error'

			logger.error('Failed to get parameter', {
				operation: 'getParameter',
				parameterName: name,
				duration,
				error: errorMessage,
				errorType:
					error instanceof Error ? error.constructor.name : 'UnknownError',
			})

			// Record error metric
			recordParameterStoreMetrics('error', name)

			throw new Error(`Failed to retrieve parameter ${name}: ${errorMessage}`)
		}
	}

	/**
	 * Get multiple parameters in a single call (more efficient) with metrics tracking
	 */
	public async getParameters(
		names: string[],
		withDecryption = true,
	): Promise<Record<string, string>> {
		const startTime = Date.now()
		const uncachedNames: string[] = []
		const result: Record<string, string> = {}

		logger.debug('Getting multiple parameters', {
			operation: 'getParameters',
			parameterCount: names.length,
			parameterNames: names,
			withDecryption,
		})

		// Check cache for each parameter
		for (const name of names) {
			const cached = this.cache.get(name)
			if (cached && cached.expires > Date.now()) {
				result[name] = cached.value
				// Record individual cache hit
				recordParameterStoreMetrics('hit', name)
			} else {
				uncachedNames.push(name)
			}
		}

		// Fetch uncached parameters
		if (uncachedNames.length > 0) {
			logger.debug('Fetching uncached parameters from Parameter Store', {
				operation: 'getParameters',
				uncachedCount: uncachedNames.length,
				uncachedNames,
			})

			try {
				const command = new GetParametersCommand({
					Names: uncachedNames,
					WithDecryption: withDecryption,
				})

				const response: GetParametersCommandOutput =
					await this.ssmClient.send(command)

				// Process successful parameters
				if (response.Parameters) {
					for (const param of response.Parameters) {
						if (param.Name && param.Value) {
							result[param.Name] = param.Value

							// Cache the parameter
							this.cache.set(param.Name, {
								value: param.Value,
								expires: Date.now() + this.CACHE_TTL,
							})

							// Record cache miss for each retrieved parameter
							recordParameterStoreMetrics('miss', param.Name)
						}
					}
				}

				// Check for invalid parameters
				if (
					response.InvalidParameters &&
					response.InvalidParameters.length > 0
				) {
					logger.warn('Invalid parameters detected', {
						operation: 'getParameters',
						invalidParameters: response.InvalidParameters,
					})

					// Record error metrics for invalid parameters
					for (const invalidParam of response.InvalidParameters) {
						recordParameterStoreMetrics('error', invalidParam)
					}

					throw new Error(
						`Invalid parameters: ${response.InvalidParameters.join(', ')}`,
					)
				}
			} catch (error) {
				const duration = Date.now() - startTime
				const errorMessage =
					error instanceof Error ? error.message : 'Unknown error'

				logger.error('Failed to get parameters', {
					operation: 'getParameters',
					uncachedNames,
					duration,
					error: errorMessage,
					errorType:
						error instanceof Error ? error.constructor.name : 'UnknownError',
				})

				// Record error metrics for all uncached parameters
				for (const paramName of uncachedNames) {
					recordParameterStoreMetrics('error', paramName)
				}

				throw new Error(`Failed to retrieve parameters: ${errorMessage}`)
			}
		}

		const totalDuration = Date.now() - startTime
		const cacheHits = names.length - uncachedNames.length

		logger.info('Parameters retrieved successfully', {
			operation: 'getParameters',
			totalParams: names.length,
			cacheHits,
			cacheMisses: uncachedNames.length,
			totalDuration,
		})

		return result
	}

	/**
	 * Initialize all required parameters for Macro AI with validation and metrics
	 * Call this on Lambda cold start for optimal performance
	 */
	public async initializeParameters(): Promise<ValidatedParameterStoreData> {
		const startTime = Date.now()

		logger.info('Initializing Parameter Store parameters', {
			operation: 'initializeParameters',
			parameterCount: this.PARAMETERS.length,
			requiredParams: this.PARAMETERS.filter((p) => p.required).length,
		})

		const parameterNames = this.PARAMETERS.map((p) => p.name)

		try {
			const rawParameters = await this.getParameters(parameterNames, true)

			// Basic presence validation (existing logic)
			const missingParams = this.PARAMETERS.filter(
				(p) => p.required && !rawParameters[p.name],
			).map((p) => p.name)

			if (missingParams.length > 0) {
				logger.error('Missing required parameters', {
					operation: 'initializeParameters',
					missingParams,
					requiredParams: this.PARAMETERS.filter((p) => p.required).map(
						(p) => p.name,
					),
				})

				// Record error metrics for missing parameters
				for (const missingParam of missingParams) {
					recordParameterStoreMetrics('error', missingParam)
				}

				throw new Error(
					`Missing required parameters: ${missingParams.join(', ')}`,
				)
			}

			// Data integrity validation using Zod
			let validatedParameters: ValidatedParameterStoreData
			try {
				validatedParameters = ParameterStoreDataSchema.parse(rawParameters)
			} catch (zodError) {
				const validationError = fromZodError(zodError as z.ZodError)

				logger.error('Parameter validation failed', {
					operation: 'initializeParameters',
					validationError: validationError.message,
					parameterNames,
				})

				// Record validation error metrics
				for (const paramName of parameterNames) {
					recordParameterStoreMetrics('error', paramName)
				}

				throw new Error(
					`Parameter validation failed: ${validationError.message}`,
				)
			}

			const duration = Date.now() - startTime

			logger.info('Successfully loaded and validated parameters', {
				operation: 'initializeParameters',
				parameterCount: Object.keys(validatedParameters).length,
				duration,
				durationMs: `${String(duration)}ms`,
			})

			return validatedParameters
		} catch (error) {
			const duration = Date.now() - startTime
			const errorMessage =
				error instanceof Error ? error.message : 'Unknown error'

			logger.error('Failed to initialize parameters', {
				operation: 'initializeParameters',
				duration,
				error: errorMessage,
				errorType:
					error instanceof Error ? error.constructor.name : 'UnknownError',
			})

			throw error
		}
	}

	/**
	 * Clear parameter cache (useful for testing)
	 */
	public clearCache(): void {
		this.cache.clear()
	}

	/**
	 * Get cache statistics
	 */
	public getCacheStats(): { size: number; keys: string[] } {
		return {
			size: this.cache.size,
			keys: Array.from(this.cache.keys()),
		}
	}

	/**
	 * Health check for Parameter Store connectivity with metrics
	 */
	public async healthCheck(): Promise<boolean> {
		const startTime = Date.now()

		logger.debug('Starting Parameter Store health check', {
			operation: 'healthCheck',
		})

		try {
			// Try to get a simple parameter to test connectivity
			await this.getParameter('macro-ai-cognito-user-pool-id', false)

			const duration = Date.now() - startTime

			logger.info('Parameter Store health check passed', {
				operation: 'healthCheck',
				duration,
				status: 'healthy',
			})

			return true
		} catch (error) {
			const duration = Date.now() - startTime
			const errorMessage =
				error instanceof Error ? error.message : 'Unknown error'

			logger.error('Parameter Store health check failed', {
				operation: 'healthCheck',
				duration,
				error: errorMessage,
				errorType:
					error instanceof Error ? error.constructor.name : 'UnknownError',
				status: 'unhealthy',
			})

			// Record health check failure metric
			recordParameterStoreMetrics('error', 'health-check')

			return false
		}
	}
}

// Export singleton instance
export const parameterStore = ParameterStoreService.getInstance()
