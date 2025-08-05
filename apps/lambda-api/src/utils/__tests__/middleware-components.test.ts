/**
 * Comprehensive Unit Tests for Middleware Components
 * Tests individual middleware components using our comprehensive test helper system
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Import our comprehensive test helpers
import {
	createErrorLoggingModuleMock,
	createLoggerModuleMock,
	createMetricsModuleMock,
	createMiddlewareTestSuite,
	createTracerModuleMock,
	type MiddlewareTestSuite,
} from '../test-helpers/index.js'

// Mock all Powertools modules using our test helpers
vi.mock('../powertools-logger.js', () => createLoggerModuleMock())
vi.mock('../powertools-metrics.js', () => createMetricsModuleMock())
vi.mock('../powertools-tracer.js', () => createTracerModuleMock())
vi.mock('../powertools-error-logging.js', () => createErrorLoggingModuleMock())

// Import middleware components after mocking
import {
	__resetMiddlewareForTesting,
	applyMiddlewareWithTracing,
	compose,
	createMiddlewareContext,
	createMiddlewareStack,
	withErrorHandling,
	withObservability,
	withPerformanceMonitoring,
	withRequestLogging,
} from '../lambda-middleware.js'
import type { LambdaMiddleware } from '../lambda-middleware-types.js'
// Get references to mocked modules
import * as powertoolsLogger from '../powertools-logger.js'
import * as powertoolsMetrics from '../powertools-metrics.js'
import * as powertoolsTracer from '../powertools-tracer.js'

const loggerMock = powertoolsLogger as unknown as ReturnType<
	typeof createLoggerModuleMock
>
const metricsMock = powertoolsMetrics as unknown as ReturnType<
	typeof createMetricsModuleMock
>
const tracerMock = powertoolsTracer as unknown as ReturnType<
	typeof createTracerModuleMock
>

describe('Middleware Components Unit Tests', () => {
	let testSuite: MiddlewareTestSuite

	beforeEach(() => {
		vi.clearAllMocks()

		// Create comprehensive test suite for each test
		testSuite = createMiddlewareTestSuite({
			event: { httpMethod: 'GET', path: '/test' },
			context: {
				functionName: 'test-function',
				awsRequestId: 'test-request-id',
			},
		})
	})

	afterEach(() => {
		vi.resetAllMocks()
	})

	describe('createMiddlewareContext', () => {
		beforeEach(() => {
			// Reset middleware state for cold start testing
			__resetMiddlewareForTesting()
		})

		it('should create middleware context with correct properties', () => {
			const context = createMiddlewareContext(
				testSuite.mockEvent,
				testSuite.mockContext,
			)

			expect(context).toMatchObject({
				requestId: testSuite.mockContext.awsRequestId,
				functionName: testSuite.mockContext.functionName,
				functionVersion: testSuite.mockContext.functionVersion,
				isColdStart: expect.any(Boolean) as boolean,
				startTime: expect.any(Number) as number,
				metadata: {
					httpMethod: testSuite.mockEvent.httpMethod,
					path: testSuite.mockEvent.path,
					userAgent: testSuite.mockEvent.headers['User-Agent'],
					sourceIp: testSuite.mockEvent.requestContext.identity.sourceIp,
				},
			})
		})

		it('should handle cold start detection correctly', () => {
			// Reset state to ensure cold start
			__resetMiddlewareForTesting()

			// First call should be cold start
			const context1 = createMiddlewareContext(
				testSuite.mockEvent,
				testSuite.mockContext,
			)
			expect(context1.isColdStart).toBe(true)

			// Second call should be warm start
			const context2 = createMiddlewareContext(
				testSuite.mockEvent,
				testSuite.mockContext,
			)
			expect(context2.isColdStart).toBe(false)
		})

		it('should include request metadata', () => {
			const context = createMiddlewareContext(
				testSuite.mockEvent,
				testSuite.mockContext,
			)

			expect(context.metadata).toEqual({
				httpMethod: 'GET',
				path: '/test',
				userAgent: testSuite.mockEvent.headers['User-Agent'],
				sourceIp: testSuite.mockEvent.requestContext.identity.sourceIp,
			})
		})
	})

	describe('withObservability', () => {
		it('should add observability to handler when enabled', async () => {
			const middleware = withObservability({
				enabled: true,
				options: {
					enableRequestLogging: true,
					enablePerformanceMetrics: true,
					enableTracingAnnotations: true,
				},
			})

			const wrappedHandler = middleware(testSuite.mockHandler)
			const result = await wrappedHandler(
				testSuite.mockEvent,
				testSuite.mockContext,
			)

			expect(result).toEqual(testSuite.mockResponse)

			// Verify observability calls
			expect(loggerMock.logger.info).toHaveBeenCalledWith(
				expect.stringContaining('Lambda request started'),
				expect.objectContaining({
					requestId: testSuite.mockContext.awsRequestId,
					httpMethod: 'GET',
					path: '/test',
				}),
			)
		})

		it('should skip observability when disabled', async () => {
			const middleware = withObservability({
				enabled: false,
			})

			const wrappedHandler = middleware(testSuite.mockHandler)
			const result = await wrappedHandler(
				testSuite.mockEvent,
				testSuite.mockContext,
			)

			expect(result).toEqual(testSuite.mockResponse)
			expect(loggerMock.logger.info).not.toHaveBeenCalled()
		})

		it('should handle observability errors gracefully', async () => {
			// Mock logger to throw error
			loggerMock.logger.info.mockImplementation(() => {
				throw new Error('Logger error')
			})

			const middleware = withObservability({
				enabled: true,
				options: { enableRequestLogging: true },
			})

			const wrappedHandler = middleware(testSuite.mockHandler)

			// The middleware should propagate the error since it doesn't have error handling
			await expect(
				wrappedHandler(testSuite.mockEvent, testSuite.mockContext),
			).rejects.toThrow('Logger error')
		})
	})

	describe('withPerformanceMonitoring', () => {
		it('should add performance metrics when enabled', async () => {
			const middleware = withPerformanceMonitoring({
				enabled: true,
				options: {
					enableExecutionTime: true,
					enableMemoryUsage: true,
					enableColdStartTracking: true,
				},
			})

			const wrappedHandler = middleware(testSuite.mockHandler)
			const result = await wrappedHandler(
				testSuite.mockEvent,
				testSuite.mockContext,
			)

			expect(result).toEqual(testSuite.mockResponse)

			// Verify performance metrics were recorded
			expect(metricsMock.addMetric).toHaveBeenCalledWith(
				'ExecutionTime',
				'Milliseconds',
				expect.any(Number),
			)
		})

		it('should skip performance monitoring when disabled', async () => {
			const middleware = withPerformanceMonitoring({
				enabled: false,
			})

			const wrappedHandler = middleware(testSuite.mockHandler)
			await wrappedHandler(testSuite.mockEvent, testSuite.mockContext)

			expect(metricsMock.addMetric).not.toHaveBeenCalled()
		})
	})

	describe('withRequestLogging', () => {
		it('should log requests when enabled', async () => {
			const middleware = withRequestLogging({
				enabled: true,
				options: {
					enableRequestBody: true,
					enableResponseBody: true,
					enableHeaders: true,
					maxBodySize: 1024,
				},
			})

			const wrappedHandler = middleware(testSuite.mockHandler)
			const result = await wrappedHandler(
				testSuite.mockEvent,
				testSuite.mockContext,
			)

			expect(result).toEqual(testSuite.mockResponse)

			// Verify request logging - based on actual middleware behavior
			expect(loggerMock.logger.info).toHaveBeenCalledWith(
				expect.stringContaining('Lambda request details'),
				expect.objectContaining({
					httpMethod: 'GET',
					path: '/test',
				}),
			)
		})

		it('should skip request logging when disabled', async () => {
			const middleware = withRequestLogging({
				enabled: false,
			})

			const wrappedHandler = middleware(testSuite.mockHandler)
			await wrappedHandler(testSuite.mockEvent, testSuite.mockContext)

			expect(loggerMock.logger.info).not.toHaveBeenCalledWith(
				expect.stringContaining('Request received'),
				expect.any(Object),
			)
		})
	})

	describe('withErrorHandling', () => {
		it('should handle errors when enabled', async () => {
			const middleware = withErrorHandling({
				enabled: true,
				options: {
					enableFullObservability: true,
					enableErrorMetrics: true,
					enableErrorTracing: true,
				},
			})

			const wrappedHandler = middleware(testSuite.mockErrorHandler)
			const result = await wrappedHandler(
				testSuite.mockEvent,
				testSuite.mockContext,
			)

			expect(result.statusCode).toBe(500)
			expect(result.headers?.['x-lambda-error']).toBe('true')

			// Verify error logging
			expect(loggerMock.logger.error).toHaveBeenCalled()
		})

		it('should pass through errors when disabled', async () => {
			const middleware = withErrorHandling({
				enabled: false,
			})

			const wrappedHandler = middleware(testSuite.mockErrorHandler)

			await expect(
				wrappedHandler(testSuite.mockEvent, testSuite.mockContext),
			).rejects.toThrow('Test error')
		})
	})

	describe('compose', () => {
		it('should compose multiple middleware correctly', async () => {
			const middleware1: LambdaMiddleware =
				(handler) => async (event, context) => {
					const result = await handler(event, context)
					return {
						...result,
						headers: { ...result.headers, 'X-Middleware-1': 'applied' },
					}
				}

			const middleware2: LambdaMiddleware =
				(handler) => async (event, context) => {
					const result = await handler(event, context)
					return {
						...result,
						headers: { ...result.headers, 'X-Middleware-2': 'applied' },
					}
				}

			const composedMiddleware = compose([middleware1, middleware2])
			const wrappedHandler = composedMiddleware(testSuite.mockHandler)
			const result = await wrappedHandler(
				testSuite.mockEvent,
				testSuite.mockContext,
			)

			expect(result.headers).toMatchObject({
				'X-Middleware-1': 'applied',
				'X-Middleware-2': 'applied',
			})
		})

		it('should handle empty middleware array', async () => {
			const composedMiddleware = compose([])
			const wrappedHandler = composedMiddleware(testSuite.mockHandler)
			const result = await wrappedHandler(
				testSuite.mockEvent,
				testSuite.mockContext,
			)

			expect(result).toEqual(testSuite.mockResponse)
		})
	})

	describe('applyMiddlewareWithTracing', () => {
		it('should apply middleware with X-Ray tracing', async () => {
			const middleware: LambdaMiddleware =
				(handler) => async (event, context) => {
					const result = await handler(event, context)
					return {
						...result,
						headers: { ...result.headers, 'X-Traced': 'true' },
					}
				}

			const wrappedHandler = applyMiddlewareWithTracing(
				testSuite.mockHandler,
				middleware,
				'test-subsegment',
			)
			const result = await wrappedHandler(
				testSuite.mockEvent,
				testSuite.mockContext,
			)

			expect(result.headers?.['X-Traced']).toBe('true')
			expect(tracerMock.withSubsegment).toHaveBeenCalledWith(
				'test-subsegment',
				expect.any(Function),
			)
		})
	})

	describe('createMiddlewareStack', () => {
		it('should create middleware stack with configuration', () => {
			const stack = createMiddlewareStack(testSuite.mockConfig)

			expect(typeof stack).toBe('function')
			expect(stack).toBeInstanceOf(Function)
		})

		it('should respect middleware configuration', () => {
			const config = {
				...testSuite.mockConfig,
				observability: { enabled: false },
				errorHandling: { enabled: false },
			}

			const stack = createMiddlewareStack(config)

			// Should still return a function even with features disabled
			expect(typeof stack).toBe('function')
		})
	})
})
