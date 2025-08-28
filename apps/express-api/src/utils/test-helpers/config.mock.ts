import { vi } from 'vitest'

import type { Config } from '../../utils/load-config.ts'

/**
 * Config Mock Helper for Express API Tests
 * Provides type-safe mocking for application configuration
 *
 * This mock now matches the simplified load-config.ts structure
 * which directly exposes environment variables without complex loading logic
 */

/**
 * Use the actual Config type from load-config.ts
 */
type ConfigType = Config

/**
 * Default test configuration values
 * These provide sensible defaults for testing while maintaining type safety
 */
export const defaultTestConfig: ConfigType = {
	// API Configuration
	API_KEY: 'test-api-key-12345678901234567890',
	NODE_ENV: 'test',
	APP_ENV: 'test',
	SERVER_PORT: 3000,

	// AWS Cognito Configuration
	AWS_COGNITO_REGION: 'us-east-1',
	AWS_COGNITO_USER_POOL_ID: 'test-pool-id',
	AWS_COGNITO_USER_POOL_CLIENT_ID: 'test-client-id',
	// AWS Cognito credentials removed - using IAM roles instead
	AWS_COGNITO_REFRESH_TOKEN_EXPIRY: 30,

	// Cookie Configuration
	COOKIE_DOMAIN: 'localhost',
	COOKIE_ENCRYPTION_KEY: 'test-cookie-encryption-key-32-chars',

	// Database Configuration
	RELATIONAL_DATABASE_URL: 'postgresql://test:test@localhost:5432/test_db',

	// OpenAI Configuration
	OPENAI_API_KEY: 'sk-test-mock-key-for-testing-only',

	// Rate Limiting Configuration
	RATE_LIMIT_WINDOW_MS: 900000, // 15 minutes
	RATE_LIMIT_MAX_REQUESTS: 100,
	AUTH_RATE_LIMIT_WINDOW_MS: 3600000, // 1 hour
	AUTH_RATE_LIMIT_MAX_REQUESTS: 10,
	API_RATE_LIMIT_WINDOW_MS: 60000, // 1 minute
	API_RATE_LIMIT_MAX_REQUESTS: 60,

	// Redis Configuration
	REDIS_URL: 'redis://localhost:6379',
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
		NODE_ENV: 'development',
		APP_ENV: 'development',
		SERVER_PORT: 3001,
	})

/**
 * Create production environment config
 * @returns Config mock configured for production environment
 */
export const createProductionConfig = () =>
	createConfigMock({
		NODE_ENV: 'production',
		APP_ENV: 'production',
		SERVER_PORT: 8080,
	})

/**
 * Create staging environment config
 * @returns Config mock configured for staging environment
 */
export const createStagingConfig = () =>
	createConfigMock({
		NODE_ENV: 'production', // Staging uses NODE_ENV=production for library optimizations
		APP_ENV: 'staging',
		SERVER_PORT: 3040,
	})

/**
 * Create test environment config (default)
 * @returns Config mock configured for test environment
 */
export const createTestConfig = () =>
	createConfigMock({
		NODE_ENV: 'test',
		APP_ENV: 'test',
		SERVER_PORT: 3000,
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
			| 'AWS_COGNITO_REGION'
			| 'AWS_COGNITO_USER_POOL_ID'
			| 'AWS_COGNITO_USER_POOL_CLIENT_ID'
			// AWS Cognito credentials removed - using IAM roles instead
			| 'AWS_COGNITO_REFRESH_TOKEN_EXPIRY'
		>
	> = {},
) =>
	createConfigMock({
		AWS_COGNITO_REGION: 'us-west-2',
		AWS_COGNITO_USER_POOL_ID: 'cognito-test-pool-id',
		AWS_COGNITO_USER_POOL_CLIENT_ID: 'cognito-test-client-id',
		// AWS Cognito credentials removed - using IAM roles instead
		AWS_COGNITO_REFRESH_TOKEN_EXPIRY: 60,
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
		Pick<ConfigType, 'RELATIONAL_DATABASE_URL' | 'REDIS_URL'>
	> = {},
) =>
	createConfigMock({
		RELATIONAL_DATABASE_URL:
			'postgresql://testuser:testpass@localhost:5432/testdb',
		REDIS_URL: 'redis://localhost:6379/testdb',
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
			| 'RATE_LIMIT_WINDOW_MS'
			| 'RATE_LIMIT_MAX_REQUESTS'
			| 'AUTH_RATE_LIMIT_WINDOW_MS'
			| 'AUTH_RATE_LIMIT_MAX_REQUESTS'
			| 'API_RATE_LIMIT_WINDOW_MS'
			| 'API_RATE_LIMIT_MAX_REQUESTS'
		>
	> = {},
) =>
	createConfigMock({
		RATE_LIMIT_WINDOW_MS: 60000, // 1 minute for testing
		RATE_LIMIT_MAX_REQUESTS: 10,
		AUTH_RATE_LIMIT_WINDOW_MS: 300000, // 5 minutes for testing
		AUTH_RATE_LIMIT_MAX_REQUESTS: 5,
		API_RATE_LIMIT_WINDOW_MS: 30000, // 30 seconds for testing
		API_RATE_LIMIT_MAX_REQUESTS: 30,
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
	/** Create staging environment config */
	staging: createStagingConfig,
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
