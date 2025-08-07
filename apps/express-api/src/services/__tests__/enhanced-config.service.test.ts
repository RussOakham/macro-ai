/**
 * Unit tests for Enhanced Configuration Service
 * Tests integration between Parameter Store and environment variables
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable turbo/no-undeclared-env-vars */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { InternalError } from '../../utils/errors.ts'
import { EnhancedConfigService } from '../enhanced-config.service.ts'

// Mock the tryCatch utility
vi.mock('../../utils/error-handling/try-catch.ts', () => ({
	tryCatch: vi.fn(),
}))

// Mock the logger
vi.mock('../../utils/logger.ts', () => ({
	pino: {
		logger: {
			info: vi.fn(),
			debug: vi.fn(),
			error: vi.fn(),
			warn: vi.fn(),
		},
	},
}))

// Import mocked functions
import { tryCatch } from '../../utils/error-handling/try-catch.ts'

// Mock ParameterStoreService
const mockParameterStoreService = {
	getParameter: vi.fn(),
	getParameters: vi.fn(),
	clearCache: vi.fn(),
	getCacheStats: vi.fn(),
}

describe('EnhancedConfigService', () => {
	let enhancedConfigService: EnhancedConfigService
	let originalEnv: NodeJS.ProcessEnv

	beforeEach(() => {
		// Reset all mocks
		vi.clearAllMocks()

		// Store original environment
		originalEnv = { ...process.env }

		// Mock tryCatch with real implementation
		vi.mocked(tryCatch).mockImplementation(async (promise) => {
			try {
				const result = await promise
				return [result, null]
			} catch (error) {
				return [null, error as InternalError]
			}
		})

		// Create service with mocked Parameter Store
		enhancedConfigService = new EnhancedConfigService(
			mockParameterStoreService as unknown as import('../parameter-store.service.ts').ParameterStoreService,
		)
	})

	afterEach(() => {
		// Restore original environment
		process.env = originalEnv
	})

	describe('constructor', () => {
		it('should initialize with Lambda environment detection', () => {
			// Arrange
			process.env.AWS_LAMBDA_FUNCTION_NAME = 'test-function'

			// Act
			const service = new EnhancedConfigService(
				mockParameterStoreService as any,
			)

			// Assert
			expect(service.isLambda()).toBe(true)
		})

		it('should initialize without Lambda environment', () => {
			// Arrange
			delete process.env.AWS_LAMBDA_FUNCTION_NAME

			// Act
			const service = new EnhancedConfigService(
				mockParameterStoreService as any,
			)

			// Assert
			expect(service.isLambda()).toBe(false)
		})
	})

	describe('getConfig', () => {
		it('should return Parameter Store value in Lambda environment', async () => {
			// Arrange
			process.env.AWS_LAMBDA_FUNCTION_NAME = 'test-function'
			const service = new EnhancedConfigService(
				mockParameterStoreService as any,
			)
			const expectedValue = 'sk-test-openai-key'

			mockParameterStoreService.getParameter.mockResolvedValue([
				expectedValue,
				null,
			])

			// Act
			const [result, error] = await service.getConfig('OPENAI_API_KEY', {
				required: true,
			})

			// Assert
			expect(error).toBeNull()
			expect(result?.value).toBe(expectedValue)
			expect(result?.source).toBe('parameter-store')
			expect(result?.cached).toBe(true)
			expect(mockParameterStoreService.getParameter).toHaveBeenCalledWith(
				'openai-api-key',
			)
		})

		it('should fallback to environment variable when Parameter Store fails', async () => {
			// Arrange
			process.env.AWS_LAMBDA_FUNCTION_NAME = 'test-function'
			process.env.OPENAI_API_KEY = 'sk-env-openai-key'
			const service = new EnhancedConfigService(
				mockParameterStoreService as any,
			)

			mockParameterStoreService.getParameter.mockResolvedValue([
				null,
				new InternalError('Parameter Store error', 'test'),
			])

			// Act
			const [result, error] = await service.getConfig('OPENAI_API_KEY', {
				required: true,
			})

			// Assert
			expect(error).toBeNull()
			expect(result?.value).toBe('sk-env-openai-key')
			expect(result?.source).toBe('environment')
			expect(result?.cached).toBe(false)
		})

		it('should use environment variable directly in non-Lambda environment', async () => {
			// Arrange
			delete process.env.AWS_LAMBDA_FUNCTION_NAME
			process.env.OPENAI_API_KEY = 'sk-env-openai-key'
			const service = new EnhancedConfigService(
				mockParameterStoreService as any,
			)

			// Act
			const [result, error] = await service.getConfig('OPENAI_API_KEY', {
				required: true,
			})

			// Assert
			expect(error).toBeNull()
			expect(result?.value).toBe('sk-env-openai-key')
			expect(result?.source).toBe('environment')
			expect(result?.cached).toBe(false)
			expect(mockParameterStoreService.getParameter).not.toHaveBeenCalled()
		})

		it('should use fallback value when provided', async () => {
			// Arrange
			delete process.env.OPENAI_API_KEY
			const fallbackValue = 'sk-fallback-key'

			// Act
			const [result, error] = await enhancedConfigService.getConfig(
				'OPENAI_API_KEY',
				{
					fallback: fallbackValue,
				},
			)

			// Assert
			expect(error).toBeNull()
			expect(result?.value).toBe(fallbackValue)
			expect(result?.source).toBe('fallback')
			expect(result?.cached).toBe(false)
		})

		it('should return error for required config when not found', async () => {
			// Arrange
			delete process.env.OPENAI_API_KEY
			mockParameterStoreService.getParameter.mockResolvedValue([
				null,
				new InternalError('Parameter not found', 'test'),
			])

			// Act
			const [result, error] = await enhancedConfigService.getConfig(
				'OPENAI_API_KEY',
				{
					required: true,
				},
			)

			// Assert
			expect(result).toBeNull()
			expect(error).toBeInstanceOf(InternalError)
			expect(error?.message).toContain(
				'Required configuration OPENAI_API_KEY not found',
			)
		})

		it('should return empty string for optional config when not found', async () => {
			// Arrange
			delete process.env.SOME_OPTIONAL_CONFIG

			// Act
			const [result, error] = await enhancedConfigService.getConfig(
				'SOME_OPTIONAL_CONFIG',
				{
					required: false,
				},
			)

			// Assert
			expect(error).toBeNull()
			expect(result?.value).toBe('')
			expect(result?.source).toBe('fallback')
			expect(result?.cached).toBe(false)
		})

		it('should skip Parameter Store when useParameterStore is false', async () => {
			// Arrange
			process.env.AWS_LAMBDA_FUNCTION_NAME = 'test-function'
			process.env.OPENAI_API_KEY = 'sk-env-openai-key'
			const service = new EnhancedConfigService(
				mockParameterStoreService as any,
			)

			// Act
			const [result, error] = await service.getConfig('OPENAI_API_KEY', {
				useParameterStore: false,
			})

			// Assert
			expect(error).toBeNull()
			expect(result?.value).toBe('sk-env-openai-key')
			expect(result?.source).toBe('environment')
			expect(mockParameterStoreService.getParameter).not.toHaveBeenCalled()
		})
	})

	describe('preloadParameters', () => {
		it('should preload all mapped parameters successfully', async () => {
			// Arrange
			const expectedParameters = {
				'openai-api-key': 'sk-test-openai-key',
				'neon-database-url': 'postgresql://test:5432/db',
				'upstash-redis-url': 'redis://test:6379',
				'cognito-user-pool-id': 'us-east-1_test',
				'cognito-user-pool-client-id': 'test-client-id',
			}

			mockParameterStoreService.getParameters.mockResolvedValue([
				expectedParameters,
				null,
			])

			// Act
			const [result, error] = await enhancedConfigService.preloadParameters()

			// Assert
			expect(error).toBeNull()
			expect(result).toBeDefined()
			if (result) {
				expect(Object.keys(result)).toHaveLength(5)
				expect(result['openai-api-key']?.value).toBe('sk-test-openai-key')
				expect(result['openai-api-key']?.source).toBe('parameter-store')
				expect(result['openai-api-key']?.cached).toBe(true)
			}
		})

		it('should return error when preloading fails', async () => {
			// Arrange
			const parameterError = new InternalError(
				'Failed to load parameters',
				'test',
			)
			mockParameterStoreService.getParameters.mockResolvedValue([
				null,
				parameterError,
			])

			// Act
			const [result, error] = await enhancedConfigService.preloadParameters()

			// Assert
			expect(result).toBeNull()
			expect(error).toBe(parameterError)
		})
	})

	describe('getAllMappedConfig', () => {
		it('should get all mapped configuration successfully', async () => {
			// Arrange
			process.env.OPENAI_API_KEY = 'sk-env-openai-key'
			process.env.RELATIONAL_DATABASE_URL = 'postgresql://env:5432/db'
			process.env.AWS_COGNITO_USER_POOL_ID = 'us-east-1_env'
			process.env.AWS_COGNITO_USER_POOL_CLIENT_ID = 'env-client-id'

			// Act
			const [result, error] = await enhancedConfigService.getAllMappedConfig()

			// Assert
			expect(error).toBeNull()
			expect(result).toBeDefined()
			if (result) {
				expect(Object.keys(result)).toHaveLength(5) // All mapped parameters
				expect(result.OPENAI_API_KEY?.value).toBe('sk-env-openai-key')
				expect(result.OPENAI_API_KEY?.source).toBe('environment')
			}
		})

		it('should return error when required config is missing', async () => {
			// Arrange - Remove required environment variables
			delete process.env.OPENAI_API_KEY
			delete process.env.RELATIONAL_DATABASE_URL
			delete process.env.AWS_COGNITO_USER_POOL_ID
			delete process.env.AWS_COGNITO_USER_POOL_CLIENT_ID

			mockParameterStoreService.getParameter.mockResolvedValue([
				null,
				new InternalError('Parameter not found', 'test'),
			])

			// Act
			const [result, error] = await enhancedConfigService.getAllMappedConfig()

			// Assert
			expect(result).toBeNull()
			expect(error).toBeInstanceOf(InternalError)
			expect(error?.message).toContain('Failed to load')
		})
	})

	describe('utility methods', () => {
		it('should clear cache', () => {
			// Act
			enhancedConfigService.clearCache('test-parameter')

			// Assert
			expect(mockParameterStoreService.clearCache).toHaveBeenCalledWith(
				'test-parameter',
			)
		})

		it('should get cache stats', () => {
			// Arrange
			const expectedStats = {
				totalEntries: 5,
				activeEntries: 3,
				expiredEntries: 2,
				cacheEnabled: true,
				cacheTtlMs: 300000,
			}
			mockParameterStoreService.getCacheStats.mockReturnValue(expectedStats)

			// Act
			const stats = enhancedConfigService.getCacheStats()

			// Assert
			expect(stats).toEqual(expectedStats)
		})

		it('should return parameter mappings', () => {
			// Act
			const mappings = enhancedConfigService.getParameterMappings()

			// Assert
			expect(mappings).toBeDefined()
			expect(mappings.length).toBeGreaterThan(0)
			expect(mappings[0]).toHaveProperty('envVar')
			expect(mappings[0]).toHaveProperty('parameterName')
			expect(mappings[0]).toHaveProperty('required')
		})
	})
})
