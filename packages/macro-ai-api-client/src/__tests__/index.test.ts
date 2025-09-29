import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { Config } from '../client/client/types.gen.js'

// Mock the generated client modules
const mockCreateClient = vi.fn()
const mockCreateConfig = vi.fn()

vi.mock('../client/client/index.js', () => ({
	createClient: mockCreateClient,
	createConfig: mockCreateConfig,
}))

describe('API Client Package', () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	describe('createApiClient', () => {
		it('should create client with valid baseURL and default config', async () => {
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
					Accept: 'application/json',
					'Content-Type': 'application/json',
				},
				responseType: 'json',
				timeout: 30000,
				validateStatus: expect.any(Function) as unknown as (
					status: number,
				) => boolean,
			})
			expect(mockCreateClient).toHaveBeenCalledWith({
				baseURL: 'https://api.example.com',
			})
			expect(result).toBe(mockClient)
		})

		it('should throw error for invalid URL format', async () => {
			const { createApiClient } = await import('../index.js')

			expect(() => createApiClient('not-a-url')).toThrow(
				'baseURL validation failed',
			)
		})

		it('should throw error for empty string', async () => {
			const { createApiClient } = await import('../index.js')

			expect(() => createApiClient('')).toThrow('baseURL validation failed')
		})

		it('should throw error for undefined baseURL', async () => {
			const { createApiClient } = await import('../index.js')

			// @ts-expect-error Testing invalid input
			expect(() => createApiClient(undefined)).toThrow(
				'baseURL validation failed',
			)
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
				responseType: 'json',
				timeout: 60000,
				validateStatus: expect.any(Function) as unknown as (
					status: number,
				) => boolean,
			})
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
