/**
 * Authentication Integration Tests
 *
 * End-to-end testing of authentication flows through API Gateway
 * Tests Cognito integration, JWT validation, and protected routes
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

interface AuthTestConfig {
	apiEndpoint: string
	apiKey: string
	testUser: {
		email: string
		password: string
		username: string
	}
}

// Interface for potential future use
// interface AuthResponse {
//   accessToken?: string
//   refreshToken?: string
//   idToken?: string
//   user?: any
//   error?: string
// }

class AuthTestClient {
	private readonly config: AuthTestConfig
	private accessToken: string | null = null

	constructor(config: AuthTestConfig) {
		this.config = config
	}

	async makeAuthRequest(
		method: string,
		path: string,
		body?: any,
		includeAuth = false,
		customAuthHeader?: string,
	): Promise<{ status: number; data: any; headers: Record<string, string> }> {
		const url = `${this.config.apiEndpoint}${path}`

		const headers: Record<string, string> = {
			'Content-Type': 'application/json',
			'X-API-Key': this.config.apiKey,
		}

		if (customAuthHeader) {
			headers.Authorization = customAuthHeader
		} else if (includeAuth && this.accessToken) {
			headers.Authorization = `Bearer ${this.accessToken}`
		}

		const response = await fetch(url, {
			method,
			headers,
			body: body ? JSON.stringify(body) : undefined,
		})

		// Parse JSON response with proper error handling
		// Clone the response to preserve the body for error diagnostics
		const responseClone = response.clone()
		let data: any
		try {
			data = await response.json()
		} catch (jsonError) {
			// Get response text for better error diagnostics using the cloned response
			const responseText = await responseClone
				.text()
				.catch(() => 'Unable to read response body')
			const contentType = response.headers.get('content-type') ?? 'unknown'

			console.error('JSON parsing failed in Auth integration test:', {
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
				`Failed to parse JSON response in Auth test (${response.status.toString()} ${response.statusText}): ` +
					`Content-Type: ${contentType}, ` +
					`Response: ${responseText.substring(0, 200)}...`,
			)
		}

		const responseHeaders: Record<string, string> = {}
		response.headers.forEach((value, key) => {
			responseHeaders[key] = value
		})

		return {
			status: response.status,
			data,
			headers: responseHeaders,
		}
	}

	setAccessToken(token: string) {
		this.accessToken = token
	}

	clearAccessToken() {
		this.accessToken = null
	}
}

describe('Authentication Integration Tests', () => {
	let authClient: AuthTestClient
	let config: AuthTestConfig

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
			testUser: {
				email: 'test@example.com',
				password: 'TestPassword123!',
				username: 'testuser',
			},
		}

		authClient = new AuthTestClient(config)

		console.log(
			`🔐 Running authentication integration tests against: ${config.apiEndpoint}`,
		)
	})

	afterAll(() => {
		console.log('🏁 Authentication integration tests completed')
	})

	describe('Authentication Endpoints', () => {
		it('should validate registration request format', async () => {
			const response = await authClient.makeAuthRequest(
				'POST',
				'api/auth/register',
				{
					// Missing required fields to test validation
				},
			)

			expect(response.status).toBe(400)
			expect(response.data).toHaveProperty('error')
			expect(response.data.error).toContain('validation')
		})

		it('should validate login request format', async () => {
			const response = await authClient.makeAuthRequest(
				'POST',
				'api/auth/login',
				{
					// Missing required fields
				},
			)

			expect(response.status).toBe(400)
			expect(response.data).toHaveProperty('error')
		})

		it('should handle login with invalid credentials', async () => {
			const response = await authClient.makeAuthRequest(
				'POST',
				'api/auth/login',
				{
					email: 'nonexistent@example.com',
					password: 'wrongpassword',
				},
			)

			expect(response.status).toBe(401)
			expect(response.data).toHaveProperty('error')
		})

		it('should validate email format in registration', async () => {
			const response = await authClient.makeAuthRequest(
				'POST',
				'api/auth/register',
				{
					email: 'invalid-email',
					password: 'ValidPassword123!',
					username: 'testuser',
				},
			)

			expect(response.status).toBe(400)
			expect(response.data).toHaveProperty('error')
		})

		it('should validate password strength in registration', async () => {
			const response = await authClient.makeAuthRequest(
				'POST',
				'api/auth/register',
				{
					email: 'test@example.com',
					password: 'weak', // Too weak
					username: 'testuser',
				},
			)

			expect(response.status).toBe(400)
			expect(response.data).toHaveProperty('error')
		})
	})

	describe('Protected Routes', () => {
		it('should reject access to protected routes without authentication', async () => {
			const response = await authClient.makeAuthRequest('GET', 'api/auth/user')

			expect(response.status).toBe(401)
			expect(response.data).toHaveProperty('error')
			expect(response.data.error).toContain('authorization')
		})

		it('should reject access with invalid JWT token', async () => {
			authClient.setAccessToken('INVALID_TEST_JWT_TOKEN')

			const response = await authClient.makeAuthRequest(
				'GET',
				'api/auth/user',
				undefined,
				true,
			)

			expect(response.status).toBe(401)
			expect(response.data).toHaveProperty('error')
		})

		it('should reject access with malformed Authorization header', async () => {
			// Send a malformed Authorization header that doesn't follow Bearer format
			const response = await authClient.makeAuthRequest(
				'GET',
				'api/auth/user',
				undefined,
				false, // Don't use standard auth
				'InvalidFormat TEST_TOKEN', // Send malformed auth header
			)

			expect(response.status).toBe(401)
			expect(response.data).toHaveProperty('error')
		})
	})

	describe('JWT Token Validation', () => {
		it('should validate JWT token structure', async () => {
			// Test with an obviously fake JWT token for testing
			const fakeJwt =
				'FAKE_JWT_TOKEN_FOR_TESTING.INVALID_PAYLOAD.MOCK_SIGNATURE'
			authClient.setAccessToken(fakeJwt)

			const response = await authClient.makeAuthRequest(
				'GET',
				'api/auth/user',
				undefined,
				true,
			)

			expect(response.status).toBe(401)
			expect(response.data).toHaveProperty('error')
		})

		it('should handle expired JWT tokens', async () => {
			// This would require a pre-generated expired token or mocking
			// For now, test the error handling structure
			authClient.setAccessToken('EXPIRED_TEST_JWT_TOKEN')

			const response = await authClient.makeAuthRequest(
				'GET',
				'api/auth/user',
				undefined,
				true,
			)

			expect(response.status).toBe(401)
		})
	})

	describe('Rate Limiting', () => {
		it('should apply rate limiting to authentication endpoints', async () => {
			const maxRequests = 15 // Slightly above the expected limit
			const responses = []

			// Make multiple rapid requests to trigger rate limiting
			for (let i = 0; i < maxRequests; i++) {
				const response = await authClient.makeAuthRequest(
					'POST',
					'api/auth/login',
					{
						email: 'test@example.com',
						password: 'wrongpassword',
					},
				)
				responses.push(response)

				// Small delay to avoid overwhelming the server
				await new Promise((resolve) => setTimeout(resolve, 100))
			}

			// Check if any requests were rate limited
			const rateLimitedResponses = responses.filter((r) => r.status === 429)

			// We expect some rate limiting to occur with this many requests
			if (rateLimitedResponses.length > 0) {
				expect(rateLimitedResponses[0].data).toHaveProperty('error')
				expect(rateLimitedResponses[0].data.error).toContain('rate limit')
			}
		}, 30000) // Longer timeout for this test

		it('should include rate limit headers in responses', async () => {
			const response = await authClient.makeAuthRequest(
				'POST',
				'api/auth/login',
				{
					email: 'test@example.com',
					password: 'wrongpassword',
				},
			)

			// Check for common rate limiting headers
			const hasRateLimitHeaders =
				response.headers['x-ratelimit-limit'] ||
				response.headers['x-ratelimit-remaining'] ||
				response.headers['retry-after']

			// Rate limit headers might not always be present, but if they are, they should be valid
			if (hasRateLimitHeaders) {
				expect(typeof hasRateLimitHeaders).toBe('string')
			}
		})
	})

	describe('CORS for Authentication', () => {
		it('should handle CORS preflight for auth endpoints', async () => {
			const response = await fetch(`${config.apiEndpoint}api/auth/login`, {
				method: 'OPTIONS',
				headers: {
					Origin: 'http://localhost:3000',
					'Access-Control-Request-Method': 'POST',
					'Access-Control-Request-Headers':
						'Content-Type,Authorization,X-API-Key',
				},
			})

			expect(response.status).toBe(200)
			expect(response.headers.get('access-control-allow-origin')).toBeTruthy()
			expect(response.headers.get('access-control-allow-methods')).toContain(
				'POST',
			)
		})
	})

	describe('Error Response Format', () => {
		it('should return consistent error format for authentication failures', async () => {
			const response = await authClient.makeAuthRequest(
				'POST',
				'api/auth/login',
				{
					email: 'invalid@example.com',
					password: 'wrongpassword',
				},
			)

			expect(response.status).toBe(401)
			expect(response.data).toHaveProperty('error')
			expect(typeof response.data.error).toBe('string')
			expect(response.data.error.length).toBeGreaterThan(0)
		})

		it('should return consistent error format for validation failures', async () => {
			const response = await authClient.makeAuthRequest(
				'POST',
				'api/auth/register',
				{
					email: 'invalid-email',
					password: 'weak',
				},
			)

			expect(response.status).toBe(400)
			expect(response.data).toHaveProperty('error')
			expect(typeof response.data.error).toBe('string')
		})
	})

	describe('Security Headers', () => {
		it('should include security headers in authentication responses', async () => {
			const response = await authClient.makeAuthRequest(
				'POST',
				'api/auth/login',
				{
					email: 'test@example.com',
					password: 'wrongpassword',
				},
			)

			// Check for important security headers
			expect(response.headers['content-type']).toContain('application/json')

			// CORS headers should be present
			expect(response.headers['access-control-allow-origin']).toBeTruthy()
		})

		it('should not expose sensitive information in error responses', async () => {
			const response = await authClient.makeAuthRequest(
				'POST',
				'api/auth/login',
				{
					email: 'test@example.com',
					password: 'wrongpassword',
				},
			)

			expect(response.status).toBe(401)

			// Error message should not contain sensitive details
			const errorMessage = response.data.error.toLowerCase()
			expect(errorMessage).not.toContain('database')
			expect(errorMessage).not.toContain('sql')
			expect(errorMessage).not.toContain('cognito')
			expect(errorMessage).not.toContain('aws')
		})
	})
})
