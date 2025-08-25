/**
 * Unit tests for the enhanced environment configuration system
 */

import { existsSync, mkdirSync, unlinkSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Import the functions we're testing
import { getEnvironmentType, loadEnvConfig } from './env-config.js'

describe('Enhanced Environment Configuration System', () => {
	const originalEnv = process.env
	const testDir = join(tmpdir(), 'macro-ai-env-config-tests')

	// Valid test configuration
	const validConfig = {
		API_KEY: 'test-api-key-fake-value-for-testing-only',
		NODE_ENV: 'test' as const,
		APP_ENV: 'test',
		SERVER_PORT: '3000',
		AWS_COGNITO_REGION: 'us-east-1',
		AWS_COGNITO_USER_POOL_ID: 'test-pool-id',
		AWS_COGNITO_USER_POOL_CLIENT_ID: 'test-client-id',
		AWS_COGNITO_USER_POOL_SECRET_KEY: 'test-pool-secret-key-32-chars-long',
		AWS_COGNITO_ACCESS_KEY: 'test-access-key',
		AWS_COGNITO_SECRET_KEY: 'test-secret-key',
		AWS_COGNITO_REFRESH_TOKEN_EXPIRY: '30',
		OPENAI_API_KEY: 'sk-test-fake-openai-key-for-testing-only',
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
		REDIS_URL: 'redis://localhost:6379',
	}

	beforeEach(() => {
		// Clear environment completely
		process.env = {}

		// Set only the minimum required environment variables
		process.env.NODE_ENV = 'test'

		// Create test directory
		if (!existsSync(testDir)) {
			mkdirSync(testDir, { recursive: true })
		}

		// Mock process.cwd to return test directory to prevent loading root .env
		vi.spyOn(process, 'cwd').mockReturnValue(testDir)
	})

	afterEach(() => {
		// Restore original environment
		process.env = originalEnv

		// Restore process.cwd mock
		vi.restoreAllMocks()

		// Clean up test files
		try {
			unlinkSync(join(testDir, '.env'))
			unlinkSync(join(testDir, '.env.local'))
			unlinkSync(join(testDir, '.env.development'))
			unlinkSync(join(testDir, '.env.test'))
			unlinkSync(join(testDir, '.env.preview'))
		} catch {
			// Ignore errors if files don't exist
		}
	})

	describe('getEnvironmentType', () => {
		it('should detect development environment by default', () => {
			delete process.env.NODE_ENV
			delete process.env.APP_ENV

			const envType = getEnvironmentType()

			expect(envType).toBe('development')
		})

		it('should detect test environment from NODE_ENV', () => {
			process.env.NODE_ENV = 'test'

			const envType = getEnvironmentType()

			expect(envType).toBe('test')
		})

		it('should detect preview environment from APP_ENV pattern', () => {
			process.env.NODE_ENV = 'production'
			process.env.APP_ENV = 'pr-123'

			const envType = getEnvironmentType()

			expect(envType).toBe('preview')
		})

		it('should detect staging environment', () => {
			process.env.NODE_ENV = 'production'
			process.env.APP_ENV = 'staging'

			const envType = getEnvironmentType()

			expect(envType).toBe('staging')
		})

		it('should detect production environment', () => {
			process.env.NODE_ENV = 'production'
			process.env.APP_ENV = 'production'

			const envType = getEnvironmentType()

			expect(envType).toBe('production')
		})

		it('should respect forced environment type', () => {
			process.env.NODE_ENV = 'production'
			process.env.APP_ENV = 'staging'

			const envType = getEnvironmentType('test')

			expect(envType).toBe('test')
		})
	})

	describe('loadEnvConfig', () => {
		it('should load configuration from environment variables', () => {
			// Set valid environment variables
			Object.entries(validConfig).forEach(([key, value]) => {
				process.env[key] = value
			})

			const result = loadEnvConfig()

			// Check result structure
			expect(result).toBeDefined()
			expect(Array.isArray(result)).toBe(true)
			expect(result).toHaveLength(2)

			// Check success case
			expect(result[0]).toBeTruthy()
			expect(result[1]).toBeNull()

			const data = result[0] as Record<string, unknown>
			expect(data.API_KEY).toBe(validConfig.API_KEY)
			expect(data.NODE_ENV).toBe(validConfig.NODE_ENV)
			expect(data.SERVER_PORT).toBe(3000) // Should be converted to number
		})

		it('should load configuration from .env file', () => {
			// Create .env file
			const envFilePath = join(testDir, '.env')
			const envContent = Object.entries(validConfig)
				.map(([key, value]) => `${key}=${value}`)
				.join('\n')
			writeFileSync(envFilePath, envContent, 'utf-8')

			const result = loadEnvConfig({
				baseDir: testDir,
			})

			// Check success case
			expect(result[0]).toBeTruthy()
			expect(result[1]).toBeNull()

			const data = result[0] as Record<string, unknown>
			expect(data.API_KEY).toBe(validConfig.API_KEY)
		})

		it('should respect validateSchema option', () => {
			// Set invalid configuration
			process.env.API_KEY = 'invalid-key' // Too short
			process.env.NODE_ENV = 'test'

			const result = loadEnvConfig({
				validateSchema: false,
			})

			// Should succeed when validation is disabled
			expect(result[0]).toBeTruthy()
			expect(result[1]).toBeNull()
		})

		it('should respect enableLogging option', () => {
			// eslint-disable-next-line @typescript-eslint/no-empty-function
			const loggerSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

			// Set valid environment variables
			Object.entries(validConfig).forEach(([key, value]) => {
				process.env[key] = value
			})

			loadEnvConfig({
				enableLogging: false,
			})

			// Should not log when logging is disabled
			expect(loggerSpy).not.toHaveBeenCalled()

			loggerSpy.mockRestore()
		})

		it('should handle custom base directory', () => {
			// Create .env file in custom directory
			const customDir = join(testDir, 'custom')
			if (!existsSync(customDir)) {
				mkdirSync(customDir, { recursive: true })
			}

			const envFilePath = join(customDir, '.env')
			const envContent = Object.entries(validConfig)
				.map(([key, value]) => `${key}=${value}`)
				.join('\n')
			writeFileSync(envFilePath, envContent, 'utf-8')

			const result = loadEnvConfig({
				baseDir: customDir,
			})

			// Check success case
			expect(result[0]).toBeTruthy()
			expect(result[1]).toBeNull()

			const data = result[0] as Record<string, unknown>
			expect(data.API_KEY).toBe(validConfig.API_KEY)
		})
	})
})
