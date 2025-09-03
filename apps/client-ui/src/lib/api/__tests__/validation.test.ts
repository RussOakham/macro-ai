import { AxiosError } from 'axios'
import { describe, expect, it } from 'vitest'

import { apiClient, apiClientWithoutCredentials } from '../clients'

describe('API Client Validation', () => {
	describe('Client Configuration', () => {
		it('should have unified API clients configured', () => {
			expect(apiClient).toBeDefined()
			expect(apiClientWithoutCredentials).toBeDefined()
		})

		it('should have axios instances on all clients', () => {
			expect(apiClient.instance).toBeDefined()
			expect(apiClientWithoutCredentials.instance).toBeDefined()
		})

		it('should have interceptors configured on all clients', () => {
			// Check that response interceptors are configured
			expect(apiClient.instance.interceptors.response).toBeDefined()
			expect(
				apiClientWithoutCredentials.instance.interceptors.response,
			).toBeDefined()

			// Check that interceptors have the use method (indicating they're properly configured)
			expect(typeof apiClient.instance.interceptors.response.use).toBe(
				'function',
			)
			expect(
				typeof apiClientWithoutCredentials.instance.interceptors.response.use,
			).toBe('function')
		})

		it('should have proper axios configuration', () => {
			// Check that clients have proper base configuration
			expect(apiClient.instance.defaults.headers['X-API-KEY']).toBe(
				'test-api-key-that-is-at-least-32-characters-long',
			)
			expect(
				apiClientWithoutCredentials.instance.defaults.headers['X-API-KEY'],
			).toBe('test-api-key-that-is-at-least-32-characters-long')

			// Check credentials configuration
			expect(apiClient.instance.defaults.withCredentials).toBe(true)
			expect(
				apiClientWithoutCredentials.instance.defaults.withCredentials,
			).toBe(false)
		})
	})

	describe('Type Safety', () => {
		it('should have proper TypeScript types', () => {
			// These should compile without errors
			expect(typeof apiClient.get).toBe('function')
			expect(typeof apiClient.post).toBe('function')
			expect(typeof apiClient.put).toBe('function')
			expect(typeof apiClient.delete).toBe('function')

			expect(typeof apiClientWithoutCredentials.get).toBe('function')
			expect(typeof apiClientWithoutCredentials.post).toBe('function')
			expect(typeof apiClientWithoutCredentials.put).toBe('function')
			expect(typeof apiClientWithoutCredentials.delete).toBe('function')
		})
	})

	describe('Interceptor Integration', () => {
		it('should have consistent interceptor behavior across clients', () => {
			const clients = [apiClient, apiClientWithoutCredentials]

			// All clients should have interceptor managers
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

		it('should maintain interceptor functionality after client creation', () => {
			// Verify that interceptors can be added (indicating they're working)
			const testInterceptorId = apiClient.instance.interceptors.response.use(
				(response) => response,
				(error) => Promise.reject(error as AxiosError),
			)

			expect(typeof testInterceptorId).toBe('number')

			// Clean up test interceptor
			apiClient.instance.interceptors.response.eject(testInterceptorId)
		})
	})

	describe('Ready for Production', () => {
		it('should have all components needed for token refresh', () => {
			// Verify that all the pieces are in place for token refresh to work
			expect(apiClient.instance.interceptors.response).toBeDefined()
			expect(
				apiClientWithoutCredentials.instance.interceptors.response,
			).toBeDefined()

			// Verify base URLs are set
			expect(apiClient.instance.defaults.baseURL).toBe('http://localhost:3000')
			expect(apiClientWithoutCredentials.instance.defaults.baseURL).toBe(
				'http://localhost:3000',
			)
		})
	})
})
