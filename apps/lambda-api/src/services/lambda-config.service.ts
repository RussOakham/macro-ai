/**
 * Lambda Configuration Service
 * Manages configuration loading for Lambda environment with Parameter Store integration
 */

import { z } from 'zod'
import { fromZodError } from 'zod-validation-error'

import type { TEnv } from '../utils/env.schema.js'
import { loadConfig } from '../utils/load-config.js'
import { logger } from '../utils/powertools-logger.js'

import { parameterStore } from './parameter-store.service.js'

export interface LambdaConfig {
	// Database configuration
	relationalDatabaseUrl: string
	nonRelationalDatabaseUrl: string

	// External API configuration
	openaiApiKey: string

	// AWS Cognito configuration
	awsCognitoUserPoolId: string
	awsCognitoUserPoolClientId: string

	// Environment configuration
	nodeEnv: string
	awsRegion: string
	lambdaFunctionName: string

	// Lambda-specific configuration
	isLambdaEnvironment: boolean
	coldStart: boolean
}

/**
 * Business-specific Zod schema for Lambda configuration validation
 * Applies additional business rules beyond basic data integrity
 */
const LambdaConfigParameterSchema = z.object({
	'macro-ai-database-url': z.string().url('Database URL must be a valid URL'),
	'macro-ai-redis-url': z.string().url('Redis URL must be a valid URL'),
	'macro-ai-openai-key': z
		.string()
		.regex(/^sk-/, 'OpenAI API key must start with "sk-"'),
	'macro-ai-cognito-user-pool-id': z
		.string()
		.regex(
			/^[a-z0-9-]+_[a-zA-Z0-9]+$/,
			'Cognito User Pool ID must be in format: region_poolId',
		),
	'macro-ai-cognito-user-pool-client-id': z
		.string()
		.regex(
			/^[a-z0-9]{26}$/,
			'Cognito User Pool Client ID must be 26 characters long',
		),
})

/**
 * Type for business-validated parameters
 */
type BusinessValidatedParameters = z.infer<typeof LambdaConfigParameterSchema>

export class LambdaConfigService {
	private static instance: LambdaConfigService | undefined
	private config: LambdaConfig | null = null
	private envConfig: TEnv | null = null
	private initialized = false

	// eslint-disable-next-line @typescript-eslint/no-empty-function
	private constructor() {}

	/**
	 * Get singleton instance
	 */
	public static getInstance(): LambdaConfigService {
		LambdaConfigService.instance ??= new LambdaConfigService()
		return LambdaConfigService.instance
	}

	/**
	 * Initialize configuration from Parameter Store
	 * Should be called on Lambda cold start
	 */
	public async initialize(isColdStart = false): Promise<LambdaConfig> {
		if (this.initialized && this.config) {
			// Update cold start flag
			this.config.coldStart = isColdStart
			return this.config
		}

		logger.info('Initializing Lambda configuration', {
			operation: 'initialize',
			isColdStart,
		})

		try {
			// Load and validate environment configuration first
			const [envConfig, envError] = loadConfig()
			if (envError) {
				throw envError
			}
			this.envConfig = envConfig

			// Load and validate parameters from Parameter Store
			// Parameter Store now handles basic validation (non-empty, URLs, API key format)
			const basicValidatedParameters =
				await parameterStore.initializeParameters()

			// Apply additional business-specific validation rules
			let parameters: BusinessValidatedParameters
			try {
				parameters = LambdaConfigParameterSchema.parse(basicValidatedParameters)
			} catch (zodError) {
				const validationError = fromZodError(zodError as z.ZodError)
				console.error('❌ Business validation failed:', validationError.message)
				throw new Error(
					`Business validation failed: ${validationError.message}`,
				)
			}

			// Create configuration object with validated parameters and environment config
			this.config = {
				// Database configuration
				relationalDatabaseUrl: parameters['macro-ai-database-url'],
				nonRelationalDatabaseUrl: parameters['macro-ai-redis-url'],

				// External API configuration
				openaiApiKey: parameters['macro-ai-openai-key'],

				// AWS Cognito configuration
				awsCognitoUserPoolId: parameters['macro-ai-cognito-user-pool-id'],
				awsCognitoUserPoolClientId:
					parameters['macro-ai-cognito-user-pool-client-id'],

				// Environment configuration (from validated env config)
				nodeEnv: envConfig.NODE_ENV,
				awsRegion: envConfig.AWS_REGION,
				lambdaFunctionName: envConfig.AWS_LAMBDA_FUNCTION_NAME,

				// Lambda-specific configuration
				isLambdaEnvironment: true,
				coldStart: isColdStart,
			}

			this.initialized = true
			console.log('✅ Lambda configuration initialized successfully')

			return this.config
		} catch (error) {
			console.error('❌ Failed to initialize Lambda configuration:', error)
			throw new Error(
				`Configuration initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
			)
		}
	}

	/**
	 * Get current configuration
	 * Throws error if not initialized
	 */
	public getConfig(): LambdaConfig {
		if (!this.config || !this.initialized) {
			throw new Error('Configuration not initialized. Call initialize() first.')
		}
		return this.config
	}

	/**
	 * Check if configuration is initialized
	 */
	public isInitialized(): boolean {
		return this.initialized
	}

	/**
	 * Get configuration for Express app
	 * Converts Lambda config to Express-compatible format
	 */
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	public getExpressConfig(): Record<string, any> {
		const config = this.getConfig()

		return {
			// Port configuration (not used in Lambda but required by Express)
			port: 3000,

			// Database configuration
			relationalDatabaseUrl: config.relationalDatabaseUrl,
			nonRelationalDatabaseUrl: config.nonRelationalDatabaseUrl,

			// External API configuration
			openaiApiKey: config.openaiApiKey,

			// AWS configuration
			awsCognitoUserPoolId: config.awsCognitoUserPoolId,
			awsCognitoUserPoolClientId: config.awsCognitoUserPoolClientId,
			awsRegion: config.awsRegion,

			// Environment configuration
			nodeEnv: config.nodeEnv,

			// Lambda-specific flags
			isLambdaEnvironment: config.isLambdaEnvironment,
			coldStart: config.coldStart,
		}
	}

	/**
	 * Update cold start flag
	 */
	public setColdStart(isColdStart: boolean): void {
		if (this.config) {
			this.config.coldStart = isColdStart
		}
	}

	/**
	 * Reset configuration (useful for testing)
	 */
	public reset(): void {
		this.config = null
		this.initialized = false
	}

	/**
	 * Get configuration summary for logging
	 */
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	public getConfigSummary(): Record<string, any> {
		if (!this.config) {
			return { status: 'not_initialized' }
		}

		return {
			status: 'initialized',
			nodeEnv: this.config.nodeEnv,
			awsRegion: this.config.awsRegion,
			lambdaFunctionName: this.config.lambdaFunctionName,
			isLambdaEnvironment: this.config.isLambdaEnvironment,
			coldStart: this.config.coldStart,
			hasDatabase: !!this.config.relationalDatabaseUrl,
			hasRedis: !!this.config.nonRelationalDatabaseUrl,
			hasOpenAI: !!this.config.openaiApiKey,
			hasCognito: !!(
				this.config.awsCognitoUserPoolId &&
				this.config.awsCognitoUserPoolClientId
			),
		}
	}
}

// Export singleton instance
export const lambdaConfig = LambdaConfigService.getInstance()
