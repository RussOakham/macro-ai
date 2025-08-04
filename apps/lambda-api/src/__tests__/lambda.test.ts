/**
 * Tests for main Lambda handler
 */

import type {
	APIGatewayProxyEvent,
	APIGatewayProxyResult,
	Context,
} from 'aws-lambda'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Mock serverless-http before importing the handler
const mockServerlessHandler = vi.fn()
vi.mock('serverless-http', () => ({
	default: vi.fn(() => mockServerlessHandler),
}))

// Mock the Express server creation
const mockExpressApp = {
	use: vi.fn(),
	get: vi.fn(),
	post: vi.fn(),
	listen: vi.fn(),
}

vi.mock('@repo/express-api/src/utils/server.js', () => ({
	createServer: vi.fn(() => mockExpressApp),
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

describe('Lambda Handler', () => {
	let handler: (
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

	beforeEach(async () => {
		vi.clearAllMocks()

		// Reset module state
		vi.resetModules()

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

		mockLambdaConfig.isInitialized.mockReturnValue(true)

		mockServerlessHandler.mockResolvedValue({
			statusCode: 200,
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ message: 'success' }),
		})

		// Import handler after mocks are set up
		const lambdaModule = await import('../lambda.js')
		handler = lambdaModule.handler
		healthCheck = lambdaModule.healthCheck
	})

	afterEach(() => {
		vi.clearAllMocks()
	})

	describe('handler', () => {
		it('should handle cold start initialization', async () => {
			const event = global.createMockAPIGatewayEvent({
				httpMethod: 'GET',
				path: '/health',
			}) as APIGatewayProxyEvent
			const context = global.createMockLambdaContext() as Context

			const result = await handler(event, context)

			expect(mockLambdaConfig.initialize).toHaveBeenCalledWith(true)
			expect(mockLambdaConfig.getConfigSummary).toHaveBeenCalled()
			expect(mockServerlessHandler).toHaveBeenCalledWith(event, context)
			expect(result.statusCode).toBe(200)
		})

		it('should handle warm start without re-initialization', async () => {
			// First call (cold start)
			const event1 = global.createMockAPIGatewayEvent() as APIGatewayProxyEvent
			const context1 = global.createMockLambdaContext() as Context
			await handler(event1, context1)

			vi.clearAllMocks()

			// Second call (warm start)
			const event2 = global.createMockAPIGatewayEvent() as APIGatewayProxyEvent
			const context2 = global.createMockLambdaContext() as Context
			await handler(event2, context2)

			expect(mockLambdaConfig.initialize).not.toHaveBeenCalled()
			expect(mockLambdaConfig.setColdStart).toHaveBeenCalledWith(false)
			expect(mockServerlessHandler).toHaveBeenCalledWith(event2, context2)
		})

		it('should set callbackWaitsForEmptyEventLoop to false', async () => {
			const event = global.createMockAPIGatewayEvent() as APIGatewayProxyEvent
			const context = global.createMockLambdaContext() as Context

			await handler(event, context)

			expect(context.callbackWaitsForEmptyEventLoop).toBe(false)
		})

		it('should handle Express app initialization errors', async () => {
			mockLambdaConfig.initialize.mockRejectedValue(
				new Error('Config initialization failed'),
			)

			const event = global.createMockAPIGatewayEvent() as APIGatewayProxyEvent
			const context = global.createMockLambdaContext() as Context

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

			const event = global.createMockAPIGatewayEvent() as APIGatewayProxyEvent
			const context = global.createMockLambdaContext() as Context

			const result = await handler(event, context)

			expect(result.statusCode).toBe(500)
			expect(result.headers?.['x-lambda-error']).toBe('true')
		})

		it('should add Lambda context to request', async () => {
			const event = global.createMockAPIGatewayEvent() as APIGatewayProxyEvent
			const context = global.createMockLambdaContext() as Context

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
				const event = global.createMockAPIGatewayEvent({
					httpMethod: method,
					path: '/test',
				}) as APIGatewayProxyEvent
				const context = global.createMockLambdaContext() as Context

				const result = await handler(event, context)
				expect(result.statusCode).toBe(200)
			}
		})

		it('should handle requests with different paths', async () => {
			const paths = ['/health', '/auth/login', '/users/me', '/chats']

			for (const path of paths) {
				const event = global.createMockAPIGatewayEvent({
					path,
				}) as APIGatewayProxyEvent
				const context = global.createMockLambdaContext() as Context

				const result = await handler(event, context)
				expect(result.statusCode).toBe(200)
			}
		})

		it('should handle requests with query parameters', async () => {
			const event = global.createMockAPIGatewayEvent({
				queryStringParameters: {
					page: '1',
					limit: '10',
				},
			}) as APIGatewayProxyEvent
			const context = global.createMockLambdaContext() as Context

			const result = await handler(event, context)
			expect(result.statusCode).toBe(200)
		})

		it('should handle requests with body', async () => {
			const event = global.createMockAPIGatewayEvent({
				httpMethod: 'POST',
				body: JSON.stringify({ message: 'test' }),
				headers: {
					'Content-Type': 'application/json',
				},
			}) as APIGatewayProxyEvent
			const context = global.createMockLambdaContext() as Context

			const result = await handler(event, context)
			expect(result.statusCode).toBe(200)
		})
	})

	describe('healthCheck', () => {
		it('should return health status', async () => {
			const event = {}
			const context = global.createMockLambdaContext() as Context

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
			const context = global.createMockLambdaContext() as Context

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

			// First invocation (cold start)
			const event1 = global.createMockAPIGatewayEvent({
				path: '/health',
			}) as APIGatewayProxyEvent
			const context1 = global.createMockLambdaContext({
				awsRequestId: 'request-1',
			}) as Context

			const result1 = await handler(event1, context1)
			expect(result1.statusCode).toBe(200)
			expect(mockLambdaConfig.initialize).toHaveBeenCalledWith(true)

			// Clear mocks but keep module state
			vi.clearAllMocks()

			// Second invocation (warm start)
			const event2 = global.createMockAPIGatewayEvent({
				path: '/users/me',
			}) as APIGatewayProxyEvent
			const context2 = global.createMockLambdaContext({
				awsRequestId: 'request-2',
			}) as Context

			const result2 = await handler(event2, context2)
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

			const event = global.createMockAPIGatewayEvent() as APIGatewayProxyEvent
			const context = global.createMockLambdaContext() as Context

			const result = await handler(event, context)

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
