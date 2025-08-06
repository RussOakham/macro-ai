/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-non-null-assertion */
import type { APIGatewayProxyEvent, Context } from 'aws-lambda'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
	createErrorResponse,
	createLambdaResponse,
	extractRequestInfo,
	getLambdaContext,
	handleCorsPreflightRequest,
	isLambdaEnvironment,
	parseJsonBody,
	validateEnvironment,
} from '../lambda-utils.ts'

describe('Lambda Utils', () => {
	const mockContext: Context = {
		callbackWaitsForEmptyEventLoop: false,
		functionName: 'test-function',
		functionVersion: '1',
		invokedFunctionArn:
			'arn:aws:lambda:us-east-1:123456789012:function:test-function',
		memoryLimitInMB: '128',
		awsRequestId: 'test-request-id',
		logGroupName: '/aws/lambda/test-function',
		logStreamName: '2024/01/01/[$LATEST]test-stream',
		getRemainingTimeInMillis: () => 30000,
		done: vi.fn(),
		fail: vi.fn(),
		succeed: vi.fn(),
	}

	const mockEvent: APIGatewayProxyEvent = {
		httpMethod: 'GET',
		path: '/api/test',
		headers: { 'User-Agent': 'test-agent' },
		multiValueHeaders: {},
		queryStringParameters: { param1: 'value1' },
		multiValueQueryStringParameters: null,
		pathParameters: { id: '123' },
		stageVariables: null,
		requestContext: {
			accountId: '123456789012',
			apiId: 'test-api',
			protocol: 'HTTP/1.1',
			httpMethod: 'GET',
			path: '/api/test',
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
			resourcePath: '/api/test',
		},
		resource: '/api/test',
		body: null,
		isBase64Encoded: false,
	}

	beforeEach(() => {
		vi.clearAllMocks()
	})

	describe('createLambdaResponse', () => {
		it('should create a proper Lambda response with default headers', () => {
			const response = createLambdaResponse(200, { message: 'success' })

			expect(response).toEqual({
				statusCode: 200,
				headers: {
					'Content-Type': 'application/json',
					'Access-Control-Allow-Origin': '*',
					'Access-Control-Allow-Credentials': 'true',
					'Access-Control-Allow-Headers':
						'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
					'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS,PATCH',
				},
				body: JSON.stringify({ message: 'success' }),
			})
		})

		it('should add Lambda context headers when context is provided', () => {
			const response = createLambdaResponse(
				200,
				{ message: 'success' },
				{},
				mockContext,
			)

			expect(response.headers).toEqual(
				expect.objectContaining({
					'x-lambda-request-id': 'test-request-id',
					'x-lambda-function-name': 'test-function',
				}),
			)
		})

		it('should handle string body without JSON.stringify', () => {
			const response = createLambdaResponse(200, 'plain text')

			expect(response.body).toBe('plain text')
		})
	})

	describe('createErrorResponse', () => {
		it('should create a proper error response', () => {
			const response = createErrorResponse(
				500,
				'Test error',
				undefined,
				mockContext,
			)

			const body = JSON.parse(response.body)
			expect(response.statusCode).toBe(500)
			expect(body).toEqual({
				error: 'Internal Server Error',
				message: 'Test error',
				requestId: 'test-request-id',
				timestamp: expect.any(String),
			})
		})

		it('should include error details in development', () => {
			const error = new Error('Detailed error')
			const response = createErrorResponse(
				500,
				'Test error',
				error,
				mockContext,
				'development',
			)

			const body = JSON.parse(response.body)
			expect(body.details).toBe('Detailed error')
			expect(body.stack).toBeDefined()
		})

		it('should not include error details in production', () => {
			const error = new Error('Detailed error')
			const response = createErrorResponse(
				500,
				'Test error',
				error,
				mockContext,
				'production',
			)

			const body = JSON.parse(response.body)
			expect(body.details).toBeUndefined()
			expect(body.stack).toBeUndefined()
		})
	})

	describe('extractRequestInfo', () => {
		it('should extract request information correctly', () => {
			const info = extractRequestInfo(mockEvent)

			expect(info).toEqual({
				method: 'GET',
				path: '/api/test',
				pathParameters: { id: '123' },
				queryStringParameters: { param1: 'value1' },
				headers: { 'User-Agent': 'test-agent' },
				body: null,
				isBase64Encoded: false,
				requestContext: {
					requestId: 'test-request-id',
					stage: 'test',
					httpMethod: 'GET',
					resourcePath: '/api/test',
					identity: {
						sourceIp: '127.0.0.1',
						userAgent: 'test-agent',
					},
				},
			})
		})
	})

	describe('parseJsonBody', () => {
		it('should parse valid JSON', () => {
			const result = parseJsonBody('{"key": "value"}')
			expect(result).toEqual({ key: 'value' })
		})

		it('should return null for null body', () => {
			const result = parseJsonBody(null)
			expect(result).toBeNull()
		})

		it('should throw error for invalid JSON', () => {
			expect(() => parseJsonBody('invalid json')).toThrow(
				'Invalid JSON in request body',
			)
		})
	})

	describe('validateEnvironment', () => {
		it('should not throw for existing environment variables', () => {
			process.env.TEST_VAR = 'value'
			expect(() => {
				validateEnvironment(['TEST_VAR'])
			}).not.toThrow()
			delete process.env.TEST_VAR
		})

		it('should throw for missing environment variables', () => {
			expect(() => {
				validateEnvironment(['MISSING_VAR'])
			}).toThrow('Missing required environment variables: MISSING_VAR')
		})
	})

	describe('getLambdaContext', () => {
		it('should extract Lambda context information', () => {
			const info = getLambdaContext(mockContext)

			expect(info).toEqual({
				functionName: 'test-function',
				functionVersion: '1',
				invokedFunctionArn:
					'arn:aws:lambda:us-east-1:123456789012:function:test-function',
				memoryLimitInMB: '128',
				awsRequestId: 'test-request-id',
				logGroupName: '/aws/lambda/test-function',
				logStreamName: '2024/01/01/[$LATEST]test-stream',
				remainingTimeInMillis: 30000,
			})
		})
	})

	describe('handleCorsPreflightRequest', () => {
		it('should handle OPTIONS request', () => {
			const optionsEvent = { ...mockEvent, httpMethod: 'OPTIONS' }
			const response = handleCorsPreflightRequest(optionsEvent, mockContext)

			expect(response).not.toBeNull()
			expect(response!.statusCode).toBe(200)
			expect(response!.headers).toEqual(
				expect.objectContaining({
					'Access-Control-Allow-Origin': '*',
					'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS,PATCH',
					'Access-Control-Max-Age': '86400',
				}),
			)
		})

		it('should return null for non-OPTIONS request', () => {
			const response = handleCorsPreflightRequest(mockEvent, mockContext)
			expect(response).toBeNull()
		})
	})

	describe('isLambdaEnvironment', () => {
		it('should return true when Lambda environment variables are present', () => {
			process.env.AWS_LAMBDA_FUNCTION_NAME = 'test-function'
			expect(isLambdaEnvironment()).toBe(true)
			delete process.env.AWS_LAMBDA_FUNCTION_NAME
		})

		it('should return false when Lambda environment variables are not present', () => {
			expect(isLambdaEnvironment()).toBe(false)
		})
	})
})
