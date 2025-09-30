/**
 * Unit tests for the enhanced environment configuration system
 */

import { mkdir, unlink, writeFile } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Import the functions we're testing
import { getEnvironmentType, loadEnvConfig } from '../env-config.ts'

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
		// AWS Cognito credentials removed - using IAM roles instead
		AWS_COGNITO_REFRESH_TOKEN_EXPIRY: '30',
		OPENAI_API_KEY: 'sk-test-fake-openai-key-for-testing-only',
		RELATIONAL_DATABASE_URL:
			'postgresql://testuser:testpass@localhost:5432/testdb',
		REDIS_URL: 'redis://localhost:6379',
		COOKIE_ENCRYPTION_KEY: 'test-cookie-encryption-key-32-chars-long-enough',
		COOKIE_DOMAIN: 'localhost',
		CORS_ALLOWED_ORIGINS: 'http://localhost:3000,http://localhost:5173',
		RATE_LIMIT_WINDOW_MS: '900000',
		RATE_LIMIT_MAX_REQUESTS: '100',
		AUTH_RATE_LIMIT_WINDOW_MS: '900000',
		AUTH_RATE_LIMIT_MAX_REQUESTS: '5',
		API_RATE_LIMIT_WINDOW_MS: '60000',
		API_RATE_LIMIT_MAX_REQUESTS: '1000',
	}

	beforeEach(async () => {
		// Clear environment completely
		process.env = {}

		// Set only the minimum required environment variables
		process.env.NODE_ENV = 'test'

		// Create test directory
		const mkdirAsync = promisify(mkdir)
		try {
			await mkdirAsync(testDir, { recursive: true })
		} catch {
			// Directory already exists or creation failed
		}

		// Mock process.cwd to return test directory to prevent loading root .env
		vi.spyOn(process, 'cwd').mockReturnValue(testDir)
	})

	afterEach(async () => {
		// Restore original environment
		process.env = originalEnv

		// Restore process.cwd mock
		vi.restoreAllMocks()

		// Clean up test files
		const unlinkAsync = promisify(unlink)
		const filesToClean = [
			join(testDir, '.env'),
			join(testDir, '.env.local'),
			join(testDir, '.env.development'),
			join(testDir, '.env.test'),
			join(testDir, '.env.preview'),
		]

		for (const file of filesToClean) {
			try {
				await unlinkAsync(file)
			} catch {
				// Ignore errors if files don't exist
			}
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
		it('should load configuration from environment variables', async () => {
			// Set valid environment variables
			Object.entries(validConfig).forEach(([key, value]) => {
				process.env[key] = value
			})

			const result = await loadEnvConfig()

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

		it('should load configuration from .env file', async () => {
			// Create .env file
			const envFilePath = join(testDir, '.env')
			const envContent = Object.entries(validConfig)
				.map(([key, value]) => `${key}=${value}`)
				.join('\n')
			const writeFileAsync = promisify(writeFile)
			await writeFileAsync(envFilePath, envContent, 'utf8')

			const result = await loadEnvConfig({
				baseDir: testDir,
			})

			// Check success case
			expect(result[0]).toBeTruthy()
			expect(result[1]).toBeNull()

			const data = result[0] as Record<string, unknown>
			expect(data.API_KEY).toBe(validConfig.API_KEY)
		})

		it('should respect validateSchema option', async () => {
			// Set invalid configuration
			process.env.API_KEY = 'invalid-key' // Too short
			process.env.NODE_ENV = 'test'

			const result = await loadEnvConfig({
				validateSchema: false,
			})

			// Should succeed when validation is disabled
			expect(result[0]).toBeTruthy()
			expect(result[1]).toBeNull()
		})

		it('should respect enableLogging option', async () => {
			const loggerSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

			// Set valid environment variables
			Object.entries(validConfig).forEach(([key, value]) => {
				process.env[key] = value
			})

			await loadEnvConfig({
				enableLogging: false,
			})

			// Should not log when logging is disabled
			expect(loggerSpy).not.toHaveBeenCalled()

			loggerSpy.mockRestore()
		})

		it('should handle custom base directory', async () => {
			// Create .env file in custom directory
			const customDir = join(testDir, 'custom')
			const mkdirAsync = promisify(mkdir)
			try {
				await mkdirAsync(customDir, { recursive: true })
			} catch {
				// Directory already exists or creation failed
			}

			const envFilePath = join(customDir, '.env')
			const envContent = Object.entries(validConfig)
				.map(([key, value]) => `${key}=${value}`)
				.join('\n')
			const writeFileAsync = promisify(writeFile)
			await writeFileAsync(envFilePath, envContent, 'utf8')

			const result = await loadEnvConfig({
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
