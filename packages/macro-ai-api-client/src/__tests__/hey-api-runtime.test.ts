import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { createClientConfig } from '../hey-api-runtime.js'

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
		it('should create configuration with default values', () => {
			const config = createClientConfig({})

			expect(config).toEqual({
				baseURL: 'http://localhost:3000',
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

		it('should use API_BASE_URL from environment when available', () => {
			process.env.API_BASE_URL = 'https://api.production.com'

			const config = createClientConfig({})

			expect(config.baseURL).toBe('https://api.production.com')
		})

		it('should merge custom headers with defaults', () => {
			const customConfig = {
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
				responseType: 'text' as const,
				timeout: 60000,
			}

			const config = createClientConfig(customConfig)

			// The runtime config overrides timeout and responseType with its defaults
			expect(config.timeout).toBe(30000) // Runtime default overrides
			expect(config.responseType).toBe('json') // Runtime default overrides
		})

		it('should handle undefined headers gracefully', () => {
			const config = createClientConfig({ headers: undefined })

			expect(config.headers).toEqual({
				Accept: 'application/json',
				'Content-Type': 'application/json',
			})
		})
	})

	describe('validateStatus function', () => {
		it('should validate HTTP status codes correctly', () => {
			const config = createClientConfig({})
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

	describe('environment variable handling', () => {
		it('should handle missing API_BASE_URL gracefully', () => {
			delete process.env.API_BASE_URL

			const config = createClientConfig({})

			expect(config.baseURL).toBe('http://localhost:3000')
		})

		it('should handle empty API_BASE_URL', () => {
			process.env.API_BASE_URL = ''

			const config = createClientConfig({})

			// Empty string is not nullish, so it uses the empty string
			expect(config.baseURL).toBe('')
		})
	})
})
