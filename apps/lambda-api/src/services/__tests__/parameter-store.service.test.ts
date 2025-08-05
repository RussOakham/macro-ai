/**
 * Tests for Parameter Store Service
 */

import {
	GetParameterCommand,
	GetParametersCommand,
	SSMClient,
} from '@aws-sdk/client-ssm'
import { mockClient } from 'aws-sdk-client-mock'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Import the mocked module to get reference to the mock function
import * as powertoolsMetrics from '../../utils/powertools-metrics.js'
import * as powertoolsTracer from '../../utils/powertools-tracer.js'
import { mockParameterStoreService } from '../../utils/test-helpers/parameter-store.mock.js'
import { ParameterStoreService } from '../parameter-store.service.js'

// Mock Powertools Logger to suppress console output during tests
vi.mock('../../utils/powertools-logger.js', () => ({
	logger: {
		debug: vi.fn(),
		info: vi.fn(),
		warn: vi.fn(),
		error: vi.fn(),
		critical: vi.fn(),
		createChild: vi.fn().mockReturnValue({
			debug: vi.fn(),
			info: vi.fn(),
			warn: vi.fn(),
			error: vi.fn(),
			critical: vi.fn(),
		}),
	},
}))

// Mock Powertools Metrics to suppress console output during tests
vi.mock('../../utils/powertools-metrics.js', () => ({
	recordParameterStoreMetrics: vi.fn(),
}))

// Mock Powertools Tracer to suppress console output during tests
vi.mock('../../utils/powertools-tracer.js', () => ({
	withSubsegment: vi
		.fn()
		.mockImplementation(
			async <T>(name: string, operation: () => Promise<T>): Promise<T> => {
				return operation()
			},
		),
	captureError: vi.fn(),
	subsegmentNames: {
		PARAMETER_STORE_GET: 'parameter-store-get',
		PARAMETER_STORE_GET_MULTIPLE: 'parameter-store-get-multiple',
		PARAMETER_STORE_INIT: 'parameter-store-initialization',
		PARAMETER_STORE_HEALTH: 'parameter-store-health-check',
	},
	traceErrorTypes: {
		PARAMETER_STORE_ERROR: 'ParameterStoreError',
	},
}))

// Create AWS SDK mock - using type assertion to work around @smithy/types version conflict
const ssmMock = mockClient(SSMClient)

describe('ParameterStoreService', () => {
	let service: ParameterStoreService
	let mockRecordParameterStoreMetrics: ReturnType<typeof vi.fn>
	let mockWithSubsegment: ReturnType<typeof vi.fn>
	let mockCaptureError: ReturnType<typeof vi.fn>

	beforeEach(() => {
		// Reset singleton instance
		ParameterStoreService.resetInstance()
		service = ParameterStoreService.getInstance()

		// Get reference to the mocked functions
		mockRecordParameterStoreMetrics = vi.mocked(
			powertoolsMetrics.recordParameterStoreMetrics,
		)
		mockWithSubsegment = vi.mocked(powertoolsTracer.withSubsegment)
		mockCaptureError = vi.mocked(powertoolsTracer.captureError)
	})

	afterEach(() => {
		service.clearCache()
		ssmMock.reset()
		mockRecordParameterStoreMetrics.mockClear()
		mockWithSubsegment.mockClear()
		mockCaptureError.mockClear()
	})

	describe('getInstance', () => {
		it('should return singleton instance', () => {
			const instance1 = ParameterStoreService.getInstance()
			const instance2 = ParameterStoreService.getInstance()

			expect(instance1).toBe(instance2)
		})
	})

	describe('getParameter', () => {
		it('should retrieve parameter successfully', async () => {
			// Arrange
			const mockResponse = mockParameterStoreService.createParameter({
				Parameter: {
					Name: 'test-param',
					Value: 'test-value',
				},
			})
			ssmMock.on(GetParameterCommand).resolves(mockResponse)

			// Act
			const result = await service.getParameter('test-param')

			// Assert
			expect(result).toBe('test-value')
			expect(ssmMock.commandCalls(GetParameterCommand)).toHaveLength(1)
			expect(
				ssmMock.commandCalls(GetParameterCommand)[0]?.args[0].input,
			).toEqual({
				Name: 'test-param',
				WithDecryption: true,
			})

			// Verify tracing was called
			expect(mockWithSubsegment).toHaveBeenCalledWith(
				'parameter-store-get',
				expect.any(Function),
				expect.objectContaining({
					parameterName: 'test-param',
					withDecryption: true,
					operation: 'getParameter',
				}),
				expect.objectContaining({
					parameterName: 'test-param',
					withDecryption: true,
					cacheEnabled: true,
				}),
			)

			// Verify metrics - should record cache miss with duration
			expect(mockRecordParameterStoreMetrics).toHaveBeenCalledWith(
				'miss',
				'test-param',
				expect.any(Number), // duration
			)
		})

		it('should cache parameter values', async () => {
			// Arrange
			const mockResponse = mockParameterStoreService.createParameter({
				Parameter: {
					Name: 'cached-param',
					Value: 'cached-value',
				},
			})
			ssmMock.on(GetParameterCommand).resolves(mockResponse)

			// Act - First call
			const result1 = await service.getParameter('cached-param')
			expect(result1).toBe('cached-value')
			expect(ssmMock.commandCalls(GetParameterCommand)).toHaveLength(1)

			// Verify first call metrics - should record cache miss
			expect(mockRecordParameterStoreMetrics).toHaveBeenCalledWith(
				'miss',
				'cached-param',
				expect.any(Number), // duration
			)

			// Clear metrics for second call
			mockRecordParameterStoreMetrics.mockClear()

			// Act - Second call should use cache
			const result2 = await service.getParameter('cached-param')
			expect(result2).toBe('cached-value')
			expect(ssmMock.commandCalls(GetParameterCommand)).toHaveLength(1) // No additional call

			// Verify second call metrics - should record cache hit
			expect(mockRecordParameterStoreMetrics).toHaveBeenCalledWith(
				'hit',
				'cached-param',
			)
		})

		it('should handle parameter not found', async () => {
			// Arrange
			const mockResponse = mockParameterStoreService.createParameter({
				Parameter: undefined,
			})
			ssmMock.on(GetParameterCommand).resolves(mockResponse)

			// Act & Assert
			await expect(service.getParameter('missing-param')).rejects.toThrow(
				'Parameter missing-param not found or has no value',
			)

			// Verify error metrics
			expect(mockRecordParameterStoreMetrics).toHaveBeenCalledWith(
				'error',
				'missing-param',
			)

			// Verify error was captured in trace
			expect(mockCaptureError).toHaveBeenCalledWith(
				expect.any(Error),
				'ParameterStoreError',
				expect.objectContaining({
					parameterName: 'missing-param',
					operation: 'getParameter',
					errorType: 'ParameterNotFound',
				}),
			)
		})

		it('should handle AWS SDK errors', async () => {
			// Arrange
			ssmMock.on(GetParameterCommand).rejects(new Error('AWS SDK Error'))

			// Act & Assert
			await expect(service.getParameter('error-param')).rejects.toThrow(
				'Failed to retrieve parameter error-param: AWS SDK Error',
			)

			// Verify error metrics
			expect(mockRecordParameterStoreMetrics).toHaveBeenCalledWith(
				'error',
				'error-param',
			)
		})

		it('should support withDecryption parameter', async () => {
			// Arrange
			const mockResponse = mockParameterStoreService.createParameter({
				Parameter: {
					Name: 'encrypted-param',
					Value: 'decrypted-value',
				},
			})
			ssmMock.on(GetParameterCommand).resolves(mockResponse)

			// Act
			await service.getParameter('encrypted-param', false)

			// Assert
			expect(ssmMock.commandCalls(GetParameterCommand)).toHaveLength(1)
			expect(
				ssmMock.commandCalls(GetParameterCommand)[0]?.args[0].input,
			).toEqual({
				Name: 'encrypted-param',
				WithDecryption: false,
			})
		})
	})

	describe('getParameters', () => {
		it('should retrieve multiple parameters successfully', async () => {
			// Arrange
			const mockResponse = mockParameterStoreService.createParameters({
				param1: 'value1',
				param2: 'value2',
			})
			ssmMock.on(GetParametersCommand).resolves(mockResponse)

			// Act
			const result = await service.getParameters(['param1', 'param2'])

			// Assert
			expect(result).toEqual({
				param1: 'value1',
				param2: 'value2',
			})

			// Verify metrics - should record cache miss for both parameters
			expect(mockRecordParameterStoreMetrics).toHaveBeenCalledWith(
				'miss',
				'param1',
			)
			expect(mockRecordParameterStoreMetrics).toHaveBeenCalledWith(
				'miss',
				'param2',
			)

			// Verify tracing was called
			expect(mockWithSubsegment).toHaveBeenCalledWith(
				'parameter-store-get-multiple',
				expect.any(Function),
				expect.objectContaining({
					parameterCount: 2,
					withDecryption: true,
					operation: 'getParameters',
				}),
				expect.objectContaining({
					parameterNames: ['param1', 'param2'],
					withDecryption: true,
					cacheEnabled: true,
				}),
			)
		})

		it('should use cached parameters when available', async () => {
			// Arrange - Pre-populate cache
			const mockResponse1 = mockParameterStoreService.createParameter({
				Parameter: { Name: 'cached-param', Value: 'cached-value' },
			})
			ssmMock.on(GetParameterCommand).resolves(mockResponse1)
			await service.getParameter('cached-param')

			ssmMock.reset()

			// Request multiple parameters including cached one
			const mockResponse2 = mockParameterStoreService.createParameters({
				'new-param': 'new-value',
			})
			ssmMock.on(GetParametersCommand).resolves(mockResponse2)

			// Act
			const result = await service.getParameters(['cached-param', 'new-param'])

			// Assert
			expect(result).toEqual({
				'cached-param': 'cached-value',
				'new-param': 'new-value',
			})

			// Should only fetch the non-cached parameter
			expect(ssmMock.commandCalls(GetParametersCommand)).toHaveLength(1)
			expect(
				ssmMock.commandCalls(GetParametersCommand)[0]?.args[0].input,
			).toEqual({
				Names: ['new-param'],
				WithDecryption: true,
			})
		})

		it('should handle invalid parameters', async () => {
			// Arrange
			const mockResponse = mockParameterStoreService.createParameters(
				{ 'valid-param': 'valid-value' },
				{ InvalidParameters: ['invalid-param'] },
			)
			ssmMock.on(GetParametersCommand).resolves(mockResponse)

			// Act & Assert
			await expect(
				service.getParameters(['valid-param', 'invalid-param']),
			).rejects.toThrow('Invalid parameters: invalid-param')
		})

		it('should handle empty parameter list', async () => {
			// Act
			const result = await service.getParameters([])

			// Assert
			expect(result).toEqual({})
			expect(ssmMock.commandCalls(GetParametersCommand)).toHaveLength(0)
		})
	})

	describe('initializeParameters', () => {
		it('should initialize all required parameters', async () => {
			// Arrange
			const mockParameters = mockParameterStoreService.createMacroAiParameters()
			const mockResponse =
				mockParameterStoreService.createParameters(mockParameters)
			ssmMock.on(GetParametersCommand).resolves(mockResponse)

			// Act
			const result = await service.initializeParameters()

			// Assert
			expect(result).toEqual(mockParameters)
		})

		it('should handle missing required parameters', async () => {
			// Arrange - Only provide partial parameters
			const mockResponse = mockParameterStoreService.createParameters({
				'macro-ai-openai-key': 'openai-key',
				// Missing other required parameters
			})
			ssmMock.on(GetParametersCommand).resolves(mockResponse)

			// Act & Assert
			await expect(service.initializeParameters()).rejects.toThrow(
				'Missing required parameters:',
			)
		})
	})

	describe('clearCache', () => {
		it('should clear parameter cache', async () => {
			// Arrange - Add item to cache
			const mockResponse = mockParameterStoreService.createParameter({
				Parameter: { Name: 'test-param', Value: 'cached-value' },
			})
			ssmMock.on(GetParameterCommand).resolves(mockResponse)
			await service.getParameter('test-param')

			expect(service.getCacheStats().size).toBe(1)

			// Act
			service.clearCache()

			// Assert
			expect(service.getCacheStats().size).toBe(0)
		})
	})

	describe('getCacheStats', () => {
		it('should return cache statistics', async () => {
			// Arrange
			const mockResponse = mockParameterStoreService.createParameter({
				Parameter: { Name: 'param1', Value: 'test-value' },
			})
			ssmMock.on(GetParameterCommand).resolves(mockResponse)

			// Act
			await service.getParameter('param1')
			await service.getParameter('param2')

			// Assert
			const stats = service.getCacheStats()
			expect(stats.size).toBe(2)
			expect(stats.keys).toContain('param1')
			expect(stats.keys).toContain('param2')
		})
	})

	describe('healthCheck', () => {
		it('should return true for successful health check', async () => {
			// Arrange
			const mockResponse = mockParameterStoreService.createParameter({
				Parameter: { Name: 'health-check', Value: 'health-check-value' },
			})
			ssmMock.on(GetParameterCommand).resolves(mockResponse)

			// Act
			const result = await service.healthCheck()

			// Assert
			expect(result).toBe(true)
		})

		it('should return false for failed health check', async () => {
			// Arrange
			ssmMock.on(GetParameterCommand).rejects(new Error('Health check failed'))

			// Act
			const result = await service.healthCheck()

			// Assert
			expect(result).toBe(false)
		})
	})

	describe('cache expiration', () => {
		it('should expire cached parameters after TTL', async () => {
			// Arrange
			const mockResponse = mockParameterStoreService.createParameter({
				Parameter: { Name: 'expiring-param', Value: 'test-value' },
			})
			ssmMock.on(GetParameterCommand).resolves(mockResponse)

			// Act - First call
			await service.getParameter('expiring-param')
			expect(ssmMock.commandCalls(GetParameterCommand)).toHaveLength(1)

			// Mock time passage (5+ minutes)
			const originalDateNow = Date.now
			Date.now = vi.fn(() => originalDateNow() + 6 * 60 * 1000)

			// Act - Second call should fetch again due to expiration
			await service.getParameter('expiring-param')
			expect(ssmMock.commandCalls(GetParameterCommand)).toHaveLength(2)

			// Restore Date.now
			Date.now = originalDateNow
		})
	})
})
