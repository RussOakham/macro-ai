import { describe, expect, it } from 'vitest'

import { apiClient, apiClientWithoutCredentials } from '../clients'

describe('Performance and Reliability Tests', () => {
	describe('Client Stability', () => {
		it('should maintain stable client instances', () => {
			// Verify clients are properly instantiated
			expect(apiClient).toBeDefined()
			expect(apiClientWithoutCredentials).toBeDefined()

			// Verify they have axios instances
			expect(apiClient.instance).toBeDefined()
			expect(apiClientWithoutCredentials.instance).toBeDefined()
		})

		it('should have consistent interceptor configuration', () => {
			const clients = [apiClient, apiClientWithoutCredentials]

			clients.forEach((client) => {
				expect(client.instance.interceptors.response).toBeDefined()
				expect(typeof client.instance.interceptors.response.use).toBe(
					'function',
				)
				expect(typeof client.instance.interceptors.response.eject).toBe(
					'function',
				)
			})
		})

		it('should have proper base configuration', () => {
			// Test client with credentials
			expect(apiClient.instance.defaults.baseURL).toBe('http://localhost:3000')
			expect(apiClient.instance.defaults.headers['X-API-KEY']).toBe(
				'test-api-key-that-is-at-least-32-characters-long',
			)
			expect(apiClient.instance.defaults.withCredentials).toBe(true)

			// Test client without credentials
			expect(apiClientWithoutCredentials.instance.defaults.baseURL).toBe(
				'http://localhost:3000',
			)
			expect(
				apiClientWithoutCredentials.instance.defaults.headers['X-API-KEY'],
			).toBe('test-api-key-that-is-at-least-32-characters-long')
			expect(
				apiClientWithoutCredentials.instance.defaults.withCredentials,
			).toBe(false)
		})

		it('should support interceptor management', () => {
			// Test that we can add and remove interceptors
			const testInterceptorId = apiClient.instance.interceptors.response.use(
				(response) => response,
				(error) => Promise.reject(new Error(String(error))),
			)

			expect(typeof testInterceptorId).toBe('number')

			// Clean up
			apiClient.instance.interceptors.response.eject(testInterceptorId)
		})
	})
})
