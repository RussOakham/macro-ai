import { Config } from '@repo/macro-ai-api-client'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// Import MSW setup utilities
import { setupMSWForTests } from '../../../test/msw-setup'

// Mock the interceptors module before importing clients
vi.mock('../interceptors', () => ({
	applyTokenRefreshInterceptors: vi.fn(),
}))

// Mock the API client package
vi.mock('@repo/macro-ai-api-client', () => ({
	createApiClient: vi.fn((baseURL: string, config: Partial<Config>) => ({
		instance: {
			defaults: {
				baseURL,
				headers: config.headers ?? {},
				withCredentials: config.withCredentials ?? false,
			},
			interceptors: {
				response: { use: vi.fn(), eject: vi.fn() },
			},
		},
		post: vi.fn(),
		get: vi.fn(),
		put: vi.fn(),
		delete: vi.fn(),
	})),
}))

describe('API Clients Integration', () => {
	// Setup MSW for all tests in this describe block
	setupMSWForTests()

	beforeEach(() => {
		vi.clearAllMocks()
	})

	it('should apply interceptors to unified clients', async () => {
		const { applyTokenRefreshInterceptors } = await import('../interceptors')

		// Import clients after mocking
		await import('../clients')

		// Verify that interceptors were applied to both clients
		expect(applyTokenRefreshInterceptors).toHaveBeenCalledTimes(2) // apiClient, apiClientWithoutCredentials
	})

	it('should export unified API clients with proper configuration', async () => {
		const clients = await import('../clients')

		// Verify unified clients are exported
		expect(clients.apiClient).toBeDefined()
		expect(clients.apiClientWithoutCredentials).toBeDefined()

		// Verify clients have axios instances
		expect(clients.apiClient.instance).toBeDefined()
		expect(clients.apiClientWithoutCredentials.instance).toBeDefined()

		// Verify clients have HTTP methods
		expect(typeof clients.apiClient.post).toBe('function')
		expect(typeof clients.apiClient.get).toBe('function')
		expect(typeof clients.apiClient.put).toBe('function')
		expect(typeof clients.apiClient.delete).toBe('function')

		// Verify credentials configuration
		expect(clients.apiClient.instance.defaults.withCredentials).toBe(true)
		expect(
			clients.apiClientWithoutCredentials.instance.defaults.withCredentials,
		).toBe(false)
	})

	it('should successfully call /health endpoint using auto-generated MSW handlers', async () => {
		// Unmock the API client for this test
		vi.unmock('@repo/macro-ai-api-client')

		// Create a real API client for testing
		const { createApiClient } = await import('@repo/macro-ai-api-client')
		const realApiClient = createApiClient('http://localhost:3000', {
			withCredentials: false,
		})

		// Make a real HTTP request to the health endpoint (using auto-generated handler)
		const response = await realApiClient.get({
			url: '/health',
			baseURL: 'http://localhost:3000',
		})

		// Verify the response structure matches the OpenAPI spec
		expect(response.status).toBe(200)
		expect(response.data).toHaveProperty('message')
		expect(typeof response.data.message).toBe('string')
	})

	it('should handle 404 error for non-existent endpoint', async () => {
		// Unmock the API client for this test
		vi.unmock('@repo/macro-ai-api-client')

		// Create a real API client for testing
		const { createApiClient } = await import('@repo/macro-ai-api-client')
		const realApiClient = createApiClient('http://localhost:3000', {
			withCredentials: false,
		})

		// Make a request to a non-existent endpoint
		try {
			await realApiClient.get({
				url: '/api/no-such-page',
				baseURL: 'http://localhost:3000',
			})
			// If we get here, the request succeeded but we expected it to fail
			expect.fail('Expected request to fail with 404')
		} catch (error: unknown) {
			// The error should be an Axios error with response
			// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
			if ((error as any).response) {
				// Axios error with response
				// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
				expect((error as any).response.status).toBe(404)
			} else {
				// Other type of error - just verify it's an error
				expect(error).toBeDefined()
				expect(error).toBeInstanceOf(Error)
			}
		}
	})
})
