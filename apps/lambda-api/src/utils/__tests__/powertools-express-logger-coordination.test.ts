/* eslint-disable @typescript-eslint/unbound-method */
/**
 * Tests for Powertools-Express Logger Coordination
 */

import type { Context } from 'aws-lambda'
import type { NextFunction, Response } from 'express'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Mock Powertools modules
vi.mock('../powertools-logger.js', () => ({
	logger: {
		debug: vi.fn(),
		info: vi.fn(),
		warn: vi.fn(),
		error: vi.fn(),
	},
	createChildLogger: vi.fn().mockReturnValue({
		debug: vi.fn(),
		info: vi.fn(),
		warn: vi.fn(),
		error: vi.fn(),
	}),
}))

// Import after mocking
import {
	createCoordinatedPinoHttpConfig,
	createEnhancedLambdaContextInjection,
	createSharedLogMetadata,
	createUnifiedLogEntry,
	defaultPowertoolsExpressCoordinationConfig,
	enhanceRequestWithPowertoolsContext,
	extractCorrelationData,
	type LambdaAwareRequest,
	logUnifiedError,
	powertoolsExpressCoordinationMiddleware,
} from '../powertools-express-logger-coordination.js'
// Import mocked modules
import * as powertoolsLogger from '../powertools-logger.js'

describe('Powertools-Express Logger Coordination', () => {
	// Mock Lambda context
	const mockLambdaContext: Context = {
		awsRequestId: 'test-request-id',
		functionName: 'test-function',
		functionVersion: '1.0.0',
		callbackWaitsForEmptyEventLoop: false,
	} as Context

	// Mock middleware context
	const mockMiddlewareContext = {
		startTime: Date.now(),
		isColdStart: true,
		requestId: 'test-request-id',
		functionName: 'test-function',
		functionVersion: '1.0.0',
		metadata: {},
	}

	// Mock Express request
	let mockRequest: Partial<LambdaAwareRequest>
	let mockResponse: Partial<Response>
	let mockNext: NextFunction

	beforeEach(() => {
		vi.clearAllMocks()

		// Set up X-Ray trace ID
		process.env._X_AMZN_TRACE_ID = 'Root=1-5e1b4151-5ac6c58f5b5dbd6a5b5dbd6a'

		mockRequest = {
			method: 'GET',
			path: '/api/test',
			url: '/api/test?param=value',
			ip: '127.0.0.1',
			headers: {
				'user-agent': 'test-agent',
			},
			socket: {
				remotePort: 12345,
			},
			get: vi.fn().mockImplementation((header: string) => {
				if (header === 'User-Agent') return 'test-agent'
				return undefined
			}),
			lambda: {
				event: {},
				context: mockLambdaContext,
				isLambda: true,
				coldStart: true,
				functionName: 'test-function',
				functionVersion: '1.0.0',
				requestId: 'test-request-id',
				traceId: 'Root=1-5e1b4151-5ac6c58f5b5dbd6a5b5dbd6a',
				middlewareContext: mockMiddlewareContext,
			},
			log: {
				debug: vi.fn(),
				info: vi.fn(),
				warn: vi.fn(),
				error: vi.fn(),
			},
		} as unknown as LambdaAwareRequest

		mockResponse = {
			setHeader: vi.fn(),
			statusCode: 200,
			getHeaders: vi.fn().mockReturnValue({}),
		}

		mockNext = vi.fn()
	})

	afterEach(() => {
		vi.resetAllMocks()
		delete process.env._X_AMZN_TRACE_ID
	})

	describe('extractCorrelationData', () => {
		it('should extract correlation data from Lambda context', () => {
			const result = extractCorrelationData(
				mockLambdaContext,
				mockMiddlewareContext,
			)

			expect(result).toEqual({
				requestId: 'test-request-id',
				traceId: 'Root=1-5e1b4151-5ac6c58f5b5dbd6a5b5dbd6a',
				functionName: 'test-function',
				coldStart: true,
				correlationId: 'test-request-id-5e1b4151',
			})
		})

		it('should handle missing Lambda context', () => {
			const result = extractCorrelationData(undefined, mockMiddlewareContext)

			expect(result).toEqual({
				requestId: 'test-request-id',
				traceId: 'Root=1-5e1b4151-5ac6c58f5b5dbd6a5b5dbd6a',
				functionName: 'test-function',
				coldStart: true,
				correlationId: 'test-request-id-5e1b4151',
			})
		})

		it('should handle missing trace ID', () => {
			delete process.env._X_AMZN_TRACE_ID

			const result = extractCorrelationData(
				mockLambdaContext,
				mockMiddlewareContext,
			)

			expect(result).toEqual({
				requestId: 'test-request-id',
				traceId: undefined,
				functionName: 'test-function',
				coldStart: true,
				correlationId: 'test-request-id',
			})
		})

		it('should fallback to unknown when no context available', () => {
			delete process.env._X_AMZN_TRACE_ID

			const result = extractCorrelationData(undefined, undefined)

			expect(result).toEqual({
				requestId: 'unknown',
				traceId: undefined,
				functionName: undefined,
				coldStart: undefined,
				correlationId: 'unknown',
			})
		})
	})

	describe('createSharedLogMetadata', () => {
		it('should create comprehensive shared metadata', () => {
			const config = defaultPowertoolsExpressCoordinationConfig

			const result = createSharedLogMetadata(
				mockRequest as LambdaAwareRequest,
				config,
			)

			expect(result).toEqual({
				service: 'macro-ai-lambda-api',
				layer: 'express',
				requestId: 'test-request-id',
				traceId: 'Root=1-5e1b4151-5ac6c58f5b5dbd6a5b5dbd6a',
				functionName: 'test-function',
				coldStart: true,
				correlationId: 'test-request-id-5e1b4151',
				lambda: {
					isLambda: true,
					functionName: 'test-function',
					functionVersion: '1.0.0',
					coldStart: true,
				},
				request: {
					method: 'GET',
					path: '/api/test',
					url: '/api/test?param=value',
					userAgent: 'test-agent',
					ip: '127.0.0.1',
				},
			})
		})

		it('should handle request without Lambda context', () => {
			const requestWithoutLambda = { ...mockRequest }
			delete requestWithoutLambda.lambda

			const config = defaultPowertoolsExpressCoordinationConfig

			const result = createSharedLogMetadata(
				requestWithoutLambda as LambdaAwareRequest,
				config,
			)

			expect(result.lambda).toBeUndefined()
			expect(result.service).toBe('macro-ai-lambda-api')
			expect(result.layer).toBe('express')
		})
	})

	describe('enhanceRequestWithPowertoolsContext', () => {
		it('should enhance request with Powertools context', () => {
			const config = defaultPowertoolsExpressCoordinationConfig
			const mockChildLogger = {
				debug: vi.fn(),
				info: vi.fn(),
				warn: vi.fn(),
				error: vi.fn(),
			}
			vi.mocked(powertoolsLogger.createChildLogger).mockReturnValue(
				mockChildLogger as unknown as typeof powertoolsLogger.logger,
			)

			enhanceRequestWithPowertoolsContext(
				mockRequest as LambdaAwareRequest,
				config,
			)

			expect(mockRequest.correlationId).toBe('test-request-id-5e1b4151')
			expect(mockRequest.traceId).toBe(
				'Root=1-5e1b4151-5ac6c58f5b5dbd6a5b5dbd6a',
			)
			expect(mockRequest.powertoolsLogger).toBe(mockChildLogger)
			expect(powertoolsLogger.createChildLogger).toHaveBeenCalledWith(
				expect.objectContaining({
					correlationId: 'test-request-id-5e1b4151',
					requestId: 'test-request-id',
					traceId: 'Root=1-5e1b4151-5ac6c58f5b5dbd6a5b5dbd6a',
					layer: 'express',
				}),
			)
		})

		it('should add correlation headers', () => {
			const config = defaultPowertoolsExpressCoordinationConfig
			mockRequest.headers = {}

			enhanceRequestWithPowertoolsContext(
				mockRequest as LambdaAwareRequest,
				config,
			)

			expect(mockRequest.headers['x-correlation-id']).toBe(
				'test-request-id-5e1b4151',
			)
			expect(mockRequest.headers['x-amzn-trace-id']).toBe(
				'Root=1-5e1b4151-5ac6c58f5b5dbd6a5b5dbd6a',
			)
		})

		it('should skip enhancement when disabled', () => {
			const config = {
				...defaultPowertoolsExpressCoordinationConfig,
				options: {
					...defaultPowertoolsExpressCoordinationConfig.options,
					enableLambdaContextInjection: false,
				},
			}

			enhanceRequestWithPowertoolsContext(
				mockRequest as LambdaAwareRequest,
				config,
			)

			expect(mockRequest.correlationId).toBeUndefined()
			expect(mockRequest.powertoolsLogger).toBeUndefined()
		})
	})

	describe('createUnifiedLogEntry', () => {
		it('should create unified log entry for both loggers', () => {
			const config = defaultPowertoolsExpressCoordinationConfig
			mockRequest.powertoolsLogger = {
				debug: vi.fn(),
				info: vi.fn(),
				warn: vi.fn(),
				error: vi.fn(),
			} as unknown as typeof powertoolsLogger.logger

			createUnifiedLogEntry(
				'info',
				'Test message',
				mockRequest as LambdaAwareRequest,
				{ additional: 'data' },
				config,
			)

			expect(mockRequest.powertoolsLogger.info).toHaveBeenCalledWith(
				'Test message',
				expect.objectContaining({
					service: 'macro-ai-lambda-api',
					layer: 'express',
					additional: 'data',
				}),
			)

			expect(mockRequest.log?.info).toHaveBeenCalledWith(
				expect.objectContaining({
					service: 'macro-ai-lambda-api',
					layer: 'express',
					additional: 'data',
				}),
				'Test message',
			)
		})

		it('should skip when coordination is disabled', () => {
			const config = {
				...defaultPowertoolsExpressCoordinationConfig,
				enabled: false,
			}

			createUnifiedLogEntry(
				'info',
				'Test message',
				mockRequest as LambdaAwareRequest,
				{},
				config,
			)

			expect(powertoolsLogger.logger.info).not.toHaveBeenCalled()
			expect(mockRequest.log?.info).not.toHaveBeenCalled()
		})
	})

	describe('powertoolsExpressCoordinationMiddleware', () => {
		it('should enhance request and add unified logging', () => {
			const middleware = powertoolsExpressCoordinationMiddleware()

			middleware(
				mockRequest as LambdaAwareRequest,
				mockResponse as Response,
				mockNext,
			)

			expect(mockRequest.correlationId).toBe('test-request-id-5e1b4151')
			expect(mockRequest.unifiedLog).toBeDefined()
			expect(mockResponse.setHeader).toHaveBeenCalledWith(
				'x-correlation-id',
				'test-request-id-5e1b4151',
			)
			expect(mockResponse.setHeader).toHaveBeenCalledWith(
				'x-amzn-trace-id',
				'Root=1-5e1b4151-5ac6c58f5b5dbd6a5b5dbd6a',
			)
			expect(mockNext).toHaveBeenCalled()
		})

		it('should log request start when correlation is enabled', () => {
			const middleware = powertoolsExpressCoordinationMiddleware()

			middleware(
				mockRequest as LambdaAwareRequest,
				mockResponse as Response,
				mockNext,
			)

			expect(powertoolsLogger.logger.info).toHaveBeenCalledWith(
				'Express request started',
				expect.objectContaining({
					operation: 'express-request-start',
					method: 'GET',
					path: '/api/test',
				}),
			)
		})

		it('should skip when disabled', () => {
			const config = {
				...defaultPowertoolsExpressCoordinationConfig,
				enabled: false,
			}
			const middleware = powertoolsExpressCoordinationMiddleware(config)

			middleware(
				mockRequest as LambdaAwareRequest,
				mockResponse as Response,
				mockNext,
			)

			expect(mockRequest.correlationId).toBeUndefined()
			expect(mockRequest.unifiedLog).toBeUndefined()
			expect(mockNext).toHaveBeenCalled()
		})

		it('should handle errors gracefully', () => {
			// Mock request that will cause an error by making get() throw
			const errorRequest = {
				...mockRequest,
				get: vi.fn().mockImplementation(() => {
					throw new Error('Test error in get()')
				}),
			}

			const middleware = powertoolsExpressCoordinationMiddleware()

			middleware(
				errorRequest as LambdaAwareRequest,
				mockResponse as Response,
				mockNext,
			)

			expect(powertoolsLogger.logger.error).toHaveBeenCalledWith(
				'Powertools-Express coordination error',
				expect.objectContaining({
					operation: 'coordination-middleware',
					error: 'Test error in get()',
				}),
			)
			expect(mockNext).toHaveBeenCalled()
		})

		it('should work with unified logging function', () => {
			const middleware = powertoolsExpressCoordinationMiddleware()

			middleware(
				mockRequest as LambdaAwareRequest,
				mockResponse as Response,
				mockNext,
			)

			// Test the unified logging function
			mockRequest.unifiedLog?.('warn', 'Test warning', { custom: 'data' })

			expect(powertoolsLogger.logger.warn).toHaveBeenCalledWith(
				'Test warning',
				expect.objectContaining({
					custom: 'data',
					service: 'macro-ai-lambda-api',
				}),
			)
		})
	})

	describe('createCoordinatedPinoHttpConfig', () => {
		it('should create coordinated pino-http configuration', () => {
			const config = createCoordinatedPinoHttpConfig()

			expect(config.quietReqLogger).toBe(true)
			expect(config.quietResLogger).toBe(true)
			expect(config.customLogLevel).toBeDefined()
			expect(config.serializers).toBeDefined()
			expect(config.customSuccessMessage).toBeDefined()
			expect(config.customErrorMessage).toBeDefined()
		})

		it('should serialize request with Lambda context', () => {
			const config = createCoordinatedPinoHttpConfig()
			const serializedReq = config.serializers.req(
				mockRequest as LambdaAwareRequest,
			)

			expect(serializedReq).toEqual({
				method: 'GET',
				url: '/api/test?param=value',
				path: '/api/test',
				headers: { 'user-agent': 'test-agent' },
				remoteAddress: '127.0.0.1',
				remotePort: 12345,
				lambda: {
					requestId: 'test-request-id',
					functionName: 'test-function',
					coldStart: true,
					traceId: undefined, // Not set on request yet
				},
				correlationId: undefined, // Not set on request yet
			})
		})

		it('should create custom success message with correlation ID', () => {
			const config = createCoordinatedPinoHttpConfig()
			mockRequest.correlationId = 'test-correlation-id'

			const message = config.customSuccessMessage(
				mockRequest as LambdaAwareRequest,
				mockResponse as Response,
			)

			expect(message).toBe('GET /api/test 200 [test-correlation-id]')
		})

		it('should create custom error message with correlation ID', () => {
			const config = createCoordinatedPinoHttpConfig()
			mockRequest.correlationId = 'test-correlation-id'
			const error = new Error('Test error')

			const message = config.customErrorMessage(
				mockRequest as LambdaAwareRequest,
				mockResponse as Response,
				error,
			)

			expect(message).toBe(
				'GET /api/test 200 ERROR [test-correlation-id]: Test error',
			)
		})
	})

	describe('logUnifiedError', () => {
		it('should log error to both Powertools and Express loggers', () => {
			const error = new Error('Test error')
			mockRequest.powertoolsLogger = {
				error: vi.fn(),
			} as unknown as LambdaAwareRequest['powertoolsLogger']

			logUnifiedError(
				error,
				mockRequest as LambdaAwareRequest,
				'test-operation',
			)

			expect(mockRequest.powertoolsLogger?.error).toHaveBeenCalledWith(
				'Express operation failed',
				expect.objectContaining({
					operation: 'test-operation',
					error: 'Test error',
					errorType: 'Error',
					path: '/api/test',
					method: 'GET',
				}),
			)

			expect(mockRequest.log?.error).toHaveBeenCalledWith(
				expect.objectContaining({
					operation: 'test-operation',
					error: 'Test error',
				}),
				'Express operation failed: test-operation',
			)
		})

		it('should skip when unified error logging is disabled', () => {
			const config = {
				...defaultPowertoolsExpressCoordinationConfig,
				options: {
					...defaultPowertoolsExpressCoordinationConfig.options,
					enableUnifiedErrorLogging: false,
				},
			}
			const error = new Error('Test error')

			logUnifiedError(
				error,
				mockRequest as LambdaAwareRequest,
				'test-operation',
				{},
				config,
			)

			expect(powertoolsLogger.logger.error).not.toHaveBeenCalled()
			expect(mockRequest.log?.error).not.toHaveBeenCalled()
		})
	})

	describe('createEnhancedLambdaContextInjection', () => {
		it('should create enhanced context injection function', () => {
			const injectionFn = createEnhancedLambdaContextInjection(
				mockMiddlewareContext,
			)

			const mockExpressRequest = {
				headers: {},
			} as unknown as LambdaAwareRequest
			const result = injectionFn(
				mockExpressRequest,
				{},
				mockLambdaContext,
			) as unknown as LambdaAwareRequest

			expect(result.lambda).toEqual({
				event: {},
				context: mockLambdaContext,
				isLambda: true,
				coldStart: true,
				functionName: 'test-function',
				functionVersion: '1.0.0',
				requestId: 'test-request-id',
				traceId: 'Root=1-5e1b4151-5ac6c58f5b5dbd6a5b5dbd6a',
				middlewareContext: mockMiddlewareContext,
			})

			expect(result.headers['x-correlation-id']).toBe(
				'test-request-id-5e1b4151',
			)
			expect(result.headers['x-amzn-trace-id']).toBe(
				'Root=1-5e1b4151-5ac6c58f5b5dbd6a5b5dbd6a',
			)
		})

		it('should skip coordination when disabled', () => {
			const config = {
				...defaultPowertoolsExpressCoordinationConfig,
				enabled: false,
			}
			const injectionFn = createEnhancedLambdaContextInjection(
				mockMiddlewareContext,
				config,
			)

			const mockExpressRequest = {
				headers: {},
			} as unknown as LambdaAwareRequest
			const result = injectionFn(
				mockExpressRequest,
				{},
				mockLambdaContext,
			) as unknown as LambdaAwareRequest

			expect(result.headers['x-correlation-id']).toBeUndefined()
			expect(result.headers['x-amzn-trace-id']).toBeUndefined()
		})
	})

	describe('Integration Tests', () => {
		it('should provide complete coordination between Powertools and Express logging', () => {
			const mockChildLogger = {
				debug: vi.fn(),
				info: vi.fn(),
				warn: vi.fn(),
				error: vi.fn(),
			}
			vi.mocked(powertoolsLogger.createChildLogger).mockReturnValue(
				mockChildLogger as unknown as typeof powertoolsLogger.logger,
			)

			const middleware = powertoolsExpressCoordinationMiddleware()

			// Apply middleware
			middleware(
				mockRequest as LambdaAwareRequest,
				mockResponse as Response,
				mockNext,
			)

			// Verify request enhancement
			expect(mockRequest.correlationId).toBeDefined()
			expect(mockRequest.traceId).toBeDefined()
			expect(mockRequest.powertoolsLogger).toBe(mockChildLogger)
			expect(mockRequest.unifiedLog).toBeDefined()

			// Verify response headers
			expect(mockResponse.setHeader).toHaveBeenCalledWith(
				'x-correlation-id',
				expect.any(String),
			)
			expect(mockResponse.setHeader).toHaveBeenCalledWith(
				'x-amzn-trace-id',
				expect.any(String),
			)

			// Test unified logging
			mockRequest.unifiedLog?.('info', 'Test unified log', { test: 'data' })

			// Verify both loggers were called (should use child logger)
			expect(mockChildLogger.info).toHaveBeenCalledWith(
				'Test unified log',
				expect.objectContaining({
					test: 'data',
					service: 'macro-ai-lambda-api',
					layer: 'express',
				}),
			)

			expect(mockRequest.log?.info).toHaveBeenCalledWith(
				expect.objectContaining({
					test: 'data',
				}),
				'Test unified log',
			)
		})
	})
})
