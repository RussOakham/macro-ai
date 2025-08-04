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
	 * Get a single parameter with caching
	 */
	public async getParameter(
		name: string,
		withDecryption = true,
	): Promise<string> {
		// Check cache first
		const cached = this.cache.get(name)
		if (cached && cached.expires > Date.now()) {
			return cached.value
		}

		try {
			const command = new GetParameterCommand({
				Name: name,
				WithDecryption: withDecryption,
			})

			const response: GetParameterCommandOutput =
				await this.ssmClient.send(command)
			const value = response.Parameter?.Value

			if (!value) {
				throw new Error(`Parameter ${name} not found or has no value`)
			}

			// Cache the parameter
			this.cache.set(name, {
				value,
				expires: Date.now() + this.CACHE_TTL,
			})

			return value
		} catch (error) {
			console.error(`Failed to get parameter ${name}:`, error)
			throw new Error(
				`Failed to retrieve parameter ${name}: ${error instanceof Error ? error.message : 'Unknown error'}`,
			)
		}
	}

	/**
	 * Get multiple parameters in a single call (more efficient)
	 */
	public async getParameters(
		names: string[],
		withDecryption = true,
	): Promise<Record<string, string>> {
		const uncachedNames: string[] = []
		const result: Record<string, string> = {}

		// Check cache for each parameter
		for (const name of names) {
			const cached = this.cache.get(name)
			if (cached && cached.expires > Date.now()) {
				result[name] = cached.value
			} else {
				uncachedNames.push(name)
			}
		}

		// Fetch uncached parameters
		if (uncachedNames.length > 0) {
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
						}
					}
				}

				// Check for invalid parameters
				if (
					response.InvalidParameters &&
					response.InvalidParameters.length > 0
				) {
					console.warn('Invalid parameters:', response.InvalidParameters)
					throw new Error(
						`Invalid parameters: ${response.InvalidParameters.join(', ')}`,
					)
				}
			} catch (error) {
				console.error('Failed to get parameters:', error)
				throw new Error(
					`Failed to retrieve parameters: ${error instanceof Error ? error.message : 'Unknown error'}`,
				)
			}
		}

		return result
	}

	/**
	 * Initialize all required parameters for Macro AI with validation
	 * Call this on Lambda cold start for optimal performance
	 */
	public async initializeParameters(): Promise<ValidatedParameterStoreData> {
		console.log('🔧 Initializing Parameter Store parameters...')

		const parameterNames = this.PARAMETERS.map((p) => p.name)

		try {
			const rawParameters = await this.getParameters(parameterNames, true)

			// Basic presence validation (existing logic)
			const missingParams = this.PARAMETERS.filter(
				(p) => p.required && !rawParameters[p.name],
			).map((p) => p.name)

			if (missingParams.length > 0) {
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
				console.error(
					'❌ Parameter validation failed:',
					validationError.message,
				)
				throw new Error(
					`Parameter validation failed: ${validationError.message}`,
				)
			}

			console.log(
				`✅ Successfully loaded and validated ${String(Object.keys(validatedParameters).length)} parameters`,
			)
			return validatedParameters
		} catch (error) {
			console.error('❌ Failed to initialize parameters:', error)
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
	 * Health check for Parameter Store connectivity
	 */
	public async healthCheck(): Promise<boolean> {
		try {
			// Try to get a simple parameter to test connectivity
			await this.getParameter('macro-ai-cognito-user-pool-id', false)
			return true
		} catch (error) {
			console.error('Parameter Store health check failed:', error)
			return false
		}
	}
}

// Export singleton instance
export const parameterStore = ParameterStoreService.getInstance()
