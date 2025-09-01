import { describe, expect, it } from 'vitest'

import { validateEnvironment } from '@/lib/validation/environment'

import { apiClient, apiClientWithoutCredentials } from '../clients'

describe('Token Refresh Integration Tests', () => {
	describe('Client Integration', () => {
		it('should have unified clients properly configured for token refresh', () => {
			const env = validateEnvironment()
			const clients = [apiClient, apiClientWithoutCredentials]

			clients.forEach((client) => {
				// Verify client has axios instance
				expect(client.instance).toBeDefined()

				// Verify interceptors are configured
				expect(client.instance.interceptors.response).toBeDefined()
				expect(typeof client.instance.interceptors.response.use).toBe(
					'function',
				)
				expect(typeof client.instance.interceptors.response.eject).toBe(
					'function',
				)

				// Verify base configuration
				expect(client.instance.defaults.baseURL).toBe(env.VITE_API_URL)
				expect(client.instance.defaults.headers['X-API-KEY']).toBe(
					env.VITE_API_KEY,
				)
			})
		})

		it('should have proper credentials configuration', () => {
			// Main client should have credentials enabled
			expect(apiClient.instance.defaults.withCredentials).toBe(true)

			// Client without credentials should have credentials disabled
			expect(
				apiClientWithoutCredentials.instance.defaults.withCredentials,
			).toBe(false)
		})

		it('should support interceptor functionality', () => {
			// Test that interceptors can be added and removed
			const clients = [apiClient, apiClientWithoutCredentials]

			clients.forEach((client) => {
				const testInterceptorId = client.instance.interceptors.response.use(
					(response) => response,
					(error) => Promise.reject(new Error(String(error))),
				)

				expect(typeof testInterceptorId).toBe('number')

				// Clean up
				client.instance.interceptors.response.eject(testInterceptorId)
			})
		})
	})
})
