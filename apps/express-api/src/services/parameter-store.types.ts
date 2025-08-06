/**
 * Type definitions for Parameter Store Service
 */

import { Result } from '../utils/errors.ts'

/**
 * Cache entry interface for parameter values
 */
export interface CacheEntry {
	value: string
	expires: number
}

/**
 * Parameter Store Service configuration
 */
export interface ParameterStoreConfig {
	region: string
	environment: string
	cacheEnabled: boolean
	cacheTtlMs: number
}

/**
 * Parameter metadata for logging and categorization
 */
export interface ParameterMetadata {
	name: string
	fullPath: string
	isCritical: boolean
	category: 'critical' | 'standard'
}

/**
 * Cache statistics for monitoring
 */
export interface CacheStats {
	totalEntries: number
	activeEntries: number
	expiredEntries: number
	cacheEnabled: boolean
	cacheTtlMs: number
}

/**
 * Critical parameter names (requiring advanced tier)
 */
export type CriticalParameterName = 'openai-api-key' | 'neon-database-url'

/**
 * Standard parameter names (using standard tier)
 */
export type StandardParameterName =
	| 'upstash-redis-url'
	| 'cognito-user-pool-id'
	| 'cognito-user-pool-client-id'

/**
 * All valid parameter names
 */
export type ParameterName = CriticalParameterName | StandardParameterName

/**
 * Parameter Store Service interface
 */
export interface IParameterStoreService {
	/**
	 * Get a parameter value from Parameter Store with caching
	 */
	getParameter(
		parameterName: string,
		useCache?: boolean,
	): Promise<Result<string>>

	/**
	 * Get multiple parameters in a single call
	 */
	getParameters(
		parameterNames: string[],
		useCache?: boolean,
	): Promise<Result<Record<string, string>>>

	/**
	 * Clear the cache for a specific parameter or all parameters
	 */
	clearCache(parameterName?: string): void

	/**
	 * Get cache statistics for monitoring
	 */
	getCacheStats(): CacheStats
}

/**
 * Environment-specific parameter configuration
 */
export interface EnvironmentConfig {
	environment: 'development' | 'staging' | 'production' | 'test'
	parameterPrefix: string
	criticalTier: 'Standard' | 'Advanced'
	standardTier: 'Standard' | 'Advanced'
}

/**
 * Parameter retrieval options
 */
export interface ParameterOptions {
	useCache?: boolean
	forceRefresh?: boolean
	timeout?: number
}

/**
 * Parameter Store error types
 */
export type ParameterStoreErrorType =
	| 'PARAMETER_NOT_FOUND'
	| 'ACCESS_DENIED'
	| 'INVALID_PARAMETER_NAME'
	| 'RATE_LIMIT_EXCEEDED'
	| 'SERVICE_UNAVAILABLE'
	| 'CACHE_ERROR'
	| 'UNKNOWN_ERROR'

/**
 * Parameter Store error details
 */
export interface ParameterStoreErrorDetails {
	type: ParameterStoreErrorType
	parameterName?: string
	fullPath?: string
	originalError?: Error
	retryable: boolean
}
