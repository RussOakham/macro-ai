/**
 * Tests for load-config.ts
 */

import { config as dotenvConfig } from 'dotenv'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { loadConfig } from '../load-config.js'

// Mock dotenv
vi.mock('dotenv', () => ({
	config: vi.fn().mockReturnValue({ parsed: {}, error: null }),
}))

describe('loadConfig', () => {
	const originalEnv = process.env

	beforeEach(() => {
		vi.clearAllMocks()
		// Reset process.env to a clean state
		process.env = { ...originalEnv }
		// Clear Lambda environment indicators
		delete process.env.AWS_LAMBDA_FUNCTION_NAME
		delete process.env.AWS_LAMBDA_RUNTIME_API
		delete process.env.LAMBDA_RUNTIME_DIR
	})

	afterEach(() => {
		process.env = originalEnv
	})

	it('should successfully load and validate valid environment configuration', () => {
		// Set up valid environment variables
		process.env.NODE_ENV = 'development'
		process.env.AWS_REGION = 'us-east-1'
		process.env.AWS_LAMBDA_FUNCTION_NAME = 'test-lambda'
		process.env.LOG_LEVEL = 'info'

		const [config, error] = loadConfig()

		expect(error).toBeNull()
		expect(config).toBeDefined()
		expect(config?.NODE_ENV).toBe('development')
		expect(config?.AWS_REGION).toBe('us-east-1')
		expect(config?.AWS_LAMBDA_FUNCTION_NAME).toBe('test-lambda')
		expect(config?.LOG_LEVEL).toBe('info')
		expect(config?.PARAMETER_STORE_CACHE_TTL).toBe(300)
	})

	it('should use default values for optional environment variables', () => {
		// Set only required environment variables and clear NODE_ENV to test default
		delete process.env.NODE_ENV
		process.env.AWS_REGION = 'us-west-2'
		process.env.AWS_LAMBDA_FUNCTION_NAME = 'test-lambda'

		const [config, error] = loadConfig()

		expect(error).toBeNull()
		expect(config?.NODE_ENV).toBe('production') // default
		expect(config?.LOG_LEVEL).toBe('info') // default
		expect(config?.PARAMETER_STORE_CACHE_TTL).toBe(300) // default
	})

	it('should detect Lambda environment correctly', () => {
		// Set Lambda environment indicators
		process.env.AWS_LAMBDA_FUNCTION_NAME = 'test-lambda'
		process.env.AWS_LAMBDA_RUNTIME_API = 'test-api'
		process.env.AWS_REGION = 'us-east-1'

		const [config, error] = loadConfig()

		expect(error).toBeNull()
		expect(config).toBeDefined()
	})

	it('should reject invalid NODE_ENV values', () => {
		process.env.NODE_ENV = 'invalid'
		process.env.AWS_REGION = 'us-east-1'
		process.env.AWS_LAMBDA_FUNCTION_NAME = 'test-lambda'

		const [config, error] = loadConfig()

		expect(config).toBeNull()
		expect(error).toBeDefined()
		expect(error?.message).toContain('Invalid environment configuration')
		expect(error?.type).toBe('ValidationError')
	})

	it('should reject invalid LOG_LEVEL values', () => {
		process.env.NODE_ENV = 'production'
		process.env.AWS_REGION = 'us-east-1'
		process.env.AWS_LAMBDA_FUNCTION_NAME = 'test-lambda'
		process.env.LOG_LEVEL = 'invalid'

		const [config, error] = loadConfig()

		expect(config).toBeNull()
		expect(error).toBeDefined()
		expect(error?.message).toContain('Invalid environment configuration')
	})

	it('should validate numeric environment variables', () => {
		process.env.NODE_ENV = 'production'
		process.env.AWS_REGION = 'us-east-1'
		process.env.AWS_LAMBDA_FUNCTION_NAME = 'test-lambda'
		process.env.PARAMETER_STORE_CACHE_TTL = 'not-a-number'

		const [config, error] = loadConfig()

		expect(config).toBeNull()
		expect(error).toBeDefined()
		expect(error?.message).toContain('Invalid environment configuration')
	})

	it('should validate LAMBDA_MEMORY_SIZE range', () => {
		process.env.NODE_ENV = 'production'
		process.env.AWS_REGION = 'us-east-1'
		process.env.AWS_LAMBDA_FUNCTION_NAME = 'test-lambda'
		process.env.LAMBDA_MEMORY_SIZE = '64' // Below minimum

		const [config, error] = loadConfig()

		expect(config).toBeNull()
		expect(error).toBeDefined()
		expect(error?.message).toContain('Invalid environment configuration')
	})

	it('should validate LAMBDA_TIMEOUT range', () => {
		process.env.NODE_ENV = 'production'
		process.env.AWS_REGION = 'us-east-1'
		process.env.AWS_LAMBDA_FUNCTION_NAME = 'test-lambda'
		process.env.LAMBDA_TIMEOUT = '1000' // Above maximum

		const [config, error] = loadConfig()

		expect(config).toBeNull()
		expect(error).toBeDefined()
		expect(error?.message).toContain('Invalid environment configuration')
	})

	it('should handle missing required environment variables', () => {
		// Clear all environment variables to test validation failure
		delete process.env.NODE_ENV
		delete process.env.AWS_REGION
		delete process.env.AWS_LAMBDA_FUNCTION_NAME

		// Mock dotenv to return an error to simulate missing .env file
		vi.mocked(dotenvConfig).mockReturnValueOnce({
			parsed: undefined,
			error: new Error('ENOENT: no such file or directory'),
		})

		const [config, error] = loadConfig()

		expect(config).toBeNull()
		expect(error).toBeDefined()
		expect(error?.type).toBe('ConfigurationError')
	})
})
