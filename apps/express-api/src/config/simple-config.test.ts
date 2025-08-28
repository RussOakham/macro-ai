/* eslint-disable @typescript-eslint/no-dynamic-delete */
/**
 * Unit tests for the simplified configuration system
 */

import { existsSync, mkdirSync, unlinkSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Import the functions we're testing
import { assertConfig, getConfig, loadConfig } from './simple-config.js'

describe.skip('Simple Configuration System', () => {
	const originalEnv = process.env
	const testDir = join(tmpdir(), 'macro-ai-config-tests')

	// Valid test configuration
	const validConfig = {
		API_KEY: 'test-api-key-12345678901234567890',
		NODE_ENV: 'test' as const,
		APP_ENV: 'test',
		SERVER_PORT: '3000',
		AWS_COGNITO_REGION: 'us-east-1',
		AWS_COGNITO_USER_POOL_ID: 'test-pool-id',
		AWS_COGNITO_USER_POOL_CLIENT_ID: 'test-client-id',
		AWS_COGNITO_USER_POOL_SECRET_KEY: 'test-pool-secret-key-32-chars-long',
		// AWS Cognito credentials removed - using IAM roles instead
		AWS_COGNITO_REFRESH_TOKEN_EXPIRY: '30',
		OPENAI_API_KEY: 'test-openai-key',
		RELATIONAL_DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
		NON_RELATIONAL_DATABASE_URL: 'redis://localhost:6379',
		COOKIE_ENCRYPTION_KEY: 'test-cookie-encryption-key-32-chars',
		COOKIE_DOMAIN: 'localhost',
	}

	beforeEach(() => {
		// Clear environment
		process.env = { ...originalEnv }

		// Clear all config-related env vars
		Object.keys(validConfig).forEach((key) => {
			delete process.env[key]
		})

		// Create test directory
		if (!existsSync(testDir)) {
			mkdirSync(testDir, { recursive: true })
		}
	})

	afterEach(() => {
		// Restore original environment
		process.env = originalEnv
	})

	describe.skip('loadConfig', () => {
		it('should successfully load valid configuration', () => {
			// Set valid environment variables
			Object.entries(validConfig).forEach(([key, value]) => {
				process.env[key] = value
			})

			const [config, error] = loadConfig()

			expect(error).toBeNull()
			expect(config).toBeDefined()
			expect(config?.API_KEY).toBe(validConfig.API_KEY)
			expect(config?.NODE_ENV).toBe(validConfig.NODE_ENV)
			expect(config?.SERVER_PORT).toBe(3000) // Should be converted to number
		})

		it('should return error for missing required variables', () => {
			// Set only partial configuration
			process.env.API_KEY = validConfig.API_KEY
			process.env.NODE_ENV = validConfig.NODE_ENV

			const [config, error] = loadConfig()

			expect(config).toBeNull()
			expect(error).toBeDefined()
			expect(error?.message).toContain('validation')
		})

		it('should validate environment variable types', () => {
			// Set invalid types
			const invalidConfig = {
				...validConfig,
				SERVER_PORT: 'not-a-number',
				AWS_COGNITO_REFRESH_TOKEN_EXPIRY: 'invalid',
			}

			Object.entries(invalidConfig).forEach(([key, value]) => {
				process.env[key] = value
			})

			const [config, error] = loadConfig()

			expect(config).toBeNull()
			expect(error).toBeDefined()
			expect(error?.message).toContain('validation')
		})

		it('should load .env file in non-production environments', () => {
			const envFile = join(testDir, '.env.test')

			// Create .env file
			const envContent = Object.entries(validConfig)
				.map(([key, value]) => `${key}=${value}`)
				.join('\n')
			writeFileSync(envFile, envContent)

			process.env.NODE_ENV = 'test'

			try {
				const [config, error] = loadConfig({
					envFilePath: envFile,
				})

				expect(error).toBeNull()
				expect(config).toBeDefined()
				expect(config?.API_KEY).toBe(validConfig.API_KEY)
			} finally {
				if (existsSync(envFile)) {
					unlinkSync(envFile)
				}
			}
		})

		it('should skip .env file in production environment', () => {
			const envFile = join(testDir, '.env.prod')

			// Create .env file
			const envContent = Object.entries(validConfig)
				.map(([key, value]) => `${key}=${value}`)
				.join('\n')
			writeFileSync(envFile, envContent)

			// Set production environment
			process.env.NODE_ENV = 'production'

			// Don't set any other env vars - should fail validation
			try {
				const [config, error] = loadConfig({
					envFilePath: envFile,
				})

				// Should fail because .env file is not loaded in production
				expect(config).toBeNull()
				expect(error).toBeDefined()
			} finally {
				if (existsSync(envFile)) {
					unlinkSync(envFile)
				}
			}
		})

		it('should prioritize environment variables over .env file', () => {
			const envFile = join(testDir, '.env.priority')

			// Create .env file with one API key
			const envFileConfig = {
				...validConfig,
				API_KEY: 'env-file-api-key-12345678901234567890',
			}
			const envContent = Object.entries(envFileConfig)
				.map(([key, value]) => `${key}=${value}`)
				.join('\n')
			writeFileSync(envFile, envContent)

			// Set environment variable with different API key
			Object.entries(validConfig).forEach(([key, value]) => {
				process.env[key] = value
			})
			process.env.API_KEY = 'env-var-api-key-12345678901234567890'
			process.env.NODE_ENV = 'test'

			try {
				const [config, error] = loadConfig({
					envFilePath: envFile,
				})

				expect(error).toBeNull()
				expect(config).toBeDefined()
				// Environment variable should take precedence
				expect(config?.API_KEY).toBe('env-var-api-key-12345678901234567890')
			} finally {
				if (existsSync(envFile)) {
					unlinkSync(envFile)
				}
			}
		})

		it('should handle missing .env file gracefully', () => {
			// Set valid environment variables
			Object.entries(validConfig).forEach(([key, value]) => {
				process.env[key] = value
			})

			const [config, error] = loadConfig({
				envFilePath: '/non/existent/path/.env',
			})

			// Should still work with environment variables
			expect(error).toBeNull()
			expect(config).toBeDefined()
		})

		it('should allow disabling schema validation', () => {
			// Set incomplete configuration
			process.env.API_KEY = 'short' // Too short, would normally fail validation

			const [config, error] = loadConfig({
				validateSchema: false,
			})

			expect(error).toBeNull()
			expect(config).toBeDefined()
		})

		it('should allow disabling logging', () => {
			// eslint-disable-next-line @typescript-eslint/no-empty-function
			const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

			Object.entries(validConfig).forEach(([key, value]) => {
				process.env[key] = value
			})

			const [config, error] = loadConfig({
				enableLogging: false,
			})

			expect(error).toBeNull()
			expect(config).toBeDefined()

			consoleSpy.mockRestore()
		})
	})

	describe('assertConfig', () => {
		it('should return config when valid', () => {
			Object.entries(validConfig).forEach(([key, value]) => {
				process.env[key] = value
			})

			const config = assertConfig()

			expect(config).toBeDefined()
			expect(config.apiKey).toBe(validConfig.API_KEY)
			expect(config.nodeEnv).toBe(validConfig.NODE_ENV)
			expect(config.port).toBe(3000)
		})

		it('should throw error when invalid', () => {
			// Set invalid configuration
			process.env.API_KEY = 'short' // Too short

			expect(() => {
				assertConfig()
			}).toThrow()
		})

		it('should convert to camelCase properties', () => {
			Object.entries(validConfig).forEach(([key, value]) => {
				process.env[key] = value
			})

			const config = assertConfig()

			// Test camelCase conversion
			expect(config.apiKey).toBe(validConfig.API_KEY)
			expect(config.awsCognitoRegion).toBe(validConfig.AWS_COGNITO_REGION)
			expect(config.awsCognitoUserPoolId).toBe(
				validConfig.AWS_COGNITO_USER_POOL_ID,
			)
			expect(config.awsCognitoRefreshTokenExpiry).toBe(30) // Should be converted to number
			expect(config.relationalDatabaseUrl).toBe(
				validConfig.RELATIONAL_DATABASE_URL,
			)
			expect(config.cookieEncryptionKey).toBe(validConfig.COOKIE_ENCRYPTION_KEY)
		})
	})

	describe('getConfig', () => {
		it('should return config when valid', () => {
			Object.entries(validConfig).forEach(([key, value]) => {
				process.env[key] = value
			})

			const config = getConfig()

			expect(config).toBeDefined()
			expect(config.API_KEY).toBe(validConfig.API_KEY)
		})

		it('should throw error when invalid', () => {
			// Set invalid configuration
			process.env.API_KEY = 'short' // Too short

			expect(() => {
				getConfig()
			}).toThrow()
		})
	})
})
