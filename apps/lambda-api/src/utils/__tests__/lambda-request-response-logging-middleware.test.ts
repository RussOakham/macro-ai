/* eslint-disable @typescript-eslint/unbound-method */
/**
 * Tests for Comprehensive Request/Response Logging Middleware
 */

import type {
	APIGatewayProxyEvent,
	APIGatewayProxyResult,
	Context,
} from 'aws-lambda'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { LambdaHandler } from '../lambda-middleware-types.js'

// Mock Powertools modules
vi.mock('../powertools-logger.js', () => ({
	logger: {
		debug: vi.fn(),
		info: vi.fn(),
		warn: vi.fn(),
		error: vi.fn(),
	},
}))

vi.mock('../powertools-metrics.js', () => ({
	addMetric: vi.fn(),
	MetricName: {
		RequestDuration: 'RequestDuration',
	},
	MetricUnit: {
		Count: 'Count',
		Milliseconds: 'Milliseconds',
	},
}))

vi.mock('../powertools-tracer.js', () => ({
	tracer: {
		putAnnotation: vi.fn(),
		putMetadata: vi.fn(),
	},
}))

vi.mock('../lambda-middleware.js', () => ({
	createMiddlewareContext: vi.fn(),
}))

// Import after mocking
import * as lambdaMiddleware from '../lambda-middleware.js'
import {
	addXRayCorrelation,
	collectRequestResponseMetrics,
	extractRequestInfo,
	extractResponseInfo,
	redactSensitiveFields,
	truncateContent,
	withComprehensiveRequestResponseLogging,
	withDebugRequestResponseLogging,
	withExpressStyleRequestResponseLogging,
	withProductionRequestResponseLogging,
} from '../lambda-request-response-logging-middleware.js'
// Import mocked modules to get reference to mock functions
import * as powertoolsLogger from '../powertools-logger.js'
import * as powertoolsMetrics from '../powertools-metrics.js'
import * as powertoolsTracer from '../powertools-tracer.js'

describe('Comprehensive Request/Response Logging Middleware', () => {
	// Mock Lambda event and context
	const mockEvent: APIGatewayProxyEvent = {
		httpMethod: 'POST',
		path: '/api/test',
		resource: '/api/test',
		headers: {
			'User-Agent': 'test-agent',
			'Content-Type': 'application/json',
			Authorization: 'Bearer secret-token',
		},
		queryStringParameters: {
			param1: 'value1',
			token: 'secret-query-token',
		},
		pathParameters: {
			id: '123',
		},
		body: JSON.stringify({ message: 'test', password: 'secret' }),
		requestContext: {
			identity: {
				sourceIp: '127.0.0.1',
			},
			stage: 'dev',
		} as unknown as APIGatewayProxyEvent['requestContext'],
	} as unknown as APIGatewayProxyEvent

	const mockContext: Context = {
		awsRequestId: 'test-request-id',
		functionName: 'test-function',
		functionVersion: '1.0.0',
		callbackWaitsForEmptyEventLoop: false,
	} as Context

	const mockResponse: APIGatewayProxyResult = {
		statusCode: 200,
		headers: {
			'Content-Type': 'application/json',
			'Set-Cookie': 'session=secret-session',
		},
		body: JSON.stringify({ result: 'success', token: 'response-token' }),
	}

	// Mock handlers
	let mockHandler: LambdaHandler
	let mockErrorHandler: LambdaHandler

	beforeEach(() => {
		vi.clearAllMocks()

		// Setup createMiddlewareContext mock
		vi.mocked(lambdaMiddleware.createMiddlewareContext).mockReturnValue({
			startTime: Date.now(),
			isColdStart: false,
			requestId: 'test-request-id',
			functionName: 'test-function',
			functionVersion: '1.0.0',
			metadata: {
				httpMethod: 'POST',
				path: '/api/test',
				userAgent: 'test-agent',
				sourceIp: '127.0.0.1',
			},
		})

		// Recreate mock handlers
		mockHandler = vi.fn().mockResolvedValue(mockResponse)
		mockErrorHandler = vi.fn().mockRejectedValue(new Error('Test error'))

		// Mock environment variable
		process.env._X_AMZN_TRACE_ID = 'Root=1-5e1b4151-5ac6c58f5b5dbd6a5b5dbd6a'
	})

	afterEach(() => {
		vi.resetAllMocks()
		delete process.env._X_AMZN_TRACE_ID
	})

	describe('redactSensitiveFields', () => {
		it('should redact sensitive fields from objects', () => {
			const data = {
				username: 'john',
				password: 'secret123',
				token: 'abc123',
				authorization: 'Bearer token',
				publicInfo: 'visible',
			}

			const redacted = redactSensitiveFields(data, [
				'password',
				'token',
				'authorization',
			])

			expect(redacted).toEqual({
				username: 'john',
				password: '[REDACTED]',
				token: '[REDACTED]',
				authorization: '[REDACTED]',
				publicInfo: 'visible',
			})
		})

		it('should handle nested objects', () => {
			const data = {
				user: {
					name: 'john',
					credentials: {
						password: 'secret',
						apiKey: 'key123',
					},
				},
			}

			const redacted = redactSensitiveFields(data, ['password', 'key'])

			expect(redacted).toEqual({
				user: {
					name: 'john',
					credentials: {
						password: '[REDACTED]',
						apiKey: '[REDACTED]',
					},
				},
			})
		})

		it('should handle null and undefined values', () => {
			expect(redactSensitiveFields(null, ['password'])).toBe(null)
			expect(redactSensitiveFields(undefined, ['password'])).toBe(null)
		})

		it('should handle case-insensitive field matching', () => {
			const data = {
				PASSWORD: 'secret',
				Token: 'abc123',
				AUTHORIZATION: 'Bearer token',
			}

			const redacted = redactSensitiveFields(data, [
				'password',
				'token',
				'authorization',
			])

			expect(redacted).toEqual({
				PASSWORD: '[REDACTED]',
				Token: '[REDACTED]',
				AUTHORIZATION: '[REDACTED]',
			})
		})
	})

	describe('truncateContent', () => {
		it('should return content as-is if under size limit', () => {
			const content = 'short content'
			const result = truncateContent(content, 100)

			expect(result).toBe(content)
		})

		it('should truncate content if over size limit', () => {
			const content = 'a'.repeat(1000)
			const result = truncateContent(content, 100)

			expect(result).toEqual({
				truncated: expect.stringContaining('... [TRUNCATED]') as string,
				originalSize: 1000,
			})
		})

		it('should handle null and undefined values', () => {
			expect(truncateContent(null, 100)).toBe(null)
			expect(truncateContent(undefined, 100)).toBe(null)
		})
	})

	describe('extractRequestInfo', () => {
		it('should extract basic request information', () => {
			const config = {
				enabled: true,
				options: {
					enableHeaders: false,
					enableQueryParameters: false,
					enableRequestBody: false,
				},
			}

			const requestInfo = extractRequestInfo(mockEvent, config)

			expect(requestInfo).toEqual({
				httpMethod: 'POST',
				path: '/api/test',
				resource: '/api/test',
				stage: 'dev',
				sourceIp: '127.0.0.1',
				userAgent: 'test-agent',
			})
		})

		it('should include headers when enabled', () => {
			const config = {
				enabled: true,
				options: {
					enableHeaders: true,
					redactFields: ['authorization'],
				},
			}

			const requestInfo = extractRequestInfo(mockEvent, config)

			expect(requestInfo.headers).toEqual({
				'User-Agent': 'test-agent',
				'Content-Type': 'application/json',
				Authorization: '[REDACTED]',
			})
		})

		it('should include query parameters when enabled', () => {
			const config = {
				enabled: true,
				options: {
					enableQueryParameters: true,
					redactFields: ['token'],
				},
			}

			const requestInfo = extractRequestInfo(mockEvent, config)

			expect(requestInfo.queryStringParameters).toEqual({
				param1: 'value1',
				token: '[REDACTED]',
			})
		})

		it('should include request body when enabled', () => {
			const config = {
				enabled: true,
				options: {
					enableRequestBody: true,
					maxBodySize: 1024,
				},
			}

			const requestInfo = extractRequestInfo(mockEvent, config)

			expect(requestInfo.body).toBe(mockEvent.body)
			expect(requestInfo.bodySize).toBe(
				// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
				Buffer.byteLength(mockEvent.body!, 'utf8'),
			)
		})

		it('should truncate large request body', () => {
			const largeBody = JSON.stringify({ data: 'x'.repeat(2000) })
			const eventWithLargeBody = { ...mockEvent, body: largeBody }

			const config = {
				enabled: true,
				options: {
					enableRequestBody: true,
					maxBodySize: 100,
				},
			}

			const requestInfo = extractRequestInfo(eventWithLargeBody, config)

			expect(requestInfo.body).toEqual({
				truncated: expect.stringContaining('... [TRUNCATED]') as string,
				originalSize: Buffer.byteLength(largeBody, 'utf8'),
			})
		})

		describe('extractResponseInfo', () => {
			it('should extract basic response information', () => {
				const config = {
					enabled: true,
					options: {
						enableHeaders: false,
						enableResponseBody: false,
					},
				}

				const responseInfo = extractResponseInfo(mockResponse, config)

				expect(responseInfo).toEqual({
					statusCode: 200,
					isBase64Encoded: undefined,
				})
			})

			it('should include headers when enabled', () => {
				const config = {
					enabled: true,
					options: {
						enableHeaders: true,
						redactFields: ['cookie'],
					},
				}

				const responseInfo = extractResponseInfo(mockResponse, config)

				expect(responseInfo.headers).toEqual({
					'Content-Type': 'application/json',
					'Set-Cookie': '[REDACTED]',
				})
			})

			it('should include response body when enabled', () => {
				const config = {
					enabled: true,
					options: {
						enableResponseBody: true,
						maxBodySize: 1024,
					},
				}

				const responseInfo = extractResponseInfo(mockResponse, config)

				expect(responseInfo.body).toBe(mockResponse.body)
				expect(responseInfo.bodySize).toBe(
					Buffer.byteLength(mockResponse.body, 'utf8'),
				)
			})
		})

		describe('addXRayCorrelation', () => {
			it('should add X-Ray correlation data', () => {
				const logData: Record<string, unknown> = {
					httpMethod: 'POST',
					path: '/api/test',
					statusCode: 200,
				}

				const middlewareContext = {
					startTime: Date.now(),
					isColdStart: false,
					requestId: 'test-request-id',
					functionName: 'test-function',
					functionVersion: '1.0.0',
					metadata: {},
				}

				addXRayCorrelation(logData, middlewareContext)

				expect(logData.traceId).toBe('Root=1-5e1b4151-5ac6c58f5b5dbd6a5b5dbd6a')

				expect(powertoolsTracer.tracer.putAnnotation).toHaveBeenCalledWith(
					'httpMethod',
					'POST',
				)
				expect(powertoolsTracer.tracer.putAnnotation).toHaveBeenCalledWith(
					'statusCode',
					200,
				)
				expect(powertoolsTracer.tracer.putAnnotation).toHaveBeenCalledWith(
					'path',
					'/api/test',
				)

				expect(powertoolsTracer.tracer.putMetadata).toHaveBeenCalledWith(
					'request',
					{
						requestId: 'test-request-id',
						path: '/api/test',
						method: 'POST',
						userAgent: undefined,
						sourceIp: undefined,
					},
				)
			})
		})

		describe('collectRequestResponseMetrics', () => {
			it('should collect timing and size metrics', () => {
				const middlewareContext = {
					startTime: Date.now(),
					isColdStart: true,
					requestId: 'test-request-id',
					functionName: 'test-function',
					functionVersion: '1.0.0',
					metadata: {},
				}

				const config = {
					enabled: true,
					options: {
						enableTimingMetrics: true,
						enableSizeMetrics: true,
					},
				}

				collectRequestResponseMetrics(
					mockEvent,
					mockResponse,
					150,
					middlewareContext,
					config,
				)

				expect(powertoolsMetrics.addMetric).toHaveBeenCalledWith(
					'RequestDuration',
					'Milliseconds',
					150,
					expect.objectContaining({
						HttpMethod: 'POST',
						StatusCode: '200',
						ColdStart: 'true',
						FunctionName: 'test-function',
					}),
				)

				expect(powertoolsMetrics.addMetric).toHaveBeenCalledWith(
					'RequestCount',
					'Count',
					1,
					expect.objectContaining({
						HttpMethod: 'POST',
						StatusCode: '200',
					}),
				)

				expect(powertoolsMetrics.addMetric).toHaveBeenCalledWith(
					'RequestSize',
					'Bytes',
					// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
					Buffer.byteLength(mockEvent.body!, 'utf8'),
					expect.anything(),
				)

				expect(powertoolsMetrics.addMetric).toHaveBeenCalledWith(
					'ResponseSize',
					'Bytes',
					Buffer.byteLength(mockResponse.body, 'utf8'),
					expect.anything(),
				)
			})

			it('should skip metrics when disabled', () => {
				const middlewareContext = {
					startTime: Date.now(),
					isColdStart: false,
					requestId: 'test-request-id',
					functionName: 'test-function',
					functionVersion: '1.0.0',
					metadata: {},
				}

				const config = {
					enabled: true,
					options: {
						enableTimingMetrics: false,
						enableSizeMetrics: false,
					},
				}

				collectRequestResponseMetrics(
					mockEvent,
					mockResponse,
					150,
					middlewareContext,
					config,
				)

				expect(powertoolsMetrics.addMetric).not.toHaveBeenCalled()
			})
		})

		describe('withComprehensiveRequestResponseLogging', () => {
			it('should handle successful requests with full logging', async () => {
				const middleware = withComprehensiveRequestResponseLogging({
					enabled: true,
					options: {
						enableHeaders: true,
						enableQueryParameters: true,
						enableRequestBody: true,
						enableResponseBody: true,
						enableXRayCorrelation: true,
						enableTimingMetrics: true,
					},
				})
				const wrappedHandler = middleware(mockHandler)

				const result = await wrappedHandler(mockEvent, mockContext)

				expect(result).toEqual(mockResponse)
				expect(mockHandler).toHaveBeenCalledWith(mockEvent, mockContext)

				// Verify request logging
				expect(powertoolsLogger.logger.info).toHaveBeenCalledWith(
					'Lambda request started',
					expect.objectContaining({
						requestId: 'test-request-id',
						httpMethod: 'POST',
						path: '/api/test',
						coldStart: false,
					}),
				)

				// Verify response logging
				expect(powertoolsLogger.logger.info).toHaveBeenCalledWith(
					'Lambda request completed successfully',
					expect.objectContaining({
						statusCode: 200,
						executionTime: expect.any(Number) as number,
					}),
				)

				// Verify X-Ray annotations
				expect(powertoolsTracer.tracer.putAnnotation).toHaveBeenCalled()
				expect(powertoolsTracer.tracer.putMetadata).toHaveBeenCalled()

				// Verify metrics
				expect(powertoolsMetrics.addMetric).toHaveBeenCalled()
			})

			it('should handle errors with proper logging', async () => {
				const middleware = withComprehensiveRequestResponseLogging({
					enabled: true,
					options: {
						enableExpressCompatibility: true,
					},
				})
				const wrappedHandler = middleware(mockErrorHandler)

				await expect(wrappedHandler(mockEvent, mockContext)).rejects.toThrow(
					'Test error',
				)

				// Verify error logging
				expect(powertoolsLogger.logger.error).toHaveBeenCalledWith(
					'Lambda request failed',
					expect.objectContaining({
						error: 'Test error',
						errorType: 'Error',
						executionTime: expect.any(Number) as number,
					}),
				)

				// Verify Express-style error logging
				expect(powertoolsLogger.logger.error).toHaveBeenCalledWith(
					'POST /api/test ERROR',
					expect.objectContaining({
						operation: 'request-error',
						requestId: 'test-request-id',
						error: 'Test error',
					}),
				)
			})

			it('should skip when disabled', async () => {
				const middleware = withComprehensiveRequestResponseLogging({
					enabled: false,
				})
				const wrappedHandler = middleware(mockHandler)

				const result = await wrappedHandler(mockEvent, mockContext)

				expect(result).toEqual(mockResponse)
				expect(powertoolsLogger.logger.info).not.toHaveBeenCalled()
			})
		})

		describe('withExpressStyleRequestResponseLogging', () => {
			it('should use Express-compatible logging', async () => {
				const middleware = withExpressStyleRequestResponseLogging()
				const wrappedHandler = middleware(mockHandler)

				const result = await wrappedHandler(mockEvent, mockContext)

				expect(result).toEqual(mockResponse)

				// Verify Express-style logging
				expect(powertoolsLogger.logger.info).toHaveBeenCalledWith(
					'POST /api/test',
					expect.objectContaining({
						operation: 'request-start',
						requestId: 'test-request-id',
					}),
				)

				expect(powertoolsLogger.logger.info).toHaveBeenCalledWith(
					'POST /api/test 200',
					expect.objectContaining({
						operation: 'request-complete',
						statusCode: 200,
						responseTime: expect.any(Number) as number,
					}),
				)
			})
		})

		describe('withDebugRequestResponseLogging', () => {
			it('should enable detailed logging for debugging', async () => {
				const middleware = withDebugRequestResponseLogging()
				const wrappedHandler = middleware(mockHandler)

				const result = await wrappedHandler(mockEvent, mockContext)

				expect(result).toEqual(mockResponse)

				// Verify debug-level logging
				expect(powertoolsLogger.logger.debug).toHaveBeenCalledWith(
					'Lambda request started',
					expect.objectContaining({
						body: expect.any(String) as string,
						headers: expect.any(Object) as Record<string, string>,
					}),
				)
			})
		})

		describe('withProductionRequestResponseLogging', () => {
			it('should use minimal logging for production', async () => {
				const middleware = withProductionRequestResponseLogging()
				const wrappedHandler = middleware(mockHandler)

				const result = await wrappedHandler(mockEvent, mockContext)

				expect(result).toEqual(mockResponse)

				// Verify production logging (no body, no headers)
				expect(powertoolsLogger.logger.info).toHaveBeenCalledWith(
					'Lambda request started',
					expect.objectContaining({
						httpMethod: 'POST',
						path: '/api/test',
					}),
				)

				// Should not include sensitive data
				const logCall = vi.mocked(powertoolsLogger.logger.info).mock.calls[0]
				const logData = logCall?.[1] as Record<string, unknown>
				expect(logData.headers).toBeUndefined()
				expect(logData.body).toBeUndefined()
				expect(logData.queryStringParameters).toBeUndefined()
			})
		})

		describe('Integration Tests', () => {
			it('should handle complete request/response lifecycle with all features', async () => {
				const middleware = withComprehensiveRequestResponseLogging({
					enabled: true,
					options: {
						enableHeaders: true,
						enableQueryParameters: true,
						enableRequestBody: true,
						enableResponseBody: true,
						enableXRayCorrelation: true,
						enableTimingMetrics: true,
						enableSizeMetrics: true,
						enableExpressCompatibility: true,
						redactFields: ['password', 'token', 'authorization'],
					},
				})
				const wrappedHandler = middleware(mockHandler)

				const result = await wrappedHandler(mockEvent, mockContext)

				// Verify response
				expect(result).toEqual(mockResponse)

				// Verify comprehensive logging
				expect(powertoolsLogger.logger.info).toHaveBeenCalledTimes(4) // request start, express start, response, express complete

				// Verify X-Ray integration
				expect(powertoolsTracer.tracer.putAnnotation).toHaveBeenCalledWith(
					'httpMethod',
					'POST',
				)
				expect(powertoolsTracer.tracer.putMetadata).toHaveBeenCalledWith(
					'request',
					expect.any(Object),
				)

				// Verify metrics collection
				expect(powertoolsMetrics.addMetric).toHaveBeenCalledWith(
					'RequestDuration',
					'Milliseconds',
					expect.any(Number),
					expect.any(Object),
				)
				expect(powertoolsMetrics.addMetric).toHaveBeenCalledWith(
					'RequestSize',
					'Bytes',
					expect.any(Number),
					expect.any(Object),
				)
				expect(powertoolsMetrics.addMetric).toHaveBeenCalledWith(
					'ResponseSize',
					'Bytes',
					expect.any(Number),
					expect.any(Object),
				)
			})
		})
	})
})
