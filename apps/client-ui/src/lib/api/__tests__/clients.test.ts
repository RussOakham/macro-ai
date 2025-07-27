import { beforeEach, describe, expect, it, vi } from 'vitest'

// Mock the interceptors module before importing clients
vi.mock('../interceptors', () => ({
	applyTokenRefreshInterceptors: vi.fn(),
}))

// Mock the API client package
vi.mock('@repo/macro-ai-api-client', () => ({
	createAuthClient: vi.fn(() => ({
		axios: {
			interceptors: {
				response: { use: vi.fn() },
			},
		},
	})),
	createChatClient: vi.fn(() => ({
		axios: {
			interceptors: {
				response: { use: vi.fn() },
			},
		},
	})),
	createUserClient: vi.fn(() => ({
		axios: {
			interceptors: {
				response: { use: vi.fn() },
			},
		},
	})),
}))

describe('API Clients Integration', () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	it('should apply interceptors to all modular clients', async () => {
		const { applyTokenRefreshInterceptors } = await import('../interceptors')

		// Import clients after mocking
		await import('../clients')

		// Verify that interceptors were applied to all clients
		expect(applyTokenRefreshInterceptors).toHaveBeenCalledTimes(4) // auth, chat, user, authWithoutCredentials
	})

	it('should export all required clients', async () => {
		const clients = await import('../clients')

		// Verify all clients are exported
		expect(clients.authClient).toBeDefined()
		expect(clients.chatClient).toBeDefined()
		expect(clients.userClient).toBeDefined()
		expect(clients.authClientWithoutCredentials).toBeDefined()

		// Verify clients have axios instances
		expect(clients.authClient.axios).toBeDefined()
		expect(clients.chatClient.axios).toBeDefined()
		expect(clients.userClient.axios).toBeDefined()
		expect(clients.authClientWithoutCredentials.axios).toBeDefined()
	})
})
