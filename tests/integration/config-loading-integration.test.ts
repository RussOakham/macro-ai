/* eslint-disable @typescript-eslint/no-dynamic-delete */
/**
 * Configuration Loading Integration Tests
 *
 * Tests the simple-config.ts system including:
 * - Environment variable loading and validation
 * - Zod schema validation for type checking
 * - CamelCase conversion functionality
 * - Error handling for missing or invalid configuration
 * - Integration with different environment setups
 */

import { existsSync, mkdirSync, unlinkSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

// Import the configuration system we're testing
// Note: We need to dynamically import to control environment variables
type ConfigModule =
	typeof import('../../apps/express-api/src/config/simple-config.ts')

// Test configuration
const TEST_CONFIG = {
	// Complete valid configuration for testing
	validConfig: {
		API_KEY: 'test-api-key-12345678901234567890123456789012',
		NODE_ENV: 'test' as const,
		APP_ENV: 'test',
		SERVER_PORT: '3000',
		AWS_COGNITO_REGION: 'us-east-1',
		AWS_COGNITO_USER_POOL_ID: 'test-pool-id',
		AWS_COGNITO_USER_POOL_CLIENT_ID: 'test-client-id',
		AWS_COGNITO_USER_POOL_SECRET_KEY: 'test-pool-secret-key-32-chars-long',
		// AWS Cognito credentials removed - using IAM roles instead
		AWS_COGNITO_REFRESH_TOKEN_EXPIRY: '30',
		OPENAI_API_KEY: 'sk-test-openai-key-12345678901234567890123456789012',
		RELATIONAL_DATABASE_URL:
			'postgresql://testuser:testpass@localhost:5432/testdb',
		NON_RELATIONAL_DATABASE_URL: 'redis://localhost:6379',
		COOKIE_ENCRYPTION_KEY: 'test-cookie-encryption-key-32-chars-long-enough',
		COOKIE_DOMAIN: 'localhost',
		CORS_ALLOWED_ORIGINS: 'http://localhost:3000,http://localhost:5173',
		RATE_LIMIT_WINDOW_MS: '900000',
		RATE_LIMIT_MAX_REQUESTS: '100',
		AUTH_RATE_LIMIT_WINDOW_MS: '900000',
		AUTH_RATE_LIMIT_MAX_REQUESTS: '5',
		API_RATE_LIMIT_WINDOW_MS: '60000',
		API_RATE_LIMIT_MAX_REQUESTS: '1000',
	},

	// Test directories
	testDir: join(tmpdir(), 'macro-ai-config-tests'),
}

// Test utilities
const ConfigTestUtils = (() => {
	let originalEnv: Record<string, string | undefined> = {}

	return {
		setEnvironmentVariables: (env: Record<string, string>) => {
			// Save original environment
			originalEnv = { ...process.env }

			// Clear existing environment variables
			for (const key of Object.keys(TEST_CONFIG.validConfig)) {
				delete process.env[key]
			}

			// Set new environment variables
			for (const [key, value] of Object.entries(env)) {
				process.env[key] = value
			}
		},

		restoreEnvironment: () => {
			// Restore original environment
			for (const [key, value] of Object.entries(originalEnv)) {
				if (value === undefined) {
					delete process.env[key]
				} else {
					process.env[key] = value
				}
			}
			originalEnv = {}
		},

		createEnvFile: (filePath: string, env: Record<string, string>) => {
			// Ensure the directory exists
			const dir = join(filePath, '..')
			if (!existsSync(dir)) {
				mkdirSync(dir, { recursive: true })
			}

			const content = Object.entries(env)
				.map(([key, value]) => `${key}=${value}`)
				.join('\n')

			writeFileSync(filePath, content, 'utf-8')
		},

		importConfigModule: async (): Promise<ConfigModule> => {
			// Clear module cache to ensure fresh import
			const modulePath = '../../apps/express-api/src/config/simple-config.ts'
			const resolvedPath = require.resolve(modulePath)
			if (resolvedPath in require.cache) {
				require.cache[resolvedPath] = undefined
			}

			return await import(modulePath)
		},
	}
})()

describe.skip('Configuration Loading Integration Tests', () => {
	beforeEach(() => {
		// Clear any existing environment variables
		ConfigTestUtils.restoreEnvironment()
	})

	afterEach(() => {
		// Restore original environment after each test
		ConfigTestUtils.restoreEnvironment()
	})

	describe('Environment Variable Loading', () => {
		it('should successfully load valid configuration from environment variables', async () => {
			ConfigTestUtils.setEnvironmentVariables(TEST_CONFIG.validConfig)

			const configModule = await ConfigTestUtils.importConfigModule()
			const [config, error] = configModule.loadConfig()

			expect(error).toBeNull()
			expect(config).toBeDefined()

			if (config) {
				expect(config.API_KEY).toBe(TEST_CONFIG.validConfig.API_KEY)
				expect(config.NODE_ENV).toBe(TEST_CONFIG.validConfig.NODE_ENV)
				expect(config.SERVER_PORT).toBe(3000) // Should be converted to number
				expect(config.AWS_COGNITO_REGION).toBe(
					TEST_CONFIG.validConfig.AWS_COGNITO_REGION,
				)
			}
		})

		it('should validate required environment variables', async () => {
			// Set incomplete configuration (missing required variables)
			const incompleteConfig = {
				API_KEY: 'test-api-key',
				NODE_ENV: 'test',
				// Missing other required variables
			}

			ConfigTestUtils.setEnvironmentVariables(incompleteConfig)

			const configModule = await ConfigTestUtils.importConfigModule()
			const [config, error] = configModule.loadConfig()

			expect(config).toBeNull()
			expect(error).toBeDefined()
			expect(error?.message).toContain('Validation error')
		})

		it('should validate environment variable types and formats', async () => {
			// Set configuration with invalid types
			const invalidConfig = {
				...TEST_CONFIG.validConfig,
				SERVER_PORT: 'not-a-number', // Should be a valid number
				AWS_COGNITO_REFRESH_TOKEN_EXPIRY: 'invalid', // Should be a valid number
			}

			ConfigTestUtils.setEnvironmentVariables(invalidConfig)

			const configModule = await ConfigTestUtils.importConfigModule()
			const [config, error] = configModule.loadConfig()

			expect(config).toBeNull()
			expect(error).toBeDefined()
			expect(error?.message).toContain('Validation error')
		})
	})

	describe('CamelCase Conversion', () => {
		it('should convert environment variables to camelCase properties', async () => {
			ConfigTestUtils.setEnvironmentVariables(TEST_CONFIG.validConfig)

			const configModule = await ConfigTestUtils.importConfigModule()
			const config = configModule.assertConfig()

			// Test camelCase conversion
			expect(config.apiKey).toBe(TEST_CONFIG.validConfig.API_KEY)
			expect(config.nodeEnv).toBe(TEST_CONFIG.validConfig.NODE_ENV)
			expect(config.appEnv).toBe(TEST_CONFIG.validConfig.APP_ENV)
			expect(config.port).toBe(3000)
			expect(config.awsCognitoRegion).toBe(
				TEST_CONFIG.validConfig.AWS_COGNITO_REGION,
			)
			expect(config.awsCognitoUserPoolId).toBe(
				TEST_CONFIG.validConfig.AWS_COGNITO_USER_POOL_ID,
			)
			expect(config.awsCognitoUserPoolClientId).toBe(
				TEST_CONFIG.validConfig.AWS_COGNITO_USER_POOL_CLIENT_ID,
			)
			expect(config.awsCognitoUserPoolSecretKey).toBe(
				TEST_CONFIG.validConfig.AWS_COGNITO_USER_POOL_SECRET_KEY,
			)
			// AWS Cognito credentials removed - using IAM roles instead
			expect(config.awsCognitoRefreshTokenExpiry).toBe(30)
			expect(config.openaiApiKey).toBe(TEST_CONFIG.validConfig.OPENAI_API_KEY)
			expect(config.relationalDatabaseUrl).toBe(
				TEST_CONFIG.validConfig.RELATIONAL_DATABASE_URL,
			)
			expect(config.nonRelationalDatabaseUrl).toBe(
				TEST_CONFIG.validConfig.NON_RELATIONAL_DATABASE_URL,
			)
			expect(config.cookieEncryptionKey).toBe(
				TEST_CONFIG.validConfig.COOKIE_ENCRYPTION_KEY,
			)
			expect(config.cookieDomain).toBe(TEST_CONFIG.validConfig.COOKIE_DOMAIN)
		})

		it('should handle optional properties correctly', async () => {
			// Test with minimal required configuration
			const minimalConfig = {
				API_KEY: 'test-api-key-12345678901234567890123456789012',
				NODE_ENV: 'test',
				APP_ENV: 'test',
				SERVER_PORT: '3000',
				AWS_COGNITO_REGION: 'us-east-1',
				AWS_COGNITO_USER_POOL_ID: 'test-pool-id',
				AWS_COGNITO_USER_POOL_CLIENT_ID: 'test-client-id',
				AWS_COGNITO_USER_POOL_SECRET_KEY: 'test-pool-secret-key-32-chars-long',
				// AWS Cognito credentials removed - using IAM roles instead
				AWS_COGNITO_REFRESH_TOKEN_EXPIRY: '30',
				OPENAI_API_KEY: 'sk-test-openai-key-12345678901234567890123456789012',
				RELATIONAL_DATABASE_URL:
					'postgresql://testuser:testpass@localhost:5432/testdb',
				NON_RELATIONAL_DATABASE_URL: 'redis://localhost:6379',
				COOKIE_ENCRYPTION_KEY:
					'test-cookie-encryption-key-32-chars-long-enough',
				COOKIE_DOMAIN: 'localhost',
				// Add required rate limit properties with valid values
				RATE_LIMIT_WINDOW_MS: '900000',
				RATE_LIMIT_MAX_REQUESTS: '100',
				AUTH_RATE_LIMIT_WINDOW_MS: '900000',
				AUTH_RATE_LIMIT_MAX_REQUESTS: '5',
				API_RATE_LIMIT_WINDOW_MS: '60000',
				API_RATE_LIMIT_MAX_REQUESTS: '1000',
				// Optional properties not set
			}

			ConfigTestUtils.setEnvironmentVariables(minimalConfig)

			const configModule = await ConfigTestUtils.importConfigModule()
			const config = configModule.assertConfig()

			// Required properties should be present
			expect(config.apiKey).toBeDefined()
			expect(config.nodeEnv).toBeDefined()

			// Optional properties should be undefined or have defaults
			expect(config.corsAllowedOrigins).toBeUndefined()
			expect(config.redisUrl).toBeUndefined()
		})
	})

	describe('Error Handling', () => {
		it('should throw error in assertConfig when configuration is invalid', async () => {
			// Set invalid configuration
			const invalidConfig = {
				API_KEY: 'short', // Too short
				NODE_ENV: 'invalid', // Invalid enum value
			}

			ConfigTestUtils.setEnvironmentVariables(invalidConfig)

			const configModule = await ConfigTestUtils.importConfigModule()

			expect(() => {
				configModule.assertConfig()
			}).toThrow()
		})

		it('should handle missing environment variables gracefully in loadConfig', async () => {
			// Set empty environment
			ConfigTestUtils.setEnvironmentVariables({})

			const configModule = await ConfigTestUtils.importConfigModule()
			const [config, error] = configModule.loadConfig()

			expect(config).toBeNull()
			expect(error).toBeDefined()
			expect(error?.message).toContain('Validation error')
		})

		it('should provide detailed error messages for validation failures', async () => {
			// Set configuration with multiple validation errors
			const invalidConfig = {
				API_KEY: 'too-short', // Should be at least 32 characters
				NODE_ENV: 'invalid-env', // Should be development, production, or test
				SERVER_PORT: '-1', // Should be positive number
				AWS_COGNITO_REGION: '', // Should not be empty
			}

			ConfigTestUtils.setEnvironmentVariables(invalidConfig)

			const configModule = await ConfigTestUtils.importConfigModule()
			const [config, error] = configModule.loadConfig()

			expect(config).toBeNull()
			expect(error).toBeDefined()
			expect(error?.message).toContain('Validation error')

			// Error should contain information about multiple validation failures
			const errorMessage = error?.message ?? ''
			expect(errorMessage.length).toBeGreaterThan(50) // Should be detailed
		})
	})

	describe('Environment File Loading', () => {
		it('should load configuration from .env file when present', async () => {
			const envFile = join(TEST_CONFIG.testDir, '.env.test')

			// Create test .env file
			ConfigTestUtils.createEnvFile(envFile, TEST_CONFIG.validConfig)

			// Set environment to point to the test file
			process.env.NODE_ENV = 'test'

			try {
				const configModule = await ConfigTestUtils.importConfigModule()
				const [config, error] = configModule.loadConfig({
					envFilePath: envFile,
				})

				expect(error).toBeNull()
				expect(config).toBeDefined()

				if (config) {
					expect(config.API_KEY).toBe(TEST_CONFIG.validConfig.API_KEY)
					expect(config.NODE_ENV).toBe('test')
				}
			} finally {
				// Cleanup
				if (existsSync(envFile)) {
					unlinkSync(envFile)
				}
			}
		})

		it('should prioritize environment variables over .env file', async () => {
			const envFile = join(TEST_CONFIG.testDir, '.env.test')

			// Create .env file with one API key
			const envFileConfig = {
				...TEST_CONFIG.validConfig,
				API_KEY: 'env-file-api-key-12345678901234567890',
			}
			ConfigTestUtils.createEnvFile(envFile, envFileConfig)

			// Set environment variable with different API key
			const envVarConfig = {
				...TEST_CONFIG.validConfig,
				API_KEY: 'env-var-api-key-12345678901234567890',
			}
			ConfigTestUtils.setEnvironmentVariables(envVarConfig)

			try {
				const configModule = await ConfigTestUtils.importConfigModule()
				const [config, error] = configModule.loadConfig({
					envFilePath: envFile,
				})

				expect(error).toBeNull()
				expect(config).toBeDefined()

				if (config) {
					// Environment variable should take precedence
					expect(config.API_KEY).toBe('env-var-api-key-12345678901234567890')
				}
			} finally {
				// Cleanup
				if (existsSync(envFile)) {
					unlinkSync(envFile)
				}
			}
		})
	})

	describe('Different Environment Configurations', () => {
		it('should handle development environment configuration', async () => {
			const devConfig = {
				...TEST_CONFIG.validConfig,
				NODE_ENV: 'development',
				APP_ENV: 'development',
			}

			ConfigTestUtils.setEnvironmentVariables(devConfig)

			const configModule = await ConfigTestUtils.importConfigModule()
			const config = configModule.assertConfig()

			expect(config.nodeEnv).toBe('development')
			expect(config.appEnv).toBe('development')
		})

		it('should handle production environment configuration', async () => {
			const prodConfig = {
				...TEST_CONFIG.validConfig,
				NODE_ENV: 'production',
				APP_ENV: 'production',
			}

			ConfigTestUtils.setEnvironmentVariables(prodConfig)

			const configModule = await ConfigTestUtils.importConfigModule()
			const config = configModule.assertConfig()

			expect(config.nodeEnv).toBe('production')
			expect(config.appEnv).toBe('production')
		})

		it('should handle PR environment configuration', async () => {
			const prConfig = {
				...TEST_CONFIG.validConfig,
				NODE_ENV: 'production',
				APP_ENV: 'pr-123',
			}

			ConfigTestUtils.setEnvironmentVariables(prConfig)

			const configModule = await ConfigTestUtils.importConfigModule()
			const config = configModule.assertConfig()

			expect(config.nodeEnv).toBe('production')
			expect(config.appEnv).toBe('pr-123')
		})
	})
})
