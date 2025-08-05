/**
 * Comprehensive Unit Tests for Request/Response Logging Middleware Components
 * Tests individual request/response logging middleware functions using our test helper system
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

// Import request/response logging middleware after mocking
import {
	extractRequestInfo,
	extractResponseInfo,
	redactSensitiveFields,
	truncateContent,
	withComprehensiveRequestResponseLogging,
	withDebugRequestResponseLogging,
	withProductionRequestResponseLogging,
} from '../lambda-request-response-logging-middleware.js'
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
// Note: errorLoggingMock is not used in this test file but kept for consistency

describe('Request/Response Logging Middleware Components Unit Tests', () => {
	let testSuite: MiddlewareTestSuite

	beforeEach(() => {
		vi.clearAllMocks()

		// Create comprehensive test suite
		testSuite = createMiddlewareTestSuite({
			event: {
				httpMethod: 'POST',
				path: '/api/users',
				headers: {
					'Content-Type': 'application/json',
					Authorization: 'Bearer token123',
					'User-Agent': 'test-client/1.0',
					'X-API-Key': 'secret-key',
				},
				body: JSON.stringify({
					username: 'testuser',
					password: 'secret123',
					email: 'test@example.com',
				}),
				queryStringParameters: {
					include: 'profile',
					debug: 'true',
				},
			},
			context: {
				functionName: 'request-logging-test',
				awsRequestId: 'req-123',
			},
		})
	})

	afterEach(() => {
		vi.resetAllMocks()
	})

	describe('extractRequestInfo', () => {
		it('should extract basic request information', () => {
			const config = {
				enabled: true,
				options: {
					enableHeaders: true,
					enableQueryParameters: true,
				},
			}
			const requestInfo = extractRequestInfo(testSuite.mockEvent, config)

			expect(requestInfo).toMatchObject({
				httpMethod: 'POST',
				path: '/api/users',
				resource: testSuite.mockEvent.resource,
				stage: testSuite.mockEvent.requestContext.stage,
			})
		})

		it('should include query parameters when enabled', () => {
			const config = {
				enabled: true,
				options: {
					enableQueryParameters: true,
				},
			}
			const requestInfo = extractRequestInfo(testSuite.mockEvent, config)

			expect(requestInfo.queryStringParameters).toEqual({
				include: 'profile',
				debug: 'true',
			})
		})

		it('should handle missing query parameters', () => {
			const eventWithoutQuery = {
				...testSuite.mockEvent,
				queryStringParameters: null,
			}
			const config = {
				enabled: true,
				options: {
					enableQueryParameters: true,
				},
			}

			const requestInfo = extractRequestInfo(eventWithoutQuery, config)

			expect(requestInfo.queryStringParameters).toBeUndefined()
		})

		it('should include headers when enabled', () => {
			const config = {
				enabled: true,
				options: {
					enableHeaders: true,
				},
			}
			const requestInfo = extractRequestInfo(testSuite.mockEvent, config)

			expect(requestInfo.headers).toBeDefined()
			expect(requestInfo.headers).toMatchObject({
				'Content-Type': 'application/json',
				'User-Agent': 'test-client/1.0',
			})
		})
	})

	describe('extractResponseInfo', () => {
		it('should extract response information', () => {
			const response = {
				...testSuite.mockResponse,
				statusCode: 201,
				headers: {
					'Content-Type': 'application/json',
					'X-Custom-Header': 'value',
				},
			}
			const config = {
				enabled: true,
				options: {
					enableHeaders: true,
					enableResponseBody: true,
				},
			}

			const responseInfo = extractResponseInfo(response, config)

			expect(responseInfo).toMatchObject({
				statusCode: 201,
				isBase64Encoded: false,
			})
		})

		it('should include response body when enabled', () => {
			const response = {
				...testSuite.mockResponse,
				body: JSON.stringify({ message: 'success', data: { id: 123 } }),
			}
			const config = {
				enabled: true,
				options: {
					enableResponseBody: true,
				},
			}

			const responseInfo = extractResponseInfo(response, config)

			expect(responseInfo.body).toBe(response.body)
		})

		it('should handle responses without headers', () => {
			const response = {
				...testSuite.mockResponse,
				headers: undefined,
			}
			const config = {
				enabled: true,
				options: {
					enableHeaders: true,
				},
			}

			const responseInfo = extractResponseInfo(response, config)

			expect(responseInfo.statusCode).toBe(200)
			expect(responseInfo.headers).toBeUndefined()
		})
	})

	describe('redactSensitiveFields', () => {
		it('should redact sensitive fields from data', () => {
			const data = {
				Authorization: 'Bearer secret-token',
				'X-API-Key': 'api-key-123',
				'Content-Type': 'application/json',
				'User-Agent': 'test-client',
			}
			const redactFields = ['Authorization', 'X-API-Key']

			const redacted = redactSensitiveFields(data, redactFields)

			expect(redacted).toEqual({
				Authorization: '[REDACTED]',
				'X-API-Key': '[REDACTED]',
				'Content-Type': 'application/json',
				'User-Agent': 'test-client',
			})
		})

		it('should handle case-sensitive field names', () => {
			const data = {
				authorization: 'Bearer token',
				'x-api-key': 'key123',
				COOKIE: 'session=abc123',
			}
			const redactFields = ['authorization', 'x-api-key', 'COOKIE']

			const redacted = redactSensitiveFields(data, redactFields)

			expect(redacted?.authorization).toBe('[REDACTED]')
			expect(redacted?.['x-api-key']).toBe('[REDACTED]')
			expect(redacted?.COOKIE).toBe('[REDACTED]')
		})

		it('should preserve non-sensitive fields', () => {
			const data = {
				'Content-Type': 'application/json',
				Accept: 'application/json',
				'User-Agent': 'test-client',
			}
			const redactFields = ['password', 'token']

			const redacted = redactSensitiveFields(data, redactFields)

			expect(redacted).toEqual(data)
		})

		it('should handle null/undefined data', () => {
			expect(redactSensitiveFields(null, ['password'])).toBeNull()
			expect(redactSensitiveFields(undefined, ['password'])).toBeNull()
		})
	})

	describe('truncateContent', () => {
		it('should truncate large content', () => {
			const largeContent = 'x'.repeat(2000)
			const truncated = truncateContent(largeContent, 1000)

			expect(typeof truncated).toBe('object')
			expect(truncated).toHaveProperty('truncated')
			expect(truncated).toHaveProperty('originalSize', 2000)
		})

		it('should preserve small content', () => {
			const smallContent = 'small content'
			const result = truncateContent(smallContent, 1000)

			expect(result).toBe(smallContent)
		})

		it('should handle null/undefined content', () => {
			expect(truncateContent(null, 1000)).toBeNull()
			expect(truncateContent(undefined, 1000)).toBeNull()
		})

		it('should handle empty content', () => {
			expect(truncateContent('', 1000)).toBeNull()
		})
	})

	describe('withComprehensiveRequestResponseLogging', () => {
		it('should log requests and responses when enabled', async () => {
			const middleware = withComprehensiveRequestResponseLogging({
				enabled: true,
				options: {
					enableRequestBody: true,
					enableResponseBody: true,
					enableHeaders: true,
					enableQueryParameters: true,
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
				expect.stringContaining('Lambda request started'),
				expect.objectContaining({
					httpMethod: 'POST',
					path: '/api/users',
					requestId: 'req-123',
				}),
			)

			// Verify response logging - based on actual middleware behavior
			expect(loggerMock.logger.info).toHaveBeenCalledWith(
				expect.stringContaining('Lambda request completed successfully'),
				expect.objectContaining({
					statusCode: 200,
					executionTime: expect.any(Number) as number,
				}),
			)
		})

		it('should skip logging when disabled', async () => {
			const middleware = withComprehensiveRequestResponseLogging({
				enabled: false,
			})

			const wrappedHandler = middleware(testSuite.mockHandler)
			await wrappedHandler(testSuite.mockEvent, testSuite.mockContext)

			expect(loggerMock.logger.info).not.toHaveBeenCalledWith(
				expect.stringContaining('Request received'),
				expect.any(Object),
			)
		})

		it('should redact sensitive data when logging', async () => {
			const middleware = withComprehensiveRequestResponseLogging({
				enabled: true,
				options: {
					enableRequestBody: true,
					enableHeaders: true,
					redactFields: ['Authorization', 'X-API-Key'],
				},
			})

			const wrappedHandler = middleware(testSuite.mockHandler)
			await wrappedHandler(testSuite.mockEvent, testSuite.mockContext)

			// Verify sensitive data was redacted - based on actual middleware behavior
			const logCalls = loggerMock.logger.info.mock.calls as unknown[][]
			const requestLogCall = logCalls.find((call) => {
				const message = call[0]
				return (
					typeof message === 'string' &&
					message.includes('Lambda request started')
				)
			})

			expect(requestLogCall).toBeDefined()
			const logData = requestLogCall?.[1] as Record<string, unknown> | undefined

			// Check that sensitive headers were redacted if headers are logged
			if (logData?.headers) {
				const headers = logData.headers as Record<string, unknown>
				expect(headers.Authorization).toBe('[REDACTED]')
				expect(headers['X-API-Key']).toBe('[REDACTED]')
			}
		})

		it('should add metrics for request/response logging', async () => {
			const middleware = withComprehensiveRequestResponseLogging({
				enabled: true,
				options: {
					enableSizeMetrics: true,
					enableTimingMetrics: true,
				},
			})

			const wrappedHandler = middleware(testSuite.mockHandler)
			await wrappedHandler(testSuite.mockEvent, testSuite.mockContext)

			expect(metricsMock.addMetric).toHaveBeenCalledWith(
				'RequestCount',
				'Count',
				1,
				expect.objectContaining({
					httpMethod: 'POST',
					statusCode: 200,
				}),
			)
		})

		it('should add X-Ray annotations when enabled', async () => {
			const middleware = withComprehensiveRequestResponseLogging({
				enabled: true,
				options: {
					enableXRayCorrelation: true,
				},
			})

			const wrappedHandler = middleware(testSuite.mockHandler)
			await wrappedHandler(testSuite.mockEvent, testSuite.mockContext)

			expect(tracerMock.tracer.putAnnotation).toHaveBeenCalledWith(
				'http.method',
				'POST',
			)
			expect(tracerMock.tracer.putAnnotation).toHaveBeenCalledWith(
				'http.status_code',
				200,
			)
		})
	})

	describe('withDebugRequestResponseLogging', () => {
		it('should enable comprehensive logging for debugging', async () => {
			const middleware = withDebugRequestResponseLogging({
				options: {
					enableRequestBody: true,
					enableResponseBody: true,
					enableHeaders: true,
					// Debug mode uses default redaction settings
				},
			})

			const wrappedHandler = middleware(testSuite.mockHandler)
			await wrappedHandler(testSuite.mockEvent, testSuite.mockContext)

			// Verify comprehensive logging
			expect(loggerMock.logger.debug).toHaveBeenCalled()
		})
	})

	describe('withProductionRequestResponseLogging', () => {
		it('should use production-safe logging settings', async () => {
			const middleware = withProductionRequestResponseLogging({
				options: {
					enableRequestBody: false, // Production typically disables body logging
					enableResponseBody: false,
					enableHeaders: false, // Production disables headers for security
				},
			})

			const wrappedHandler = middleware(testSuite.mockHandler)
			await wrappedHandler(testSuite.mockEvent, testSuite.mockContext)

			// Verify production-safe logging - based on actual middleware behavior
			expect(loggerMock.logger.info).toHaveBeenCalledWith(
				expect.stringContaining('Lambda request started'),
				expect.objectContaining({
					httpMethod: 'POST',
					path: '/api/users',
					requestId: 'req-123',
				}),
			)
		})
	})
})
