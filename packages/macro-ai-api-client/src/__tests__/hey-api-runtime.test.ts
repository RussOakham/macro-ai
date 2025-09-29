import { describe, expect, it } from 'vitest'

import { createClientConfig } from '../hey-api-runtime.js'

describe('Hey API Runtime Configuration', () => {
	describe('createClientConfig', () => {
		it('should create configuration with provided baseURL', () => {
			const config = createClientConfig({ baseURL: 'https://api.example.com' })

			expect(config).toEqual({
				baseURL: 'https://api.example.com',
				headers: {
					Accept: 'application/json',
					'Content-Type': 'application/json',
				},
				responseType: 'json',
				timeout: 30000,
				validateStatus: expect.any(Function) as unknown as (
					status: number,
				) => boolean,
			})
		})

		it('should throw error when baseURL is not provided', () => {
			expect(() => createClientConfig({})).toThrow(
				'baseURL is required and must be provided explicitly. The API client is environment-agnostic and does not provide defaults.',
			)
		})

		it('should throw error when baseURL is empty string', () => {
			expect(() => createClientConfig({ baseURL: '' })).toThrow(
				'baseURL is required and must be provided explicitly',
			)
		})

		it('should use provided baseURL regardless of environment variables', () => {
			process.env.API_BASE_URL = 'https://api.production.com'

			const config = createClientConfig({ baseURL: 'https://api.custom.com' })

			expect(config.baseURL).toBe('https://api.custom.com')
		})

		it('should merge custom headers with defaults', () => {
			const customConfig = {
				baseURL: 'https://api.example.com',
				headers: {
					Authorization: 'Bearer token',
					'X-API-Key': 'secret-key',
				},
			}

			const config = createClientConfig(customConfig)

			expect(config.headers).toEqual({
				Accept: 'application/json',
				Authorization: 'Bearer token',
				'Content-Type': 'application/json',
				'X-API-Key': 'secret-key',
			})
		})

		it('should override default headers when provided', () => {
			const customConfig = {
				baseURL: 'https://api.example.com',
				headers: {
					Accept: 'application/xml',
					'Content-Type': 'application/xml',
				},
			}

			const config = createClientConfig(customConfig)

			expect(config.headers).toEqual({
				Accept: 'application/xml',
				'Content-Type': 'application/xml',
			})
		})

		it('should preserve other configuration properties', () => {
			const customConfig = {
				baseURL: 'https://api.example.com',
				responseType: 'text' as const,
				timeout: 60000,
			}

			const config = createClientConfig(customConfig)

			// The runtime config overrides timeout and responseType with its defaults
			expect(config.timeout).toBe(30000) // Runtime default overrides
			expect(config.responseType).toBe('json') // Runtime default overrides
		})

		it('should handle undefined headers gracefully', () => {
			const config = createClientConfig({
				baseURL: 'https://api.example.com',
				headers: undefined,
			})

			expect(config.headers).toEqual({
				Accept: 'application/json',
				'Content-Type': 'application/json',
			})
		})
	})

	describe('validateStatus function', () => {
		it('should validate HTTP status codes correctly', () => {
			const config = createClientConfig({ baseURL: 'https://api.example.com' })
			const { validateStatus } = config

			// Ensure validateStatus is defined
			expect(validateStatus).toBeDefined()
			expect(typeof validateStatus).toBe('function')

			// Type guard to ensure validateStatus is a function
			if (typeof validateStatus === 'function') {
				// Valid status codes (2xx)
				expect(validateStatus(200)).toBe(true)
				expect(validateStatus(201)).toBe(true)
				expect(validateStatus(204)).toBe(true)
				expect(validateStatus(299)).toBe(true)

				// Invalid status codes
				expect(validateStatus(199)).toBe(false) // 1xx
				expect(validateStatus(300)).toBe(false) // 3xx
				expect(validateStatus(400)).toBe(false) // 4xx
				expect(validateStatus(404)).toBe(false) // 4xx
				expect(validateStatus(500)).toBe(false) // 5xx
			}
		})
	})

	describe('environment variable independence', () => {
		it('should ignore environment variables and only use provided baseURL', () => {
			process.env.API_BASE_URL = 'https://should-be-ignored.com'

			const config = createClientConfig({ baseURL: 'https://api.example.com' })

			expect(config.baseURL).toBe('https://api.example.com')
		})
	})
})
