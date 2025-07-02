import { vi } from 'vitest'

import { config } from '../../../config/default.ts'

/**
 * Config Mock Helper for Express API Tests
 * Provides type-safe mocking for application configuration
 *
 * IMPLEMENTATION FOLLOWS TYPE INFERENCE PATTERN:
 * Types are inferred from the actual config object to ensure:
 * - Mock interfaces stay in sync with the real configuration
 * - TypeScript catches any mismatches between mocks and actual usage
 * - Automatic updates when configuration structure changes
 *
 * See: documentation/implementation/test-helpers-and-mocking-strategy.md
 */

/**
 * Infer the actual config type from the implementation
 * This ensures our mock types match the real config structure
 */
type ConfigType = typeof config

/**
 * Default test configuration values
 * These provide sensible defaults for testing while maintaining type safety
 */
export const defaultTestConfig: ConfigType = {
	// API Configuration
	apiKey: 'test-api-key-12345678901234567890',
	nodeEnv: 'test',
	port: 3000,

	// AWS Cognito Configuration
	awsCognitoRegion: 'us-east-1',
	awsCognitoUserPoolId: 'test-pool-id',
	awsCognitoUserPoolClientId: 'test-client-id',
	awsCognitoUserPoolSecretKey: 'test-pool-secret',
	awsCognitoAccessKey: 'test-access-key',
	awsCognitoSecretKey: 'test-secret-key',
	awsCognitoRefreshTokenExpiry: 30,

	// Cookie Configuration
	cookieDomain: 'localhost',
	cookieEncryptionKey: 'test-cookie-encryption-key-32-chars',

	// Database Configuration
	nonRelationalDatabaseUrl: 'mongodb://localhost:27017/test_db',
	relationalDatabaseUrl: 'postgresql://test:test@localhost:5432/test_db',

	// OpenAI Configuration
	openaiApiKey: 'sk-test-mock-key-for-testing-only',

	// Rate Limiting Configuration
	rateLimitWindowMs: 900000, // 15 minutes
	rateLimitMaxRequests: 100,
	authRateLimitWindowMs: 3600000, // 1 hour
	authRateLimitMaxRequests: 10,
	apiRateLimitWindowMs: 60000, // 1 minute
	apiRateLimitMaxRequests: 60,

	// Redis Configuration
	redisUrl: 'redis://localhost:6379',
}

/**
 * Factory function to create a config mock with optional overrides
 * @param overrides - Partial config object to override default values
 * @returns Mock config object with type safety
 */
export const createConfigMock = (overrides: Partial<ConfigType> = {}) => ({
	config: {
		...defaultTestConfig,
		...overrides,
	},
})

/**
 * Mock factory for vi.mock() calls
 * Creates the complete module mock structure expected by the config module
 * @param overrides - Partial config object to override default values
 * @returns Object with config mock for module mocking
 */
export const createConfigModuleMock = (overrides: Partial<ConfigType> = {}) =>
	createConfigMock(overrides)

/**
 * Setup function for beforeEach hooks
 * Clears all mocks and returns a fresh config mock
 * @param overrides - Partial config object to override default values
 * @returns Fresh config mock instance
 */
export const setupConfigMock = (overrides: Partial<ConfigType> = {}) => {
	vi.clearAllMocks()
	return createConfigMock(overrides)
}

/**
 * Environment-specific config creators
 * These provide pre-configured setups for different environments
 */

/**
 * Create development environment config
 * @returns Config mock configured for development environment
 */
export const createDevelopmentConfig = () =>
	createConfigMock({
		nodeEnv: 'development',
		port: 3001,
	})

/**
 * Create production environment config
 * @returns Config mock configured for production environment
 */
export const createProductionConfig = () =>
	createConfigMock({
		nodeEnv: 'production',
		port: 8080,
	})

/**
 * Create test environment config (default)
 * @returns Config mock configured for test environment
 */
export const createTestConfig = () =>
	createConfigMock({
		nodeEnv: 'test',
		port: 3000,
	})

/**
 * AWS Cognito specific config creator
 * Useful for tests that specifically need Cognito configuration
 * @param overrides - Cognito-specific overrides
 * @returns Config mock with Cognito-focused configuration
 */
export const createCognitoConfig = (
	overrides: Partial<
		Pick<
			ConfigType,
			| 'awsCognitoRegion'
			| 'awsCognitoUserPoolId'
			| 'awsCognitoUserPoolClientId'
			| 'awsCognitoUserPoolSecretKey'
			| 'awsCognitoAccessKey'
			| 'awsCognitoSecretKey'
			| 'awsCognitoRefreshTokenExpiry'
		>
	> = {},
) =>
	createConfigMock({
		awsCognitoRegion: 'us-west-2',
		awsCognitoUserPoolId: 'cognito-test-pool-id',
		awsCognitoUserPoolClientId: 'cognito-test-client-id',
		awsCognitoUserPoolSecretKey: 'cognito-test-pool-secret',
		awsCognitoAccessKey: 'cognito-test-access-key',
		awsCognitoSecretKey: 'cognito-test-secret-key',
		awsCognitoRefreshTokenExpiry: 60,
		...overrides,
	})

/**
 * Database specific config creator
 * Useful for tests that specifically need database configuration
 * @param overrides - Database-specific overrides
 * @returns Config mock with database-focused configuration
 */
export const createDatabaseConfig = (
	overrides: Partial<
		Pick<ConfigType, 'relationalDatabaseUrl' | 'nonRelationalDatabaseUrl'>
	> = {},
) =>
	createConfigMock({
		relationalDatabaseUrl:
			'postgresql://testuser:testpass@localhost:5432/testdb',
		nonRelationalDatabaseUrl: 'mongodb://localhost:27017/testdb',
		...overrides,
	})

/**
 * Rate limiting specific config creator
 * Useful for tests that specifically need rate limiting configuration
 * @param overrides - Rate limiting-specific overrides
 * @returns Config mock with rate limiting-focused configuration
 */
export const createRateLimitConfig = (
	overrides: Partial<
		Pick<
			ConfigType,
			| 'rateLimitWindowMs'
			| 'rateLimitMaxRequests'
			| 'authRateLimitWindowMs'
			| 'authRateLimitMaxRequests'
			| 'apiRateLimitWindowMs'
			| 'apiRateLimitMaxRequests'
		>
	> = {},
) =>
	createConfigMock({
		rateLimitWindowMs: 60000, // 1 minute for testing
		rateLimitMaxRequests: 10,
		authRateLimitWindowMs: 300000, // 5 minutes for testing
		authRateLimitMaxRequests: 5,
		apiRateLimitWindowMs: 30000, // 30 seconds for testing
		apiRateLimitMaxRequests: 30,
		...overrides,
	})

/**
 * Unified export object providing all config mock utilities
 * Follows the pattern established by other mock helpers
 */
export const mockConfig = {
	/** Create a basic config mock with optional overrides */
	create: createConfigMock,
	/** Create module mock for vi.mock() calls */
	createModule: createConfigModuleMock,
	/** Setup config mock for beforeEach hooks */
	setup: setupConfigMock,

	// Default configurations
	/** Default test configuration values */
	defaults: defaultTestConfig,

	// Environment-specific creators
	/** Create development environment config */
	development: createDevelopmentConfig,
	/** Create production environment config */
	production: createProductionConfig,
	/** Create test environment config */
	test: createTestConfig,

	// Feature-specific creators
	/** Create Cognito-focused config */
	cognito: createCognitoConfig,
	/** Create database-focused config */
	database: createDatabaseConfig,
	/** Create rate limiting-focused config */
	rateLimit: createRateLimitConfig,
}

// Export types for use in test files
export type { ConfigType }
