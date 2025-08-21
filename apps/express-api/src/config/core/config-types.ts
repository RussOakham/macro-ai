/**
 * Configuration Types and Schemas
 * Centralized Zod schemas and type definitions for the configuration system
 */

import { z } from 'zod'

/**
 * Environment types for configuration loading
 */
export enum ConfigEnvironment {
	BUILD_TIME = 'build-time',
	LOCALHOST = 'localhost',
	EC2_RUNTIME = 'ec2-runtime',
}

/**
 * Configuration source metadata
 */
export enum ConfigSource {
	ENVIRONMENT = 'environment',
	PARAMETER_STORE = 'parameter-store',
	ENV_FILE = 'env-file',
	BUILD_DEFAULT = 'build-default',
}

/**
 * Application configuration schema
 * This is the final, validated configuration object used throughout the app
 * Uses Zod for runtime validation and type inference
 */
export const appConfigSchema = z.object({
	// Core application settings
	apiKey: z.string().min(1, 'API key is required'),
	nodeEnv: z.enum(['development', 'production', 'test']),
	appEnv: z.string().min(1, 'App environment is required'),
	port: z.number().int().positive('Port must be a positive integer'),

	// AWS Cognito configuration
	awsCognitoRegion: z.string().min(1, 'AWS Cognito region is required'),
	awsCognitoUserPoolId: z
		.string()
		.min(1, 'AWS Cognito user pool ID is required'),
	awsCognitoUserPoolClientId: z
		.string()
		.min(1, 'AWS Cognito user pool client ID is required'),
	awsCognitoUserPoolSecretKey: z
		.string()
		.min(1, 'AWS Cognito user pool secret key is required'),
	awsCognitoAccessKey: z.string().min(1, 'AWS Cognito access key is required'),
	awsCognitoSecretKey: z.string().min(1, 'AWS Cognito secret key is required'),
	awsCognitoRefreshTokenExpiry: z
		.number()
		.int()
		.positive('Refresh token expiry must be positive'),

	// Security settings
	cookieDomain: z.string().min(1, 'Cookie domain is required'),
	cookieEncryptionKey: z.string().min(1, 'Cookie encryption key is required'),

	// Database configuration
	nonRelationalDatabaseUrl: z
		.string()
		.min(1, 'Non-relational database URL is required'),
	relationalDatabaseUrl: z
		.string()
		.min(1, 'Relational database URL is required'),

	// External API keys
	openaiApiKey: z.string().min(1, 'OpenAI API key is required'),

	// Rate limiting configuration
	rateLimitWindowMs: z
		.number()
		.int()
		.positive('Rate limit window must be positive'),
	rateLimitMaxRequests: z
		.number()
		.int()
		.positive('Rate limit max requests must be positive'),
	authRateLimitWindowMs: z
		.number()
		.int()
		.positive('Auth rate limit window must be positive'),
	authRateLimitMaxRequests: z
		.number()
		.int()
		.positive('Auth rate limit max requests must be positive'),
	apiRateLimitWindowMs: z
		.number()
		.int()
		.positive('API rate limit window must be positive'),
	apiRateLimitMaxRequests: z
		.number()
		.int()
		.positive('API rate limit max requests must be positive'),

	// Optional services
	redisUrl: z.string().optional(),
	corsAllowedOrigins: z.string().optional(),
})

/**
 * Inferred AppConfig type from the Zod schema
 */
export type AppConfig = z.infer<typeof appConfigSchema>

/**
 * Configuration with source metadata for debugging and monitoring
 */
export interface EnhancedAppConfig extends AppConfig {
	_metadata: {
		environment: ConfigEnvironment
		sources: Record<keyof AppConfig, ConfigSource>
		loadedAt: Date
		validationResults?: {
			totalFields: number
			parameterStoreFields: number
			environmentFields: number
			defaultFields: number
		}
	}
}

/**
 * Configuration loader interface
 * All loaders must implement this interface for consistency
 */
export interface ConfigLoader {
	load(): Promise<Result<AppConfig>> | Result<AppConfig>
	getEnvironment(): ConfigEnvironment
}

/**
 * Configuration loading options schema
 */
export const configLoadingOptionsSchema = z.object({
	enableMonitoring: z.boolean().optional(),
	enableCaching: z.boolean().optional(),
	validateSchema: z.boolean().optional(),
	includeMetadata: z.boolean().optional(),
})

/**
 * Inferred ConfigLoadingOptions type from the Zod schema
 */
export type ConfigLoadingOptions = z.infer<typeof configLoadingOptionsSchema>

/**
 * Result type for Go-style error handling
 */
export type Result<T> = [T, null] | [null, Error]

/**
 * Configuration loading context schema for monitoring and debugging
 */
export const configLoadingContextSchema = z.object({
	environment: z.nativeEnum(ConfigEnvironment),
	startTime: z.date(),
	parameterStorePrefix: z.string().optional(),
	envFilePath: z.string().optional(),
})

/**
 * Inferred ConfigLoadingContext type from the Zod schema
 */
export type ConfigLoadingContext = z.infer<typeof configLoadingContextSchema>

/**
 * Validate an AppConfig object using the Zod schema
 * Provides runtime validation of the final configuration object
 */
export const validateAppConfig = (config: unknown): Result<AppConfig> => {
	try {
		const validatedConfig = appConfigSchema.parse(config)
		return [validatedConfig, null]
	} catch (error) {
		if (error instanceof z.ZodError) {
			const errorMessage = error.errors
				.map((err) => `${err.path.join('.')}: ${err.message}`)
				.join(', ')
			return [null, new Error(`AppConfig validation failed: ${errorMessage}`)]
		}
		return [
			null,
			error instanceof Error ? error : new Error('Unknown validation error'),
		]
	}
}
