/**
 * Unit tests for Parameter Store Service
 * Tests parameter retrieval, caching, error handling, and AWS SDK integration
 */

import {
	GetParameterCommand,
	ParameterNotFound,
	SSMClient,
} from '@aws-sdk/client-ssm'
import { mockClient } from 'aws-sdk-client-mock'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { AppError, InternalError, NotFoundError } from '../../utils/errors.ts'
import { ParameterStoreService } from '../parameter-store.service.ts'

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

// Create AWS SDK mock
const ssmMock = mockClient(SSMClient)

// Helper function to mock tryCatch with real implementation
const mockTryCatchWithRealImplementation = () => {
	vi.mocked(tryCatch).mockImplementation(async (promise) => {
		try {
			const result = await promise
			return [result, null]
		} catch (error) {
			return [null, error as AppError]
		}
	})
}

describe('ParameterStoreService', () => {
	let parameterStoreService: ParameterStoreService

	beforeEach(() => {
		// Reset all mocks
		vi.clearAllMocks()
		ssmMock.reset()

		// Mock tryCatch with real implementation
		mockTryCatchWithRealImplementation()

		// Create new service instance for each test
		parameterStoreService = new ParameterStoreService({
			region: 'us-east-1',
			environment: 'test',
			cacheEnabled: true,
			cacheTtlMs: 5 * 60 * 1000,
		})
	})

	describe('constructor', () => {
		it('should initialize with default configuration', () => {
			const service = new ParameterStoreService()
			const stats = service.getCacheStats()

			expect(stats.cacheEnabled).toBe(true)
			expect(stats.cacheTtlMs).toBe(5 * 60 * 1000)
		})

		it('should initialize with custom configuration', () => {
			const service = new ParameterStoreService({
				region: 'eu-west-1',
				environment: 'staging',
				cacheEnabled: false,
				cacheTtlMs: 10 * 60 * 1000,
			})
			const stats = service.getCacheStats()

			expect(stats.cacheEnabled).toBe(false)
			expect(stats.cacheTtlMs).toBe(10 * 60 * 1000)
		})
	})

	describe('getParameter', () => {
		it('should retrieve critical parameter successfully', async () => {
			// Arrange
			const parameterName = 'openai-api-key'
			const expectedValue = 'sk-test-openai-key'
			const expectedPath = '/macro-ai/test/critical/openai-api-key'

			ssmMock.on(GetParameterCommand).resolves({
				Parameter: {
					Name: expectedPath,
					Value: expectedValue,
					Type: 'SecureString',
				},
			})

			// Act
			const [result, error] =
				await parameterStoreService.getParameter(parameterName)

			// Assert
			expect(error).toBeNull()
			expect(result).toBe(expectedValue)
			expect(ssmMock.commandCalls(GetParameterCommand)).toHaveLength(1)
			expect(
				ssmMock.commandCalls(GetParameterCommand)[0]?.args[0].input,
			).toEqual({
				Name: expectedPath,
				WithDecryption: true,
			})
		})

		it('should retrieve critical parameter (redis url) successfully', async () => {
			// Arrange
			const parameterName = 'upstash-redis-url'
			const expectedValue = 'redis://test-redis:6379'
			const expectedPath = '/macro-ai/test/critical/upstash-redis-url'

			ssmMock.on(GetParameterCommand).resolves({
				Parameter: {
					Name: expectedPath,
					Value: expectedValue,
					Type: 'SecureString',
				},
			})

			// Act
			const [result, error] =
				await parameterStoreService.getParameter(parameterName)

			// Assert
			expect(error).toBeNull()
			expect(result).toBe(expectedValue)
			expect(ssmMock.commandCalls(GetParameterCommand)).toHaveLength(1)
			expect(
				ssmMock.commandCalls(GetParameterCommand)[0]?.args[0].input,
			).toEqual({
				Name: expectedPath,
				WithDecryption: true,
			})
		})

		it('should return cached value on second call', async () => {
			// Arrange
			const parameterName = 'openai-api-key'
			const expectedValue = 'sk-test-openai-key'

			ssmMock.on(GetParameterCommand).resolves({
				Parameter: {
					Name: '/macro-ai/test/critical/openai-api-key',
					Value: expectedValue,
					Type: 'SecureString',
				},
			})

			// Act - First call
			const [result1, error1] =
				await parameterStoreService.getParameter(parameterName)

			// Act - Second call (should use cache)
			const [result2, error2] =
				await parameterStoreService.getParameter(parameterName)

			// Assert
			expect(error1).toBeNull()
			expect(error2).toBeNull()
			expect(result1).toBe(expectedValue)
			expect(result2).toBe(expectedValue)
			// Should only call AWS once due to caching
			expect(ssmMock.commandCalls(GetParameterCommand)).toHaveLength(1)
		})

		it('should bypass cache when useCache is false', async () => {
			// Arrange
			const parameterName = 'openai-api-key'
			const expectedValue = 'sk-test-openai-key'

			ssmMock.on(GetParameterCommand).resolves({
				Parameter: {
					Name: '/macro-ai/test/critical/openai-api-key',
					Value: expectedValue,
					Type: 'SecureString',
				},
			})

			// Act - Two calls with useCache = false
			const [result1, error1] = await parameterStoreService.getParameter(
				parameterName,
				false,
			)
			const [result2, error2] = await parameterStoreService.getParameter(
				parameterName,
				false,
			)

			// Assert
			expect(error1).toBeNull()
			expect(error2).toBeNull()
			expect(result1).toBe(expectedValue)
			expect(result2).toBe(expectedValue)
			// Should call AWS twice since caching is disabled
			expect(ssmMock.commandCalls(GetParameterCommand)).toHaveLength(2)
		})

		it('should return NotFoundError when parameter does not exist', async () => {
			// Arrange
			const parameterName = 'non-existent-parameter'

			ssmMock.on(GetParameterCommand).rejects(
				new ParameterNotFound({
					message: 'Parameter not found',
					$metadata: {},
				}),
			)

			// Mock tryCatch to handle the AWS error
			vi.mocked(tryCatch).mockImplementation(async (promise) => {
				try {
					await promise
					return [null, null]
				} catch {
					const appError = new Error('Parameter not found')
					appError.name = 'ParameterNotFound'
					return [null, appError as AppError]
				}
			})

			// Act
			const [result, error] =
				await parameterStoreService.getParameter(parameterName)

			// Assert
			expect(result).toBeNull()
			expect(error).toBeInstanceOf(NotFoundError)
			expect(error?.message).toContain(
				'Parameter non-existent-parameter not found',
			)
		})

		it('should return InternalError for other AWS errors', async () => {
			// Arrange
			const parameterName = 'openai-api-key'

			ssmMock.on(GetParameterCommand).rejects(new Error('Access denied'))

			// Mock tryCatch to handle the AWS error
			vi.mocked(tryCatch).mockImplementation(async (promise) => {
				try {
					await promise
					return [null, null]
				} catch (error) {
					return [null, error as AppError]
				}
			})

			// Act
			const [result, error] =
				await parameterStoreService.getParameter(parameterName)

			// Assert
			expect(result).toBeNull()
			expect(error).toBeInstanceOf(InternalError)
			expect(error?.message).toContain(
				'Failed to retrieve parameter openai-api-key',
			)
		})

		it('should handle empty parameter value', async () => {
			// Arrange
			const parameterName = 'openai-api-key'

			ssmMock.on(GetParameterCommand).resolves({
				Parameter: {
					Name: '/macro-ai/test/critical/openai-api-key',
					Value: undefined,
					Type: 'SecureString',
				},
			})

			// Act
			const [result, error] =
				await parameterStoreService.getParameter(parameterName)

			// Assert
			expect(result).toBeNull()
			expect(error).toBeDefined()
			expect(error?.message).toContain('Parameter openai-api-key')
		})
	})

	describe('getParameters', () => {
		it('should retrieve multiple parameters successfully', async () => {
			// Arrange
			const parameterNames = ['openai-api-key', 'upstash-redis-url']
			const expectedValues = {
				'openai-api-key': 'sk-test-openai-key',
				'upstash-redis-url': 'redis://test-redis:6379',
			}

			ssmMock
				.on(GetParameterCommand, {
					Name: '/macro-ai/test/critical/openai-api-key',
					WithDecryption: true,
				})
				.resolves({
					Parameter: {
						Name: '/macro-ai/test/critical/openai-api-key',
						Value: expectedValues['openai-api-key'],
						Type: 'SecureString',
					},
				})
				.on(GetParameterCommand, {
					Name: '/macro-ai/test/critical/upstash-redis-url',
					WithDecryption: true,
				})
				.resolves({
					Parameter: {
						Name: '/macro-ai/test/critical/upstash-redis-url',
						Value: expectedValues['upstash-redis-url'],
						Type: 'SecureString',
					},
				})

			// Act
			const [result, error] =
				await parameterStoreService.getParameters(parameterNames)

			// Assert
			expect(error).toBeNull()
			expect(result).toEqual(expectedValues)
			expect(ssmMock.commandCalls(GetParameterCommand)).toHaveLength(2)
		})

		it('should return error when any parameter fails', async () => {
			// Arrange
			const parameterNames = ['openai-api-key', 'non-existent-parameter']

			ssmMock
				.on(GetParameterCommand, {
					Name: '/macro-ai/test/critical/openai-api-key',
					WithDecryption: true,
				})
				.resolves({
					Parameter: {
						Name: '/macro-ai/test/critical/openai-api-key',
						Value: 'sk-test-openai-key',
						Type: 'SecureString',
					},
				})
				.on(GetParameterCommand, {
					Name: '/macro-ai/test/standard/non-existent-parameter',
					WithDecryption: true,
				})
				.rejects(
					new ParameterNotFound({
						message: 'Parameter not found',
						$metadata: {},
					}),
				)

			// Mock tryCatch to handle mixed success/failure
			let callCount = 0
			vi.mocked(tryCatch).mockImplementation(async (promise) => {
				callCount++
				try {
					const result = await promise
					return [result, null]
				} catch (error) {
					if (callCount === 2) {
						// Second call fails
						const appError = new Error('ParameterNotFound: Parameter not found')
						return [null, appError as AppError]
					}
					return [null, error as AppError]
				}
			})

			// Act
			const [result, error] =
				await parameterStoreService.getParameters(parameterNames)

			// Assert
			expect(result).toBeNull()
			expect(error).toBeInstanceOf(InternalError)
			expect(error?.message).toContain('Failed to retrieve 1 parameters')
		})
	})

	describe('clearCache', () => {
		it('should clear specific parameter from cache', async () => {
			// Arrange
			const parameterName = 'openai-api-key'
			const expectedValue = 'sk-test-openai-key'

			ssmMock.on(GetParameterCommand).resolves({
				Parameter: {
					Name: '/macro-ai/test/critical/openai-api-key',
					Value: expectedValue,
					Type: 'SecureString',
				},
			})

			// Cache the parameter
			await parameterStoreService.getParameter(parameterName)

			// Act - Clear cache for specific parameter
			parameterStoreService.clearCache(parameterName)

			// Act - Get parameter again (should call AWS again)
			await parameterStoreService.getParameter(parameterName)

			// Assert
			expect(ssmMock.commandCalls(GetParameterCommand)).toHaveLength(2)
		})

		it('should clear all cache when no parameter specified', async () => {
			// Arrange
			const parameterNames = ['openai-api-key', 'upstash-redis-url']

			ssmMock.on(GetParameterCommand).resolves({
				Parameter: {
					Name: '/macro-ai/test/critical/openai-api-key',
					Value: 'sk-test-openai-key',
					Type: 'SecureString',
				},
			})

			// Cache multiple parameters
			for (const name of parameterNames) {
				await parameterStoreService.getParameter(name)
			}

			// Act - Clear all cache
			parameterStoreService.clearCache()

			// Act - Get parameters again (should call AWS again)
			for (const name of parameterNames) {
				await parameterStoreService.getParameter(name)
			}

			// Assert - Should have called AWS 4 times total (2 initial + 2 after cache clear)
			expect(ssmMock.commandCalls(GetParameterCommand)).toHaveLength(4)
		})
	})

	describe('getCacheStats', () => {
		it('should return correct cache statistics', async () => {
			// Arrange
			const parameterName = 'openai-api-key'

			ssmMock.on(GetParameterCommand).resolves({
				Parameter: {
					Name: '/macro-ai/test/critical/openai-api-key',
					Value: 'sk-test-openai-key',
					Type: 'SecureString',
				},
			})

			// Act - Get initial stats
			const initialStats = parameterStoreService.getCacheStats()

			// Cache a parameter
			await parameterStoreService.getParameter(parameterName)

			// Get stats after caching
			const afterCacheStats = parameterStoreService.getCacheStats()

			// Assert
			expect(initialStats.totalEntries).toBe(0)
			expect(initialStats.activeEntries).toBe(0)
			expect(initialStats.cacheEnabled).toBe(true)
			expect(initialStats.cacheTtlMs).toBe(5 * 60 * 1000)

			expect(afterCacheStats.totalEntries).toBe(1)
			expect(afterCacheStats.activeEntries).toBe(1)
			expect(afterCacheStats.expiredEntries).toBe(0)
		})

		it('should handle expired cache entries in statistics', async () => {
			// Arrange
			const parameterName = 'openai-api-key'
			const shortTtlService = new ParameterStoreService({
				region: 'us-east-1',
				environment: 'test',
				cacheEnabled: true,
				cacheTtlMs: 1, // 1ms TTL for immediate expiration
			})

			ssmMock.on(GetParameterCommand).resolves({
				Parameter: {
					Name: '/macro-ai/test/critical/openai-api-key',
					Value: 'sk-test-openai-key',
					Type: 'SecureString',
				},
			})

			// Cache a parameter
			await shortTtlService.getParameter(parameterName)

			// Wait for cache to expire
			await new Promise((resolve) => setTimeout(resolve, 10))

			// Act - Get stats after expiration
			const stats = shortTtlService.getCacheStats()

			// Assert
			expect(stats.totalEntries).toBe(1)
			expect(stats.activeEntries).toBe(0)
			expect(stats.expiredEntries).toBe(1)
		})
	})
})
