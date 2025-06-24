import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
	type ConfigType,
	defaultTestConfig,
	mockConfig,
} from '../config.mock.ts'

describe('Config Mock Helper', () => {
	let configMock: ReturnType<typeof mockConfig.create>

	beforeEach(() => {
		configMock = mockConfig.setup()
	})

	describe('mockConfig.create', () => {
		it('should create config with default values', () => {
			// Act
			const mock = mockConfig.create()

			// Assert
			expect(mock).toHaveProperty('config')
			expect(mock.config).toEqual(defaultTestConfig)
		})

		it('should create config with overrides', () => {
			// Arrange
			const overrides: Partial<ConfigType> = {
				nodeEnv: 'production',
				port: 8080,
				apiKey: 'custom-api-key',
			}

			// Act
			const mock = mockConfig.create(overrides)

			// Assert
			expect(mock.config.nodeEnv).toBe('production')
			expect(mock.config.port).toBe(8080)
			expect(mock.config.apiKey).toBe('custom-api-key')
			// Should preserve other defaults
			expect(mock.config.awsCognitoRegion).toBe(
				defaultTestConfig.awsCognitoRegion,
			)
		})

		it('should maintain type safety with partial overrides', () => {
			// Arrange
			const overrides: Partial<ConfigType> = {
				awsCognitoRefreshTokenExpiry: 120,
			}

			// Act
			const mock = mockConfig.create(overrides)

			// Assert
			expect(mock.config.awsCognitoRefreshTokenExpiry).toBe(120)
			expect(typeof mock.config.awsCognitoRefreshTokenExpiry).toBe('number')
		})
	})

	describe('mockConfig.createModule', () => {
		it('should create module mock with same structure as create', () => {
			// Act
			const moduleMock = mockConfig.createModule()
			const basicMock = mockConfig.create()

			// Assert
			expect(moduleMock).toEqual(basicMock)
		})

		it('should create module mock with overrides', () => {
			// Arrange
			const overrides: Partial<ConfigType> = {
				redisUrl: 'redis://test:6379',
			}

			// Act
			const mock = mockConfig.createModule(overrides)

			// Assert
			expect(mock.config.redisUrl).toBe('redis://test:6379')
		})
	})

	describe('mockConfig.setup', () => {
		it('should clear all mocks and return fresh config', () => {
			// Arrange
			const clearAllMocksSpy = vi
				.spyOn(vi, 'clearAllMocks')
				.mockImplementation(() => vi)

			// Act
			const mock = mockConfig.setup()

			// Assert
			expect(clearAllMocksSpy).toHaveBeenCalledOnce()
			expect(mock).toHaveProperty('config')
			expect(mock.config).toEqual(defaultTestConfig)

			// Cleanup
			clearAllMocksSpy.mockRestore()
		})

		it('should setup config with overrides', () => {
			// Arrange
			const overrides: Partial<ConfigType> = {
				nodeEnv: 'development',
			}

			// Act
			const mock = mockConfig.setup(overrides)

			// Assert
			expect(mock.config.nodeEnv).toBe('development')
		})

		it('should demonstrate beforeEach usage pattern', () => {
			// Assert - configMock should be fresh from beforeEach
			expect(configMock).toHaveProperty('config')
			expect(configMock.config).toEqual(defaultTestConfig)
		})
	})

	describe('Environment-specific config creators', () => {
		describe('mockConfig.development', () => {
			it('should create development environment config', () => {
				// Act
				const mock = mockConfig.development()

				// Assert
				expect(mock.config.nodeEnv).toBe('development')
				expect(mock.config.port).toBe(3001)
				// Should preserve other defaults
				expect(mock.config.apiKey).toBe(defaultTestConfig.apiKey)
			})

			it('should be consistent with unified API', () => {
				// Act
				const mock1 = mockConfig.development()
				const mock2 = mockConfig.create({ nodeEnv: 'development', port: 3001 })

				// Assert
				expect(mock1.config.nodeEnv).toBe(mock2.config.nodeEnv)
				expect(mock1.config.port).toBe(mock2.config.port)
			})
		})

		describe('mockConfig.production', () => {
			it('should create production environment config', () => {
				// Act
				const mock = mockConfig.production()

				// Assert
				expect(mock.config.nodeEnv).toBe('production')
				expect(mock.config.port).toBe(8080)
				// Should preserve other defaults
				expect(mock.config.apiKey).toBe(defaultTestConfig.apiKey)
			})

			it('should be consistent with unified API', () => {
				// Act
				const mock1 = mockConfig.production()
				const mock2 = mockConfig.create({ nodeEnv: 'production', port: 8080 })

				// Assert
				expect(mock1.config.nodeEnv).toBe(mock2.config.nodeEnv)
				expect(mock1.config.port).toBe(mock2.config.port)
			})
		})

		describe('mockConfig.test', () => {
			it('should create test environment config', () => {
				// Act
				const mock = mockConfig.test()

				// Assert
				expect(mock.config.nodeEnv).toBe('test')
				expect(mock.config.port).toBe(3000)
				// Should preserve other defaults
				expect(mock.config.apiKey).toBe(defaultTestConfig.apiKey)
			})

			it('should match default test config', () => {
				// Act
				const mock = mockConfig.test()

				// Assert
				expect(mock.config.nodeEnv).toBe(defaultTestConfig.nodeEnv)
				expect(mock.config.port).toBe(defaultTestConfig.port)
			})
		})
	})

	describe('Feature-specific config creators', () => {
		describe('mockConfig.cognito', () => {
			it('should create Cognito-focused config with defaults', () => {
				// Act
				const mock = mockConfig.cognito()

				// Assert
				expect(mock.config.awsCognitoRegion).toBe('us-west-2')
				expect(mock.config.awsCognitoUserPoolId).toBe('cognito-test-pool-id')
				expect(mock.config.awsCognitoUserPoolClientId).toBe(
					'cognito-test-client-id',
				)
				expect(mock.config.awsCognitoRefreshTokenExpiry).toBe(60)
				// Should preserve other defaults
				expect(mock.config.nodeEnv).toBe(defaultTestConfig.nodeEnv)
			})

			it('should create Cognito config with overrides', () => {
				// Arrange
				const overrides = {
					awsCognitoRegion: 'eu-west-1' as const,
					awsCognitoRefreshTokenExpiry: 90,
				}

				// Act
				const mock = mockConfig.cognito(overrides)

				// Assert
				expect(mock.config.awsCognitoRegion).toBe('eu-west-1')
				expect(mock.config.awsCognitoRefreshTokenExpiry).toBe(90)
			})

			it('should provide Cognito-specific test values', () => {
				// Act
				const mock = mockConfig.cognito()

				// Assert - Should have different values than defaults for testing
				expect(mock.config.awsCognitoRegion).not.toBe(
					defaultTestConfig.awsCognitoRegion,
				)
				expect(mock.config.awsCognitoUserPoolId).not.toBe(
					defaultTestConfig.awsCognitoUserPoolId,
				)
				expect(mock.config.awsCognitoRefreshTokenExpiry).not.toBe(
					defaultTestConfig.awsCognitoRefreshTokenExpiry,
				)
			})
		})

		describe('mockConfig.database', () => {
			it('should create database-focused config with defaults', () => {
				// Act
				const mock = mockConfig.database()

				// Assert
				expect(mock.config.relationalDatabaseUrl).toBe(
					'postgresql://testuser:testpass@localhost:5432/testdb',
				)
				expect(mock.config.nonRelationalDatabaseUrl).toBe(
					'mongodb://localhost:27017/testdb',
				)
				// Should preserve other defaults
				expect(mock.config.nodeEnv).toBe(defaultTestConfig.nodeEnv)
			})

			it('should create database config with overrides', () => {
				// Arrange
				const overrides = {
					relationalDatabaseUrl:
						'postgresql://custom:pass@localhost:5432/custom',
				}

				// Act
				const mock = mockConfig.database(overrides)

				// Assert
				expect(mock.config.relationalDatabaseUrl).toBe(
					'postgresql://custom:pass@localhost:5432/custom',
				)
			})

			it('should provide database-specific test values', () => {
				// Act
				const mock = mockConfig.database()

				// Assert - Should have different values than defaults for testing
				expect(mock.config.relationalDatabaseUrl).not.toBe(
					defaultTestConfig.relationalDatabaseUrl,
				)
				expect(mock.config.nonRelationalDatabaseUrl).not.toBe(
					defaultTestConfig.nonRelationalDatabaseUrl,
				)
			})
		})

		describe('mockConfig.rateLimit', () => {
			it('should create rate limiting-focused config with defaults', () => {
				// Act
				const mock = mockConfig.rateLimit()

				// Assert
				expect(mock.config.rateLimitWindowMs).toBe(60000) // 1 minute
				expect(mock.config.rateLimitMaxRequests).toBe(10)
				expect(mock.config.authRateLimitWindowMs).toBe(300000) // 5 minutes
				expect(mock.config.authRateLimitMaxRequests).toBe(5)
				expect(mock.config.apiRateLimitWindowMs).toBe(30000) // 30 seconds
				expect(mock.config.apiRateLimitMaxRequests).toBe(30)
				// Should preserve other defaults
				expect(mock.config.nodeEnv).toBe(defaultTestConfig.nodeEnv)
			})

			it('should create rate limit config with overrides', () => {
				// Arrange
				const overrides = {
					rateLimitMaxRequests: 50,
					authRateLimitMaxRequests: 20,
				}

				// Act
				const mock = mockConfig.rateLimit(overrides)

				// Assert
				expect(mock.config.rateLimitMaxRequests).toBe(50)
				expect(mock.config.authRateLimitMaxRequests).toBe(20)
			})

			it('should provide rate limit-specific test values', () => {
				// Act
				const mock = mockConfig.rateLimit()

				// Assert - Should have different values than defaults for testing
				expect(mock.config.rateLimitWindowMs).not.toBe(
					defaultTestConfig.rateLimitWindowMs,
				)
				expect(mock.config.rateLimitMaxRequests).not.toBe(
					defaultTestConfig.rateLimitMaxRequests,
				)
				expect(mock.config.authRateLimitWindowMs).not.toBe(
					defaultTestConfig.authRateLimitWindowMs,
				)
			})
		})
	})

	describe('defaultTestConfig', () => {
		it('should contain all required configuration properties', () => {
			// Assert - Check that all expected properties exist
			expect(defaultTestConfig).toHaveProperty('apiKey')
			expect(defaultTestConfig).toHaveProperty('nodeEnv')
			expect(defaultTestConfig).toHaveProperty('port')
			expect(defaultTestConfig).toHaveProperty('awsCognitoRegion')
			expect(defaultTestConfig).toHaveProperty('awsCognitoUserPoolId')
			expect(defaultTestConfig).toHaveProperty('awsCognitoUserPoolClientId')
			expect(defaultTestConfig).toHaveProperty('awsCognitoUserPoolSecretKey')
			expect(defaultTestConfig).toHaveProperty('awsCognitoAccessKey')
			expect(defaultTestConfig).toHaveProperty('awsCognitoSecretKey')
			expect(defaultTestConfig).toHaveProperty('awsCognitoRefreshTokenExpiry')
			expect(defaultTestConfig).toHaveProperty('cookieDomain')
			expect(defaultTestConfig).toHaveProperty('cookieEncryptionKey')
			expect(defaultTestConfig).toHaveProperty('relationalDatabaseUrl')
			expect(defaultTestConfig).toHaveProperty('nonRelationalDatabaseUrl')
			expect(defaultTestConfig).toHaveProperty('rateLimitWindowMs')
			expect(defaultTestConfig).toHaveProperty('rateLimitMaxRequests')
			expect(defaultTestConfig).toHaveProperty('authRateLimitWindowMs')
			expect(defaultTestConfig).toHaveProperty('authRateLimitMaxRequests')
			expect(defaultTestConfig).toHaveProperty('apiRateLimitWindowMs')
			expect(defaultTestConfig).toHaveProperty('apiRateLimitMaxRequests')
			expect(defaultTestConfig).toHaveProperty('redisUrl')
		})

		it('should have sensible test values', () => {
			// Assert - Check that values are appropriate for testing
			expect(defaultTestConfig.nodeEnv).toBe('test')
			expect(defaultTestConfig.apiKey).toMatch(/^test-api-key-/)
			expect(defaultTestConfig.cookieDomain).toBe('localhost')
			expect(defaultTestConfig.awsCognitoRegion).toBe('us-east-1')
			expect(typeof defaultTestConfig.port).toBe('number')
			expect(typeof defaultTestConfig.awsCognitoRefreshTokenExpiry).toBe(
				'number',
			)
		})
	})

	describe('mockConfig unified export', () => {
		it('should provide consistent API for all mock helpers', () => {
			// Assert - Check that the unified export follows the established pattern
			expect(typeof mockConfig.create).toBe('function')
			expect(typeof mockConfig.createModule).toBe('function')
			expect(typeof mockConfig.setup).toBe('function')
			expect(typeof mockConfig.defaults).toBe('object')
			expect(typeof mockConfig.development).toBe('function')
			expect(typeof mockConfig.production).toBe('function')
			expect(typeof mockConfig.test).toBe('function')
			expect(typeof mockConfig.cognito).toBe('function')
			expect(typeof mockConfig.database).toBe('function')
			expect(typeof mockConfig.rateLimit).toBe('function')
		})

		it('should provide access to default test config', () => {
			// Assert
			expect(mockConfig.defaults).toBe(defaultTestConfig)
			expect(mockConfig.defaults).toEqual(defaultTestConfig)
		})

		it('should demonstrate unified API usage patterns', () => {
			// Act - Use different methods from unified API
			const basicMock = mockConfig.create({ port: 4000 })
			const envMock = mockConfig.development()
			const featureMock = mockConfig.cognito()

			// Assert - All should return consistent structure
			expect(basicMock).toHaveProperty('config')
			expect(envMock).toHaveProperty('config')
			expect(featureMock).toHaveProperty('config')

			// Assert - Each should have different configurations
			expect(basicMock.config.port).toBe(4000)
			expect(envMock.config.nodeEnv).toBe('development')
			expect(featureMock.config.awsCognitoRegion).toBe('us-west-2')
		})
	})

	describe('Integration and Usage Patterns', () => {
		it('should support chaining and composition patterns', () => {
			// Arrange - Create a complex config by combining features
			const complexOverrides: Partial<ConfigType> = {
				nodeEnv: 'production',
				port: 8080,
				awsCognitoRegion: 'eu-west-1',
				rateLimitMaxRequests: 100,
			}

			// Act
			const mock = mockConfig.create(complexOverrides)

			// Assert
			expect(mock.config.nodeEnv).toBe('production')
			expect(mock.config.port).toBe(8080)
			expect(mock.config.awsCognitoRegion).toBe('eu-west-1')
			expect(mock.config.rateLimitMaxRequests).toBe(100)
			// Should preserve other defaults
			expect(mock.config.apiKey).toBe(defaultTestConfig.apiKey)
		})

		it('should demonstrate beforeEach setup with overrides', () => {
			// Arrange - Override the beforeEach setup for this test
			const customMock = mockConfig.setup({ nodeEnv: 'development' })

			// Assert
			expect(customMock.config.nodeEnv).toBe('development')
			expect(customMock).toHaveProperty('config')
		})

		it('should support module mocking patterns', () => {
			// Act - Simulate vi.mock() usage
			const moduleMock = mockConfig.createModule({
				redisUrl: 'redis://test-server:6379',
			})

			// Assert
			expect(moduleMock.config.redisUrl).toBe('redis://test-server:6379')
			expect(moduleMock).toEqual(
				mockConfig.create({ redisUrl: 'redis://test-server:6379' }),
			)
		})
	})
})
