import { AxiosInstance } from 'axios'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { applyTokenRefreshInterceptors } from '../interceptors'

// Mock the auth service
vi.mock('@/services/network/auth/postRefreshToken', () => ({
	postRefreshToken: vi.fn(),
}))

describe('Token Refresh Interceptors', () => {
	let mockAxiosInstance: AxiosInstance
	let mockClient: { axios: AxiosInstance }

	beforeEach(() => {
		vi.clearAllMocks()

		mockAxiosInstance = {
			interceptors: {
				response: {
					use: vi.fn(),
				},
			},
		} as unknown as AxiosInstance

		mockClient = {
			axios: mockAxiosInstance,
		}
	})

	it('should apply interceptors to a client', () => {
		applyTokenRefreshInterceptors(mockClient)

		expect(mockAxiosInstance.interceptors.response.use).toHaveBeenCalledTimes(1)
		expect(mockAxiosInstance.interceptors.response.use).toHaveBeenCalledWith(
			expect.any(Function),
			expect.any(Function),
		)
	})

	it('should accept clients with axios instance', () => {
		expect(() => {
			applyTokenRefreshInterceptors(mockClient)
		}).not.toThrow()
	})

	it('should have consistent interceptor behavior across all clients', () => {
		const authClient = { axios: mockAxiosInstance }
		const chatClient = { axios: mockAxiosInstance }
		const userClient = { axios: mockAxiosInstance }

		// Apply interceptors to all clients
		applyTokenRefreshInterceptors(authClient)
		applyTokenRefreshInterceptors(chatClient)
		applyTokenRefreshInterceptors(userClient)

		// Each client should have interceptors applied
		expect(mockAxiosInstance.interceptors.response.use).toHaveBeenCalledTimes(3)
	})

	it('should handle clients without axios instance gracefully', () => {
		const invalidClient = {} as { axios: AxiosInstance }

		expect(() => {
			applyTokenRefreshInterceptors(invalidClient)
		}).toThrow()
	})
})
