/**
 * Test setup for Lambda API tests
 */

import { vi } from 'vitest'

// Mock serverless-http
vi.mock('serverless-http', () => ({
	default: vi.fn(() =>
		vi.fn(() =>
			Promise.resolve({
				statusCode: 200,
				headers: {},
				body: JSON.stringify({ message: 'mocked response' }),
			}),
		),
	),
}))

// Set up test environment variables
process.env.NODE_ENV = 'test'
process.env.AWS_REGION = 'us-east-1'
process.env.AWS_LAMBDA_FUNCTION_NAME = 'test-lambda'

// Global test utilities
declare global {
	// eslint-disable-next-line no-var, @typescript-eslint/no-explicit-any
	var createMockAPIGatewayEvent: (overrides?: any) => any
	// eslint-disable-next-line no-var, @typescript-eslint/no-explicit-any
	var createMockLambdaContext: (overrides?: any) => any
}

// eslint-disable-next-line @typescript-eslint/no-unsafe-return
global.createMockAPIGatewayEvent = (overrides = {}) => ({
	httpMethod: 'GET',
	path: '/health',
	pathParameters: null,
	queryStringParameters: null,
	headers: {
		'Content-Type': 'application/json',
	},
	body: null,
	isBase64Encoded: false,
	requestContext: {
		requestId: 'test-request-id',
		stage: 'test',
		httpMethod: 'GET',
		resourcePath: '/health',
		identity: {
			sourceIp: '127.0.0.1',
			userAgent: 'test-agent',
		},
	},
	...overrides,
})

// eslint-disable-next-line @typescript-eslint/no-unsafe-return
global.createMockLambdaContext = (overrides = {}) => ({
	functionName: 'test-lambda',
	functionVersion: '1',
	invokedFunctionArn:
		'arn:aws:lambda:us-east-1:123456789012:function:test-lambda',
	memoryLimitInMB: '1024',
	awsRequestId: 'test-request-id',
	logGroupName: '/aws/lambda/test-lambda',
	logStreamName: '2023/01/01/[$LATEST]test',
	getRemainingTimeInMillis: () => 30000,
	callbackWaitsForEmptyEventLoop: false,
	identity: undefined,
	clientContext: undefined,
	...overrides,
})
