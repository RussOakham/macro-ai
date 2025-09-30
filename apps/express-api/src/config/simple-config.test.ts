/**
 * Unit tests for simple-config.ts
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { assertConfig } from './simple-config.ts'

describe('Simple Config System', () => {
	const originalEnv = process.env

	beforeEach(() => {
		// Clear environment completely
		process.env = {}
	})

	afterEach(() => {
		// Restore original environment
		process.env = originalEnv
	})

	describe('assertConfig with skip validation', () => {
		it('should return minimal config when SKIP_CONFIG_VALIDATION=true', async () => {
			// Set the skip validation flag
			process.env.SKIP_CONFIG_VALIDATION = 'true'

			const config = await assertConfig(false)

			// Should return a config object with minimal/default values
			expect(config).toBeDefined()
			expect(typeof config).toBe('object')
			expect(config.nodeEnv).toBe('development') // default
			expect(config.appEnv).toBe('development') // default
		})

		it('should validate normally when SKIP_CONFIG_VALIDATION is not set', async () => {
			// Ensure SKIP_CONFIG_VALIDATION is not set
			delete process.env.SKIP_CONFIG_VALIDATION

			// This should fail because no environment variables are set
			await expect(assertConfig(false)).rejects.toThrow()
		})

		it('should validate normally when SKIP_CONFIG_VALIDATION=false', async () => {
			// Explicitly set to false
			process.env.SKIP_CONFIG_VALIDATION = 'false'

			// This should fail because no environment variables are set
			await expect(assertConfig(false)).rejects.toThrow()
		})

		it('should handle skipValidation parameter override', async () => {
			// Set environment variable to true, but pass undefined to function
			process.env.SKIP_CONFIG_VALIDATION = 'true'

			// This should skip validation because env var is set and param is undefined
			const config = await assertConfig(false)
			expect(config).toBeDefined()
		})

		it('should prioritize function parameter over environment variable', async () => {
			// Set environment variable to false, but pass true to function
			process.env.SKIP_CONFIG_VALIDATION = 'false'

			// This should skip validation because function parameter takes precedence
			const config = await assertConfig(false, true)

			expect(config).toBeDefined()
			expect(typeof config).toBe('object')
		})

		it('should override environment variable when explicitly passing false', async () => {
			// Set environment variable to true, but explicitly pass false to function
			process.env.SKIP_CONFIG_VALIDATION = 'true'

			// This should validate and fail because function parameter overrides env var
			await expect(assertConfig(false, false)).rejects.toThrow()
		})
	})

	describe('minimal config structure', () => {
		it('should return all required config properties in minimal mode', async () => {
			process.env.SKIP_CONFIG_VALIDATION = 'true'

			const config = await assertConfig(false)

			// Check that all required properties are present
			expect(config).toHaveProperty('apiKey')
			expect(config).toHaveProperty('nodeEnv')
			expect(config).toHaveProperty('appEnv')
			expect(config).toHaveProperty('port')
			expect(config).toHaveProperty('awsCognitoRegion')
			expect(config).toHaveProperty('awsCognitoUserPoolId')
			expect(config).toHaveProperty('awsCognitoUserPoolClientId')
			expect(config).toHaveProperty('awsCognitoRefreshTokenExpiry')
			expect(config).toHaveProperty('openaiApiKey')
			expect(config).toHaveProperty('relationalDatabaseUrl')
			expect(config).toHaveProperty('redisUrl')
			expect(config).toHaveProperty('cookieEncryptionKey')
			expect(config).toHaveProperty('cookieDomain')
		})

		it('should return valid data types for minimal config', async () => {
			process.env.SKIP_CONFIG_VALIDATION = 'true'

			const config = await assertConfig(false)

			// Check data types
			expect(typeof config.apiKey).toBe('string')
			expect(typeof config.nodeEnv).toBe('string')
			expect(typeof config.appEnv).toBe('string')
			expect(typeof config.port).toBe('number')
			expect(typeof config.awsCognitoRegion).toBe('string')
			expect(typeof config.awsCognitoRefreshTokenExpiry).toBe('number')
			expect(typeof config.openaiApiKey).toBe('string')
		})
	})
})
