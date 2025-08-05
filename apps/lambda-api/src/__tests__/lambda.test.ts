/**
 * Tests for main Lambda handler
 * Updated to use comprehensive middleware test helpers and observability configuration
 */

import type {
	APIGatewayProxyEvent,
	APIGatewayProxyResult,
	Context,
} from 'aws-lambda'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Import our comprehensive test helpers
import {
	createErrorLoggingModuleMock,
	createLoggerModuleMock,
	createMetricsModuleMock,
	createMiddlewareTestSuite,
	createTracerModuleMock,
	type MiddlewareTestSuite,
	type MockLogger,
	powertoolsAssertions,
} from '../utils/test-helpers/index.js'

// Mock serverless-http before importing the handler
const mockServerlessHandler = vi.fn()
const mockServerlessHttpFactory = vi.fn(() => mockServerlessHandler)

vi.mock('serverless-http', () => ({
	default: mockServerlessHttpFactory,
}))

// Mock the Express server creation
const mockExpressApp = {
	use: vi.fn(),
	get: vi.fn(),
	post: vi.fn(),
	listen: vi.fn(),
}

// Mock the original Express server
vi.mock('@repo/express-api/src/utils/server.js', () => ({
	createServer: vi.fn(() => mockExpressApp),
}))

// Mock the coordinated Express server
vi.mock('./utils/coordinated-express-server.js', () => ({
	createLambdaExpressServer: vi.fn(() => Promise.resolve(mockExpressApp)),
}))

// Mock Lambda config service
const mockLambdaConfig = {
	initialize: vi.fn(),
	getExpressConfig: vi.fn(),
	setColdStart: vi.fn(),
	isInitialized: vi.fn(),
	getConfigSummary: vi.fn(),
}

vi.mock('../services/lambda-config.service.js', () => ({
	lambdaConfig: mockLambdaConfig,
}))

// Setup comprehensive Powertools mocking using our test helpers
const loggerMock = createLoggerModuleMock()
const metricsMock = createMetricsModuleMock()
const tracerMock = createTracerModuleMock()
const errorLoggingMock = createErrorLoggingModuleMock()

// Mock all Powertools modules
vi.mock('../utils/powertools-logger.js', () => loggerMock)
vi.mock('../utils/powertools-metrics.js', () => metricsMock)
vi.mock('../utils/powertools-tracer.js', () => tracerMock)
vi.mock('../utils/powertools-error-logging.js', () => errorLoggingMock)

describe('Lambda Handler', () => {
	let handler: (
		event: APIGatewayProxyEvent,
		context: Context,
	) => Promise<APIGatewayProxyResult>
	let coreHandler: (
		event: APIGatewayProxyEvent,
		context: Context,
	) => Promise<APIGatewayProxyResult>
	let healthCheck: (
		event: unknown,
		context: Context,
	) => Promise<{
		statusCode: number
		headers: Record<string, string>
		body: string
	}>

	// Test suite for comprehensive testing utilities
	let testSuite: MiddlewareTestSuite

	// Powertools mock references using our test helpers
	let mockLogger: MockLogger

	beforeEach(async () => {
		// Reset all modules to ensure clean state
		vi.resetModules()
		vi.clearAllMocks()

		// Create comprehensive test suite with observability integration
		testSuite = createMiddlewareTestSuite({
			event: { httpMethod: 'GET', path: '/health' },
			context: { functionName: 'test-lambda', awsRequestId: 'test-request-id' },
		})

		// Get Powertools mocks from our test helpers
		mockLogger = loggerMock.logger

		// Setup default mocks
		mockLambdaConfig.initialize.mockResolvedValue({
			relationalDatabaseUrl: 'test-db-url',
			openaiApiKey: 'test-openai-key',
		})

		mockLambdaConfig.getExpressConfig.mockReturnValue({
			port: 3000,
			relationalDatabaseUrl: 'test-db-url',
			openaiApiKey: 'test-openai-key',
		})

		mockLambdaConfig.getConfigSummary.mockReturnValue({
			status: 'initialized',
			nodeEnv: 'test',
		})

		mockLambdaConfig.isInitialized.mockReturnValue(false)

		// Setup serverless-http mock to return proper response
		const mockResponse = {
			statusCode: 200,
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ message: 'success' }),
		}

		// Clear previous mock calls and set up fresh implementations
		mockServerlessHttpFactory.mockClear()
		mockServerlessHandler.mockClear()

		// Set up the serverless-http factory to return our mock handler
		mockServerlessHttpFactory.mockReturnValue(mockServerlessHandler)

		// Set up the mock handler to return our expected response
		mockServerlessHandler.mockResolvedValue(mockResponse)

		// Import handler after mocks are set up
		const lambdaModule = await import('../lambda.js')
		handler = lambdaModule.handler
		healthCheck = lambdaModule.healthCheck

		// For debugging, let's test the core handler directly
		coreHandler = lambdaModule.__coreHandlerForTesting

		// Reset lambda module state for fresh test
		lambdaModule.__resetForTesting()

		// Reset middleware state for fresh test
		const middlewareModule = await import('../utils/lambda-middleware.js')
		middlewareModule.__resetMiddlewareForTesting()
	})

	afterEach(() => {
		vi.clearAllMocks()
	})

	describe('handler', () => {
		it('should handle cold start initialization', async () => {
			// Use our test suite for consistent event/context creation
			const event = testSuite.mockEvent
			const context = testSuite.mockContext

			const result = await coreHandler(event, context)

			expect(mockLambdaConfig.initialize).toHaveBeenCalledWith(true)
			expect(mockLambdaConfig.getConfigSummary).toHaveBeenCalled()
			expect(mockServerlessHandler).toHaveBeenCalledWith(event, context)
			expect(result.statusCode).toBe(200)

			// Verify Powertools logger calls using our assertion helpers
			powertoolsAssertions.expectLoggerCalled(
				mockLogger,
				'info',
				'Cold start - initializing Express app with Powertools coordination',
				{
					requestId: 'test-request-id',
					operation: 'coldStartInit',
					coldStart: true,
				},
			)

			// Verify Powertools tracer calls - withSubsegment should be called for Express initialization
			expect(tracerMock.withSubsegment).toHaveBeenCalled()
			expect(tracerMock.withSubsegmentSync).toHaveBeenCalled()
		})

		it('should handle warm start without re-initialization', async () => {
			// First call (cold start) - use test suite events
			const event1 = testSuite.mockEvent
			const context1 = testSuite.mockContext
			await handler(event1, context1)

			vi.clearAllMocks()

			// Second call (warm start) - create new test suite for different request
			const warmStartSuite = createMiddlewareTestSuite({
				event: { httpMethod: 'GET', path: '/users/me' },
				context: { awsRequestId: 'warm-start-request-id' },
			})
			await handler(warmStartSuite.mockEvent, warmStartSuite.mockContext)

			expect(mockLambdaConfig.initialize).not.toHaveBeenCalled()
			expect(mockLambdaConfig.setColdStart).toHaveBeenCalledWith(false)
			expect(mockServerlessHandler).toHaveBeenCalledWith(
				warmStartSuite.mockEvent,
				warmStartSuite.mockContext,
			)

			// Verify warm start behavior
			expect(mockLambdaConfig.setColdStart).toHaveBeenCalledWith(false)
		})

		it('should set callbackWaitsForEmptyEventLoop to false', async () => {
			const event = testSuite.mockEvent
			const context = testSuite.mockContext

			await handler(event, context)

			expect(context.callbackWaitsForEmptyEventLoop).toBe(false)
		})

		it('should handle Express app initialization errors', async () => {
			mockLambdaConfig.initialize.mockRejectedValue(
				new Error('Config initialization failed'),
			)

			const event = testSuite.mockEvent
			const context = testSuite.mockContext

			const result = await handler(event, context)

			expect(result.statusCode).toBe(500)
			expect(result.headers?.['Content-Type']).toBe('application/json')
			expect(result.headers?.['x-lambda-request-id']).toBe(context.awsRequestId)
			expect(result.headers?.['x-lambda-error']).toBe('true')

			const body = JSON.parse(result.body) as {
				error: string
				requestId: string
				message: string
			}
			expect(body.error).toBe('Internal Server Error')
			expect(body.requestId).toBe(context.awsRequestId)
		})

		it('should handle serverless-http handler errors', async () => {
			mockServerlessHandler.mockRejectedValue(new Error('Handler error'))

			const event = testSuite.mockEvent
			const context = testSuite.mockContext

			const result = await handler(event, context)

			expect(result.statusCode).toBe(500)
			expect(result.headers?.['x-lambda-error']).toBe('true')
		})

		it('should add Lambda context to request', async () => {
			const event = testSuite.mockEvent
			const context = testSuite.mockContext

			await handler(event, context)

			// Verify serverless-http was called with correct configuration
			const serverlessHttp = await import('serverless-http')
			expect(serverlessHttp.default).toHaveBeenCalledWith(
				mockExpressApp,
				expect.objectContaining({
					binary: false,
					request: expect.any(Function) as unknown,
					response: expect.any(Function) as unknown,
				}) as unknown,
			)
		})

		it('should handle different HTTP methods', async () => {
			const methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH']

			for (const method of methods) {
				const methodSuite = createMiddlewareTestSuite({
					event: { httpMethod: method, path: '/test' },
				})

				const result = await handler(
					methodSuite.mockEvent,
					methodSuite.mockContext,
				)
				expect(result.statusCode).toBe(200)
			}
		})

		it('should handle requests with different paths', async () => {
			const paths = ['/health', '/auth/login', '/users/me', '/chats']

			for (const path of paths) {
				const pathSuite = createMiddlewareTestSuite({
					event: { path },
				})

				const result = await handler(pathSuite.mockEvent, pathSuite.mockContext)
				expect(result.statusCode).toBe(200)
			}
		})

		it('should handle requests with query parameters', async () => {
			const querySuite = createMiddlewareTestSuite({
				event: {
					queryStringParameters: {
						page: '1',
						limit: '10',
					},
				},
			})

			const result = await handler(querySuite.mockEvent, querySuite.mockContext)
			expect(result.statusCode).toBe(200)
		})

		it('should handle requests with body', async () => {
			const bodySuite = createMiddlewareTestSuite({
				event: {
					httpMethod: 'POST',
					body: JSON.stringify({ message: 'test' }),
					headers: {
						'Content-Type': 'application/json',
					},
				},
			})

			const result = await handler(bodySuite.mockEvent, bodySuite.mockContext)
			expect(result.statusCode).toBe(200)
		})
	})

	describe('healthCheck', () => {
		it('should return health status', async () => {
			const event = {}
			const context = testSuite.mockContext

			const result = await healthCheck(event, context)

			expect(result.statusCode).toBe(200)
			expect(result.headers['Content-Type']).toBe('application/json')

			const body = JSON.parse(result.body) as {
				status: string
				functionName: string
				requestId: string
				timestamp: string
			}
			expect(body.status).toBe('healthy')
			expect(body.functionName).toBe(context.functionName)
			expect(body.requestId).toBe(context.awsRequestId)
			expect(body).toHaveProperty('timestamp')
		})

		it('should include initialization status', async () => {
			mockLambdaConfig.isInitialized.mockReturnValue(false)

			const event = {}
			const context = testSuite.mockContext

			const result = await healthCheck(event, context)

			const body = JSON.parse(result.body) as {
				configStatus: string
			}
			expect(body.configStatus).toBe('not_initialized')
		})
	})

	describe('Cold Start vs Warm Start Integration', () => {
		it('should handle multiple invocations correctly', async () => {
			// Reset module state for clean test
			vi.resetModules()
			const lambdaModule = await import('../lambda.js')
			const handler = lambdaModule.handler

			// First invocation (cold start) - use test suite
			const coldStartSuite = createMiddlewareTestSuite({
				event: { path: '/health' },
				context: { awsRequestId: 'request-1' },
			})

			const result1 = await handler(
				coldStartSuite.mockEvent,
				coldStartSuite.mockContext,
			)
			expect(result1.statusCode).toBe(200)
			expect(mockLambdaConfig.initialize).toHaveBeenCalledWith(true)

			// Clear mocks but keep module state
			vi.clearAllMocks()

			// Second invocation (warm start) - use test suite
			const warmStartSuite = createMiddlewareTestSuite({
				event: { path: '/users/me' },
				context: { awsRequestId: 'request-2' },
			})

			const result2 = await handler(
				warmStartSuite.mockEvent,
				warmStartSuite.mockContext,
			)
			expect(result2.statusCode).toBe(200)
			expect(mockLambdaConfig.initialize).not.toHaveBeenCalled()
			expect(mockLambdaConfig.setColdStart).toHaveBeenCalledWith(false)
		})

		it('should handle Express app initialization failure on cold start', async () => {
			// Reset module state
			vi.resetModules()

			// Mock initialization failure
			mockLambdaConfig.initialize.mockRejectedValue(
				new Error('Initialization failed'),
			)

			const lambdaModule = await import('../lambda.js')
			const handler = lambdaModule.handler

			// Use test suite for consistent event/context
			const errorSuite = createMiddlewareTestSuite()

			const result = await handler(errorSuite.mockEvent, errorSuite.mockContext)

			expect(result.statusCode).toBe(500)
			expect(result.headers?.['x-lambda-error']).toBe('true')

			const body = JSON.parse(result.body) as {
				error: string
				message: string
			}
			expect(body.error).toBe('Internal Server Error')
			expect(body.message).toBe('Lambda function encountered an error')
		})
	})
})
