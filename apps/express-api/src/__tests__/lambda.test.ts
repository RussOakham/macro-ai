/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-return */
import type { APIGatewayProxyEvent, Context } from 'aws-lambda'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { mockConfig } from '../utils/test-helpers/config.mock.ts'
import { mockLogger } from '../utils/test-helpers/logger.mock.ts'

// Mock the config and logger
vi.mock('../../config/default.ts', () => mockConfig.createModule())
vi.mock('../utils/logger.ts', () => mockLogger.createModule())

// Mock serverless-http
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
} as any

vi.mock('../utils/server.ts', () => ({
	createServer: vi.fn(() => mockExpressApp),
}))

// Mock AWS Lambda Powertools Logger
const mockPowertoolsLogger = {
	info: vi.fn(),
	error: vi.fn(),
	debug: vi.fn(),
	warn: vi.fn(),
	addContext: vi.fn(),
}

vi.mock('@aws-lambda-powertools/logger', () => ({
	Logger: vi.fn(() => mockPowertoolsLogger),
}))

// Mock Enhanced Config Service
const mockEnhancedConfigService = {
	preloadParameters: vi.fn(),
	getConfig: vi.fn(),
	getAllMappedConfig: vi.fn(),
	clearCache: vi.fn(),
	getCacheStats: vi.fn(),
	isLambda: vi.fn(),
	getParameterMappings: vi.fn(),
}

vi.mock('../services/enhanced-config.service.ts', () => ({
	enhancedConfigService: mockEnhancedConfigService,
}))

describe('Lambda Handler', () => {
	let handler: typeof import('../lambda.ts').handler
	let initializeExpressApp: typeof import('../lambda.ts').initializeExpressApp
	let initializeServerlessHandler: typeof import('../lambda.ts').initializeServerlessHandler

	const mockEvent: APIGatewayProxyEvent = {
		httpMethod: 'GET',
		path: '/api/health',
		headers: {},
		multiValueHeaders: {},
		queryStringParameters: null,
		multiValueQueryStringParameters: null,
		pathParameters: null,
		stageVariables: null,
		requestContext: {
			accountId: '123456789012',
			apiId: 'test-api',
			protocol: 'HTTP/1.1',
			httpMethod: 'GET',
			path: '/api/health',
			stage: 'test',
			requestId: 'test-request-id',
			requestTime: '01/Jan/2024:00:00:00 +0000',
			requestTimeEpoch: 1704067200000,
			authorizer: {},
			identity: {
				cognitoIdentityPoolId: null,
				accountId: null,
				cognitoIdentityId: null,
				caller: null,
				sourceIp: '127.0.0.1',
				principalOrgId: null,
				accessKey: null,
				cognitoAuthenticationType: null,
				cognitoAuthenticationProvider: null,
				userArn: null,
				userAgent: 'test-agent',
				user: null,
				apiKey: null,
				apiKeyId: null,
				clientCert: null,
			},
			resourceId: 'test-resource',
			resourcePath: '/api/health',
		},
		resource: '/api/health',
		body: null,
		isBase64Encoded: false,
	}

	const mockContext: Context = {
		callbackWaitsForEmptyEventLoop: false,
		functionName: 'test-function',
		functionVersion: '1',
		invokedFunctionArn:
			'arn:aws:lambda:us-east-1:123456789012:function:test-function',
		memoryLimitInMB: '128',
		awsRequestId: 'test-aws-request-id',
		logGroupName: '/aws/lambda/test-function',
		logStreamName: '2024/01/01/[$LATEST]test-stream',
		getRemainingTimeInMillis: () => 30000,
		done: vi.fn(),
		fail: vi.fn(),
		succeed: vi.fn(),
	}

	beforeEach(async () => {
		vi.clearAllMocks()
		mockConfig.setup()
		mockLogger.setup()

		// Reset Enhanced Config Service mocks
		mockEnhancedConfigService.preloadParameters.mockClear()
		mockEnhancedConfigService.getConfig.mockClear()
		mockEnhancedConfigService.getAllMappedConfig.mockClear()
		mockEnhancedConfigService.clearCache.mockClear()
		mockEnhancedConfigService.getCacheStats.mockClear()
		mockEnhancedConfigService.isLambda.mockClear()
		mockEnhancedConfigService.getParameterMappings.mockClear()

		// Set default successful preload response
		mockEnhancedConfigService.preloadParameters.mockResolvedValue([
			{
				'openai-api-key': {
					value: 'sk-test-key',
					source: 'parameter-store',
					cached: true,
				},
			},
			null,
		])

		// Reset module state by re-importing
		vi.resetModules()
		const lambdaModule = await import('../lambda.ts')
		handler = lambdaModule.handler
		initializeExpressApp = lambdaModule.initializeExpressApp
		initializeServerlessHandler = lambdaModule.initializeServerlessHandler
	})

	describe('handler', () => {
		it('should handle cold start and process request successfully', async () => {
			// Arrange
			const mockResponse = {
				statusCode: 200,
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ message: 'OK' }),
			}
			mockServerlessHandler.mockResolvedValue(mockResponse)

			// Act
			const result = await handler(mockEvent, mockContext)

			// Assert
			expect(result).toEqual(mockResponse)
			expect(mockPowertoolsLogger.addContext).toHaveBeenCalledWith(mockContext)
			expect(mockPowertoolsLogger.info).toHaveBeenCalledWith(
				'Lambda invocation started',
				expect.objectContaining({
					operation: 'lambdaInvocation',
					httpMethod: 'GET',
					path: '/api/health',
					coldStart: true,
				}),
			)
			// Verify Parameter Store preload was called
			expect(mockEnhancedConfigService.preloadParameters).toHaveBeenCalled()
			expect(mockPowertoolsLogger.info).toHaveBeenCalledWith(
				'Parameters preloaded successfully',
				expect.objectContaining({
					operation: 'preloadParametersSuccess',
					requestId: mockContext.awsRequestId,
					parametersLoaded: 1,
				}),
			)
		}, 10000)

		it('should handle warm start correctly', async () => {
			// Arrange - First call (cold start)
			const mockResponse = {
				statusCode: 200,
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ message: 'OK' }),
			}
			mockServerlessHandler.mockResolvedValue(mockResponse)

			// Act - First call
			await handler(mockEvent, mockContext)

			// Clear mocks for second call
			vi.clearAllMocks()
			mockPowertoolsLogger.addContext.mockClear()
			mockPowertoolsLogger.info.mockClear()

			// Act - Second call (warm start)
			const result = await handler(mockEvent, mockContext)

			// Assert
			expect(result).toEqual(mockResponse)
			expect(mockPowertoolsLogger.info).toHaveBeenCalledWith(
				'Warm start - reusing existing Express app',
				expect.objectContaining({
					operation: 'warmStart',
				}),
			)
		})

		it('should handle errors and return proper error response', async () => {
			// Arrange
			const error = new Error('Test error')
			mockServerlessHandler.mockRejectedValue(error)

			// Act
			const result = await handler(mockEvent, mockContext)

			// Assert
			expect(result.statusCode).toBe(500)
			expect(result.headers).toEqual({
				'Content-Type': 'application/json',
				'Access-Control-Allow-Origin': '*',
				'Access-Control-Allow-Headers':
					'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
				'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
			})

			const body = JSON.parse(result.body)
			expect(body).toEqual({
				error: 'Internal Server Error',
				message: 'An unexpected error occurred',
				requestId: mockContext.awsRequestId,
			})

			expect(mockPowertoolsLogger.error).toHaveBeenCalledWith(
				'Lambda invocation failed',
				expect.objectContaining({
					operation: 'lambdaInvocationError',
					error: 'Test error',
				}),
			)
		})
	})

	describe('initializeExpressApp', () => {
		it('should initialize Express app successfully', () => {
			// Act
			const result = initializeExpressApp()

			// Assert
			expect(result).toBe(mockExpressApp)
			expect(mockPowertoolsLogger.info).toHaveBeenCalledWith(
				'Initializing Express app for Lambda',
				expect.objectContaining({
					operation: 'initializeExpressApp',
				}),
			)
		})

		it('should handle initialization errors', async () => {
			// Arrange
			const { createServer } = await import('../utils/server.ts')
			vi.mocked(createServer).mockImplementation(() => {
				throw new Error('Server creation failed')
			})

			// Act & Assert
			expect(() => initializeExpressApp()).toThrow(
				'Express app initialization failed: Server creation failed',
			)

			expect(mockPowertoolsLogger.error).toHaveBeenCalledWith(
				'Failed to initialize Express app',
				expect.objectContaining({
					operation: 'initializeExpressApp',
					error: 'Server creation failed',
				}),
			)
		})
	})

	describe('initializeServerlessHandler', () => {
		it('should initialize serverless handler with correct options', () => {
			// Act
			const result = initializeServerlessHandler(mockExpressApp)

			// Assert
			expect(result).toBe(mockServerlessHandler)
			expect(mockServerlessHttpFactory).toHaveBeenCalledWith(
				mockExpressApp,
				expect.objectContaining({
					binary: false,
					request: expect.any(Function),
					response: expect.any(Function),
				}),
			)
			expect(mockPowertoolsLogger.info).toHaveBeenCalledWith(
				'Initializing serverless-http handler',
				expect.objectContaining({
					operation: 'initializeServerlessHandler',
				}),
			)
		})
	})
})
