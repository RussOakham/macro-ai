/**
 * Middleware Test Helpers
 * Comprehensive test utilities for middleware testing with observability integration
 */

import type {
	APIGatewayProxyEvent,
	APIGatewayProxyResult,
	Context,
} from 'aws-lambda'
import { expect, vi } from 'vitest'

import type {
	LambdaHandler,
	LambdaMiddleware,
	LambdaMiddlewareConfig,
	MiddlewareContext,
} from '../lambda-middleware-types.js'
import type { ObservabilityConfig } from '../observability-config.js'
import { createTestTools } from '../observability-factory.js'

/**
 * Mock API Gateway event factory with sensible defaults
 */
export const createMockAPIGatewayEvent = (
	overrides: Partial<APIGatewayProxyEvent> = {},
): APIGatewayProxyEvent =>
	({
		httpMethod: 'GET',
		path: '/test',
		pathParameters: null,
		queryStringParameters: null,
		multiValueQueryStringParameters: null,
		headers: {
			'User-Agent': 'test-agent',
			'Content-Type': 'application/json',
			'X-Forwarded-For': '127.0.0.1',
		},
		multiValueHeaders: {},
		body: null,
		isBase64Encoded: false,
		stageVariables: null,
		requestContext: {
			requestId: 'test-request-id',
			stage: 'test',
			httpMethod: 'GET',
			resourcePath: '/test',
			resourceId: 'test-resource',
			path: '/test/test',
			accountId: '123456789012',
			apiId: 'test-api-id',
			protocol: 'HTTP/1.1',
			requestTime: '01/Jan/2024:00:00:00 +0000',
			requestTimeEpoch: Date.now(),
			identity: {
				sourceIp: '127.0.0.1',
				userAgent: 'test-agent',
				accessKey: null,
				accountId: null,
				apiKey: null,
				apiKeyId: null,
				caller: null,
				cognitoAuthenticationProvider: null,
				cognitoAuthenticationType: null,
				cognitoIdentityId: null,
				cognitoIdentityPoolId: null,
				principalOrgId: null,
				user: null,
				userArn: null,
			},
			authorizer: null,
		},
		resource: '/test',
		...overrides,
	}) as APIGatewayProxyEvent

/**
 * Mock Lambda context factory with sensible defaults
 */
export const createMockLambdaContext = (
	overrides: Partial<Context> = {},
): Context =>
	({
		functionName: 'test-function',
		functionVersion: '1.0.0',
		invokedFunctionArn:
			'arn:aws:lambda:us-east-1:123456789012:function:test-function',
		memoryLimitInMB: '1024',
		awsRequestId: 'test-request-id',
		logGroupName: '/aws/lambda/test-function',
		logStreamName: '2024/01/01/[$LATEST]test',
		getRemainingTimeInMillis: () => 30000,
		callbackWaitsForEmptyEventLoop: false,
		identity: undefined,
		clientContext: undefined,
		...overrides,
	}) as Context

/**
 * Mock API Gateway response factory
 */
export const createMockAPIGatewayResponse = (
	overrides: Partial<APIGatewayProxyResult> = {},
): APIGatewayProxyResult => ({
	statusCode: 200,
	headers: {
		'Content-Type': 'application/json',
	},
	body: JSON.stringify({ message: 'success' }),
	isBase64Encoded: false,
	...overrides,
})

/**
 * Mock middleware context factory
 */
export const createMockMiddlewareContext = (
	overrides: Partial<MiddlewareContext> = {},
): MiddlewareContext => ({
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
	...overrides,
})

/**
 * Mock handler factory for testing
 */
export const createMockHandler = (
	response: APIGatewayProxyResult = createMockAPIGatewayResponse(),
): LambdaHandler => {
	return vi.fn().mockResolvedValue(response)
}

/**
 * Mock error handler factory for testing
 */
export const createMockErrorHandler = (
	error: Error = new Error('Test error'),
): LambdaHandler => {
	return vi.fn().mockRejectedValue(error)
}

/**
 * Mock middleware configuration factory
 */
export const createMockMiddlewareConfig = (
	overrides: Partial<LambdaMiddlewareConfig> = {},
): LambdaMiddlewareConfig => ({
	observability: {
		enabled: true,
		options: {
			enableRequestLogging: true,
			enablePerformanceMetrics: true,
			enableTracingAnnotations: true,
		},
	},
	errorHandling: {
		enabled: true,
		options: {
			enableFullObservability: true,
			enableErrorMetrics: true,
			enableErrorTracing: true,
		},
	},
	performance: {
		enabled: true,
		options: {
			enableExecutionTime: true,
			enableMemoryUsage: true,
			enableColdStartTracking: true,
		},
	},
	requestLogging: {
		enabled: true,
		options: {
			enableRequestBody: false,
			enableResponseBody: false,
			enableHeaders: true,
			maxBodySize: 1024,
		},
	},
	...overrides,
})

/**
 * Mock observability configuration for testing
 */
export const createMockObservabilityConfig = (
	overrides: Partial<ObservabilityConfig> = {},
): ObservabilityConfig => {
	const testTools = createTestTools()
	return {
		...testTools.config,
		...overrides,
	}
}

/**
 * Middleware test suite factory
 * Creates a standardized test environment for middleware testing
 */
export interface MiddlewareTestSuite {
	mockEvent: APIGatewayProxyEvent
	mockContext: Context
	mockResponse: APIGatewayProxyResult
	mockHandler: LambdaHandler
	mockErrorHandler: LambdaHandler
	mockMiddlewareContext: MiddlewareContext
	mockConfig: LambdaMiddlewareConfig
	mockObservabilityConfig: ObservabilityConfig
}

export const createMiddlewareTestSuite = (
	overrides: {
		event?: Partial<APIGatewayProxyEvent>
		context?: Partial<Context>
		response?: Partial<APIGatewayProxyResult>
		config?: Partial<LambdaMiddlewareConfig>
		observabilityConfig?: Partial<ObservabilityConfig>
	} = {},
): MiddlewareTestSuite => {
	const mockEvent = createMockAPIGatewayEvent(overrides.event)
	const mockContext = createMockLambdaContext(overrides.context)
	const mockResponse = createMockAPIGatewayResponse(overrides.response)
	const mockHandler = createMockHandler(mockResponse)
	const mockErrorHandler = createMockErrorHandler()
	const mockMiddlewareContext = createMockMiddlewareContext()
	const mockConfig = createMockMiddlewareConfig(overrides.config)
	const mockObservabilityConfig = createMockObservabilityConfig(
		overrides.observabilityConfig,
	)

	return {
		mockEvent,
		mockContext,
		mockResponse,
		mockHandler,
		mockErrorHandler,
		mockMiddlewareContext,
		mockConfig,
		mockObservabilityConfig,
	}
}

/**
 * Middleware chain testing utilities
 */
export interface MiddlewareChainTestUtils {
	/** Apply multiple middleware in sequence */
	applyMiddlewareChain: (
		middlewares: LambdaMiddleware[],
		handler: LambdaHandler,
	) => LambdaHandler
	/** Test middleware execution order */
	testExecutionOrder: (
		middlewares: LambdaMiddleware[],
		handler: LambdaHandler,
	) => Promise<string[]>
	/** Test middleware error propagation */
	testErrorPropagation: (
		middlewares: LambdaMiddleware[],
		errorHandler: LambdaHandler,
	) => Promise<void>
}

export const createMiddlewareChainTestUtils = (): MiddlewareChainTestUtils => {
	const applyMiddlewareChain = (
		middlewares: LambdaMiddleware[],
		handler: LambdaHandler,
	): LambdaHandler => {
		return middlewares.reduceRight(
			(acc, middleware) => middleware(acc),
			handler,
		)
	}

	const testExecutionOrder = async (
		middlewares: LambdaMiddleware[],
		handler: LambdaHandler,
	): Promise<string[]> => {
		const executionOrder: string[] = []

		// Create tracking middleware
		const trackingMiddlewares = middlewares.map((middleware, index) => {
			return (h: LambdaHandler): LambdaHandler => {
				return async (event, context) => {
					executionOrder.push(`middleware-${index.toString()}-start`)
					const result = await middleware(h)(event, context)
					executionOrder.push(`middleware-${index.toString()}-end`)
					return result
				}
			}
		})

		const wrappedHandler = applyMiddlewareChain(trackingMiddlewares, handler)
		const { mockEvent, mockContext } = createMiddlewareTestSuite()

		await wrappedHandler(mockEvent, mockContext)
		return executionOrder
	}

	const testErrorPropagation = async (
		middlewares: LambdaMiddleware[],
		errorHandler: LambdaHandler,
	): Promise<void> => {
		const wrappedHandler = applyMiddlewareChain(middlewares, errorHandler)
		const { mockEvent, mockContext } = createMiddlewareTestSuite()

		await expect(wrappedHandler(mockEvent, mockContext)).rejects.toThrow()
	}

	return {
		applyMiddlewareChain,
		testExecutionOrder,
		testErrorPropagation,
	}
}

/**
 * Common test scenarios for middleware
 */
export const middlewareTestScenarios = {
	/** Test basic middleware functionality */
	basic: {
		name: 'basic functionality',
		event: createMockAPIGatewayEvent(),
		context: createMockLambdaContext(),
		expectedStatusCode: 200,
	},

	/** Test POST request with body */
	postWithBody: {
		name: 'POST request with body',
		event: createMockAPIGatewayEvent({
			httpMethod: 'POST',
			body: JSON.stringify({ test: 'data' }),
		}),
		context: createMockLambdaContext(),
		expectedStatusCode: 200,
	},

	/** Test cold start scenario */
	coldStart: {
		name: 'cold start scenario',
		event: createMockAPIGatewayEvent(),
		context: createMockLambdaContext(),
		middlewareContext: createMockMiddlewareContext({ isColdStart: true }),
		expectedStatusCode: 200,
	},

	/** Test error scenario */
	error: {
		name: 'error handling',
		event: createMockAPIGatewayEvent(),
		context: createMockLambdaContext(),
		shouldThrow: true,
	},

	/** Test large request body */
	largeBody: {
		name: 'large request body',
		event: createMockAPIGatewayEvent({
			httpMethod: 'POST',
			body: JSON.stringify({ data: 'x'.repeat(10000) }),
		}),
		context: createMockLambdaContext(),
		expectedStatusCode: 200,
	},
}
