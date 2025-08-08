import type { APIGatewayProxyEvent, Context } from 'aws-lambda'
import type { Express } from 'express'
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
} as unknown as Express

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

// Mock the validateConfigAfterParameterStore function
const mockValidateConfigAfterParameterStore = vi.fn()
vi.mock('../utils/load-config.ts', async (importOriginal) => {
	const actual =
		await importOriginal<typeof import('../utils/load-config.ts')>()
	return {
		...actual,
		validateConfigAfterParameterStore: mockValidateConfigAfterParameterStore,
	}
})

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

		// Set up Lambda environment variables
		process.env.AWS_LAMBDA_FUNCTION_NAME = 'test-lambda-function'
		process.env.NODE_ENV = 'production'
		process.env.APP_ENV = 'development'

		// Reset Enhanced Config Service mocks
		mockEnhancedConfigService.getConfig.mockClear()
		mockEnhancedConfigService.getAllMappedConfig.mockClear()
		mockEnhancedConfigService.clearCache.mockClear()
		mockEnhancedConfigService.getCacheStats.mockClear()
		mockEnhancedConfigService.isLambda.mockClear()
		mockEnhancedConfigService.getParameterMappings.mockClear()

		// Set default successful getAllMappedConfig response with all required values
		mockEnhancedConfigService.getAllMappedConfig.mockResolvedValue([
			{
				API_KEY: {
					value: 'test-api-key-12345678901234567890',
					source: 'parameter-store',
					cached: true,
				},
				AWS_COGNITO_REGION: {
					value: 'us-east-1',
					source: 'parameter-store',
					cached: true,
				},
				AWS_COGNITO_USER_POOL_ID: {
					value: 'us-east-1_testpool',
					source: 'parameter-store',
					cached: true,
				},
				AWS_COGNITO_USER_POOL_CLIENT_ID: {
					value: 'test-client-id',
					source: 'parameter-store',
					cached: true,
				},
				AWS_COGNITO_USER_POOL_SECRET_KEY: {
					value: 'test-secret-key',
					source: 'parameter-store',
					cached: true,
				},
				AWS_COGNITO_ACCESS_KEY: {
					value: 'test-access-key',
					source: 'parameter-store',
					cached: true,
				},
				AWS_COGNITO_SECRET_KEY: {
					value: 'test-secret-key',
					source: 'parameter-store',
					cached: true,
				},
				COOKIE_ENCRYPTION_KEY: {
					value: 'test-cookie-encryption-key-32chars',
					source: 'parameter-store',
					cached: true,
				},
				NON_RELATIONAL_DATABASE_URL: {
					value: 'redis://test-redis:6379',
					source: 'parameter-store',
					cached: true,
				},
				RELATIONAL_DATABASE_URL: {
					value: 'postgresql://test:test@localhost:5432/test',
					source: 'parameter-store',
					cached: true,
				},
				OPENAI_API_KEY: {
					value: 'sk-test-key',
					source: 'parameter-store',
					cached: true,
				},
			},
			null,
		])

		// Mock validateConfigAfterParameterStore to return success by default
		mockValidateConfigAfterParameterStore.mockReturnValue([
			{
				API_KEY: 'test-api-key-12345678901234567890',
				NODE_ENV: 'production',
				APP_ENV: 'development',
				SERVER_PORT: 3040,
				AWS_COGNITO_REGION: 'us-east-1',
				AWS_COGNITO_USER_POOL_ID: 'us-east-1_testpool',
				AWS_COGNITO_USER_POOL_CLIENT_ID: 'test-client-id',
				AWS_COGNITO_USER_POOL_SECRET_KEY: 'test-secret-key',
				AWS_COGNITO_ACCESS_KEY: 'test-access-key',
				AWS_COGNITO_SECRET_KEY: 'test-secret-key',
				AWS_COGNITO_REFRESH_TOKEN_EXPIRY: 30,
				COOKIE_DOMAIN: 'localhost',
				COOKIE_ENCRYPTION_KEY: 'test-cookie-encryption-key-32chars',
				NON_RELATIONAL_DATABASE_URL: 'redis://test-redis:6379',
				RELATIONAL_DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
				OPENAI_API_KEY: 'sk-test-key',
				RATE_LIMIT_WINDOW_MS: 900000,
				RATE_LIMIT_MAX_REQUESTS: 100,
				AUTH_RATE_LIMIT_WINDOW_MS: 3600000,
				AUTH_RATE_LIMIT_MAX_REQUESTS: 10,
				API_RATE_LIMIT_WINDOW_MS: 60000,
				API_RATE_LIMIT_MAX_REQUESTS: 60,
				REDIS_URL: undefined,
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
			// Verify Parameter Store config loading was called
			expect(mockEnhancedConfigService.getAllMappedConfig).toHaveBeenCalled()
			expect(mockPowertoolsLogger.info).toHaveBeenCalledWith(
				'Parameters loaded and environment populated',
				expect.objectContaining({
					operation: 'loadParametersSuccess',
					requestId: mockContext.awsRequestId,
					parametersLoaded: 11, // Updated to match the new mock with all required parameters
				}),
			)

			// Verify configuration validation after Parameter Store loading
			expect(mockValidateConfigAfterParameterStore).toHaveBeenCalled()
			expect(mockPowertoolsLogger.info).toHaveBeenCalledWith(
				'Configuration validated successfully after Parameter Store loading',
				expect.objectContaining({
					operation: 'postParameterStoreValidationSuccess',
					requestId: mockContext.awsRequestId,
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

			const body = JSON.parse(result.body) as {
				error: string
				message: string
				requestId: string
			}
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

		it('should handle configuration validation failure after Parameter Store loading', async () => {
			// Arrange
			const validationError = {
				message:
					'Configuration validation failed after Parameter Store loading: Missing required fields',
				code: 'VALIDATION_ERROR',
				context: { errors: ['Missing API_KEY'] },
				operation: 'configLoader',
			}

			// Mock validation to fail
			mockValidateConfigAfterParameterStore.mockReturnValue([
				null,
				validationError,
			])

			// Act
			const result = await handler(mockEvent, mockContext)

			// Assert
			expect(result.statusCode).toBe(500)
			expect(mockValidateConfigAfterParameterStore).toHaveBeenCalledWith({
				allowDeploymentMode: true,
			})
			expect(mockPowertoolsLogger.error).toHaveBeenCalledWith(
				'Configuration validation failed after Parameter Store loading',
				expect.objectContaining({
					operation: 'postParameterStoreValidationFailed',
					requestId: mockContext.awsRequestId,
					error: validationError.message,
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
					// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
					request: expect.any(Function),
					// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
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
