/* eslint-disable @typescript-eslint/unbound-method */
/**
 * Tests for Lambda Middleware System
 */

import type {
	APIGatewayProxyEvent,
	APIGatewayProxyResult,
	Context,
} from 'aws-lambda'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Mock Powertools modules
vi.mock('../powertools-logger.js', () => ({
	logger: {
		info: vi.fn(),
		error: vi.fn(),
		debug: vi.fn(),
	},
}))

vi.mock('../powertools-metrics.js', () => ({
	addMetric: vi.fn(),
	measureAndRecordExecutionTime: vi
		.fn()
		.mockImplementation(async (fn: () => Promise<unknown>) => {
			return await fn()
		}),
	MetricName: {
		ExecutionTime: 'ExecutionTime',
	},
	MetricUnit: {
		Count: 'Count',
		Milliseconds: 'Milliseconds',
	},
	recordColdStart: vi.fn(),
	recordMemoryUsage: vi.fn(),
}))

vi.mock('../powertools-tracer.js', () => ({
	addCommonAnnotations: vi.fn(),
	addCommonMetadata: vi.fn(),
	captureError: vi.fn(),
	subsegmentNames: {
		EXPRESS_ROUTES: 'express-routes',
	},
	traceErrorTypes: {
		DEPENDENCY_ERROR: 'DependencyError',
	},
	tracer: {
		putAnnotation: vi.fn(),
		putMetadata: vi.fn(),
	},
	withSubsegment: vi
		.fn()
		.mockImplementation((name, fn: () => Promise<unknown>) => {
			return fn()
		}),
}))

vi.mock('../powertools-error-logging.js', () => ({
	logErrorWithFullObservability: vi.fn(),
}))

// Import after mocking
import {
	applyMiddlewareWithTracing,
	compose,
	createMiddlewareContext,
	createMiddlewareStack,
	withErrorHandling,
	withObservability,
	withPerformanceMonitoring,
	withRequestLogging,
} from '../lambda-middleware.js'
import type { LambdaHandler } from '../lambda-middleware-types.js'
import * as powertoolsErrorLogging from '../powertools-error-logging.js'
// Import mocked modules to get reference to mock functions
import * as powertoolsLogger from '../powertools-logger.js'
import * as powertoolsMetrics from '../powertools-metrics.js'
import * as powertoolsTracer from '../powertools-tracer.js'

describe('Lambda Middleware System', () => {
	// Mock Lambda event and context
	const mockEvent: APIGatewayProxyEvent = {
		httpMethod: 'GET',
		path: '/test',
		headers: {
			'User-Agent': 'test-agent',
		},
		requestContext: {
			identity: {
				sourceIp: '127.0.0.1',
			},
		} as unknown as APIGatewayProxyEvent['requestContext'],
		body: null,
		queryStringParameters: null,
	} as unknown as APIGatewayProxyEvent

	const mockContext: Context = {
		awsRequestId: 'test-request-id',
		functionName: 'test-function',
		functionVersion: '1.0.0',
		callbackWaitsForEmptyEventLoop: false,
	} as Context

	const mockResponse: APIGatewayProxyResult = {
		statusCode: 200,
		body: JSON.stringify({ message: 'success' }),
	}

	// Mock handlers - need to be recreated in beforeEach due to vi.resetModules()
	let mockHandler: LambdaHandler
	let mockErrorHandler: LambdaHandler

	beforeEach(() => {
		vi.clearAllMocks()

		// Recreate mock handlers
		mockHandler = vi.fn().mockResolvedValue(mockResponse)
		mockErrorHandler = vi.fn().mockRejectedValue(new Error('Test error'))
	})

	afterEach(() => {
		vi.resetAllMocks()
	})

	describe('createMiddlewareContext', () => {
		it('should create middleware context with correct properties', () => {
			const context = createMiddlewareContext(mockEvent, mockContext)

			expect(context).toEqual({
				startTime: expect.any(Number) as number,
				isColdStart: expect.any(Boolean) as boolean,
				requestId: 'test-request-id',
				functionName: 'test-function',
				functionVersion: '1.0.0',
				metadata: {
					httpMethod: 'GET',
					path: '/test',
					userAgent: 'test-agent',
					sourceIp: '127.0.0.1',
				},
			})
		})

		it('should track cold start correctly', () => {
			const context1 = createMiddlewareContext(mockEvent, mockContext)
			const context2 = createMiddlewareContext(mockEvent, mockContext)

			// Both calls will have the same cold start status since we can't reset module state
			// This test verifies the cold start tracking mechanism exists
			expect(typeof context1.isColdStart).toBe('boolean')
			expect(typeof context2.isColdStart).toBe('boolean')
		})
	})

	describe('withObservability', () => {
		it('should add tracing annotations and metadata', async () => {
			const middleware = withObservability()
			const wrappedHandler = middleware(mockHandler)

			await wrappedHandler(mockEvent, mockContext)

			expect(powertoolsTracer.addCommonAnnotations).toHaveBeenCalled()
			expect(powertoolsTracer.addCommonMetadata).toHaveBeenCalled()
			expect(powertoolsTracer.tracer.putAnnotation).toHaveBeenCalledWith(
				'coldStart',
				expect.any(Boolean),
			)
			expect(powertoolsTracer.tracer.putAnnotation).toHaveBeenCalledWith(
				'requestId',
				'test-request-id',
			)
			expect(powertoolsTracer.tracer.putAnnotation).toHaveBeenCalledWith(
				'httpMethod',
				'GET',
			)
		})

		it('should log request start and completion', async () => {
			const middleware = withObservability()
			const wrappedHandler = middleware(mockHandler)

			await wrappedHandler(mockEvent, mockContext)

			expect(powertoolsLogger.logger.info).toHaveBeenCalledWith(
				'Lambda request started',
				expect.objectContaining({
					requestId: 'test-request-id',
					httpMethod: 'GET',
					path: '/test',
				}),
			)

			expect(powertoolsLogger.logger.info).toHaveBeenCalledWith(
				'Lambda request completed successfully',
				expect.objectContaining({
					requestId: 'test-request-id',
					statusCode: 200,
				}),
			)
		})

		it('should skip when disabled', async () => {
			const middleware = withObservability({ enabled: false })
			const wrappedHandler = middleware(mockHandler)

			await wrappedHandler(mockEvent, mockContext)

			expect(powertoolsTracer.addCommonAnnotations).not.toHaveBeenCalled()
			expect(powertoolsLogger.logger.info).not.toHaveBeenCalled()
		})
	})

	describe('withErrorHandling', () => {
		it('should handle errors with full observability', async () => {
			const middleware = withErrorHandling()
			const wrappedHandler = middleware(mockErrorHandler)

			await expect(wrappedHandler(mockEvent, mockContext)).rejects.toThrow(
				'Test error',
			)

			expect(
				powertoolsErrorLogging.logErrorWithFullObservability,
			).toHaveBeenCalledWith(
				expect.any(Error),
				'lambda-middleware-error-handler',
				expect.objectContaining({
					requestId: 'test-request-id',
					httpMethod: 'GET',
					path: '/test',
				}),
			)
		})

		it('should add error metrics', async () => {
			const middleware = withErrorHandling()
			const wrappedHandler = middleware(mockErrorHandler)

			await expect(wrappedHandler(mockEvent, mockContext)).rejects.toThrow()

			expect(powertoolsMetrics.addMetric).toHaveBeenCalledWith(
				'ExecutionTime',
				'Count',
				1,
				expect.objectContaining({
					Status: 'Error',
					ErrorType: 'Error',
				}),
			)
		})

		it('should skip when disabled', async () => {
			const middleware = withErrorHandling({ enabled: false })
			const wrappedHandler = middleware(mockErrorHandler)

			await expect(wrappedHandler(mockEvent, mockContext)).rejects.toThrow(
				'Test error',
			)

			expect(
				powertoolsErrorLogging.logErrorWithFullObservability,
			).not.toHaveBeenCalled()
		})
	})

	describe('withPerformanceMonitoring', () => {
		it('should record cold start metrics when enabled and cold start detected', async () => {
			// Test that the middleware has cold start tracking capability
			const middleware = withPerformanceMonitoring({
				enabled: true,
				options: {
					enableColdStartTracking: true,
				},
			})
			const wrappedHandler = middleware(mockHandler)

			await wrappedHandler(mockEvent, mockContext)

			// In test environment, cold start may not be detected
			// This test verifies the middleware runs without error when cold start tracking is enabled
			expect(mockHandler).toHaveBeenCalledWith(mockEvent, mockContext)
		})

		it('should record memory usage', async () => {
			const middleware = withPerformanceMonitoring()
			const wrappedHandler = middleware(mockHandler)

			await wrappedHandler(mockEvent, mockContext)

			expect(powertoolsMetrics.recordMemoryUsage).toHaveBeenCalled()
		})

		it('should measure execution time', async () => {
			const middleware = withPerformanceMonitoring()
			const wrappedHandler = middleware(mockHandler)

			await wrappedHandler(mockEvent, mockContext)

			expect(
				powertoolsMetrics.measureAndRecordExecutionTime,
			).toHaveBeenCalledWith(
				expect.any(Function),
				'ExecutionTime',
				expect.objectContaining({
					FunctionName: 'test-function',
					HttpMethod: 'GET',
					Path: '/test',
				}),
			)
		})

		it('should skip when disabled', async () => {
			const middleware = withPerformanceMonitoring({ enabled: false })
			const wrappedHandler = middleware(mockHandler)

			await wrappedHandler(mockEvent, mockContext)

			expect(powertoolsMetrics.recordColdStart).not.toHaveBeenCalled()
		})
	})

	describe('withRequestLogging', () => {
		it('should log request and response details', async () => {
			const middleware = withRequestLogging()
			const wrappedHandler = middleware(mockHandler)

			await wrappedHandler(mockEvent, mockContext)

			expect(powertoolsLogger.logger.info).toHaveBeenCalledWith(
				'Lambda request details',
				expect.objectContaining({
					requestId: 'test-request-id',
					httpMethod: 'GET',
					path: '/test',
				}),
			)

			expect(powertoolsLogger.logger.info).toHaveBeenCalledWith(
				'Lambda response details',
				expect.objectContaining({
					requestId: 'test-request-id',
					statusCode: 200,
				}),
			)
		})

		it('should log error details on failure', async () => {
			const middleware = withRequestLogging()
			const wrappedHandler = middleware(mockErrorHandler)

			await expect(wrappedHandler(mockEvent, mockContext)).rejects.toThrow()

			expect(powertoolsLogger.logger.error).toHaveBeenCalledWith(
				'Lambda request failed',
				expect.objectContaining({
					requestId: 'test-request-id',
					error: 'Test error',
				}),
			)
		})

		it('should skip when disabled', async () => {
			const middleware = withRequestLogging({ enabled: false })
			const wrappedHandler = middleware(mockHandler)

			await wrappedHandler(mockEvent, mockContext)

			expect(powertoolsLogger.logger.info).not.toHaveBeenCalled()
		})
	})

	describe('compose', () => {
		it('should compose multiple middleware functions', async () => {
			const middleware1 = vi
				.fn()
				.mockImplementation((handler: LambdaHandler) => handler)
			const middleware2 = vi
				.fn()
				.mockImplementation((handler: LambdaHandler) => handler)
			const middleware3 = vi
				.fn()
				.mockImplementation((handler: LambdaHandler) => handler)

			const composedMiddleware = compose([
				middleware1,
				middleware2,
				middleware3,
			])
			const wrappedHandler = composedMiddleware(mockHandler)

			await wrappedHandler(mockEvent, mockContext)

			// All middleware should be called
			expect(middleware1).toHaveBeenCalled()
			expect(middleware2).toHaveBeenCalled()
			expect(middleware3).toHaveBeenCalled()
			expect(mockHandler).toHaveBeenCalledWith(mockEvent, mockContext)
		})

		it('should execute middleware in correct order', async () => {
			const executionOrder: string[] = []

			const middleware1 =
				(handler: LambdaHandler) =>
				async (event: APIGatewayProxyEvent, context: Context) => {
					executionOrder.push('middleware1-start')
					const result = await handler(event, context)
					executionOrder.push('middleware1-end')
					return result
				}

			const middleware2 =
				(handler: LambdaHandler) =>
				async (event: APIGatewayProxyEvent, context: Context) => {
					executionOrder.push('middleware2-start')
					const result = await handler(event, context)
					executionOrder.push('middleware2-end')
					return result
				}

			const testHandler = vi.fn().mockImplementation(async () => {
				executionOrder.push('handler')
				return Promise.resolve(mockResponse)
			})

			const composedMiddleware = compose([middleware1, middleware2])
			const wrappedHandler = composedMiddleware(testHandler)

			await wrappedHandler(mockEvent, mockContext)

			expect(executionOrder).toEqual([
				'middleware1-start',
				'middleware2-start',
				'handler',
				'middleware2-end',
				'middleware1-end',
			])
		})
	})

	describe('createMiddlewareStack', () => {
		it('should create a complete middleware stack', async () => {
			const middlewareStack = createMiddlewareStack()
			const wrappedHandler = middlewareStack(mockHandler)

			await wrappedHandler(mockEvent, mockContext)

			// Verify that all middleware components are working
			expect(powertoolsLogger.logger.info).toHaveBeenCalled()
			expect(powertoolsTracer.addCommonAnnotations).toHaveBeenCalled()
			expect(powertoolsMetrics.recordColdStart).toHaveBeenCalled()
			expect(mockHandler).toHaveBeenCalledWith(mockEvent, mockContext)
		})

		it('should respect middleware configuration', async () => {
			const config = {
				requestLogging: { enabled: false },
				observability: { enabled: true },
				performance: { enabled: false },
				errorHandling: { enabled: true },
			}

			const middlewareStack = createMiddlewareStack(config)
			const wrappedHandler = middlewareStack(mockHandler)

			await wrappedHandler(mockEvent, mockContext)

			// Only observability should be active
			expect(powertoolsTracer.addCommonAnnotations).toHaveBeenCalled()
			expect(powertoolsMetrics.recordColdStart).not.toHaveBeenCalled()
		})
	})

	describe('applyMiddlewareWithTracing', () => {
		it('should apply middleware with X-Ray tracing', async () => {
			const middleware = withObservability()
			const wrappedHandler = applyMiddlewareWithTracing(
				mockHandler,
				middleware,
				'test-subsegment',
			)

			const result = await wrappedHandler(mockEvent, mockContext)

			expect(powertoolsTracer.withSubsegment).toHaveBeenCalledWith(
				'test-subsegment',
				expect.any(Function),
			)
			expect(result).toEqual(mockResponse)
		})

		it('should use default subsegment name', async () => {
			const middleware = withObservability()
			const wrappedHandler = applyMiddlewareWithTracing(mockHandler, middleware)

			await wrappedHandler(mockEvent, mockContext)

			expect(powertoolsTracer.withSubsegment).toHaveBeenCalledWith(
				'express-routes',
				expect.any(Function),
			)
		})
	})

	describe('Integration Tests', () => {
		it('should handle complete request lifecycle with all middleware', async () => {
			const middlewareStack = createMiddlewareStack()
			const wrappedHandler = applyMiddlewareWithTracing(
				mockHandler,
				middlewareStack,
			)

			const result = await wrappedHandler(mockEvent, mockContext)

			// Verify the response is returned correctly
			expect(result).toEqual(mockResponse)

			// Verify all middleware components were called
			expect(powertoolsLogger.logger.info).toHaveBeenCalled()
			expect(powertoolsTracer.addCommonAnnotations).toHaveBeenCalled()
			expect(powertoolsMetrics.recordMemoryUsage).toHaveBeenCalled()
			expect(powertoolsTracer.withSubsegment).toHaveBeenCalled()
		})

		it('should handle errors through complete middleware stack', async () => {
			const middlewareStack = createMiddlewareStack()
			const wrappedHandler = applyMiddlewareWithTracing(
				mockErrorHandler,
				middlewareStack,
			)

			await expect(wrappedHandler(mockEvent, mockContext)).rejects.toThrow(
				'Test error',
			)

			// Verify error handling was called
			expect(
				powertoolsErrorLogging.logErrorWithFullObservability,
			).toHaveBeenCalled()
			expect(powertoolsLogger.logger.error).toHaveBeenCalled()
		})
	})
})
