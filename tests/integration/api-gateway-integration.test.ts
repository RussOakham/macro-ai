/**
 * API Gateway Integration Tests
 *
 * Comprehensive end-to-end testing of deployed Lambda function through API Gateway
 * Tests authentication validation, error handling, CORS, and performance
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

interface TestConfig {
	apiEndpoint: string
	apiKey: string
	environment: string
	timeout: number
}

interface ApiResponse {
	status: number
	data: any
	headers: Record<string, string>
	responseTime: number
}

class ApiGatewayTestClient {
	private readonly config: TestConfig

	constructor(config: TestConfig) {
		this.config = config
	}

	async makeRequest(
		method: string,
		path: string,
		options: {
			body?: any
			rawBody?: string | Buffer
			headers?: Record<string, string>
			expectStatus?: number
		} = {},
	): Promise<ApiResponse> {
		const startTime = Date.now()
		const url = `${this.config.apiEndpoint}${path}`

		const requestHeaders = {
			'Content-Type': 'application/json',
			'X-API-Key': this.config.apiKey,
			...options.headers,
		}

		// Determine the body to send
		let requestBody: string | Buffer | undefined
		if (options.rawBody !== undefined) {
			// Use raw body without JSON.stringify for malformed JSON testing
			requestBody = options.rawBody
		} else if (options.body) {
			// Normal JSON.stringify behavior
			requestBody = JSON.stringify(options.body)
		} else {
			requestBody = undefined
		}

		try {
			const response = await fetch(url, {
				method,
				headers: requestHeaders,
				body: requestBody,
				signal: AbortSignal.timeout(this.config.timeout),
			})

			const responseTime = Date.now() - startTime

			// Parse JSON response with proper error handling
			let data: any
			try {
				data = await response.json()
			} catch (jsonError) {
				// Get response text for better error diagnostics
				const responseText = await response
					.text()
					.catch(() => 'Unable to read response body')
				const contentType = response.headers.get('content-type') || 'unknown'

				console.error('JSON parsing failed in API Gateway integration test:', {
					status: response.status,
					statusText: response.statusText,
					contentType,
					responseText: responseText.substring(0, 500), // Limit to first 500 chars
					url: response.url,
					method,
					parseError:
						jsonError instanceof Error ? jsonError.message : String(jsonError),
				})

				throw new Error(
					`Failed to parse JSON response in API Gateway test (${response.status} ${response.statusText}): ` +
						`Content-Type: ${contentType}, ` +
						`Response: ${responseText.substring(0, 200)}...`,
				)
			}

			const headers: Record<string, string> = {}
			response.headers.forEach((value, key) => {
				headers[key] = value
			})

			return {
				status: response.status,
				data,
				headers,
				responseTime,
			}
		} catch (error) {
			throw new Error(
				`Request failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
			)
		}
	}

	async testCors(origin: string, method = 'POST'): Promise<ApiResponse> {
		return this.makeRequest('OPTIONS', 'api/health', {
			headers: {
				Origin: origin,
				'Access-Control-Request-Method': method,
				'Access-Control-Request-Headers': 'Content-Type,Authorization',
			},
		})
	}
}

describe('API Gateway Integration Tests', () => {
	let testClient: ApiGatewayTestClient
	let config: TestConfig

	beforeAll(() => {
		// Get configuration from environment variables
		const apiEndpoint =
			process.env.TEST_API_ENDPOINT ?? process.env.VITE_API_URL
		const apiKey = process.env.TEST_API_KEY ?? process.env.VITE_API_KEY
		const environment = process.env.TEST_ENVIRONMENT ?? 'test'

		if (!apiEndpoint || !apiKey) {
			throw new Error(
				'TEST_API_ENDPOINT and TEST_API_KEY environment variables are required',
			)
		}

		config = {
			apiEndpoint: apiEndpoint.replace('/api', ''), // Remove /api suffix if present
			apiKey,
			environment,
			timeout: 30000, // 30 seconds
		}

		testClient = new ApiGatewayTestClient(config)

		console.log(`🧪 Running integration tests against: ${config.apiEndpoint}`)
	})

	afterAll(() => {
		console.log('🏁 Integration tests completed')
	})

	describe('Health Check Endpoint', () => {
		it('should return 200 OK for health check', async () => {
			const response = await testClient.makeRequest('GET', 'api/health')

			expect(response.status).toBe(200)
			expect(response.data).toHaveProperty('message')
			expect(response.data.message).toContain('Health Status')
			expect(response.responseTime).toBeLessThan(5000) // Should respond within 5 seconds
		})

		it('should include proper headers in health check response', async () => {
			const response = await testClient.makeRequest('GET', 'api/health')

			expect(response.headers).toHaveProperty('content-type')
			expect(response.headers['content-type']).toContain('application/json')
			expect(response.headers).toHaveProperty('access-control-allow-origin')
		})

		it('should handle health check without API key', async () => {
			const response = await testClient.makeRequest('GET', 'api/health', {
				headers: { 'X-API-Key': '' },
			})

			// Health endpoint should be accessible without API key
			expect(response.status).toBe(200)
		})
	})

	describe('CORS Configuration', () => {
		it('should handle CORS preflight requests', async () => {
			const response = await testClient.testCors('https://localhost:3000')

			expect(response.status).toBe(200)
			expect(response.headers).toHaveProperty('access-control-allow-origin')
			expect(response.headers).toHaveProperty('access-control-allow-methods')
			expect(response.headers).toHaveProperty('access-control-allow-headers')
		})

		it('should allow requests from development origins', async () => {
			const origins = ['http://localhost:3000', 'https://localhost:3000']

			for (const origin of origins) {
				const response = await testClient.testCors(origin)
				expect(response.status).toBe(200)
			}
		})

		it('should handle CORS for different HTTP methods', async () => {
			const methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH']

			for (const method of methods) {
				const response = await testClient.testCors(
					'http://localhost:3000',
					method,
				)
				expect(response.status).toBe(200)
			}
		})
	})

	describe('API Key Validation', () => {
		it('should reject requests with invalid API key for protected endpoints', async () => {
			const response = await testClient.makeRequest('GET', 'api/auth/user', {
				headers: { 'X-API-Key': 'invalid-key' },
			})

			expect(response.status).toBe(401)
			expect(response.data).toHaveProperty('error')
		})

		it('should accept requests with valid API key', async () => {
			const response = await testClient.makeRequest('GET', 'api/auth/user')

			// Should not fail due to API key (may fail due to missing auth token)
			expect(response.status).not.toBe(401)
		})
	})

	describe('Error Handling', () => {
		it('should return 404 for non-existent endpoints', async () => {
			const response = await testClient.makeRequest(
				'GET',
				'api/non-existent-endpoint',
			)

			expect(response.status).toBe(404)
			expect(response.data).toHaveProperty('error')
		})

		it('should handle malformed JSON in request body', async () => {
			const response = await testClient.makeRequest('POST', 'api/auth/login', {
				headers: { 'Content-Type': 'application/json' },
				rawBody: '{ invalid json }', // Use rawBody to bypass JSON.stringify
			})

			expect(response.status).toBe(400)
			expect(response.data).toHaveProperty('error')
		})

		it('should return proper error format', async () => {
			const response = await testClient.makeRequest('POST', 'api/auth/login', {
				body: {}, // Empty body should trigger validation error
			})

			expect(response.status).toBeGreaterThanOrEqual(400)
			expect(response.data).toHaveProperty('error')
			expect(typeof response.data.error).toBe('string')
		})
	})

	describe('Performance Tests', () => {
		it('should respond to health check within acceptable time', async () => {
			const response = await testClient.makeRequest('GET', 'api/health')

			expect(response.responseTime).toBeLessThan(3000) // 3 seconds max
		})

		it('should handle concurrent requests', async () => {
			const concurrentRequests = 5
			const promises = Array.from({ length: concurrentRequests }, () =>
				testClient.makeRequest('GET', 'api/health'),
			)

			const responses = await Promise.all(promises)

			responses.forEach((response) => {
				expect(response.status).toBe(200)
				expect(response.responseTime).toBeLessThan(10000) // 10 seconds max under load
			})
		})

		it('should maintain performance under sequential requests', async () => {
			const requestCount = 3
			const responses: ApiResponse[] = []

			for (let i = 0; i < requestCount; i++) {
				const response = await testClient.makeRequest('GET', 'api/health')
				responses.push(response)
			}

			const avgResponseTime =
				responses.reduce((sum, r) => sum + r.responseTime, 0) / responses.length
			expect(avgResponseTime).toBeLessThan(5000) // Average should be under 5 seconds
		})
	})

	describe('Lambda Function Integration', () => {
		it('should properly handle Lambda cold starts', async () => {
			// First request might be slower due to cold start
			const response1 = await testClient.makeRequest('GET', 'api/health')
			expect(response1.status).toBe(200)

			// Subsequent request should be faster (warm Lambda)
			const response2 = await testClient.makeRequest('GET', 'api/health')
			expect(response2.status).toBe(200)
			expect(response2.responseTime).toBeLessThanOrEqual(response1.responseTime)
		})

		it('should include Lambda execution context in responses', async () => {
			const response = await testClient.makeRequest('GET', 'api/health')

			expect(response.status).toBe(200)
			// Lambda should add request ID header
			expect(response.headers).toHaveProperty('x-amzn-requestid')
		})
	})

	describe('Environment-Specific Tests', () => {
		it('should return correct environment information', async () => {
			const response = await testClient.makeRequest('GET', 'api/health')

			expect(response.status).toBe(200)
			// Health response might include environment info
			if (response.data.environment) {
				expect(typeof response.data.environment).toBe('string')
			}
		})

		it('should have appropriate configuration for test environment', async () => {
			// Test that the API is configured correctly for the test environment
			const response = await testClient.makeRequest('GET', 'api/health')

			expect(response.status).toBe(200)
			expect(response.responseTime).toBeLessThan(10000) // Should be responsive in test env
		})
	})
})
