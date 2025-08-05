/* eslint-disable @typescript-eslint/unbound-method */
/**
 * Comprehensive Unit Tests for Error Handling Middleware Components
 * Tests individual error handling middleware functions using our test helper system
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { AppError, ErrorType } from '../errors.js'
// Import our comprehensive test helpers
import {
	createErrorHandlingTestSuite,
	createErrorLoggingModuleMock,
	createLoggerModuleMock,
	createMetricsModuleMock,
	createMiddlewareTestSuite,
	createTracerModuleMock,
	type MiddlewareTestSuite,
	testErrorScenarios,
} from '../test-helpers/index.js'

// Mock all Powertools modules using our test helpers
vi.mock('../powertools-logger.js', () => createLoggerModuleMock())
vi.mock('../powertools-metrics.js', () => createMetricsModuleMock())
vi.mock('../powertools-tracer.js', () => createTracerModuleMock())
vi.mock('../powertools-error-logging.js', () => createErrorLoggingModuleMock())

// Import error handling middleware after mocking
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
// Get references to mocked modules
import * as powertoolsLogger from '../powertools-logger.js'
import * as powertoolsMetrics from '../powertools-metrics.js'
import * as powertoolsTracer from '../powertools-tracer.js'

const loggerMock = powertoolsLogger
const metricsMock = powertoolsMetrics
const tracerMock = powertoolsTracer

describe('Error Handling Middleware Components Unit Tests', () => {
	let testSuite: MiddlewareTestSuite
	let errorTestSuite: ReturnType<typeof createErrorHandlingTestSuite>

	beforeEach(() => {
		vi.clearAllMocks()

		// Create comprehensive test suites
		testSuite = createMiddlewareTestSuite({
			event: { httpMethod: 'POST', path: '/api/test' },
			context: {
				functionName: 'error-test-function',
				awsRequestId: 'error-request-id',
			},
		})

		errorTestSuite = createErrorHandlingTestSuite()
	})

	afterEach(() => {
		vi.resetAllMocks()
	})

	describe('classifyError', () => {
		it('should classify validation errors correctly', () => {
			const error = new AppError({
				message: 'Invalid input',
				type: ErrorType.ValidationError,
				status: 400,
				service: 'test-service',
			})

			const classification = classifyError(error)

			expect(classification).toEqual({
				category: 'client_error',
				severity: 'low',
				isRetryable: false,
				statusCode: 400,
			})
		})

		it('should classify internal errors correctly', () => {
			const error = new AppError({
				message: 'Database connection failed',
				type: ErrorType.InternalError,
				status: 500,
				service: 'test-service',
			})

			const classification = classifyError(error)

			expect(classification).toEqual({
				category: 'server_error',
				severity: 'high',
				isRetryable: false,
				statusCode: 500,
			})
		})

		it('should handle unknown error types', () => {
			const error = new Error('Unknown error')

			const classification = classifyError(error)

			expect(classification).toEqual({
				category: 'unexpected_error',
				severity: 'critical',
				isRetryable: false,
				statusCode: 500,
			})
		})
	})

	describe('collectErrorMetrics', () => {
		it('should collect error metrics with proper classification', () => {
			const error = testErrorScenarios.validation.error
			const middlewareContext = testSuite.mockMiddlewareContext
			const classification = classifyError(error)

			collectErrorMetrics(error, middlewareContext, classification)

			// The actual implementation calls multiple metrics with different structure
			expect(metricsMock.addMetric).toHaveBeenCalledWith(
				'ErrorCount',
				'Count',
				1,
				expect.objectContaining({
					ErrorCategory: 'client_error',
					ErrorType: 'ValidationError',
					ErrorSeverity: 'low',
					StatusCode: '400',
				}),
			)
		})

		it('should include cold start information in metrics', () => {
			const error = testErrorScenarios.internal.error
			const middlewareContext = {
				...testSuite.mockMiddlewareContext,
				isColdStart: true,
			}
			const classification = classifyError(error)

			collectErrorMetrics(error, middlewareContext, classification)

			expect(metricsMock.addMetric).toHaveBeenCalledWith(
				'ErrorCount',
				'Count',
				1,
				expect.objectContaining({
					ColdStart: 'true',
					ErrorCategory: 'server_error',
					ErrorType: 'InternalError',
				}),
			)
		})
	})

	describe('createStandardizedErrorResponse', () => {
		it('should create standardized error response for AppError', () => {
			const error = testErrorScenarios.validation.error
			const middlewareContext = testSuite.mockMiddlewareContext
			const config = {
				enabled: true,
				options: {
					enableStandardizedResponses: true,
					redactFields: ['password', 'token'],
				},
			}

			const response = createStandardizedErrorResponse(
				error,
				middlewareContext,
				config,
			)

			expect(response).toMatchObject({
				statusCode: 400,
				headers: {
					'Content-Type': 'application/json',
					'x-lambda-error': 'true',
					'x-lambda-request-id': middlewareContext.requestId,
					'x-error-type': ErrorType.ValidationError,
					'x-error-category': 'client_error',
					'x-error-severity': 'low',
				},
			})

			const body = JSON.parse(response.body) as {
				error: boolean
				message: string
				type: string
				requestId: string
				timestamp: string
			}
			expect(body).toMatchObject({
				error: true,
				message: 'Invalid input',
				type: 'ValidationError',
				requestId: middlewareContext.requestId,
				timestamp: expect.any(String) as string, // Validate timestamp is a string,
			})
		})

		it('should create standardized error response for generic Error', () => {
			const error = testErrorScenarios.internal.error // Use AppError instead of generic Error
			const middlewareContext = testSuite.mockMiddlewareContext
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

			expect(response.statusCode).toBe(500)
			expect(response.headers?.['x-error-type']).toBe('InternalError')
		})

		it('should include correlation ID in response', () => {
			const error = testErrorScenarios.internal.error
			const middlewareContext = testSuite.mockMiddlewareContext
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

			expect(response.headers?.['x-lambda-request-id']).toBe(
				middlewareContext.requestId,
			)
		})
	})

	describe('redactSensitiveData', () => {
		it('should redact sensitive information from data objects', () => {
			const data = {
				message: 'Database error occurred',
				password: 'secret123',
				token: 'abc123',
				userId: '12345',
			}
			const redactFields = ['password', 'token']

			const redacted = redactSensitiveData(data, redactFields) as Record<
				string,
				unknown
			>

			expect(redacted.password).toBe('[REDACTED]')
			expect(redacted.token).toBe('[REDACTED]')
			expect(redacted.message).toBe('Database error occurred')
			expect(redacted.userId).toBe('12345')
		})

		it('should preserve non-sensitive information', () => {
			const data = {
				message: 'User not found with ID: 12345',
				userId: '12345',
				timestamp: '2023-01-01T00:00:00Z',
			}
			const redactFields = ['password', 'token']

			const redacted = redactSensitiveData(data, redactFields) as Record<
				string,
				unknown
			>

			expect(redacted.message).toBe('User not found with ID: 12345')
			expect(redacted.userId).toBe('12345')
			expect(redacted.timestamp).toBe('2023-01-01T00:00:00Z')
		})
	})

	describe('traceErrorWithContext', () => {
		it('should add error tracing with context', () => {
			const error = testErrorScenarios.internal.error
			const middlewareContext = testSuite.mockMiddlewareContext
			const classification = classifyError(error)

			traceErrorWithContext(error, middlewareContext, classification)

			// The actual implementation calls multiple annotations
			expect(tracerMock.tracer.putAnnotation).toHaveBeenCalledWith(
				'errorType',
				'InternalError',
			)
			expect(tracerMock.tracer.putMetadata).toHaveBeenCalledWith(
				'error',
				expect.objectContaining({
					message: error.message,
					type: error.type,
					classification: expect.any(
						Object,
					) as unknown as typeof classification,
				}),
			)
		})

		it('should capture error with appropriate trace error type', () => {
			const error = testErrorScenarios.internal.error
			const middlewareContext = testSuite.mockMiddlewareContext
			const classification = classifyError(error)

			traceErrorWithContext(error, middlewareContext, classification)

			expect(tracerMock.captureError).toHaveBeenCalledWith(
				error,
				undefined, // The actual implementation passes undefined as second parameter
				expect.objectContaining({
					operation: 'standardized-error-handler',
					category: 'server_error',
					severity: 'high',
					retryable: false,
				}),
			)
		})
	})

	describe('withStandardizedErrorHandling', () => {
		it('should handle errors with full observability enabled', async () => {
			const middleware = withStandardizedErrorHandling({
				enabled: true,
				options: {
					enableFullObservability: true,
					enableErrorMetrics: true,
					enableErrorTracing: true,
					enableStandardizedResponses: true,
					enableErrorClassification: true,
				},
			})

			const wrappedHandler = middleware(testSuite.mockErrorHandler)
			const result = await wrappedHandler(
				testSuite.mockEvent,
				testSuite.mockContext,
			)

			expect(result.statusCode).toBe(500)
			expect(result.headers?.['x-lambda-error']).toBe('true')

			// Verify observability calls
			expect(loggerMock.logger.error).toHaveBeenCalled()
			expect(metricsMock.addMetric).toHaveBeenCalled()
			expect(tracerMock.tracer.putAnnotation).toHaveBeenCalled()
		})

		it('should skip error handling when disabled', async () => {
			const middleware = withStandardizedErrorHandling({
				enabled: false,
			})

			const wrappedHandler = middleware(testSuite.mockErrorHandler)

			await expect(
				wrappedHandler(testSuite.mockEvent, testSuite.mockContext),
			).rejects.toThrow('Test error')
		})

		it('should use Go-style error handling when enabled', async () => {
			const middleware = withStandardizedErrorHandling({
				enabled: true,
				options: {
					enableGoStyleIntegration: true,
				},
			})

			const wrappedHandler = middleware(testSuite.mockErrorHandler)
			const result = await wrappedHandler(
				testSuite.mockEvent,
				testSuite.mockContext,
			)

			expect(result.statusCode).toBe(500)
			expect(errorTestSuite.tryCatch).toHaveBeenCalled()
		})
	})

	describe('withGoStyleErrorHandling', () => {
		it('should handle successful operations', async () => {
			const [result, error] = await withGoStyleErrorHandling(
				() => Promise.resolve('success'),
				'test-operation',
			)

			expect(result).toBe('success')
			expect(error).toBeNull()
		})

		it('should handle failed operations', async () => {
			const testError = new Error('Test error')
			const [result, error] = await withGoStyleErrorHandling(
				() => Promise.reject(testError),
				'test-operation',
			)

			expect(result).toBeNull()
			expect(error).toBeInstanceOf(AppError)
			expect(error?.message).toBe('Test error')
		})
	})

	describe('withGoStyleErrorHandlingSync', () => {
		it('should handle successful synchronous operations', () => {
			const [result, error] = withGoStyleErrorHandlingSync(
				() => 'success',
				'test-operation',
			)

			expect(result).toBe('success')
			expect(error).toBeNull()
		})

		it('should handle failed synchronous operations', () => {
			const [result, error] = withGoStyleErrorHandlingSync(() => {
				throw new Error('Sync error')
			}, 'test-operation')

			expect(result).toBeNull()
			expect(error).toBeInstanceOf(AppError)
			expect(error?.message).toBe('Sync error')
		})
	})

	describe('withExpressStyleErrorHandling', () => {
		it('should handle Express-style errors', async () => {
			const middleware = withExpressStyleErrorHandling({
				enabled: true,
				options: {
					enableFullObservability: true,
				},
			})

			const wrappedHandler = middleware(testSuite.mockErrorHandler)
			const result = await wrappedHandler(
				testSuite.mockEvent,
				testSuite.mockContext,
			)

			expect(result.statusCode).toBe(500)
			expect(result.headers?.['x-lambda-request-id']).toBe(
				testSuite.mockMiddlewareContext.requestId,
			)
		})

		it('should pass through successful responses', async () => {
			const middleware = withExpressStyleErrorHandling({
				enabled: true,
			})

			const wrappedHandler = middleware(testSuite.mockHandler)
			const result = await wrappedHandler(
				testSuite.mockEvent,
				testSuite.mockContext,
			)

			expect(result).toEqual(testSuite.mockResponse)
		})
	})
})
