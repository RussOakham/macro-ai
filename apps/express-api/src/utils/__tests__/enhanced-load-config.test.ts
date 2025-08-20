/* eslint-disable @typescript-eslint/unbound-method */
/**
 * Unit tests for Enhanced Configuration Loader
 * Tests integration between Parameter Store and environment variable loading
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { AppError } from '../errors.ts'
import {
	clearConfigCache,
	getConfigCacheStats,
	getConfigWithSource,
	loadEnhancedConfig,
} from '../load-config.ts'

// Mock dotenv
vi.mock('dotenv', () => ({
	config: vi.fn(),
}))

// Mock path
vi.mock('path', () => ({
	resolve: vi.fn(),
}))

// Mock the enhanced config service
vi.mock('../../services/enhanced-config.service.ts', () => ({
	enhancedConfigService: {
		getAllMappedConfig: vi.fn(),
		getConfig: vi.fn(),
		clearCache: vi.fn(),
		getCacheStats: vi.fn(),
	},
}))

// Mock the logger
vi.mock('../logger.ts', () => ({
	pino: {
		logger: {
			info: vi.fn(),
			debug: vi.fn(),
			error: vi.fn(),
			warn: vi.fn(),
		},
	},
}))

// Mock zod-validation-error
vi.mock('zod-validation-error', () => ({
	fromError: vi.fn(),
}))

// Mock the env schema
vi.mock('../env.schema.ts', () => ({
	envSchema: {
		safeParse: vi.fn(),
	},
}))

// Import mocked functions
import { config as dotenvConfig } from 'dotenv'
import { resolve } from 'path'
import { fromError } from 'zod-validation-error'

import { enhancedConfigService } from '../../services/enhanced-config.service.ts'
import { envSchema } from '../env.schema.ts'

describe('Enhanced Configuration Loader', () => {
	let originalEnv: NodeJS.ProcessEnv

	beforeEach(() => {
		// Reset all mocks
		vi.clearAllMocks()

		// Store original environment
		originalEnv = { ...process.env }

		// Clear environment to only have test values
		process.env = {}

		// Mock path.resolve
		vi.mocked(resolve).mockReturnValue('/test/.env')

		// Mock fromError
		vi.mocked(fromError).mockReturnValue({
			name: 'ZodValidationError',
			message: 'Validation error',
			details: [],
		})

		// Mock envSchema to return success with the actual environment data
		const mockSafeParse = vi.mocked(envSchema.safeParse)
		mockSafeParse.mockImplementation((env) => ({
			success: true,
			data: env as import('../env.schema.ts').TEnv,
		}))
	})

	afterEach(() => {
		// Restore original environment
		process.env = originalEnv
	})

	describe('loadEnhancedConfig', () => {
		it('should load configuration in non-Lambda environment', async () => {
			// Arrange
			delete process.env.AWS_LAMBDA_FUNCTION_NAME
			process.env.NODE_ENV = 'development'

			const validEnv = {
				API_KEY: 'test-api-key-32-characters-long',
				NODE_ENV: 'development',
				APP_ENV: 'development',
				SERVER_PORT: '3040',
				AWS_COGNITO_REGION: 'us-east-1',
				AWS_COGNITO_USER_POOL_ID: 'us-east-1_test',
				AWS_COGNITO_USER_POOL_CLIENT_ID: 'test-client-id',
				AWS_COGNITO_USER_POOL_SECRET_KEY: 'test-secret-key',
				AWS_COGNITO_ACCESS_KEY: 'test-access-key',
				AWS_COGNITO_SECRET_KEY: 'test-secret-key',
				AWS_COGNITO_REFRESH_TOKEN_EXPIRY: '30',
				COOKIE_DOMAIN: 'localhost',
				COOKIE_ENCRYPTION_KEY: 'test-cookie-key-32-characters-long',
				NON_RELATIONAL_DATABASE_URL: 'mongodb://localhost:27017/test',
				RELATIONAL_DATABASE_URL: 'postgresql://localhost:5432/test',
				OPENAI_API_KEY: 'sk-test-openai-key',
			}

			process.env = { ...process.env, ...validEnv }
			vi.mocked(dotenvConfig).mockReturnValue({ parsed: validEnv })

			// Act
			const [result, error] = await loadEnhancedConfig()

			// Assert
			expect(error).toBeNull()
			expect(result).toBeDefined()
			expect(result?._metadata.isEc2Environment).toBe(false)
			expect(result?._metadata.parameterStoreEnabled).toBe(false)
			expect(result?.API_KEY).toBe('test-api-key-32-characters-long')
			expect(result?._metadata.sources.API_KEY).toBe('environment')
			expect(
				result?._metadata.validationResults.totalVariables,
			).toBeGreaterThan(0)
			expect(
				result?._metadata.validationResults.environmentVariables,
			).toBeGreaterThan(0)
			expect(result?._metadata.validationResults.parameterStoreVariables).toBe(
				0,
			)
		})

		it('should load configuration in EC2 environment with Parameter Store', async () => {
			// Arrange
			process.env.PARAMETER_STORE_PREFIX = '/macro-ai/test'
			process.env.NODE_ENV = 'production'

			const validEnv = {
				API_KEY: 'test-api-key-32-characters-long',
				NODE_ENV: 'production',
				APP_ENV: 'production',
				SERVER_PORT: '3040',
				AWS_COGNITO_REGION: 'us-east-1',
				AWS_COGNITO_USER_POOL_ID: 'us-east-1_test',
				AWS_COGNITO_USER_POOL_CLIENT_ID: 'test-client-id',
				AWS_COGNITO_USER_POOL_SECRET_KEY: 'test-secret-key',
				AWS_COGNITO_ACCESS_KEY: 'test-access-key',
				AWS_COGNITO_SECRET_KEY: 'test-secret-key',
				AWS_COGNITO_REFRESH_TOKEN_EXPIRY: '30',
				COOKIE_DOMAIN: 'localhost',
				COOKIE_ENCRYPTION_KEY: 'test-cookie-key-32-characters-long',
				NON_RELATIONAL_DATABASE_URL: 'mongodb://localhost:27017/test',
				RELATIONAL_DATABASE_URL: 'postgresql://localhost:5432/test',
				OPENAI_API_KEY: 'sk-test-openai-key',
			}

			process.env = { ...process.env, ...validEnv }

			const parameterStoreConfig = {
				OPENAI_API_KEY: {
					value: 'sk-parameter-store-key',
					source: 'parameter-store' as const,
					cached: true,
				},
				RELATIONAL_DATABASE_URL: {
					value: 'postgresql://parameter-store:5432/db',
					source: 'parameter-store' as const,
					cached: true,
				},
				AWS_COGNITO_USER_POOL_ID: {
					value: 'us-east-1_parameter_store',
					source: 'parameter-store' as const,
					cached: true,
				},
				AWS_COGNITO_USER_POOL_CLIENT_ID: {
					value: 'parameter-store-client-id',
					source: 'parameter-store' as const,
					cached: true,
				},
				REDIS_URL: {
					value: 'redis://parameter-store:6379',
					source: 'parameter-store' as const,
					cached: true,
				},
			}

			vi.mocked(enhancedConfigService.getAllMappedConfig).mockResolvedValue([
				parameterStoreConfig,
				null,
			])

			// Act
			const [result, error] = await loadEnhancedConfig()

			// Assert
			expect(error).toBeNull()
			expect(result).toBeDefined()
			expect(result?._metadata.isEc2Environment).toBe(true)
			expect(result?._metadata.parameterStoreEnabled).toBe(true)
			expect(result?.OPENAI_API_KEY).toBe('sk-parameter-store-key')
			expect(result?._metadata.sources.OPENAI_API_KEY).toBe('parameter-store')
			expect(result?.API_KEY).toBe('test-api-key-32-characters-long')
			expect(result?._metadata.sources.API_KEY).toBe('environment')
			expect(result?._metadata.validationResults.parameterStoreVariables).toBe(
				5,
			) // OPENAI_API_KEY + 4 others from mock
			expect(
				result?._metadata.validationResults.environmentVariables,
			).toBeGreaterThan(0)
			expect(
				result?._metadata.validationResults.totalVariables,
			).toBeGreaterThan(5)
		})

		it('should handle Parameter Store failure in EC2 environment', async () => {
			// Arrange
			process.env.PARAMETER_STORE_PREFIX = '/macro-ai/test'
			process.env.NODE_ENV = 'production'

			const validEnv = {
				API_KEY: 'test-api-key-32-characters-long',
				NODE_ENV: 'production',
				APP_ENV: 'production',
				SERVER_PORT: '3040',
				AWS_COGNITO_REGION: 'us-east-1',
				AWS_COGNITO_USER_POOL_ID: 'us-east-1_test',
				AWS_COGNITO_USER_POOL_CLIENT_ID: 'test-client-id',
				AWS_COGNITO_USER_POOL_SECRET_KEY: 'test-secret-key',
				AWS_COGNITO_ACCESS_KEY: 'test-access-key',
				AWS_COGNITO_SECRET_KEY: 'test-secret-key',
				AWS_COGNITO_REFRESH_TOKEN_EXPIRY: '30',
				COOKIE_DOMAIN: 'localhost',
				COOKIE_ENCRYPTION_KEY: 'test-cookie-key-32-characters-long',
				NON_RELATIONAL_DATABASE_URL: 'mongodb://localhost:27017/test',
				RELATIONAL_DATABASE_URL: 'postgresql://localhost:5432/test',
				OPENAI_API_KEY: 'sk-test-openai-key',
			}

			process.env = { ...process.env, ...validEnv }

			vi.mocked(enhancedConfigService.getAllMappedConfig).mockRejectedValue(
				new Error('Parameter Store connection failed'),
			)

			// Act
			const [result, error] = await loadEnhancedConfig()

			// Assert - In EC2 environment, Parameter Store failure should be critical
			expect(result).toBeNull()
			expect(error).toBeDefined()
			expect(error?.message).toContain(
				'Parameter Store integration failed in EC2 environment',
			)
			expect(error?.message).toContain('Parameter Store connection failed')
			expect(error?.details).toMatchObject({
				environment: 'ec2',
				parameterStorePrefix: '/macro-ai/test',
			})
		})

		it('should return validation error for invalid environment', async () => {
			// Arrange
			delete process.env.PARAMETER_STORE_PREFIX
			process.env.NODE_ENV = 'development'

			const invalidEnv = {
				API_KEY: 'short', // Too short
				NODE_ENV: 'development',
			}

			process.env = { ...process.env, ...invalidEnv }
			vi.mocked(dotenvConfig).mockReturnValue({ parsed: invalidEnv })

			// Mock schema validation to fail for this test
			const mockSafeParse = vi.mocked(envSchema.safeParse)
			mockSafeParse.mockReturnValueOnce({
				success: false,
				error: {
					issues: [{ message: 'API_KEY must be at least 32 characters' }],
				},
			} as ReturnType<typeof envSchema.safeParse>)

			// Act
			const [result, error] = await loadEnhancedConfig()

			// Assert
			expect(result).toBeNull()
			expect(error).toBeInstanceOf(AppError)
			expect(error?.message).toContain('Invalid runtime configuration')
		})

		it('should handle dotenv parsing error', async () => {
			// Arrange
			delete process.env.AWS_LAMBDA_FUNCTION_NAME
			process.env.NODE_ENV = 'development'

			const dotenvError = new Error('Cannot parse .env file')
			vi.mocked(dotenvConfig).mockReturnValue({ error: dotenvError })

			// Act
			const [result, error] = await loadEnhancedConfig()

			// Assert
			expect(result).toBeNull()
			expect(error).toBeInstanceOf(AppError)
			expect(error?.message).toContain('Cannot parse .env file')
		})
	})

	describe('getConfigWithSource', () => {
		it('should get configuration with source information', async () => {
			// Arrange
			const expectedConfig = {
				value: 'sk-test-openai-key',
				source: 'parameter-store' as const,
				cached: true,
			}

			vi.mocked(enhancedConfigService.getConfig).mockResolvedValue([
				expectedConfig,
				null,
			])

			// Act
			const [result, error] = await getConfigWithSource('OPENAI_API_KEY', {
				required: true,
			})

			// Assert
			expect(error).toBeNull()
			expect(result).toEqual(expectedConfig)
			expect(enhancedConfigService.getConfig).toHaveBeenCalledWith(
				'OPENAI_API_KEY',
				{ required: true },
			)
		})

		it('should return error when config retrieval fails', async () => {
			// Arrange
			const configError = new AppError({ message: 'Config error' })
			vi.mocked(enhancedConfigService.getConfig).mockResolvedValue([
				null,
				configError,
			])

			// Act
			const [result, error] = await getConfigWithSource('OPENAI_API_KEY')

			// Assert
			expect(result).toBeNull()
			expect(error).toBe(configError)
		})
	})

	describe('utility functions', () => {
		it('should clear configuration cache', () => {
			// Act
			clearConfigCache('test-parameter')

			// Assert
			expect(enhancedConfigService.clearCache).toHaveBeenCalledWith(
				'test-parameter',
			)
		})

		it('should get cache statistics', () => {
			// Arrange
			const expectedStats = {
				totalEntries: 5,
				activeEntries: 3,
				expiredEntries: 2,
				cacheEnabled: true,
				cacheTtlMs: 300000,
			}
			vi.mocked(enhancedConfigService.getCacheStats).mockReturnValue(
				expectedStats,
			)

			// Act
			const stats = getConfigCacheStats()

			// Assert
			expect(stats).toEqual(expectedStats)
		})
	})
})
