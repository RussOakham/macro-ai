import { beforeEach, describe, expect, it, vi } from 'vitest'

import { mockConfig } from '../config.mock.ts'

/**
 * Example test file demonstrating usage patterns for the config mock helper
 * This file shows practical examples of how to use the mock helper in real test scenarios
 */

// Mock the config module using the helper
vi.mock('../../../../config/default.ts', () => mockConfig.createModule())

// Import after mocking
import { config } from '../../../../config/default.ts'

// Example service that uses configuration
class ExampleConfigService {
	getApiConfig() {
		if (!config) throw new Error('Config not available')
		return {
			apiKey: config.apiKey,
			port: config.port,
			environment: config.nodeEnv,
		}
	}

	getCognitoConfig() {
		if (!config) throw new Error('Config not available')
		return {
			region: config.awsCognitoRegion,
			userPoolId: config.awsCognitoUserPoolId,
			clientId: config.awsCognitoUserPoolClientId,
			refreshTokenExpiry: config.awsCognitoRefreshTokenExpiry,
		}
	}

	getDatabaseConfig() {
		if (!config) throw new Error('Config not available')
		return {
			relational: config.relationalDatabaseUrl,
			nonRelational: config.nonRelationalDatabaseUrl,
		}
	}

	getRateLimitConfig() {
		if (!config) throw new Error('Config not available')
		return {
			windowMs: config.rateLimitWindowMs,
			maxRequests: config.rateLimitMaxRequests,
			authWindowMs: config.authRateLimitWindowMs,
			authMaxRequests: config.authRateLimitMaxRequests,
		}
	}

	isProduction() {
		if (!config) throw new Error('Config not available')
		return config.nodeEnv === 'production'
	}

	isDevelopment() {
		if (!config) throw new Error('Config not available')
		return config.nodeEnv === 'development'
	}

	isTest() {
		if (!config) throw new Error('Config not available')
		return config.nodeEnv === 'test'
	}
}

describe('Config Mock Helper - Usage Examples', () => {
	let exampleService: ExampleConfigService

	beforeEach(() => {
		// Setup fresh mocks for each test
		mockConfig.setup()
		exampleService = new ExampleConfigService()
	})

	describe('Basic Mock Usage', () => {
		it('should use default test configuration', () => {
			// Act
			const apiConfig = exampleService.getApiConfig()

			// Assert
			expect(apiConfig.apiKey).toBe('test-api-key-12345678901234567890')
			expect(apiConfig.port).toBe(3000)
			expect(apiConfig.environment).toBe('test')
		})

		it('should provide consistent default values', () => {
			// Act
			const cognitoConfig = exampleService.getCognitoConfig()

			// Assert
			expect(cognitoConfig.region).toBe('us-east-1')
			expect(cognitoConfig.userPoolId).toBe('test-pool-id')
			expect(cognitoConfig.clientId).toBe('test-client-id')
			expect(cognitoConfig.refreshTokenExpiry).toBe(30)
		})
	})

	describe('Environment-specific Configuration', () => {
		it('should demonstrate development environment config creation', () => {
			// Arrange
			const devConfig = mockConfig.development()

			// Assert
			expect(devConfig.config.nodeEnv).toBe('development')
			expect(devConfig.config.port).toBe(3001)
			// Should preserve other defaults
			expect(devConfig.config.apiKey).toBe('test-api-key-12345678901234567890')
		})

		it('should demonstrate production environment config creation', () => {
			// Arrange
			const prodConfig = mockConfig.production()

			// Assert
			expect(prodConfig.config.nodeEnv).toBe('production')
			expect(prodConfig.config.port).toBe(8080)
			// Should preserve other defaults
			expect(prodConfig.config.apiKey).toBe('test-api-key-12345678901234567890')
		})
	})

	describe('Feature-specific Configuration', () => {
		it('should demonstrate Cognito-specific config creation', () => {
			// Arrange
			const cognitoConfig = mockConfig.cognito({
				awsCognitoRegion: 'eu-west-1',
				awsCognitoRefreshTokenExpiry: 120,
			})

			// Assert
			expect(cognitoConfig.config.awsCognitoRegion).toBe('eu-west-1')
			expect(cognitoConfig.config.awsCognitoRefreshTokenExpiry).toBe(120)
			expect(cognitoConfig.config.awsCognitoUserPoolId).toBe(
				'cognito-test-pool-id',
			)
			// Should preserve other defaults
			expect(cognitoConfig.config.nodeEnv).toBe('test')
		})

		it('should demonstrate database-specific config creation', () => {
			// Arrange
			const databaseConfig = mockConfig.database({
				relationalDatabaseUrl: 'postgresql://custom:pass@localhost:5432/custom',
			})

			// Assert
			expect(databaseConfig.config.relationalDatabaseUrl).toBe(
				'postgresql://custom:pass@localhost:5432/custom',
			)
			expect(databaseConfig.config.nonRelationalDatabaseUrl).toBe(
				'mongodb://localhost:27017/testdb',
			)
			// Should preserve other defaults
			expect(databaseConfig.config.nodeEnv).toBe('test')
		})

		it('should demonstrate rate limiting-specific config creation', () => {
			// Arrange
			const rateLimitConfig = mockConfig.rateLimit({
				rateLimitMaxRequests: 50,
				authRateLimitMaxRequests: 20,
			})

			// Assert
			expect(rateLimitConfig.config.rateLimitMaxRequests).toBe(50)
			expect(rateLimitConfig.config.authRateLimitMaxRequests).toBe(20)
			expect(rateLimitConfig.config.rateLimitWindowMs).toBe(60000) // Default from rate limit config
			// Should preserve other defaults
			expect(rateLimitConfig.config.nodeEnv).toBe('test')
		})
	})

	describe('Custom Configuration Overrides', () => {
		it('should demonstrate custom config creation with overrides', () => {
			// Arrange
			const customConfig = mockConfig.create({
				apiKey: 'custom-test-api-key',
				port: 4000,
				nodeEnv: 'test',
				cookieDomain: 'test.example.com',
			})

			// Assert
			expect(customConfig.config.apiKey).toBe('custom-test-api-key')
			expect(customConfig.config.port).toBe(4000)
			expect(customConfig.config.nodeEnv).toBe('test')
			expect(customConfig.config.cookieDomain).toBe('test.example.com')
		})

		it('should preserve type safety with partial overrides', () => {
			// Arrange
			const partialConfig = mockConfig.create({
				awsCognitoRefreshTokenExpiry: 180,
				redisUrl: 'redis://test-redis:6379',
			})

			// Assert
			expect(partialConfig.config.awsCognitoRefreshTokenExpiry).toBe(180)
			expect(partialConfig.config.redisUrl).toBe('redis://test-redis:6379')
			// Should preserve other defaults
			expect(partialConfig.config.awsCognitoRegion).toBe('us-east-1')
			expect(partialConfig.config.nodeEnv).toBe('test')
		})
	})

	describe('Integration with Services', () => {
		it('should demonstrate how services can use mocked config', () => {
			// Arrange - This shows how the service uses the mocked config
			const apiConfig = exampleService.getApiConfig()
			const cognitoConfig = exampleService.getCognitoConfig()

			// Assert - Verify service can use the mocked config
			expect(apiConfig.apiKey).toBe('test-api-key-12345678901234567890')
			expect(apiConfig.port).toBe(3000)
			expect(apiConfig.environment).toBe('test')

			expect(cognitoConfig.region).toBe('us-east-1')
			expect(cognitoConfig.userPoolId).toBe('test-pool-id')
			expect(cognitoConfig.clientId).toBe('test-client-id')
		})
	})
})
