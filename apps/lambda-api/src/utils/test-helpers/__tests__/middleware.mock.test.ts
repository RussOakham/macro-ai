/**
 * Tests for Middleware Test Helpers
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { LambdaMiddleware } from '../../lambda-middleware-types.js'
import {
	createMiddlewareChainTestUtils,
	createMiddlewareTestSuite,
	createMockAPIGatewayEvent,
	createMockAPIGatewayResponse,
	createMockErrorHandler,
	createMockHandler,
	createMockLambdaContext,
	createMockMiddlewareConfig,
	createMockMiddlewareContext,
	createMockObservabilityConfig,
	middlewareTestScenarios,
} from '../middleware.mock.js'

describe('Middleware Test Helpers', () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	afterEach(() => {
		vi.resetAllMocks()
	})

	describe('createMockAPIGatewayEvent', () => {
		it('should create default API Gateway event', () => {
			const event = createMockAPIGatewayEvent()

			expect(event.httpMethod).toBe('GET')
			expect(event.path).toBe('/test')
			expect(event.headers['User-Agent']).toBe('test-agent')
			expect(event.requestContext.requestId).toBe('test-request-id')
			expect(event.requestContext.identity.sourceIp).toBe('127.0.0.1')
		})

		it('should apply overrides to default event', () => {
			const event = createMockAPIGatewayEvent({
				httpMethod: 'POST',
				path: '/custom',
				body: JSON.stringify({ test: 'data' }),
			})

			expect(event.httpMethod).toBe('POST')
			expect(event.path).toBe('/custom')
			expect(event.body).toBe('{"test":"data"}')
			// Should preserve defaults
			expect(event.headers['User-Agent']).toBe('test-agent')
		})

		it('should create valid API Gateway event structure', () => {
			const event = createMockAPIGatewayEvent()

			// Verify required properties exist
			expect(event).toHaveProperty('httpMethod')
			expect(event).toHaveProperty('path')
			expect(event).toHaveProperty('headers')
			expect(event).toHaveProperty('requestContext')
			expect(event.requestContext).toHaveProperty('requestId')
			expect(event.requestContext).toHaveProperty('identity')
		})
	})

	describe('createMockLambdaContext', () => {
		it('should create default Lambda context', () => {
			const context = createMockLambdaContext()

			expect(context.functionName).toBe('test-function')
			expect(context.functionVersion).toBe('1.0.0')
			expect(context.awsRequestId).toBe('test-request-id')
			expect(context.memoryLimitInMB).toBe('1024')
			expect(typeof context.getRemainingTimeInMillis).toBe('function')
		})

		it('should apply overrides to default context', () => {
			const context = createMockLambdaContext({
				functionName: 'custom-function',
				awsRequestId: 'custom-request-id',
			})

			expect(context.functionName).toBe('custom-function')
			expect(context.awsRequestId).toBe('custom-request-id')
			// Should preserve defaults
			expect(context.functionVersion).toBe('1.0.0')
		})

		it('should have working getRemainingTimeInMillis function', () => {
			const context = createMockLambdaContext()

			const remainingTime = context.getRemainingTimeInMillis()
			expect(typeof remainingTime).toBe('number')
			expect(remainingTime).toBeGreaterThan(0)
		})
	})

	describe('createMockAPIGatewayResponse', () => {
		it('should create default API Gateway response', () => {
			const response = createMockAPIGatewayResponse()

			expect(response.statusCode).toBe(200)
			expect(response.headers?.['Content-Type']).toBe('application/json')
			expect(response.body).toBe('{"message":"success"}')
			expect(response.isBase64Encoded).toBe(false)
		})

		it('should apply overrides to default response', () => {
			const response = createMockAPIGatewayResponse({
				statusCode: 404,
				body: JSON.stringify({ error: 'Not found' }),
			})

			expect(response.statusCode).toBe(404)
			expect(response.body).toBe('{"error":"Not found"}')
			// Should preserve defaults
			expect(response.headers?.['Content-Type']).toBe('application/json')
		})
	})

	describe('createMockMiddlewareContext', () => {
		it('should create default middleware context', () => {
			const context = createMockMiddlewareContext()

			expect(context.requestId).toBe('test-request-id')
			expect(context.functionName).toBe('test-function')
			expect(context.isColdStart).toBe(false)
			expect(typeof context.startTime).toBe('number')
			expect(context.metadata).toHaveProperty('httpMethod')
		})

		it('should apply overrides to default context', () => {
			const context = createMockMiddlewareContext({
				isColdStart: true,
				requestId: 'custom-request-id',
			})

			expect(context.isColdStart).toBe(true)
			expect(context.requestId).toBe('custom-request-id')
			// Should preserve defaults
			expect(context.functionName).toBe('test-function')
		})
	})

	describe('createMockHandler', () => {
		it('should create mock handler that returns provided response', async () => {
			const response = createMockAPIGatewayResponse({ statusCode: 201 })
			const handler = createMockHandler(response)

			const event = createMockAPIGatewayEvent()
			const context = createMockLambdaContext()

			const result = await handler(event, context)

			expect(result).toEqual(response)
			expect(handler).toHaveBeenCalledWith(event, context)
		})

		it('should create mock handler with default response', async () => {
			const handler = createMockHandler()

			const event = createMockAPIGatewayEvent()
			const context = createMockLambdaContext()

			const result = await handler(event, context)

			expect(result.statusCode).toBe(200)
			expect(result.body).toBe('{"message":"success"}')
		})
	})

	describe('createMockErrorHandler', () => {
		it('should create mock handler that throws provided error', async () => {
			const error = new Error('Custom error')
			const handler = createMockErrorHandler(error)

			const event = createMockAPIGatewayEvent()
			const context = createMockLambdaContext()

			await expect(handler(event, context)).rejects.toThrow('Custom error')
		})

		it('should create mock handler with default error', async () => {
			const handler = createMockErrorHandler()

			const event = createMockAPIGatewayEvent()
			const context = createMockLambdaContext()

			await expect(handler(event, context)).rejects.toThrow('Test error')
		})
	})

	describe('createMockMiddlewareConfig', () => {
		it('should create default middleware configuration', () => {
			const config = createMockMiddlewareConfig()

			expect(config.observability?.enabled).toBe(true)
			expect(config.errorHandling?.enabled).toBe(true)
			expect(config.performance?.enabled).toBe(true)
			expect(config.requestLogging?.enabled).toBe(true)
		})

		it('should apply overrides to default configuration', () => {
			const config = createMockMiddlewareConfig({
				observability: { enabled: false },
				errorHandling: { enabled: false },
			})

			expect(config.observability?.enabled).toBe(false)
			expect(config.errorHandling?.enabled).toBe(false)
			// Should preserve defaults
			expect(config.performance?.enabled).toBe(true)
		})
	})

	describe('createMockObservabilityConfig', () => {
		it('should create observability configuration', () => {
			const config = createMockObservabilityConfig()

			expect(config.service).toBeDefined()
			expect(config.logger).toBeDefined()
			expect(config.metrics).toBeDefined()
			expect(config.tracer).toBeDefined()
			expect(config.service.environment).toBe('test')
		})

		it('should apply overrides to observability configuration', () => {
			const config = createMockObservabilityConfig({
				logger: {
					logLevel: 'DEBUG',
					enabled: false,
					sampleRate: 0,
					persistentAttributes: {},
					enableCorrelationIds: false,
					enableStructuredLogging: false,
					enableSensitiveDataRedaction: false,
					redactFields: [],
				},
				service: {
					environment: 'development',
					name: '',
					version: '',
					functionName: '',
					region: '',
					architecture: '',
					runtime: '',
				},
			})

			expect(config.logger.logLevel).toBe('DEBUG')
			expect(config.service.environment).toBe('development')
		})
	})

	describe('createMiddlewareTestSuite', () => {
		it('should create complete test suite with defaults', () => {
			const suite = createMiddlewareTestSuite()

			expect(suite.mockEvent).toBeDefined()
			expect(suite.mockContext).toBeDefined()
			expect(suite.mockResponse).toBeDefined()
			expect(suite.mockHandler).toBeDefined()
			expect(suite.mockErrorHandler).toBeDefined()
			expect(suite.mockMiddlewareContext).toBeDefined()
			expect(suite.mockConfig).toBeDefined()
			expect(suite.mockObservabilityConfig).toBeDefined()
		})

		it('should apply overrides to test suite components', () => {
			const suite = createMiddlewareTestSuite({
				event: { httpMethod: 'POST' },
				response: { statusCode: 201 },
				config: { observability: { enabled: false } },
			})

			expect(suite.mockEvent.httpMethod).toBe('POST')
			expect(suite.mockResponse.statusCode).toBe(201)
			expect(suite.mockConfig.observability?.enabled).toBe(false)
		})

		it('should create working mock handlers', async () => {
			const suite = createMiddlewareTestSuite()

			// Test success handler
			const result = await suite.mockHandler(suite.mockEvent, suite.mockContext)
			expect(result).toEqual(suite.mockResponse)

			// Test error handler
			await expect(
				suite.mockErrorHandler(suite.mockEvent, suite.mockContext),
			).rejects.toThrow()
		})
	})

	describe('createMiddlewareChainTestUtils', () => {
		it('should create middleware chain test utilities', () => {
			const utils = createMiddlewareChainTestUtils()

			expect(utils.applyMiddlewareChain).toBeDefined()
			expect(utils.testExecutionOrder).toBeDefined()
			expect(utils.testErrorPropagation).toBeDefined()
		})

		it('should apply middleware chain correctly', async () => {
			const utils = createMiddlewareChainTestUtils()
			const handler = createMockHandler()

			// Create simple middleware that adds a header
			const middleware1: LambdaMiddleware = (h) => async (event, context) => {
				const result = await h(event, context)
				return {
					...result,
					headers: { ...result.headers, 'X-Middleware-1': 'true' },
				}
			}

			const middleware2: LambdaMiddleware = (h) => async (event, context) => {
				const result = await h(event, context)
				return {
					...result,
					headers: { ...result.headers, 'X-Middleware-2': 'true' },
				}
			}

			const wrappedHandler = utils.applyMiddlewareChain(
				[middleware1, middleware2],
				handler,
			)
			const event = createMockAPIGatewayEvent()
			const context = createMockLambdaContext()

			const result = await wrappedHandler(event, context)

			expect(result.headers).toHaveProperty('X-Middleware-1', 'true')
			expect(result.headers).toHaveProperty('X-Middleware-2', 'true')
		})

		it('should test error propagation', async () => {
			const utils = createMiddlewareChainTestUtils()
			const errorHandler = createMockErrorHandler()

			// Create middleware that doesn't handle errors
			const middleware: LambdaMiddleware = (h) => async (event, context) => {
				return h(event, context) // Just pass through
			}

			await expect(
				utils.testErrorPropagation([middleware], errorHandler),
			).resolves.not.toThrow()
		})
	})

	describe('middlewareTestScenarios', () => {
		it('should provide basic test scenario', () => {
			const scenario = middlewareTestScenarios.basic

			expect(scenario.name).toBe('basic functionality')
			expect(scenario.event).toBeDefined()
			expect(scenario.context).toBeDefined()
			expect(scenario.expectedStatusCode).toBe(200)
		})

		it('should provide POST with body scenario', () => {
			const scenario = middlewareTestScenarios.postWithBody

			expect(scenario.name).toBe('POST request with body')
			expect(scenario.event.httpMethod).toBe('POST')
			expect(scenario.event.body).toBe('{"test":"data"}')
		})

		it('should provide cold start scenario', () => {
			const scenario = middlewareTestScenarios.coldStart

			expect(scenario.name).toBe('cold start scenario')
			expect(scenario.middlewareContext.isColdStart).toBe(true)
		})

		it('should provide error scenario', () => {
			const scenario = middlewareTestScenarios.error

			expect(scenario.name).toBe('error handling')
			expect(scenario.shouldThrow).toBe(true)
		})

		it('should provide large body scenario', () => {
			const scenario = middlewareTestScenarios.largeBody

			expect(scenario.name).toBe('large request body')
			expect(scenario.event.httpMethod).toBe('POST')
			expect(scenario.event.body?.length).toBeGreaterThan(10000)
		})
	})
})
