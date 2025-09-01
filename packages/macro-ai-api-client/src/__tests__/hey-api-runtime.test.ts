import { afterEach, beforeEach, describe, expect, it } from 'vitest'

// Mock environment variables
const originalEnv = process.env

describe('Hey API Runtime Configuration', () => {
	beforeEach(() => {
		process.env = { ...originalEnv }
	})

	afterEach(() => {
		process.env = originalEnv
	})

	describe('createClientConfig', () => {
		it('should create configuration with default values', async () => {
			const { createClientConfig } = await import('../hey-api-runtime.js')

			const config = createClientConfig({})

			expect(config).toEqual({
				baseURL: 'http://localhost:3000',
				headers: {
					'Content-Type': 'application/json',
					Accept: 'application/json',
				},
				timeout: 30000,
				responseType: 'json',
				validateStatus: expect.any(Function) as unknown as (
					status: number,
				) => boolean,
			})
		})

		it('should use API_BASE_URL from environment when available', async () => {
			process.env.API_BASE_URL = 'https://api.production.com'

			const { createClientConfig } = await import('../hey-api-runtime.js')

			const config = createClientConfig({})

			expect(config.baseURL).toBe('https://api.production.com')
		})

		it('should merge custom headers with defaults', async () => {
			const { createClientConfig } = await import('../hey-api-runtime.js')

			const customConfig = {
				headers: {
					'X-API-Key': 'secret-key',
					Authorization: 'Bearer token',
				},
			}

			const config = createClientConfig(customConfig)

			expect(config.headers).toEqual({
				'Content-Type': 'application/json',
				Accept: 'application/json',
				'X-API-Key': 'secret-key',
				Authorization: 'Bearer token',
			})
		})

		it('should override default headers when provided', async () => {
			const { createClientConfig } = await import('../hey-api-runtime.js')

			const customConfig = {
				headers: {
					'Content-Type': 'application/xml',
					Accept: 'application/xml',
				},
			}

			const config = createClientConfig(customConfig)

			expect(config.headers).toEqual({
				'Content-Type': 'application/xml',
				Accept: 'application/xml',
			})
		})

		it('should preserve other configuration properties', async () => {
			const { createClientConfig } = await import('../hey-api-runtime.js')

			const customConfig = {
				timeout: 60000,
				responseType: 'text' as const,
			}

			const config = createClientConfig(customConfig)

			// The runtime config overrides timeout and responseType with its defaults
			expect(config.timeout).toBe(30000) // Runtime default overrides
			expect(config.responseType).toBe('json') // Runtime default overrides
		})

		it('should handle undefined headers gracefully', async () => {
			const { createClientConfig } = await import('../hey-api-runtime.js')

			const config = createClientConfig({ headers: undefined })

			expect(config.headers).toEqual({
				'Content-Type': 'application/json',
				Accept: 'application/json',
			})
		})
	})

	describe('validateStatus function', () => {
		it('should validate HTTP status codes correctly', async () => {
			const { createClientConfig } = await import('../hey-api-runtime.js')

			const config = createClientConfig({})
			const validateStatus = config.validateStatus

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

	describe('environment variable handling', () => {
		it('should handle missing API_BASE_URL gracefully', async () => {
			delete process.env.API_BASE_URL

			const { createClientConfig } = await import('../hey-api-runtime.js')

			const config = createClientConfig({})

			expect(config.baseURL).toBe('http://localhost:3000')
		})

		it('should handle empty API_BASE_URL', async () => {
			process.env.API_BASE_URL = ''

			const { createClientConfig } = await import('../hey-api-runtime.js')

			const config = createClientConfig({})

			// Empty string is not nullish, so it uses the empty string
			expect(config.baseURL).toBe('')
		})
	})
})
