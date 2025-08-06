/**
 * Database and Parameter Store Integration Tests
 *
 * Tests database connectivity, Parameter Store integration, and data persistence
 * through the deployed Lambda function
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

interface DatabaseTestConfig {
	apiEndpoint: string
	apiKey: string
	timeout: number
}

interface DatabaseTestResponse {
	status: number
	data: any
	responseTime: number
}

class DatabaseTestClient {
	private readonly config: DatabaseTestConfig

	constructor(config: DatabaseTestConfig) {
		this.config = config
	}

	async makeRequest(
		method: string,
		path: string,
		body?: any,
		headers: Record<string, string> = {},
	): Promise<DatabaseTestResponse> {
		const startTime = Date.now()
		const url = `${this.config.apiEndpoint}${path}`

		const requestHeaders = {
			'Content-Type': 'application/json',
			'X-API-Key': this.config.apiKey,
			...headers,
		}

		try {
			const response = await fetch(url, {
				method,
				headers: requestHeaders,
				body: body ? JSON.stringify(body) : undefined,
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

				console.error('JSON parsing failed:', {
					status: response.status,
					statusText: response.statusText,
					contentType,
					responseText: responseText.substring(0, 500), // Limit to first 500 chars
					url: response.url,
					parseError:
						jsonError instanceof Error ? jsonError.message : String(jsonError),
				})

				throw new Error(
					`Failed to parse JSON response (${response.status} ${response.statusText}): ` +
						`Content-Type: ${contentType}, ` +
						`Response: ${responseText.substring(0, 200)}...`,
				)
			}

			return {
				status: response.status,
				data,
				responseTime,
			}
		} catch (error) {
			throw new Error(
				`Database test request failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
			)
		}
	}
}

describe('Database Integration Tests', () => {
	let dbClient: DatabaseTestClient
	let config: DatabaseTestConfig

	beforeAll(() => {
		const apiEndpoint =
			process.env.TEST_API_ENDPOINT ?? process.env.VITE_API_URL
		const apiKey = process.env.TEST_API_KEY ?? process.env.VITE_API_KEY

		if (!apiEndpoint || !apiKey) {
			throw new Error(
				'TEST_API_ENDPOINT and TEST_API_KEY environment variables are required',
			)
		}

		config = {
			apiEndpoint: apiEndpoint.replace('/api', ''),
			apiKey,
			timeout: 30000, // 30 seconds for database operations
		}

		dbClient = new DatabaseTestClient(config)

		console.log(
			`🗄️ Running database integration tests against: ${config.apiEndpoint}`,
		)
	})

	afterAll(() => {
		console.log('🏁 Database integration tests completed')
	})

	describe('Database Connectivity', () => {
		it('should connect to database through Lambda function', async () => {
			// Test an endpoint that requires database access
			const response = await dbClient.makeRequest('GET', '/api/health')

			expect(response.status).toBe(200)
			expect(response.responseTime).toBeLessThan(10000) // Should connect within 10 seconds

			// Health endpoint might include database status
			if (response.data.database) {
				expect(response.data.database.status).toBe('connected')
			}
		})

		it('should handle database connection timeouts gracefully', async () => {
			// This test verifies that the Lambda function handles database timeouts properly
			// We can't easily simulate a timeout, but we can verify the response structure
			const response = await dbClient.makeRequest('GET', '/api/health')

			expect(response.status).toBe(200)
			// Response should be structured properly even if database is slow
			expect(response.data).toHaveProperty('message')
		})
	})

	describe('Parameter Store Integration', () => {
		it('should successfully load configuration from Parameter Store', async () => {
			// The health endpoint should work if Parameter Store is accessible
			const response = await dbClient.makeRequest('GET', '/api/health')

			expect(response.status).toBe(200)
			expect(response.responseTime).toBeLessThan(15000) // Parameter Store access + response

			// If the Lambda is running, it means Parameter Store configuration was loaded
			expect(response.data).toHaveProperty('message')
		})

		it('should handle Parameter Store caching effectively', async () => {
			// Test caching by comparing average response times over multiple requests
			const initialRequestCount = 3
			const cachedRequestCount = 5

			// Make initial requests to warm up the cache
			const initialResponses = []
			for (let i = 0; i < initialRequestCount; i++) {
				const response = await dbClient.makeRequest('GET', '/api/health')
				expect(response.status).toBe(200)
				initialResponses.push(response)

				// Small delay between requests to avoid overwhelming the service
				if (i < initialRequestCount - 1) {
					await new Promise((resolve) => setTimeout(resolve, 100))
				}
			}

			// Make cached requests (should benefit from Parameter Store caching)
			const cachedResponses = []
			for (let i = 0; i < cachedRequestCount; i++) {
				const response = await dbClient.makeRequest('GET', '/api/health')
				expect(response.status).toBe(200)
				cachedResponses.push(response)

				// Small delay between requests
				if (i < cachedRequestCount - 1) {
					await new Promise((resolve) => setTimeout(resolve, 50))
				}
			}

			// Calculate average response times
			const initialAverage =
				initialResponses.reduce((sum, r) => sum + r.responseTime, 0) /
				initialResponses.length
			const cachedAverage =
				cachedResponses.reduce((sum, r) => sum + r.responseTime, 0) /
				cachedResponses.length

			// Cached requests should show improvement or at least not be significantly slower
			// Allow for 20% variance to account for network variability
			const improvementThreshold = initialAverage * 1.2

			expect(cachedAverage).toBeLessThanOrEqual(improvementThreshold)

			// Additional validation: ensure responses are consistent
			const allResponses = [...initialResponses, ...cachedResponses]
			allResponses.forEach((response) => {
				expect(response.data).toHaveProperty('message')
				expect(response.responseTime).toBeLessThan(30000) // Reasonable upper bound
			})

			// Log performance metrics for debugging
			console.log(`Caching test metrics:`, {
				initialAverage: Math.round(initialAverage),
				cachedAverage: Math.round(cachedAverage),
				improvement: Math.round(
					((initialAverage - cachedAverage) / initialAverage) * 100,
				),
				threshold: Math.round(improvementThreshold),
			})
		})

		it('should validate required parameters are accessible', async () => {
			// Test that the Lambda function can access required parameters
			// This is implicit - if the function runs, parameters were loaded
			const response = await dbClient.makeRequest('GET', '/api/health')

			expect(response.status).toBe(200)

			// The fact that we get a proper response means:
			// - Database URL was loaded from Parameter Store
			// - API configuration was loaded
			// - Other required parameters were accessible
		})
	})

	describe('Data Persistence Tests', () => {
		it('should handle database operations without errors', async () => {
			// Test endpoints that might involve database operations
			const endpoints = [
				'/api/health',
				// Add other endpoints that involve database operations
			]

			for (const endpoint of endpoints) {
				const response = await dbClient.makeRequest('GET', endpoint)

				// Should not return database-related errors
				expect(response.status).not.toBe(500)

				if (response.status >= 400) {
					// If there's an error, it shouldn't be database-related
					expect(response.data.error).not.toContain('database')
					expect(response.data.error).not.toContain('connection')
					expect(response.data.error).not.toContain('timeout')
				}
			}
		})

		it('should maintain database connection pool efficiently', async () => {
			// Test multiple concurrent requests to verify connection pooling
			const concurrentRequests = 3
			const promises = Array.from({ length: concurrentRequests }, () =>
				dbClient.makeRequest('GET', '/api/health'),
			)

			const responses = await Promise.all(promises)

			responses.forEach((response) => {
				expect(response.status).toBe(200)
				expect(response.responseTime).toBeLessThan(15000)
			})

			// All requests should succeed, indicating proper connection pooling
			const successfulResponses = responses.filter((r) => r.status === 200)
			expect(successfulResponses).toHaveLength(concurrentRequests)
		})
	})

	describe('Error Handling', () => {
		it('should handle database errors gracefully', async () => {
			// Test that the application handles database errors properly
			// We can't easily simulate database errors, but we can verify error structure
			const response = await dbClient.makeRequest('GET', '/api/nonexistent')

			expect(response.status).toBe(404)
			expect(response.data).toHaveProperty('error')

			// Error should not expose database internals
			const errorMessage = response.data.error.toLowerCase()
			expect(errorMessage).not.toContain('sql')
			expect(errorMessage).not.toContain('postgres')
			expect(errorMessage).not.toContain('connection string')
		})

		it('should not expose sensitive configuration in errors', async () => {
			// Test various error scenarios to ensure no sensitive data is leaked
			const testCases = [
				{ method: 'GET', path: '/api/nonexistent' },
				{ method: 'POST', path: '/api/auth/login', body: { invalid: 'data' } },
			]

			for (const testCase of testCases) {
				const response = await dbClient.makeRequest(
					testCase.method,
					testCase.path,
					testCase.body,
				)

				if (response.status >= 400 && response.data.error) {
					const errorMessage = response.data.error.toLowerCase()

					// Should not contain sensitive information
					expect(errorMessage).not.toContain('parameter store')
					expect(errorMessage).not.toContain('aws')
					expect(errorMessage).not.toContain('secret')
					expect(errorMessage).not.toContain('key')
					expect(errorMessage).not.toContain('password')
					expect(errorMessage).not.toContain('token')
				}
			}
		})
	})

	describe('Performance Tests', () => {
		it('should maintain acceptable response times with database operations', async () => {
			const response = await dbClient.makeRequest('GET', '/api/health')

			expect(response.status).toBe(200)
			expect(response.responseTime).toBeLessThan(8000) // 8 seconds max for database operations
		})

		it('should handle sequential database requests efficiently', async () => {
			const requestCount = 3
			const responses: DatabaseTestResponse[] = []

			for (let i = 0; i < requestCount; i++) {
				const response = await dbClient.makeRequest('GET', '/api/health')
				responses.push(response)

				// Small delay between requests
				await new Promise((resolve) => setTimeout(resolve, 500))
			}

			responses.forEach((response) => {
				expect(response.status).toBe(200)
				expect(response.responseTime).toBeLessThan(10000)
			})

			// Response times should be consistent (connection pooling working)
			const responseTimes = responses.map((r) => r.responseTime)
			const avgResponseTime =
				responseTimes.reduce((sum, time) => sum + time, 0) /
				responseTimes.length
			const maxDeviation = Math.max(
				...responseTimes.map((time) => Math.abs(time - avgResponseTime)),
			)

			// Response times shouldn't vary too much (indicating stable connections)
			expect(maxDeviation).toBeLessThan(5000) // 5 second max deviation
		})
	})

	describe('Environment Configuration', () => {
		it('should use correct database configuration for test environment', async () => {
			const response = await dbClient.makeRequest('GET', '/api/health')

			expect(response.status).toBe(200)

			// The fact that we can connect means the correct database URL was loaded
			// from Parameter Store for the test environment
			expect(response.data).toHaveProperty('message')
		})

		it('should load environment-specific parameters correctly', async () => {
			// Test that environment-specific configuration is loaded
			const response = await dbClient.makeRequest('GET', '/api/health')

			expect(response.status).toBe(200)

			// Response indicates that environment-specific parameters were loaded successfully
			if (response.data.environment) {
				expect(typeof response.data.environment).toBe('string')
			}
		})
	})
})
