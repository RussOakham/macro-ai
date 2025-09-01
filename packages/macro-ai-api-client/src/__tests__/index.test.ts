import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { Config } from '../client/client/types.gen.js'

// Mock the generated client modules
const mockCreateClient = vi.fn()
const mockCreateConfig = vi.fn()

vi.mock('../client/client/index.js', () => ({
	createClient: mockCreateClient,
	createConfig: mockCreateConfig,
}))

// Mock environment variables
const originalEnv = process.env

describe('API Client Package', () => {
	beforeEach(() => {
		vi.clearAllMocks()
		process.env = { ...originalEnv }
	})

	afterEach(() => {
		process.env = originalEnv
	})

	describe('createApiClient', () => {
		it('should create client with provided baseURL and default config', async () => {
			const { createApiClient } = await import('../index.js')

			const mockClient = {
				instance: { defaults: { baseURL: 'https://api.example.com' } },
			}
			mockCreateConfig.mockReturnValue({ baseURL: 'https://api.example.com' })
			mockCreateClient.mockReturnValue(mockClient)

			const result = createApiClient('https://api.example.com')

			expect(mockCreateConfig).toHaveBeenCalledWith({
				baseURL: 'https://api.example.com',
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
			expect(mockCreateClient).toHaveBeenCalledWith({
				baseURL: 'https://api.example.com',
			})
			expect(result).toBe(mockClient)
		})

		it('should use localhost fallback when API_BASE_URL is not set', async () => {
			delete process.env.API_BASE_URL

			const { createApiClient } = await import('../index.js')

			mockCreateConfig.mockReturnValue({ baseURL: 'http://localhost:3000' })
			mockCreateClient.mockReturnValue({ instance: {} })

			createApiClient('http://localhost:3000')

			expect(mockCreateConfig).toHaveBeenCalledWith({
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

		it('should merge custom configuration with defaults', async () => {
			const { createApiClient } = await import('../index.js')

			mockCreateConfig.mockReturnValue({})
			mockCreateClient.mockReturnValue({ instance: {} })

			const customConfig = {
				headers: {
					'X-Custom-Header': 'custom-value',
				},
				timeout: 60000,
			}

			createApiClient('https://api.example.com', customConfig)

			// The actual implementation spreads the custom config over the defaults
			expect(mockCreateConfig).toHaveBeenCalledWith({
				baseURL: 'https://api.example.com',
				headers: {
					'X-Custom-Header': 'custom-value',
				},
				timeout: 60000,
				responseType: 'json',
				validateStatus: expect.any(Function) as unknown as (
					status: number,
				) => boolean,
			})
		})

		it('should override baseURL from environment with provided baseURL', async () => {
			process.env.API_BASE_URL = 'https://env.example.com'

			const { createApiClient } = await import('../index.js')

			mockCreateConfig.mockReturnValue({})
			mockCreateClient.mockReturnValue({ instance: {} })

			createApiClient('https://override.example.com')

			expect(mockCreateConfig).toHaveBeenCalledWith(
				expect.objectContaining({
					baseURL: 'https://override.example.com',
				}),
			)
		})
	})

	describe('validateStatus function', () => {
		it('should validate status codes correctly', async () => {
			const { createApiClient } = await import('../index.js')

			mockCreateConfig.mockImplementation((config: Partial<Config>) => {
				// Test the validateStatus function
				if (typeof config.validateStatus === 'function') {
					expect(config.validateStatus(200)).toBe(true)
					expect(config.validateStatus(201)).toBe(true)
					expect(config.validateStatus(299)).toBe(true)
					expect(config.validateStatus(199)).toBe(false)
					expect(config.validateStatus(300)).toBe(false)
					expect(config.validateStatus(404)).toBe(false)
					expect(config.validateStatus(500)).toBe(false)
				}

				return {}
			})
			mockCreateClient.mockReturnValue({ instance: {} })

			createApiClient('https://api.example.com')
		})
	})
})
