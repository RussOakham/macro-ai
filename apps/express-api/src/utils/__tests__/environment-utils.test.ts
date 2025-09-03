
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { mockLogger } from '../test-helpers/logger.mock.ts'

// Mock the logger
vi.mock('../../../utils/logger.ts', () => ({
	logger: mockLogger.create(),
	pino: mockLogger.createPinoHttp(),
}))

import {
	getCurrentEnvironment,
	getCurrentParameterStorePrefix,
	getEnvironmentDisplayName,
	getParameterStorePrefix,
	isPreviewEnvironment,
} from '../environment-utils.ts'

describe('Environment Utils', () => {
	const originalEnv = process.env

	beforeEach(() => {
		// Clear environment variables before each test
		process.env = { ...originalEnv }
		// Clear mock calls
		vi.clearAllMocks()
	})

	afterEach(() => {
		// Restore original environment variables
		process.env = originalEnv
	})

	describe('getParameterStorePrefix', () => {
		it('should return development prefix for development environment', () => {
			expect(getParameterStorePrefix('development')).toBe(
				'/macro-ai/development/',
			)
		})

		it('should return staging prefix for staging environment', () => {
			expect(getParameterStorePrefix('staging')).toBe('/macro-ai/staging/')
		})

		it('should return production prefix for production environment', () => {
			expect(getParameterStorePrefix('production')).toBe(
				'/macro-ai/production/',
			)
		})

		it('should return development prefix for test environment', () => {
			expect(getParameterStorePrefix('test')).toBe('/macro-ai/development/')
		})

		it('should return development prefix for preview environments (pr-*)', () => {
			expect(getParameterStorePrefix('pr-123')).toBe('/macro-ai/development/')
			expect(getParameterStorePrefix('pr-456')).toBe('/macro-ai/development/')
			expect(getParameterStorePrefix('pr-999')).toBe('/macro-ai/development/')
		})

		it('should return development prefix for unknown environments', () => {
			expect(getParameterStorePrefix('unknown')).toBe('/macro-ai/development/')
		})
	})

	describe('getCurrentEnvironment', () => {
		it('should return APP_ENV value when set', () => {
			process.env.APP_ENV = 'staging'
			expect(getCurrentEnvironment()).toBe('staging')
		})

		it('should throw error when APP_ENV is not set', () => {
			delete process.env.APP_ENV
			expect(() => getCurrentEnvironment()).toThrow(
				'APP_ENV environment variable is required',
			)
		})

		it('should handle preview environment values', () => {
			process.env.APP_ENV = 'pr-123'
			expect(getCurrentEnvironment()).toBe('pr-123')
		})
	})

	describe('getCurrentParameterStorePrefix', () => {
		it('should return correct prefix for development environment', () => {
			process.env.APP_ENV = 'development'
			expect(getCurrentParameterStorePrefix()).toBe('/macro-ai/development/')
		})

		it('should return correct prefix for staging environment', () => {
			process.env.APP_ENV = 'staging'
			expect(getCurrentParameterStorePrefix()).toBe('/macro-ai/staging/')
		})

		it('should return correct prefix for production environment', () => {
			process.env.APP_ENV = 'production'
			expect(getCurrentParameterStorePrefix()).toBe('/macro-ai/production/')
		})

		it('should return development prefix for preview environments', () => {
			process.env.APP_ENV = 'pr-123'
			expect(getCurrentParameterStorePrefix()).toBe('/macro-ai/development/')
		})

		it('should throw error when APP_ENV is not set', () => {
			delete process.env.APP_ENV
			expect(() => getCurrentParameterStorePrefix()).toThrow(
				'APP_ENV environment variable is required',
			)
		})
	})

	describe('isPreviewEnvironment', () => {
		it('should return true for preview environments', () => {
			expect(isPreviewEnvironment('pr-123')).toBe(true)
			expect(isPreviewEnvironment('pr-456')).toBe(true)
			expect(isPreviewEnvironment('pr-999')).toBe(true)
		})

		it('should return false for non-preview environments', () => {
			expect(isPreviewEnvironment('development')).toBe(false)
			expect(isPreviewEnvironment('staging')).toBe(false)
			expect(isPreviewEnvironment('production')).toBe(false)
			expect(isPreviewEnvironment('test')).toBe(false)
			expect(isPreviewEnvironment('unknown')).toBe(false)
		})

		it('should provide proper type narrowing', () => {
			const env = 'pr-123' as string
			if (isPreviewEnvironment(env)) {
				// TypeScript should know this is `pr-${number}` here
				expect(env).toBe('pr-123')
			}
		})
	})

	describe('getEnvironmentDisplayName', () => {
		it('should return capitalized names for standard environments', () => {
			expect(getEnvironmentDisplayName('development')).toBe('Development')
			expect(getEnvironmentDisplayName('staging')).toBe('Staging')
			expect(getEnvironmentDisplayName('production')).toBe('Production')
			expect(getEnvironmentDisplayName('test')).toBe('Test')
		})

		it('should return preview format for preview environments', () => {
			expect(getEnvironmentDisplayName('pr-123')).toBe('Preview (pr-123)')
			expect(getEnvironmentDisplayName('pr-456')).toBe('Preview (pr-456)')
		})

		it('should handle empty string gracefully', () => {
			expect(getEnvironmentDisplayName('')).toBe('')
		})
	})

	describe('Integration scenarios', () => {
		it('should handle complete preview environment workflow', () => {
			process.env.APP_ENV = 'pr-789'

			const currentEnv = getCurrentEnvironment()
			expect(currentEnv).toBe('pr-789')

			expect(isPreviewEnvironment(currentEnv)).toBe(true)

			const prefix = getCurrentParameterStorePrefix()
			expect(prefix).toBe('/macro-ai/development/')

			const displayName = getEnvironmentDisplayName(currentEnv)
			expect(displayName).toBe('Preview (pr-789)')
		})

		it('should handle production environment workflow', () => {
			process.env.APP_ENV = 'production'

			const currentEnv = getCurrentEnvironment()
			expect(currentEnv).toBe('production')

			expect(isPreviewEnvironment(currentEnv)).toBe(false)

			const prefix = getCurrentParameterStorePrefix()
			expect(prefix).toBe('/macro-ai/production/')

			const displayName = getEnvironmentDisplayName(currentEnv)
			expect(displayName).toBe('Production')
		})
	})
})
