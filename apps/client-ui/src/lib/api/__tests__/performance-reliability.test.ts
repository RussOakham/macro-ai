import { describe, expect, it } from 'vitest'

import { authClient, chatClient, userClient } from '../clients'

describe('Performance and Reliability Tests', () => {
	describe('Client Stability', () => {
		it('should maintain stable client instances', () => {
			// Verify clients are properly instantiated
			expect(authClient).toBeDefined()
			expect(chatClient).toBeDefined()
			expect(userClient).toBeDefined()

			// Verify they have axios instances
			expect(authClient.axios).toBeDefined()
			expect(chatClient.axios).toBeDefined()
			expect(userClient.axios).toBeDefined()
		})

		it('should have consistent interceptor configuration', () => {
			const clients = [authClient, chatClient, userClient]

			clients.forEach((client) => {
				expect(client.axios.interceptors.response).toBeDefined()
				expect(typeof client.axios.interceptors.response.use).toBe('function')
				expect(typeof client.axios.interceptors.response.eject).toBe('function')
			})
		})

		it('should have proper base configuration', () => {
			const clients = [authClient, chatClient, userClient]

			clients.forEach((client) => {
				expect(client.axios.defaults.baseURL).toBe('http://localhost:3000')
				expect(client.axios.defaults.headers['X-API-KEY']).toBe('test-api-key')
				expect(client.axios.defaults.withCredentials).toBe(true)
			})
		})

		it('should support interceptor management', () => {
			// Test that we can add and remove interceptors
			const testInterceptorId = authClient.axios.interceptors.response.use(
				(response) => response,
				(error) => Promise.reject(new Error(String(error))),
			)

			expect(typeof testInterceptorId).toBe('number')

			// Clean up
			authClient.axios.interceptors.response.eject(testInterceptorId)
		})
	})
})
