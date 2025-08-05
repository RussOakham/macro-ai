/**
 * Tests for Lambda Utility Functions
 */

// Import actual Powertools types for type-safe mocking
import type { Logger } from '@aws-lambda-powertools/logger'
import type { Metrics } from '@aws-lambda-powertools/metrics'
import type { APIGatewayProxyEvent, Context } from 'aws-lambda'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Type-safe mock interfaces using TypeScript utility types
type MockLogger = {
	[K in keyof Pick<
		Logger,
		'debug' | 'info' | 'warn' | 'error' | 'critical' | 'createChild'
	>]: ReturnType<typeof vi.fn>
}

type MockMetrics = {
	[K in keyof Pick<
		Metrics,
		'addMetric' | 'singleMetric' | 'addDimension'
	>]: ReturnType<typeof vi.fn>
}

// Type-safe mock interfaces for utility functions
interface MockLoggerUtils {
	logger: MockLogger
	createChildLogger: ReturnType<typeof vi.fn>
	logWithCorrelationId: ReturnType<typeof vi.fn>
	LogLevel: {
		DEBUG: string
		INFO: string
		WARN: string
		ERROR: string
		CRITICAL: string
	}
	createLoggerConfig: ReturnType<typeof vi.fn>
	createPowertoolsLogger: ReturnType<typeof vi.fn>
}

interface MockMetricsUtils {
	metrics: MockMetrics
	addMetric: ReturnType<typeof vi.fn>
	measureAndRecordExecutionTime: ReturnType<typeof vi.fn>
	recordColdStart: ReturnType<typeof vi.fn>
	recordMemoryUsage: ReturnType<typeof vi.fn>
	recordParameterStoreMetrics: ReturnType<typeof vi.fn>
	MetricName: {
		ColdStart: string
		ExecutionTime: string
		MemoryUsage: string
	}
	MetricUnit: {
		Count: string
		Milliseconds: string
		Bytes: string
	}
	createMetricsConfig: ReturnType<typeof vi.fn>
	createPowertoolsMetrics: ReturnType<typeof vi.fn>
}

// Mock Powertools Logger
vi.mock('../powertools-logger.js', () => ({
	logger: {
		debug: vi.fn(),
		info: vi.fn(),
		warn: vi.fn(),
		error: vi.fn(),
		critical: vi.fn(),
		createChild: vi.fn().mockReturnValue({
			debug: vi.fn(),
			info: vi.fn(),
			warn: vi.fn(),
			error: vi.fn(),
			critical: vi.fn(),
			createChild: vi.fn(),
		}),
	},
	createChildLogger: vi.fn(),
	logWithCorrelationId: vi.fn(),
	LogLevel: {
		DEBUG: 'DEBUG',
		INFO: 'INFO',
		WARN: 'WARN',
		ERROR: 'ERROR',
		CRITICAL: 'CRITICAL',
	},
	createLoggerConfig: vi.fn(),
	createPowertoolsLogger: vi.fn(),
}))

// Mock Powertools Metrics
vi.mock('../powertools-metrics.js', () => ({
	metrics: {
		addMetric: vi.fn(),
		singleMetric: vi.fn(),
		addDimension: vi.fn(),
	},
	addMetric: vi.fn(),
	measureAndRecordExecutionTime: vi.fn(),
	recordColdStart: vi.fn(),
	recordMemoryUsage: vi.fn(),
	recordParameterStoreMetrics: vi.fn(),
	MetricName: {
		ColdStart: 'ColdStart',
		ExecutionTime: 'ExecutionTime',
		MemoryUsage: 'MemoryUsage',
	},
	MetricUnit: {
		Count: 'Count',
		Milliseconds: 'Milliseconds',
		Bytes: 'Bytes',
	},
	createMetricsConfig: vi.fn(),
	createPowertoolsMetrics: vi.fn(),
}))

import {
	createErrorResponse,
	createLambdaResponse,
	extractRequestInfo,
	getLambdaContext,
	getMemoryUsage,
	handleCorsPreflightRequest,
	isLambdaEnvironment,
	logRequest,
	logResponse,
	measureExecutionTime,
	parseJsonBody,
	validateEnvironment,
} from '../lambda-utils.js'

describe('Lambda Utils', () => {
	let mockEvent: APIGatewayProxyEvent
	let mockContext: Context

	// Powertools mock references with complete type safety
	let loggerMocks: { logger: MockLogger; utils: MockLoggerUtils }
	let metricsMocks: { utils: MockMetricsUtils }

	beforeEach(async () => {
		mockEvent = global.createMockAPIGatewayEvent() as APIGatewayProxyEvent
		mockContext = global.createMockLambdaContext() as Context

		// Clear environment variables
		delete process.env.AWS_LAMBDA_FUNCTION_NAME
		delete process.env.AWS_LAMBDA_RUNTIME_API
		delete process.env.LAMBDA_RUNTIME_DIR

		// Get Powertools mocks from the mocked modules
		const loggerModule = await import('../powertools-logger.js')
		const metricsModule = await import('../powertools-metrics.js')

		// Setup mocks with complete type safety
		loggerMocks = {
			logger: loggerModule.logger as unknown as MockLogger,
			utils: loggerModule as unknown as MockLoggerUtils,
		}
		metricsMocks = {
			utils: metricsModule as unknown as MockMetricsUtils,
		}
	})

	afterEach(() => {
		vi.clearAllMocks()
	})

	describe('createLambdaResponse', () => {
		it('should create basic response', () => {
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
				body: '{"message":"success"}',
			})
		})

		it('should include custom headers', () => {
			const customHeaders = { 'X-Custom-Header': 'custom-value' }
			const response = createLambdaResponse(
				200,
				{ message: 'success' },
				customHeaders,
			)

			expect(response.headers?.['X-Custom-Header']).toBe('custom-value')
			expect(response.headers?.['Content-Type']).toBe('application/json') // Default headers preserved
		})

		it('should include Lambda context headers', () => {
			const response = createLambdaResponse(
				200,
				{ message: 'success' },
				{},
				mockContext,
			)

			expect(response.headers?.['x-lambda-request-id']).toBe(
				mockContext.awsRequestId,
			)
			expect(response.headers?.['x-lambda-function-name']).toBe(
				mockContext.functionName,
			)
		})

		it('should handle string body', () => {
			const response = createLambdaResponse(200, 'plain text')

			expect(response.body).toBe('plain text')
		})

		it('should handle object body', () => {
			const body = { data: 'test' }
			const response = createLambdaResponse(200, body)

			expect(response.body).toBe(JSON.stringify(body))
		})
	})

	describe('createErrorResponse', () => {
		it('should create error response', () => {
			const response = createErrorResponse(500, 'Internal Server Error')

			expect(response.statusCode).toBe(500)
			const body = JSON.parse(response.body) as {
				error: boolean
				message: string
				statusCode: number
				timestamp: string
			}
			expect(body.error).toBe(true)
			expect(body.message).toBe('Internal Server Error')
			expect(body.statusCode).toBe(500)
			expect(body).toHaveProperty('timestamp')
		})

		it('should include context information', () => {
			const response = createErrorResponse(
				400,
				'Bad Request',
				null,
				mockContext,
			)

			const body = JSON.parse(response.body) as {
				requestId: string
			}
			expect(body.requestId).toBe(mockContext.awsRequestId)
			expect(response.headers?.['x-lambda-request-id']).toBe(
				mockContext.awsRequestId,
			)
		})

		it('should include error details in development', () => {
			const originalEnv = process.env.NODE_ENV
			process.env.NODE_ENV = 'development'

			const error = new Error('Test error')
			const response = createErrorResponse(500, 'Server Error', error)

			const body = JSON.parse(response.body) as {
				details: string
				stack: string
			}
			expect(body.details).toBe('Test error')
			expect(body.stack).toBeDefined()

			process.env.NODE_ENV = originalEnv
		})

		it('should not include error details in production', () => {
			const error = new Error('Test error')
			const response = createErrorResponse(
				500,
				'Server Error',
				error,
				undefined,
				'production',
			)

			const body = JSON.parse(response.body) as {
				details: string
				stack: string
			}
			expect(body.details).toBeUndefined()
			expect(body.stack).toBeUndefined()
		})
	})

	describe('extractRequestInfo', () => {
		it('should extract request information', () => {
			const event = global.createMockAPIGatewayEvent({
				httpMethod: 'POST',
				path: '/api/test',
				pathParameters: { id: '123' },
				queryStringParameters: { page: '1' },
				body: '{"data":"test"}',
			}) as APIGatewayProxyEvent

			const info = extractRequestInfo(event)

			expect(info.method).toBe('POST')
			expect(info.path).toBe('/api/test')
			expect(info.pathParameters).toEqual({ id: '123' })
			expect(info.queryStringParameters).toEqual({ page: '1' })
			expect(info.body).toBe('{"data":"test"}')
			expect(info.requestContext.requestId).toBe(event.requestContext.requestId)
		})
	})

	describe('parseJsonBody', () => {
		it('should parse valid JSON', () => {
			const body = '{"message":"test"}'
			const result = parseJsonBody(body) as { message: string }

			expect(result).toEqual({ message: 'test' })
		})

		it('should return null for null body', () => {
			const result = parseJsonBody(null) as null
			expect(result).toBeNull()
		})

		it('should throw error for invalid JSON', () => {
			const body = 'invalid json'
			expect(() => parseJsonBody(body) as { message: string }).toThrow(
				'Invalid JSON in request body',
			)
		})
	})

	describe('validateEnvironment', () => {
		it('should pass when all variables are present', () => {
			process.env.TEST_VAR1 = 'value1'
			process.env.TEST_VAR2 = 'value2'

			expect(() => {
				validateEnvironment(['TEST_VAR1', 'TEST_VAR2'])
			}).not.toThrow()

			delete process.env.TEST_VAR1
			delete process.env.TEST_VAR2
		})

		it('should throw error for missing variables', () => {
			expect(() => {
				validateEnvironment(['MISSING_VAR'])
			}).toThrow('Missing required environment variables: MISSING_VAR')
		})

		it('should throw error for multiple missing variables', () => {
			expect(() => {
				validateEnvironment(['MISSING_VAR1', 'MISSING_VAR2'])
			}).toThrow(
				'Missing required environment variables: MISSING_VAR1, MISSING_VAR2',
			)
		})
	})

	describe('getLambdaContext', () => {
		it('should extract Lambda context information', () => {
			const context = getLambdaContext(mockContext)

			expect(context.functionName).toBe(mockContext.functionName)
			expect(context.awsRequestId).toBe(mockContext.awsRequestId)
			expect(context.remainingTimeInMillis).toBe(30000)
		})
	})

	describe('logRequest', () => {
		it('should log request in development mode', () => {
			process.env.NODE_ENV = 'development'

			logRequest(mockEvent, mockContext)

			// Verify Powertools logger calls (development mode uses debug level)
			expect(loggerMocks.logger.debug).toHaveBeenCalledWith(
				'Lambda request received',
				expect.objectContaining({
					operation: 'lambdaRequest',
					requestId: mockContext.awsRequestId,
					method: mockEvent.httpMethod,
					path: mockEvent.path,
					headers: mockEvent.headers,
				}),
			)

			// Verify Powertools metrics calls
			expect(metricsMocks.utils.addMetric).toHaveBeenCalledWith(
				'RequestReceived',
				'Count',
				1,
				expect.objectContaining({
					Method: mockEvent.httpMethod,
					Path: mockEvent.path,
					Stage: mockEvent.requestContext.stage,
				}),
			)
		})

		it('should not log request in production mode', () => {
			process.env.NODE_ENV = 'production'

			logRequest(mockEvent, mockContext)

			// Verify Powertools logger calls (production mode uses info level)
			expect(loggerMocks.logger.info).toHaveBeenCalledWith(
				'Lambda request received',
				expect.objectContaining({
					operation: 'lambdaRequest',
					requestId: mockContext.awsRequestId,
					method: mockEvent.httpMethod,
					path: mockEvent.path,
				}),
			)

			// Verify Powertools metrics calls (same in both modes)
			expect(metricsMocks.utils.addMetric).toHaveBeenCalledWith(
				'RequestReceived',
				'Count',
				1,
				expect.objectContaining({
					Method: mockEvent.httpMethod,
					Path: mockEvent.path,
					Stage: mockEvent.requestContext.stage,
				}),
			)
		})
	})

	describe('logResponse', () => {
		it('should log response in development mode', () => {
			process.env.NODE_ENV = 'development'

			const response = createLambdaResponse(200, { message: 'test' })
			logResponse(response, mockContext)

			// Verify Powertools logger calls (development mode uses debug level for 2xx)
			expect(loggerMocks.logger.debug).toHaveBeenCalledWith(
				'Lambda response sent',
				expect.objectContaining({
					operation: 'lambdaResponse',
					requestId: mockContext.awsRequestId,
					statusCode: 200,
					isError: false,
					headers: response.headers,
				}),
			)

			// Verify Powertools metrics calls
			expect(metricsMocks.utils.addMetric).toHaveBeenCalledWith(
				'ResponseSent',
				'Count',
				1,
				expect.objectContaining({
					StatusCode: '200',
					StatusClass: '2xx',
				}),
			)

			// Verify response size metric
			expect(metricsMocks.utils.addMetric).toHaveBeenCalledWith(
				'ResponseSize',
				'Bytes',
				expect.any(Number),
			)
		})
	})

	describe('measureExecutionTime', () => {
		it('should measure successful operation', async () => {
			const operation = vi.fn().mockImplementation(async () => {
				// Add a small delay to ensure measurable duration
				await new Promise((resolve) => setTimeout(resolve, 1))
				return 'success'
			})

			const result = await measureExecutionTime(operation, 'test operation')

			expect(result.result).toBe('success')
			expect(result.duration).toBeGreaterThanOrEqual(0)

			// Verify Powertools logger calls
			expect(loggerMocks.logger.debug).toHaveBeenCalledWith(
				'Operation started',
				expect.objectContaining({
					operation: 'measureExecutionTime',
					operationName: 'test operation',
				}),
			)

			expect(loggerMocks.logger.info).toHaveBeenCalledWith(
				'Operation completed successfully',
				expect.objectContaining({
					operation: 'measureExecutionTime',
					operationName: 'test operation',
					duration: expect.any(Number) as number,
				}),
			)

			// Verify Powertools metrics calls
			expect(metricsMocks.utils.addMetric).toHaveBeenCalledWith(
				'OperationDuration',
				'Milliseconds',
				expect.any(Number),
				expect.objectContaining({
					OperationName: 'test operation',
					Status: 'Success',
				}),
			)

			expect(metricsMocks.utils.addMetric).toHaveBeenCalledWith(
				'OperationCount',
				'Count',
				1,
				expect.objectContaining({
					OperationName: 'test operation',
					Status: 'Success',
				}),
			)
		})

		it('should measure failed operation', async () => {
			const operation = vi.fn().mockRejectedValue(new Error('operation failed'))

			await expect(
				measureExecutionTime(operation, 'failing operation'),
			).rejects.toThrow('operation failed')

			// Verify Powertools logger calls for error case
			expect(loggerMocks.logger.debug).toHaveBeenCalledWith(
				'Operation started',
				expect.objectContaining({
					operation: 'measureExecutionTime',
					operationName: 'failing operation',
				}),
			)

			expect(loggerMocks.logger.error).toHaveBeenCalledWith(
				'Operation failed',
				expect.objectContaining({
					operation: 'measureExecutionTime',
					operationName: 'failing operation',
					duration: expect.any(Number) as number,
					error: 'operation failed',
					errorType: 'Error',
				}),
			)

			// Verify Powertools metrics calls for error case
			expect(metricsMocks.utils.addMetric).toHaveBeenCalledWith(
				'OperationDuration',
				'Milliseconds',
				expect.any(Number),
				expect.objectContaining({
					OperationName: 'failing operation',
					Status: 'Error',
				}),
			)

			expect(metricsMocks.utils.addMetric).toHaveBeenCalledWith(
				'OperationCount',
				'Count',
				1,
				expect.objectContaining({
					OperationName: 'failing operation',
					Status: 'Error',
				}),
			)

			expect(metricsMocks.utils.addMetric).toHaveBeenCalledWith(
				'OperationError',
				'Count',
				1,
				expect.objectContaining({
					OperationName: 'failing operation',
					ErrorType: 'Error',
				}),
			)
		})
	})

	describe('isLambdaEnvironment', () => {
		it('should return true when AWS_LAMBDA_FUNCTION_NAME is set', () => {
			process.env.AWS_LAMBDA_FUNCTION_NAME = 'test-function'
			expect(isLambdaEnvironment()).toBe(true)
		})

		it('should return true when AWS_LAMBDA_RUNTIME_API is set', () => {
			process.env.AWS_LAMBDA_RUNTIME_API = 'test-api'
			expect(isLambdaEnvironment()).toBe(true)
		})

		it('should return true when LAMBDA_RUNTIME_DIR is set', () => {
			process.env.LAMBDA_RUNTIME_DIR = '/opt/runtime'
			expect(isLambdaEnvironment()).toBe(true)
		})

		it('should return false when no Lambda environment variables are set', () => {
			expect(isLambdaEnvironment()).toBe(false)
		})
	})

	describe('getMemoryUsage', () => {
		it('should return memory usage information', () => {
			const usage = getMemoryUsage()

			expect(usage).toHaveProperty('rss')
			expect(usage).toHaveProperty('heapTotal')
			expect(usage).toHaveProperty('heapUsed')
			expect(usage).toHaveProperty('external')
			expect(usage).toHaveProperty('arrayBuffers')

			// All values should be numbers (MB)
			Object.values(usage).forEach((value) => {
				expect(typeof value).toBe('number')
				expect(value).toBeGreaterThanOrEqual(0)
			})
		})
	})

	describe('handleCorsPreflightRequest', () => {
		it('should handle OPTIONS request', () => {
			const event = global.createMockAPIGatewayEvent({
				httpMethod: 'OPTIONS',
			}) as APIGatewayProxyEvent

			const response = handleCorsPreflightRequest(event, mockContext)

			expect(response).not.toBeNull()
			if (!response) return

			expect(response.statusCode).toBe(200)
			expect(response.headers?.['Access-Control-Allow-Origin']).toBe('*')
			expect(response.headers?.['Access-Control-Allow-Methods']).toBe(
				'GET,POST,PUT,DELETE,OPTIONS,PATCH',
			)
			expect(response.headers?.['Access-Control-Max-Age']).toBe('86400')
		})

		it('should return null for non-OPTIONS request', () => {
			const event = global.createMockAPIGatewayEvent({
				httpMethod: 'GET',
			}) as APIGatewayProxyEvent

			const response = handleCorsPreflightRequest(event, mockContext)

			expect(response).toBeNull()
		})
	})
})
