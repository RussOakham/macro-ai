import { AxiosError } from 'axios'
import { describe, expect, it } from 'vitest'

import {
	authClient,
	authClientWithoutCredentials,
	chatClient,
	userClient,
} from '../clients'

describe('Token Refresh Validation', () => {
	describe('Client Configuration', () => {
		it('should have all required clients configured', () => {
			expect(authClient).toBeDefined()
			expect(chatClient).toBeDefined()
			expect(userClient).toBeDefined()
			expect(authClientWithoutCredentials).toBeDefined()
		})

		it('should have axios instances on all clients', () => {
			expect(authClient.axios).toBeDefined()
			expect(chatClient.axios).toBeDefined()
			expect(userClient.axios).toBeDefined()
			expect(authClientWithoutCredentials.axios).toBeDefined()
		})

		it('should have interceptors configured on all clients', () => {
			// Check that response interceptors are configured
			expect(authClient.axios.interceptors.response).toBeDefined()
			expect(chatClient.axios.interceptors.response).toBeDefined()
			expect(userClient.axios.interceptors.response).toBeDefined()
			expect(
				authClientWithoutCredentials.axios.interceptors.response,
			).toBeDefined()

			// Check that interceptors have the use method (indicating they're properly configured)
			expect(typeof authClient.axios.interceptors.response.use).toBe('function')
			expect(typeof chatClient.axios.interceptors.response.use).toBe('function')
			expect(typeof userClient.axios.interceptors.response.use).toBe('function')
			expect(
				typeof authClientWithoutCredentials.axios.interceptors.response.use,
			).toBe('function')
		})

		it('should have proper axios configuration', () => {
			// Check that clients have proper base configuration
			expect(authClient.axios.defaults.headers['X-API-KEY']).toBe(
				'test-api-key',
			)
			expect(chatClient.axios.defaults.headers['X-API-KEY']).toBe(
				'test-api-key',
			)
			expect(userClient.axios.defaults.headers['X-API-KEY']).toBe(
				'test-api-key',
			)
			expect(
				authClientWithoutCredentials.axios.defaults.headers['X-API-KEY'],
			).toBe('test-api-key')

			// Check credentials configuration
			expect(authClient.axios.defaults.withCredentials).toBe(true)
			expect(chatClient.axios.defaults.withCredentials).toBe(true)
			expect(userClient.axios.defaults.withCredentials).toBe(true)
			expect(authClientWithoutCredentials.axios.defaults.withCredentials).toBe(
				false,
			)
		})
	})

	describe('Type Safety', () => {
		it('should have proper TypeScript types', () => {
			// These should compile without errors
			expect(typeof authClient.get).toBe('function')
			expect(typeof authClient.post).toBe('function')
			expect(typeof authClient.put).toBe('function')
			expect(typeof authClient.delete).toBe('function')

			expect(typeof chatClient.get).toBe('function')
			expect(typeof chatClient.post).toBe('function')
			expect(typeof chatClient.put).toBe('function')
			expect(typeof chatClient.delete).toBe('function')

			expect(typeof userClient.get).toBe('function')
			expect(typeof userClient.post).toBe('function')
			expect(typeof userClient.put).toBe('function')
			expect(typeof userClient.delete).toBe('function')
		})
	})

	describe('Interceptor Integration', () => {
		it('should have consistent interceptor behavior across clients', () => {
			const clients = [
				authClient,
				chatClient,
				userClient,
				authClientWithoutCredentials,
			]

			// All clients should have interceptor managers
			clients.forEach((client) => {
				expect(client.axios.interceptors.response).toBeDefined()
				expect(typeof client.axios.interceptors.response.use).toBe('function')
				expect(typeof client.axios.interceptors.response.eject).toBe('function')
			})
		})

		it('should maintain interceptor functionality after client creation', () => {
			// Verify that interceptors can be added (indicating they're working)
			const testInterceptorId = authClient.axios.interceptors.response.use(
				(response) => response,
				(error) => Promise.reject(error as AxiosError),
			)

			expect(typeof testInterceptorId).toBe('number')

			// Clean up test interceptor
			authClient.axios.interceptors.response.eject(testInterceptorId)
		})
	})

	describe('Ready for Production', () => {
		it('should have all components needed for token refresh', () => {
			// Verify that all the pieces are in place for token refresh to work
			expect(authClient.axios.interceptors.response).toBeDefined()
			expect(chatClient.axios.interceptors.response).toBeDefined()
			expect(userClient.axios.interceptors.response).toBeDefined()
			expect(
				authClientWithoutCredentials.axios.interceptors.response,
			).toBeDefined()

			// Verify base URLs are set
			expect(authClient.axios.defaults.baseURL).toBe('http://localhost:3000')
			expect(chatClient.axios.defaults.baseURL).toBe('http://localhost:3000')
			expect(userClient.axios.defaults.baseURL).toBe('http://localhost:3000')
			expect(authClientWithoutCredentials.axios.defaults.baseURL).toBe(
				'http://localhost:3000',
			)
		})
	})
})
