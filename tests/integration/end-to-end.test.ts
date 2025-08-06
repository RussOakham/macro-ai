/**
 * End-to-End Integration Tests
 *
 * Complete frontend-backend integration testing including CORS validation,
 * full authentication flows, and cross-origin request handling
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

interface E2ETestConfig {
	apiEndpoint: string
	frontendUrl: string
	apiKey: string
	timeout: number
}

interface E2EResponse {
	status: number
	data: any
	headers: Record<string, string>
	responseTime: number
}

class E2ETestClient {
	private readonly config: E2ETestConfig

	constructor(config: E2ETestConfig) {
		this.config = config
	}

	async makeRequest(
		method: string,
		path: string,
		options: {
			body?: any
			headers?: Record<string, string>
			origin?: string
			expectStatus?: number
		} = {},
	): Promise<E2EResponse> {
		const startTime = Date.now()
		const url = `${this.config.apiEndpoint}${path}`

		const requestHeaders: Record<string, string> = {
			'Content-Type': 'application/json',
			'X-API-Key': this.config.apiKey,
			...options.headers,
		}

		// Add Origin header for CORS testing
		if (options.origin) {
			requestHeaders.Origin = options.origin
		}

		try {
			const response = await fetch(url, {
				method,
				headers: requestHeaders,
				body: options.body ? JSON.stringify(options.body) : undefined,
				signal: AbortSignal.timeout(this.config.timeout),
			})

			const responseTime = Date.now() - startTime
			const data = await response.json().catch(() => ({}))

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
				`E2E request failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
			)
		}
	}

	async testCorsFlow(
		origin: string,
		method = 'POST',
		path = 'api/health',
	): Promise<{
		preflight: E2EResponse
		actual: E2EResponse
	}> {
		// First, make preflight request
		const preflight = await this.makeRequest('OPTIONS', path, {
			headers: {
				'Access-Control-Request-Method': method,
				'Access-Control-Request-Headers':
					'Content-Type,Authorization,X-API-Key',
			},
			origin,
		})

		// Then make actual request
		const actual = await this.makeRequest(method, path, {
			origin,
			body: method === 'POST' ? {} : undefined,
		})

		return { preflight, actual }
	}
}

describe('End-to-End Integration Tests', () => {
	let e2eClient: E2ETestClient
	let config: E2ETestConfig

	beforeAll(() => {
		const apiEndpoint =
			process.env.TEST_API_ENDPOINT ?? process.env.VITE_API_URL
		const apiKey = process.env.TEST_API_KEY ?? process.env.VITE_API_KEY
		const frontendUrl = process.env.TEST_FRONTEND_URL ?? 'http://localhost:3000'

		if (!apiEndpoint || !apiKey) {
			throw new Error(
				'TEST_API_ENDPOINT and TEST_API_KEY environment variables are required',
			)
		}

		config = {
			apiEndpoint: apiEndpoint.replace('/api', ''),
			frontendUrl,
			apiKey,
			timeout: 30000,
		}

		e2eClient = new E2ETestClient(config)

		console.log(`🌐 Running E2E integration tests`)
		console.log(`  API: ${config.apiEndpoint}`)
		console.log(`  Frontend: ${config.frontendUrl}`)
	})

	afterAll(() => {
		console.log('🏁 E2E integration tests completed')
	})

	describe('Frontend-Backend CORS Integration', () => {
		it('should handle CORS preflight and actual requests from localhost', async () => {
			const { preflight, actual } = await e2eClient.testCorsFlow(
				'http://localhost:3000',
				'GET',
			)

			// Preflight should succeed
			expect(preflight.status).toBe(200)
			expect(preflight.headers['access-control-allow-origin']).toBeTruthy()
			expect(preflight.headers['access-control-allow-methods']).toContain('GET')

			// Actual request should succeed
			expect(actual.status).toBe(200)
			expect(actual.headers['access-control-allow-origin']).toBeTruthy()
		})

		it('should handle CORS for POST requests with JSON body', async () => {
			const { preflight, actual } = await e2eClient.testCorsFlow(
				'http://localhost:3000',
				'POST',
				'api/auth/login',
			)

			// Preflight should succeed
			expect(preflight.status).toBe(200)
			expect(preflight.headers['access-control-allow-methods']).toContain(
				'POST',
			)
			expect(preflight.headers['access-control-allow-headers']).toContain(
				'Content-Type',
			)

			// Actual request should be processed (may fail validation but CORS should work)
			expect(actual.status).not.toBe(0) // Not a CORS error
			expect(actual.headers['access-control-allow-origin']).toBeTruthy()
		})

		it('should handle CORS for different development origins', async () => {
			const origins = [
				'http://localhost:3000',
				'https://localhost:3000',
				config.frontendUrl,
			]

			for (const origin of origins) {
				const { preflight, actual } = await e2eClient.testCorsFlow(
					origin,
					'GET',
				)

				expect(preflight.status).toBe(200)
				expect(actual.status).toBe(200)

				// Both should have CORS headers
				expect(preflight.headers['access-control-allow-origin']).toBeTruthy()
				expect(actual.headers['access-control-allow-origin']).toBeTruthy()
			}
		})
	})

	describe('Complete Authentication Flow', () => {
		it('should handle complete authentication request flow with CORS', async () => {
			const origin = 'http://localhost:3000'

			// Test registration endpoint with CORS
			const registrationFlow = await e2eClient.testCorsFlow(
				origin,
				'POST',
				'api/auth/register',
			)

			expect(registrationFlow.preflight.status).toBe(200)
			expect(registrationFlow.actual.status).toBe(400) // Validation error expected
			expect(registrationFlow.actual.data).toHaveProperty('error')

			// CORS headers should be present in both
			expect(
				registrationFlow.preflight.headers['access-control-allow-origin'],
			).toBeTruthy()
			expect(
				registrationFlow.actual.headers['access-control-allow-origin'],
			).toBeTruthy()
		})

		it('should handle login flow with proper CORS headers', async () => {
			const origin = 'http://localhost:3000'

			const loginFlow = await e2eClient.testCorsFlow(
				origin,
				'POST',
				'api/auth/login',
			)

			expect(loginFlow.preflight.status).toBe(200)
			expect(loginFlow.actual.status).toBe(400) // Validation error expected for empty body

			// Verify CORS headers allow credentials
			expect(
				loginFlow.preflight.headers['access-control-allow-credentials'],
			).toBeTruthy()
			expect(
				loginFlow.actual.headers['access-control-allow-credentials'],
			).toBeTruthy()
		})

		it('should handle protected route access with CORS', async () => {
			const origin = 'http://localhost:3000'

			const protectedFlow = await e2eClient.testCorsFlow(
				origin,
				'GET',
				'api/auth/user',
			)

			expect(protectedFlow.preflight.status).toBe(200)
			expect(protectedFlow.actual.status).toBe(401) // Unauthorized expected without token

			// CORS should work even for unauthorized requests
			expect(
				protectedFlow.actual.headers['access-control-allow-origin'],
			).toBeTruthy()
		})
	})

	describe('API Response Format Consistency', () => {
		it('should return consistent JSON format across all endpoints', async () => {
			const endpoints = [
				{ method: 'GET', path: 'api/health' },
				{ method: 'POST', path: 'api/auth/login' },
				{ method: 'GET', path: 'api/auth/user' },
			]

			for (const endpoint of endpoints) {
				const response = await e2eClient.makeRequest(
					endpoint.method,
					endpoint.path,
					{
						origin: 'http://localhost:3000',
						body: endpoint.method === 'POST' ? {} : undefined,
					},
				)

				// All responses should be JSON
				expect(response.headers['content-type']).toContain('application/json')

				// All responses should have proper structure
				expect(typeof response.data).toBe('object')

				// Error responses should have consistent format
				if (response.status >= 400) {
					expect(response.data).toHaveProperty('error')
					expect(typeof response.data.error).toBe('string')
				}
			}
		})

		it('should include proper security headers in all responses', async () => {
			const response = await e2eClient.makeRequest('GET', 'api/health', {
				origin: 'http://localhost:3000',
			})

			expect(response.status).toBe(200)

			// Check for important security headers
			expect(response.headers['access-control-allow-origin']).toBeTruthy()
			expect(response.headers['content-type']).toContain('application/json')

			// CORS headers should be present
			expect(response.headers['access-control-allow-credentials']).toBeTruthy()
		})
	})

	describe('Performance and Reliability', () => {
		it('should maintain acceptable response times for frontend requests', async () => {
			const response = await e2eClient.makeRequest('GET', 'api/health', {
				origin: 'http://localhost:3000',
			})

			expect(response.status).toBe(200)
			expect(response.responseTime).toBeLessThan(5000) // 5 seconds max for frontend requests
		})

		it('should handle multiple concurrent frontend requests', async () => {
			const concurrentRequests = 3
			const origin = 'http://localhost:3000'

			const promises = Array.from({ length: concurrentRequests }, () =>
				e2eClient.makeRequest('GET', 'api/health', { origin }),
			)

			const responses = await Promise.all(promises)

			responses.forEach((response) => {
				expect(response.status).toBe(200)
				expect(response.responseTime).toBeLessThan(10000) // 10 seconds under load
				expect(response.headers['access-control-allow-origin']).toBeTruthy()
			})
		})

		it('should maintain CORS consistency under load', async () => {
			const requestCount = 5
			const origin = 'http://localhost:3000'

			for (let i = 0; i < requestCount; i++) {
				const response = await e2eClient.makeRequest('GET', 'api/health', {
					origin,
				})

				expect(response.status).toBe(200)
				expect(response.headers['access-control-allow-origin']).toBeTruthy()

				// Small delay between requests
				await new Promise((resolve) => setTimeout(resolve, 200))
			}
		})
	})

	describe('Error Handling Across Origins', () => {
		it('should handle errors consistently with CORS headers', async () => {
			const origin = 'http://localhost:3000'

			// Test 404 error
			const notFoundResponse = await e2eClient.makeRequest(
				'GET',
				'api/nonexistent',
				{ origin },
			)
			expect(notFoundResponse.status).toBe(404)
			expect(
				notFoundResponse.headers['access-control-allow-origin'],
			).toBeTruthy()
			expect(notFoundResponse.data).toHaveProperty('error')

			// Test validation error
			const validationResponse = await e2eClient.makeRequest(
				'POST',
				'api/auth/login',
				{
					origin,
					body: { invalid: 'data' },
				},
			)
			expect(validationResponse.status).toBe(400)
			expect(
				validationResponse.headers['access-control-allow-origin'],
			).toBeTruthy()
			expect(validationResponse.data).toHaveProperty('error')
		})

		it('should not expose sensitive information in cross-origin errors', async () => {
			const origin = 'http://localhost:3000'

			const response = await e2eClient.makeRequest('POST', 'api/auth/login', {
				origin,
				body: {},
			})

			expect(response.status).toBe(400)

			const errorMessage = response.data.error.toLowerCase()

			// Should not contain sensitive information
			expect(errorMessage).not.toContain('database')
			expect(errorMessage).not.toContain('parameter store')
			expect(errorMessage).not.toContain('aws')
			expect(errorMessage).not.toContain('lambda')
			expect(errorMessage).not.toContain('cognito')
		})
	})
})
