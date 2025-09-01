import { Config } from '@repo/macro-ai-api-client'
import { beforeEach, describe, expect, it, vi } from 'vitest'

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
})
