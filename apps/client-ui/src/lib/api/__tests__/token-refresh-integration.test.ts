import { describe, expect, it } from 'vitest'

import { validateEnvironment } from '@/lib/validation/environment'

import {
	authClient,
	authClientWithoutCredentials,
	chatClient,
	userClient,
} from '../clients'

describe('Token Refresh Integration Tests', () => {
	describe('Client Integration', () => {
		it('should have all clients properly configured for token refresh', () => {
			const env = validateEnvironment()
			const clients = [
				authClient,
				chatClient,
				userClient,
				authClientWithoutCredentials,
			]

			clients.forEach((client) => {
				// Verify client has axios instance
				expect(client.axios).toBeDefined()

				// Verify interceptors are configured
				expect(client.axios.interceptors.response).toBeDefined()
				expect(typeof client.axios.interceptors.response.use).toBe('function')
				expect(typeof client.axios.interceptors.response.eject).toBe('function')

				// Verify base configuration
				expect(client.axios.defaults.baseURL).toBe(env.VITE_API_URL)
				expect(client.axios.defaults.headers['X-API-KEY']).toBe(
					env.VITE_API_KEY,
				)
			})
		})

		it('should have proper credentials configuration', () => {
			// Auth clients should have credentials enabled
			expect(authClient.axios.defaults.withCredentials).toBe(true)
			expect(chatClient.axios.defaults.withCredentials).toBe(true)
			expect(userClient.axios.defaults.withCredentials).toBe(true)

			// Auth client without credentials should have credentials disabled
			expect(authClientWithoutCredentials.axios.defaults.withCredentials).toBe(
				false,
			)
		})

		it('should support interceptor functionality', () => {
			// Test that interceptors can be added and removed
			const clients = [
				authClient,
				chatClient,
				userClient,
				authClientWithoutCredentials,
			]

			clients.forEach((client) => {
				const testInterceptorId = client.axios.interceptors.response.use(
					(response) => response,
					(error) => Promise.reject(new Error(String(error))),
				)

				expect(typeof testInterceptorId).toBe('number')

				// Clean up
				client.axios.interceptors.response.eject(testInterceptorId)
			})
		})
	})
})
