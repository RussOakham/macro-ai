/* eslint-disable @typescript-eslint/unbound-method */
/**
 * Tests for Standardized Error Handling Middleware
 */

import type {
	APIGatewayProxyEvent,
	APIGatewayProxyResult,
	Context,
} from 'aws-lambda'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { AppError, ErrorType } from '../errors.js'
import type { LambdaHandler } from '../lambda-middleware-types.js'

// Mock Powertools modules
vi.mock('../powertools-logger.js', () => ({
	logger: {
		info: vi.fn(),
		error: vi.fn(),
		warn: vi.fn(),
		debug: vi.fn(),
	},
}))

vi.mock('../powertools-metrics.js', () => ({
	addMetric: vi.fn(),
	MetricName: {
		ExecutionTime: 'ExecutionTime',
	},
	MetricUnit: {
		Count: 'Count',
		Milliseconds: 'Milliseconds',
	},
}))

vi.mock('../powertools-tracer.js', () => ({
	captureError: vi.fn(),
	traceErrorTypes: {
		DEPENDENCY_ERROR: 'DependencyError',
		PARAMETER_STORE_ERROR: 'ParameterStoreError',
	},
	tracer: {
		putAnnotation: vi.fn(),
		putMetadata: vi.fn(),
	},
}))

vi.mock('../powertools-error-logging.js', () => ({
	logAppError: vi.fn(),
	logErrorWithFullObservability: vi.fn(),
}))

vi.mock('../lambda-middleware.js', () => ({
	createMiddlewareContext: vi.fn(),
}))

// Import after mocking
import {
	classifyError,
	collectErrorMetrics,
	createStandardizedErrorResponse,
	redactSensitiveData,
	traceErrorWithContext,
	withExpressStyleErrorHandling,
	withGoStyleErrorHandling,
	withGoStyleErrorHandlingSync,
	withStandardizedErrorHandling,
} from '../lambda-error-handling-middleware.js'
import * as lambdaMiddleware from '../lambda-middleware.js'
import * as powertoolsErrorLogging from '../powertools-error-logging.js'
// Import mocked modules to get reference to mock functions
import * as powertoolsLogger from '../powertools-logger.js'
import * as powertoolsMetrics from '../powertools-metrics.js'
import * as powertoolsTracer from '../powertools-tracer.js'

describe('Standardized Error Handling Middleware', () => {
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
				httpMethod: 'GET',
				path: '/test',
				userAgent: 'test-agent',
				sourceIp: '127.0.0.1',
			},
		})

		// Recreate mock handlers
		mockHandler = vi.fn().mockResolvedValue(mockResponse)
		mockErrorHandler = vi.fn().mockRejectedValue(
			new AppError({
				message: 'Test error',
				type: ErrorType.ValidationError,
				status: 400,
				service: 'test-service',
			}),
		)
	})

	afterEach(() => {
		vi.resetAllMocks()
	})

	describe('classifyError', () => {
		it('should classify AppError instances correctly', () => {
			const validationError = new AppError({
				message: 'Validation failed',
				type: ErrorType.ValidationError,
				status: 400,
			})

			const classification = classifyError(validationError)

			expect(classification).toEqual({
				category: 'client_error',
				severity: 'low',
				isRetryable: false,
				statusCode: 400,
			})
		})

		it('should classify configuration errors as high severity', () => {
			const configError = new AppError({
				message: 'Config missing',
				type: ErrorType.ConfigurationError,
				status: 500,
			})

			const classification = classifyError(configError)

			expect(classification).toEqual({
				category: 'configuration_error',
				severity: 'high',
				isRetryable: false,
				statusCode: 500,
			})
		})

		it('should classify parameter store errors as retryable', () => {
			const paramError = new AppError({
				message: 'Parameter store unavailable',
				type: ErrorType.ParameterStoreError,
				status: 500,
			})

			const classification = classifyError(paramError)

			expect(classification).toEqual({
				category: 'infrastructure_error',
				severity: 'medium',
				isRetryable: true,
				statusCode: 500,
			})
		})

		it('should classify standard errors as critical', () => {
			const standardError = new Error('Unexpected error')
			const classification = classifyError(standardError)

			expect(classification).toEqual({
				category: 'unexpected_error',
				severity: 'critical',
				isRetryable: false,
				statusCode: 500,
			})
		})

		it('should classify unknown errors as critical', () => {
			const unknownError = 'string error'
			const classification = classifyError(unknownError)

			expect(classification).toEqual({
				category: 'unknown_error',
				severity: 'critical',
				isRetryable: false,
				statusCode: 500,
			})
		})
	})

	describe('redactSensitiveData', () => {
		it('should redact sensitive fields', () => {
			const data = {
				username: 'john',
				password: 'secret123',
				token: 'abc123',
				publicInfo: 'visible',
			}

			const redacted = redactSensitiveData(data, ['password', 'token'])

			expect(redacted).toEqual({
				username: 'john',
				password: '[REDACTED]',
				token: '[REDACTED]',
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

			const redacted = redactSensitiveData(data, ['password', 'key'])

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

		it('should handle arrays', () => {
			const data = [
				{ name: 'user1', password: 'secret1' },
				{ name: 'user2', password: 'secret2' },
			]

			const redacted = redactSensitiveData(data, ['password'])

			expect(redacted).toEqual([
				{ name: 'user1', password: '[REDACTED]' },
				{ name: 'user2', password: '[REDACTED]' },
			])
		})

		it('should handle non-object values', () => {
			expect(redactSensitiveData('string', ['password'])).toBe('string')
			expect(redactSensitiveData(123, ['password'])).toBe(123)
			expect(redactSensitiveData(null, ['password'])).toBe(null)
			expect(redactSensitiveData(undefined, ['password'])).toBe(undefined)
		})
	})

	describe('createStandardizedErrorResponse', () => {
		it('should create standardized error response', () => {
			const error = new AppError({
				message: 'Test error',
				type: ErrorType.ValidationError,
				status: 400,
				service: 'test-service',
				details: { field: 'invalid' },
			})

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
					enableStandardizedResponses: true,
					includeStackTrace: false,
				},
			}

			const response = createStandardizedErrorResponse(
				error,
				middlewareContext,
				config,
			)

			expect(response.statusCode).toBe(400)
			expect(response.headers).toMatchObject({
				'Content-Type': 'application/json',
				'x-lambda-request-id': 'test-request-id',
				'x-lambda-error': 'true',
				'x-error-type': ErrorType.ValidationError,
				'x-error-category': 'client_error',
				'x-error-severity': 'low',
			})

			const body = JSON.parse(response.body) as {
				error: boolean
				message: string
				type: ErrorType
				requestId: string
			}
			expect(body).toMatchObject({
				error: true,
				message: 'Test error',
				type: ErrorType.ValidationError,
				requestId: 'test-request-id',
			})
		})

		it('should include retry headers for retryable errors', () => {
			const error = new AppError({
				message: 'Parameter store error',
				type: ErrorType.ParameterStoreError,
				status: 500,
			})

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
					enableStandardizedResponses: true,
				},
			}

			const response = createStandardizedErrorResponse(
				error,
				middlewareContext,
				config,
			)

			expect(response.headers).toMatchObject({
				'x-retry-after': '1000',
			})

			const body = JSON.parse(response.body) as {
				retryable: boolean
				retryAfter: number
			}
			expect(body.retryable).toBe(true)
			expect(body.retryAfter).toBe(1000)
		})
	})

	describe('collectErrorMetrics', () => {
		it('should collect comprehensive error metrics', () => {
			const error = new AppError({
				message: 'Test error',
				type: ErrorType.ValidationError,
				status: 400,
				service: 'test-service',
			})

			const middlewareContext = {
				startTime: Date.now(),
				isColdStart: true,
				requestId: 'test-request-id',
				functionName: 'test-function',
				functionVersion: '1.0.0',
				metadata: {},
			}

			const classification = classifyError(error)

			collectErrorMetrics(error, middlewareContext, classification)

			expect(powertoolsMetrics.addMetric).toHaveBeenCalledWith(
				'ErrorCount',
				'Count',
				1,
				expect.objectContaining({
					ErrorType: ErrorType.ValidationError,
					ErrorCategory: 'client_error',
					ErrorSeverity: 'low',
					StatusCode: '400',
					ColdStart: 'true',
					FunctionName: 'test-function',
				}),
			)

			expect(powertoolsMetrics.addMetric).toHaveBeenCalledWith(
				'ErrorRate',
				'Count',
				1,
				expect.objectContaining({
					Category: 'client_error',
					Severity: 'low',
				}),
			)

			expect(powertoolsMetrics.addMetric).toHaveBeenCalledWith(
				'ServiceErrorCount',
				'Count',
				1,
				expect.objectContaining({
					Service: 'test-service',
					ErrorType: ErrorType.ValidationError,
				}),
			)
		})

		it('should collect retryable error metrics', () => {
			const error = new AppError({
				message: 'Parameter store error',
				type: ErrorType.ParameterStoreError,
				status: 500,
			})

			const middlewareContext = {
				startTime: Date.now(),
				isColdStart: false,
				requestId: 'test-request-id',
				functionName: 'test-function',
				functionVersion: '1.0.0',
				metadata: {},
			}

			const classification = classifyError(error)

			collectErrorMetrics(error, middlewareContext, classification)

			expect(powertoolsMetrics.addMetric).toHaveBeenCalledWith(
				'RetryableErrorCount',
				'Count',
				1,
				expect.objectContaining({
					ErrorType: ErrorType.ParameterStoreError,
					Category: 'infrastructure_error',
				}),
			)
		})
	})

	describe('traceErrorWithContext', () => {
		it('should add comprehensive error tracing', () => {
			const error = new AppError({
				message: 'Test error',
				type: ErrorType.InternalError,
				status: 500,
				service: 'test-service',
			})

			const middlewareContext = {
				startTime: Date.now(),
				isColdStart: false,
				requestId: 'test-request-id',
				functionName: 'test-function',
				functionVersion: '1.0.0',
				metadata: { additional: 'data' },
			}

			const classification = classifyError(error)

			traceErrorWithContext(error, middlewareContext, classification)

			expect(powertoolsTracer.tracer.putAnnotation).toHaveBeenCalledWith(
				'error',
				true,
			)
			expect(powertoolsTracer.tracer.putAnnotation).toHaveBeenCalledWith(
				'errorType',
				ErrorType.InternalError,
			)
			expect(powertoolsTracer.tracer.putAnnotation).toHaveBeenCalledWith(
				'errorCategory',
				'server_error',
			)
			expect(powertoolsTracer.tracer.putAnnotation).toHaveBeenCalledWith(
				'errorSeverity',
				'high',
			)
			expect(powertoolsTracer.tracer.putAnnotation).toHaveBeenCalledWith(
				'statusCode',
				500,
			)
			expect(powertoolsTracer.tracer.putAnnotation).toHaveBeenCalledWith(
				'retryable',
				false,
			)

			expect(powertoolsTracer.tracer.putMetadata).toHaveBeenCalledWith(
				'error',
				expect.objectContaining({
					message: 'Test error',
					type: ErrorType.InternalError,
					service: 'test-service',
					classification,
					context: expect.objectContaining({
						requestId: 'test-request-id',
						functionName: 'test-function',
						coldStart: false,
					}) as unknown as typeof middlewareContext,
				}),
			)

			expect(powertoolsTracer.captureError).toHaveBeenCalledWith(
				error,
				'ParameterStoreError',
				expect.objectContaining({
					operation: 'standardized-error-handler',
					category: 'server_error',
					severity: 'high',
					retryable: false,
					additional: 'data',
				}),
			)
		})
	})

	describe('withGoStyleErrorHandling', () => {
		it('should handle successful operations', async () => {
			const operation = vi.fn().mockResolvedValue('success')
			const [result, error] = await withGoStyleErrorHandling(
				operation,
				'test-operation',
			)

			expect(result).toBe('success')
			expect(error).toBe(null)
			expect(operation).toHaveBeenCalled()
		})

		it('should handle failed operations', async () => {
			const testError = new Error('Test error')
			const operation = vi.fn().mockRejectedValue(testError)
			const [result, error] = await withGoStyleErrorHandling(
				operation,
				'test-operation',
			)

			expect(result).toBe(null)
			expect(error).toBeInstanceOf(AppError)
			expect(error?.message).toBe('Test error')
		})
	})

	describe('withGoStyleErrorHandlingSync', () => {
		it('should handle successful synchronous operations', () => {
			const operation = vi.fn().mockReturnValue('success')
			const [result, error] = withGoStyleErrorHandlingSync(
				operation,
				'test-operation',
			)

			expect(result).toBe('success')
			expect(error).toBe(null)
			expect(operation).toHaveBeenCalled()
		})

		it('should handle failed synchronous operations', () => {
			const testError = new Error('Test error')
			const operation = vi.fn().mockImplementation(() => {
				throw testError
			})
			const [result, error] = withGoStyleErrorHandlingSync(
				operation,
				'test-operation',
			)

			expect(result).toBe(null)
			expect(error).toBeInstanceOf(AppError)
			expect(error?.message).toBe('Test error')
		})
	})

	describe('withStandardizedErrorHandling', () => {
		it('should handle successful requests', async () => {
			const middleware = withStandardizedErrorHandling()
			const wrappedHandler = middleware(mockHandler)

			const result = await wrappedHandler(mockEvent, mockContext)

			expect(result).toEqual(mockResponse)
			expect(mockHandler).toHaveBeenCalledWith(mockEvent, mockContext)
		})

		it('should handle errors with full observability', async () => {
			const middleware = withStandardizedErrorHandling({
				enabled: true,
				options: {
					enableFullObservability: true,
					enableErrorMetrics: true,
					enableErrorTracing: true,
					enableStandardizedResponses: true,
				},
			})
			const wrappedHandler = middleware(mockErrorHandler)

			const result = await wrappedHandler(mockEvent, mockContext)

			expect(result.statusCode).toBe(400)
			expect(result.headers).toMatchObject({
				'x-lambda-error': 'true',
				'x-error-type': ErrorType.ValidationError,
			})

			expect(
				powertoolsErrorLogging.logErrorWithFullObservability,
			).toHaveBeenCalled()
			expect(powertoolsMetrics.addMetric).toHaveBeenCalled()
			expect(powertoolsTracer.captureError).toHaveBeenCalled()
		})

		it('should use Go-style error handling when enabled', async () => {
			const middleware = withStandardizedErrorHandling({
				enabled: true,
				options: {
					enableGoStyleIntegration: true,
					enableStandardizedResponses: true,
				},
			})
			const wrappedHandler = middleware(mockErrorHandler)

			const result = await wrappedHandler(mockEvent, mockContext)

			expect(result.statusCode).toBe(400)
			expect(result.headers).toMatchObject({
				'x-lambda-error': 'true',
			})
		})

		it('should skip when disabled', async () => {
			const middleware = withStandardizedErrorHandling({ enabled: false })
			const wrappedHandler = middleware(mockErrorHandler)

			await expect(wrappedHandler(mockEvent, mockContext)).rejects.toThrow(
				'Test error',
			)

			expect(
				powertoolsErrorLogging.logErrorWithFullObservability,
			).not.toHaveBeenCalled()
		})

		it('should use custom error transformer when provided', async () => {
			const customTransformer = vi.fn().mockReturnValue({
				statusCode: 418,
				body: JSON.stringify({ custom: 'response' }),
				headers: { 'Content-Type': 'application/json' },
			})

			const middleware = withStandardizedErrorHandling({
				enabled: true,
				options: {
					enableStandardizedResponses: true,
					customErrorTransformer: customTransformer,
				},
			})
			const wrappedHandler = middleware(mockErrorHandler)

			const result = await wrappedHandler(mockEvent, mockContext)

			expect(result.statusCode).toBe(418)
			expect(customTransformer).toHaveBeenCalled()
		})
	})

	describe('withExpressStyleErrorHandling', () => {
		it('should handle successful requests', async () => {
			const middleware = withExpressStyleErrorHandling()
			const wrappedHandler = middleware(mockHandler)

			const result = await wrappedHandler(mockEvent, mockContext)

			expect(result).toEqual(mockResponse)
			expect(mockHandler).toHaveBeenCalledWith(mockEvent, mockContext)
		})

		it('should handle errors with Express-style logging', async () => {
			const middleware = withExpressStyleErrorHandling()
			const wrappedHandler = middleware(mockErrorHandler)

			const result = await wrappedHandler(mockEvent, mockContext)

			expect(result.statusCode).toBe(400)
			expect(result.headers).toMatchObject({
				'Content-Type': 'application/json',
				'x-lambda-request-id': 'test-request-id',
			})

			expect(powertoolsLogger.logger.error).toHaveBeenCalledWith(
				'Lambda request failed',
				expect.objectContaining({
					operation: 'express-style-error-handler',
					status: 400,
					type: ErrorType.ValidationError,
					service: 'test-service',
					error: 'Test error',
				}),
			)

			const body = JSON.parse(result.body) as { message: string }
			expect(body).toMatchObject({
				message: 'Test error',
			})
		})

		it('should include details in non-production environment', async () => {
			const originalEnv = process.env.NODE_ENV
			process.env.NODE_ENV = 'development'

			const middleware = withExpressStyleErrorHandling()
			const wrappedHandler = middleware(mockErrorHandler)

			const result = await wrappedHandler(mockEvent, mockContext)

			const body = JSON.parse(result.body) as { message: string; type: string }
			expect(body).toMatchObject({
				message: 'Test error',
				type: ErrorType.ValidationError,
			})

			process.env.NODE_ENV = originalEnv
		})

		it('should skip when disabled', async () => {
			const middleware = withExpressStyleErrorHandling({ enabled: false })
			const wrappedHandler = middleware(mockErrorHandler)

			await expect(wrappedHandler(mockEvent, mockContext)).rejects.toThrow(
				'Test error',
			)

			expect(powertoolsLogger.logger.error).not.toHaveBeenCalled()
		})
	})

	describe('Integration Tests', () => {
		it('should handle complete error lifecycle with all features enabled', async () => {
			const middleware = withStandardizedErrorHandling({
				enabled: true,
				options: {
					enableFullObservability: true,
					enableErrorMetrics: true,
					enableErrorTracing: true,
					enableStandardizedResponses: true,
					enableErrorClassification: true,
					enableGoStyleIntegration: true,
				},
			})
			const wrappedHandler = middleware(mockErrorHandler)

			const result = await wrappedHandler(mockEvent, mockContext)

			// Verify response structure
			expect(result.statusCode).toBe(400)
			expect(result.headers).toMatchObject({
				'x-lambda-error': 'true',
				'x-error-type': ErrorType.ValidationError,
				'x-error-category': 'client_error',
				'x-error-severity': 'low',
			})

			// Verify all observability features were called
			expect(
				powertoolsErrorLogging.logErrorWithFullObservability,
			).toHaveBeenCalled()
			expect(powertoolsMetrics.addMetric).toHaveBeenCalled()
			expect(powertoolsTracer.captureError).toHaveBeenCalled()
			expect(powertoolsTracer.tracer.putAnnotation).toHaveBeenCalled()
			expect(powertoolsTracer.tracer.putMetadata).toHaveBeenCalled()

			// Verify response body
			const body = JSON.parse(result.body) as {
				error: boolean
				message: string
				type: ErrorType
				requestId: string
			}
			expect(body).toMatchObject({
				error: true,
				message: 'Test error',
				type: ErrorType.ValidationError,
				requestId: 'test-request-id',
			})
		})
	})
})
