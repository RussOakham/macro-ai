/**
 * Tests for Powertools Tracer Configuration
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Mock the Tracer class before importing our module
vi.mock('@aws-lambda-powertools/tracer', () => ({
	Tracer: vi.fn().mockImplementation(() => ({
		putAnnotation: vi.fn(),
		putMetadata: vi.fn(),
		addErrorAsMetadata: vi.fn(),
		getSegment: vi.fn(),
	})),
}))

// Import after mocking
import {
	addCommonAnnotations,
	addCommonMetadata,
	captureError,
	commonAnnotations,
	commonMetadata,
	subsegmentNames,
	traceErrorTypes,
	tracer,
	tracerSettings,
	withSubsegment,
	withSubsegmentSync,
} from '../powertools-tracer.js'

const mockSubsegment = {
	addAnnotation: vi.fn(),
	addMetadata: vi.fn(),
	addError: vi.fn(),
	close: vi.fn(),
}

describe('Powertools Tracer Configuration', () => {
	let mockTracer: {
		putAnnotation: ReturnType<typeof vi.fn>
		putMetadata: ReturnType<typeof vi.fn>
		addErrorAsMetadata: ReturnType<typeof vi.fn>
		getSegment: ReturnType<typeof vi.fn>
	}

	const originalEnv = process.env

	beforeEach(() => {
		vi.clearAllMocks()
		// Reset environment variables
		process.env = { ...originalEnv }
		process.env.NODE_ENV = 'test'

		// Get reference to the mocked tracer
		mockTracer = tracer as unknown as typeof mockTracer
	})

	afterEach(() => {
		vi.resetAllMocks()
	})

	describe('Configuration', () => {
		it('should export tracer instance', () => {
			expect(tracer).toBeDefined()
			expect(tracer).toBe(mockTracer)
		})

		it('should export tracer settings', () => {
			expect(tracerSettings).toMatchObject({
				serviceName: 'macro-ai-lambda-api',
				serviceVersion: 'lambda-api-v1.0.0',
				environment: 'test',
				enabled: true,
				captureHTTPsRequests: true,
				captureResponse: true,
				captureError: true,
			})
		})

		it('should export common annotations', () => {
			expect(commonAnnotations).toEqual(
				expect.objectContaining({
					service: 'macro-ai-lambda-api',
					version: 'lambda-api-v1.0.0',
					environment: 'test',
					runtime: 'nodejs22.x',
					architecture: 'x86_64',
				}),
			)
		})

		it('should export common metadata', () => {
			expect(commonMetadata).toEqual(
				expect.objectContaining({
					framework: 'express',
					powertools: expect.objectContaining({
						logger: true,
						metrics: true,
						tracer: true,
					}) as unknown as typeof commonMetadata.powertools,
					features: expect.objectContaining({
						parameterStore: true,
						goStyleErrorHandling: true,
						structuredLogging: true,
						customMetrics: true,
					}) as unknown as typeof commonMetadata.features,
				}),
			)
		})

		it('should export subsegment names constants', () => {
			expect(subsegmentNames).toEqual(
				expect.objectContaining({
					COLD_START: 'lambda-cold-start',
					WARM_START: 'lambda-warm-start',
					LAMBDA_HANDLER: 'lambda-handler',
					EXPRESS_INIT: 'express-app-initialization',
					PARAMETER_STORE_GET: 'parameter-store-get',
					DATABASE_CONNECT: 'database-connection',
					HTTP_REQUEST: 'http-request',
				}),
			)
		})

		it('should export trace error types constants', () => {
			expect(traceErrorTypes).toEqual(
				expect.objectContaining({
					VALIDATION_ERROR: 'ValidationError',
					AUTHENTICATION_ERROR: 'AuthenticationError',
					PARAMETER_STORE_ERROR: 'ParameterStoreError',
					DATABASE_ERROR: 'DatabaseError',
					NETWORK_ERROR: 'NetworkError',
					UNKNOWN_ERROR: 'UnknownError',
				}),
			)
		})
	})

	describe('addCommonAnnotations', () => {
		it('should add common annotations to tracer', () => {
			// Act
			addCommonAnnotations()

			// Assert
			expect(mockTracer.putAnnotation).toHaveBeenCalledWith(
				'service',
				expect.any(String),
			)
			expect(mockTracer.putAnnotation).toHaveBeenCalledWith(
				'version',
				expect.any(String),
			)
			expect(mockTracer.putAnnotation).toHaveBeenCalledWith(
				'environment',
				expect.any(String),
			)
			expect(mockTracer.putAnnotation).toHaveBeenCalledWith(
				'runtime',
				expect.any(String),
			)
			expect(mockTracer.putAnnotation).toHaveBeenCalledWith(
				'architecture',
				expect.any(String),
			)
		})

		it('should handle annotation errors gracefully', () => {
			// Arrange
			mockTracer.putAnnotation.mockImplementation(() => {
				throw new Error('Annotation error')
			})
			const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {
				// Empty implementation for testing
			})

			// Act & Assert - should not throw
			expect(() => {
				addCommonAnnotations()
			}).not.toThrow()
			expect(consoleSpy).toHaveBeenCalledWith(
				'Failed to add common annotations:',
				expect.any(Error),
			)

			consoleSpy.mockRestore()
		})
	})

	describe('addCommonMetadata', () => {
		it('should add common metadata to tracer', () => {
			// Act
			addCommonMetadata()

			// Assert
			expect(mockTracer.putMetadata).toHaveBeenCalledWith(
				'application',
				commonMetadata,
			)
		})

		it('should handle metadata errors gracefully', () => {
			// Arrange
			mockTracer.putMetadata.mockImplementation(() => {
				throw new Error('Metadata error')
			})
			const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {
				// Empty implementation for testing
			})

			// Act & Assert - should not throw
			expect(() => {
				addCommonMetadata()
			}).not.toThrow()
			expect(consoleSpy).toHaveBeenCalledWith(
				'Failed to add common metadata:',
				expect.any(Error),
			)

			consoleSpy.mockRestore()
		})
	})

	describe('withSubsegment', () => {
		beforeEach(() => {
			mockTracer.getSegment.mockReturnValue({
				addNewSubsegment: vi.fn().mockReturnValue(mockSubsegment),
			})
		})

		it('should execute operation within subsegment', async () => {
			// Arrange
			const operation = vi.fn().mockResolvedValue('test-result')
			const annotations = { testKey: 'testValue' }
			const metadata = { context: 'test' }

			// Act
			const result = await withSubsegment(
				'test-subsegment',
				operation,
				annotations,
				metadata,
			)

			// Assert
			expect(result).toBe('test-result')
			expect(operation).toHaveBeenCalledOnce()
			expect(mockSubsegment.addAnnotation).toHaveBeenCalledWith(
				'service',
				expect.any(String),
			)
			expect(mockSubsegment.addAnnotation).toHaveBeenCalledWith(
				'testKey',
				'testValue',
			)
			expect(mockSubsegment.addMetadata).toHaveBeenCalledWith(
				'operation',
				metadata,
			)
			expect(mockSubsegment.close).toHaveBeenCalledOnce()
		})

		it('should handle operation errors and close subsegment with error', async () => {
			// Arrange
			const error = new Error('Operation failed')
			const operation = vi.fn().mockRejectedValue(error)

			// Act & Assert
			await expect(
				withSubsegment('test-subsegment', operation),
			).rejects.toThrow('Operation failed')

			expect(mockSubsegment.addError).toHaveBeenCalledWith(error)
			expect(mockSubsegment.close).toHaveBeenCalledWith(error)
		})

		it('should execute operation when no subsegment available', async () => {
			// Arrange
			mockTracer.getSegment.mockReturnValue(null)
			const operation = vi.fn().mockResolvedValue('test-result')

			// Act
			const result = await withSubsegment('test-subsegment', operation)

			// Assert
			expect(result).toBe('test-result')
			expect(operation).toHaveBeenCalledOnce()
			expect(mockTracer.getSegment).toHaveBeenCalled()
		})
	})

	describe('withSubsegmentSync', () => {
		beforeEach(() => {
			mockTracer.getSegment.mockReturnValue({
				addNewSubsegment: vi.fn().mockReturnValue(mockSubsegment),
			})
		})

		it('should execute synchronous operation within subsegment', () => {
			// Arrange
			const operation = vi.fn().mockReturnValue('sync-result')
			const annotations = { syncKey: 'syncValue' }

			// Act
			const result: string = withSubsegmentSync(
				'sync-subsegment',
				operation,
				annotations,
			) as string

			// Assert
			expect(result).toBe('sync-result')
			expect(operation).toHaveBeenCalledOnce()
			expect(mockSubsegment.addAnnotation).toHaveBeenCalledWith(
				'syncKey',
				'syncValue',
			)
			expect(mockSubsegment.close).toHaveBeenCalledOnce()
		})

		it('should handle synchronous operation errors', () => {
			// Arrange
			const error = new Error('Sync operation failed')
			const operation = vi.fn().mockImplementation(() => {
				throw error
			})

			// Act & Assert
			expect(() => {
				withSubsegmentSync('sync-subsegment', operation)
			}).toThrow('Sync operation failed')

			expect(mockSubsegment.addError).toHaveBeenCalledWith(error)
			expect(mockSubsegment.close).toHaveBeenCalledWith(error)
		})
	})

	describe('captureError', () => {
		it('should capture error with metadata', () => {
			// Arrange
			const error = new Error('Test error')
			const errorType = traceErrorTypes.VALIDATION_ERROR
			const metadata = { context: 'test-context' }

			// Act
			captureError(error, errorType, metadata)

			// Assert
			expect(mockTracer.addErrorAsMetadata).toHaveBeenCalledWith(error)
			expect(mockTracer.putAnnotation).toHaveBeenCalledWith(
				'errorType',
				errorType,
			)
			expect(mockTracer.putMetadata).toHaveBeenCalledWith(
				'errorContext',
				metadata,
			)
		})

		it('should capture error without optional parameters', () => {
			// Arrange
			const error = new Error('Simple error')

			// Act
			captureError(error)

			// Assert
			expect(mockTracer.addErrorAsMetadata).toHaveBeenCalledWith(error)
			expect(mockTracer.putAnnotation).not.toHaveBeenCalled()
			expect(mockTracer.putMetadata).not.toHaveBeenCalled()
		})

		it('should handle capture errors gracefully', () => {
			// Arrange
			const error = new Error('Test error')
			mockTracer.addErrorAsMetadata.mockImplementation(() => {
				throw new Error('Capture error')
			})
			const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {
				// Empty implementation for testing
			})

			// Act & Assert - should not throw
			expect(() => {
				captureError(error)
			}).not.toThrow()
			expect(consoleSpy).toHaveBeenCalledWith(
				'Failed to capture error in trace:',
				expect.any(Error),
			)

			consoleSpy.mockRestore()
		})
	})
})
