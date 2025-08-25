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
				NODE_ENV: 'production',
				SERVER_PORT: 8080,
				API_KEY: 'custom-api-key',
			}

			// Act
			const mock = mockConfig.create(overrides)

			// Assert
			expect(mock.config.NODE_ENV).toBe('production')
			expect(mock.config.SERVER_PORT).toBe(8080)
			expect(mock.config.API_KEY).toBe('custom-api-key')
			// Should preserve other defaults
			expect(mock.config.AWS_COGNITO_REGION).toBe(
				defaultTestConfig.AWS_COGNITO_REGION,
			)
		})

		it('should maintain type safety with partial overrides', () => {
			// Arrange
			const overrides: Partial<ConfigType> = {
				AWS_COGNITO_REFRESH_TOKEN_EXPIRY: 120,
			}

			// Act
			const mock = mockConfig.create(overrides)

			// Assert
			expect(mock.config.AWS_COGNITO_REFRESH_TOKEN_EXPIRY).toBe(120)
			expect(typeof mock.config.AWS_COGNITO_REFRESH_TOKEN_EXPIRY).toBe('number')
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
				REDIS_URL: 'redis://test:6379',
			}

			// Act
			const mock = mockConfig.createModule(overrides)

			// Assert
			expect(mock.config.REDIS_URL).toBe('redis://test:6379')
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
				NODE_ENV: 'development',
			}

			// Act
			const mock = mockConfig.setup(overrides)

			// Assert
			expect(mock.config.NODE_ENV).toBe('development')
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
				expect(mock.config.NODE_ENV).toBe('development')
				expect(mock.config.SERVER_PORT).toBe(3001)
				// Should preserve other defaults
				expect(mock.config.API_KEY).toBe(defaultTestConfig.API_KEY)
			})

			it('should be consistent with unified API', () => {
				// Act
				const mock1 = mockConfig.development()
				const mock2 = mockConfig.create({
					NODE_ENV: 'development',
					SERVER_PORT: 3001,
				})

				// Assert
				expect(mock1.config.NODE_ENV).toBe(mock2.config.NODE_ENV)
				expect(mock1.config.SERVER_PORT).toBe(mock2.config.SERVER_PORT)
			})
		})

		describe('mockConfig.production', () => {
			it('should create production environment config', () => {
				// Act
				const mock = mockConfig.production()

				// Assert
				expect(mock.config.NODE_ENV).toBe('production')
				expect(mock.config.SERVER_PORT).toBe(8080)
				// Should preserve other defaults
				expect(mock.config.API_KEY).toBe(defaultTestConfig.API_KEY)
			})

			it('should be consistent with unified API', () => {
				// Act
				const mock1 = mockConfig.production()
				const mock2 = mockConfig.create({
					NODE_ENV: 'production',
					SERVER_PORT: 8080,
				})

				// Assert
				expect(mock1.config.NODE_ENV).toBe(mock2.config.NODE_ENV)
				expect(mock1.config.SERVER_PORT).toBe(mock2.config.SERVER_PORT)
			})
		})

		describe('mockConfig.test', () => {
			it('should create test environment config', () => {
				// Act
				const mock = mockConfig.test()

				// Assert
				expect(mock.config.NODE_ENV).toBe('test')
				expect(mock.config.SERVER_PORT).toBe(3000)
				// Should preserve other defaults
				expect(mock.config.API_KEY).toBe(defaultTestConfig.API_KEY)
			})

			it('should match default test config', () => {
				// Act
				const mock = mockConfig.test()

				// Assert
				expect(mock.config.NODE_ENV).toBe(defaultTestConfig.NODE_ENV)
				expect(mock.config.SERVER_PORT).toBe(defaultTestConfig.SERVER_PORT)
			})
		})
	})

	describe('Feature-specific config creators', () => {
		describe('mockConfig.cognito', () => {
			it('should create Cognito-focused config with defaults', () => {
				// Act
				const mock = mockConfig.cognito()

				// Assert
				expect(mock.config.AWS_COGNITO_REGION).toBe('us-west-2')
				expect(mock.config.AWS_COGNITO_USER_POOL_ID).toBe(
					'cognito-test-pool-id',
				)
				expect(mock.config.AWS_COGNITO_USER_POOL_CLIENT_ID).toBe(
					'cognito-test-client-id',
				)
				expect(mock.config.AWS_COGNITO_REFRESH_TOKEN_EXPIRY).toBe(60)
				// Should preserve other defaults
				expect(mock.config.NODE_ENV).toBe(defaultTestConfig.NODE_ENV)
			})

			it('should create Cognito config with overrides', () => {
				// Arrange
				const overrides = {
					AWS_COGNITO_REGION: 'eu-west-1' as const,
					AWS_COGNITO_REFRESH_TOKEN_EXPIRY: 90,
				}

				// Act
				const mock = mockConfig.cognito(overrides)

				// Assert
				expect(mock.config.AWS_COGNITO_REGION).toBe('eu-west-1')
				expect(mock.config.AWS_COGNITO_REFRESH_TOKEN_EXPIRY).toBe(90)
			})

			it('should provide Cognito-specific test values', () => {
				// Act
				const mock = mockConfig.cognito()

				// Assert - Should have different values than defaults for testing
				expect(mock.config.AWS_COGNITO_REGION).not.toBe(
					defaultTestConfig.AWS_COGNITO_REGION,
				)
				expect(mock.config.AWS_COGNITO_USER_POOL_ID).not.toBe(
					defaultTestConfig.AWS_COGNITO_USER_POOL_ID,
				)
				expect(mock.config.AWS_COGNITO_REFRESH_TOKEN_EXPIRY).not.toBe(
					defaultTestConfig.AWS_COGNITO_REFRESH_TOKEN_EXPIRY,
				)
			})
		})

		describe('mockConfig.database', () => {
			it('should create database-focused config with defaults', () => {
				// Act
				const mock = mockConfig.database()

				// Assert
				expect(mock.config.RELATIONAL_DATABASE_URL).toBe(
					'postgresql://testuser:testpass@localhost:5432/testdb',
				)
				expect(mock.config.NON_RELATIONAL_DATABASE_URL).toBe(
					'mongodb://localhost:27017/testdb',
				)
				// Should preserve other defaults
				expect(mock.config.NODE_ENV).toBe(defaultTestConfig.NODE_ENV)
			})

			it('should create database config with overrides', () => {
				// Arrange
				const overrides = {
					RELATIONAL_DATABASE_URL:
						'postgresql://custom:pass@localhost:5432/custom',
				}

				// Act
				const mock = mockConfig.database(overrides)

				// Assert
				expect(mock.config.RELATIONAL_DATABASE_URL).toBe(
					'postgresql://custom:pass@localhost:5432/custom',
				)
			})

			it('should provide database-specific test values', () => {
				// Act
				const mock = mockConfig.database()

				// Assert - Should have different values than defaults for testing
				expect(mock.config.RELATIONAL_DATABASE_URL).not.toBe(
					defaultTestConfig.RELATIONAL_DATABASE_URL,
				)
				expect(mock.config.NON_RELATIONAL_DATABASE_URL).not.toBe(
					defaultTestConfig.NON_RELATIONAL_DATABASE_URL,
				)
			})
		})

		describe('mockConfig.rateLimit', () => {
			it('should create rate limiting-focused config with defaults', () => {
				// Act
				const mock = mockConfig.rateLimit()

				// Assert
				expect(mock.config.RATE_LIMIT_WINDOW_MS).toBe(60000) // 1 minute
				expect(mock.config.RATE_LIMIT_MAX_REQUESTS).toBe(10)
				expect(mock.config.AUTH_RATE_LIMIT_WINDOW_MS).toBe(300000) // 5 minutes
				expect(mock.config.AUTH_RATE_LIMIT_MAX_REQUESTS).toBe(5)
				expect(mock.config.API_RATE_LIMIT_WINDOW_MS).toBe(30000) // 30 seconds
				expect(mock.config.API_RATE_LIMIT_MAX_REQUESTS).toBe(30)
				// Should preserve other defaults
				expect(mock.config.NODE_ENV).toBe(defaultTestConfig.NODE_ENV)
			})

			it('should create rate limit config with overrides', () => {
				// Arrange
				const overrides = {
					RATE_LIMIT_MAX_REQUESTS: 50,
					AUTH_RATE_LIMIT_MAX_REQUESTS: 20,
				}

				// Act
				const mock = mockConfig.rateLimit(overrides)

				// Assert
				expect(mock.config.RATE_LIMIT_MAX_REQUESTS).toBe(50)
				expect(mock.config.AUTH_RATE_LIMIT_MAX_REQUESTS).toBe(20)
			})

			it('should provide rate limit-specific test values', () => {
				// Act
				const mock = mockConfig.rateLimit()

				// Assert - Should have different values than defaults for testing
				expect(mock.config.RATE_LIMIT_WINDOW_MS).not.toBe(
					defaultTestConfig.RATE_LIMIT_WINDOW_MS,
				)
				expect(mock.config.RATE_LIMIT_MAX_REQUESTS).not.toBe(
					defaultTestConfig.RATE_LIMIT_MAX_REQUESTS,
				)
				expect(mock.config.AUTH_RATE_LIMIT_WINDOW_MS).not.toBe(
					defaultTestConfig.AUTH_RATE_LIMIT_MAX_REQUESTS,
				)
			})
		})
	})

	describe('defaultTestConfig', () => {
		it('should contain all required configuration properties', () => {
			// Assert - Check that all expected properties exist
			expect(defaultTestConfig).toHaveProperty('API_KEY')
			expect(defaultTestConfig).toHaveProperty('NODE_ENV')
			expect(defaultTestConfig).toHaveProperty('SERVER_PORT')
			expect(defaultTestConfig).toHaveProperty('AWS_COGNITO_REGION')
			expect(defaultTestConfig).toHaveProperty('AWS_COGNITO_USER_POOL_ID')
			expect(defaultTestConfig).toHaveProperty(
				'AWS_COGNITO_USER_POOL_CLIENT_ID',
			)
			expect(defaultTestConfig).toHaveProperty(
				'AWS_COGNITO_USER_POOL_SECRET_KEY',
			)
			expect(defaultTestConfig).toHaveProperty('AWS_COGNITO_ACCESS_KEY')
			expect(defaultTestConfig).toHaveProperty('AWS_COGNITO_SECRET_KEY')
			expect(defaultTestConfig).toHaveProperty(
				'AWS_COGNITO_REFRESH_TOKEN_EXPIRY',
			)
			expect(defaultTestConfig).toHaveProperty('COOKIE_DOMAIN')
			expect(defaultTestConfig).toHaveProperty('COOKIE_ENCRYPTION_KEY')
			expect(defaultTestConfig).toHaveProperty('RELATIONAL_DATABASE_URL')
			expect(defaultTestConfig).toHaveProperty('NON_RELATIONAL_DATABASE_URL')
			expect(defaultTestConfig).toHaveProperty('RATE_LIMIT_WINDOW_MS')
			expect(defaultTestConfig).toHaveProperty('RATE_LIMIT_MAX_REQUESTS')
			expect(defaultTestConfig).toHaveProperty('AUTH_RATE_LIMIT_WINDOW_MS')
			expect(defaultTestConfig).toHaveProperty('AUTH_RATE_LIMIT_MAX_REQUESTS')
			expect(defaultTestConfig).toHaveProperty('API_RATE_LIMIT_WINDOW_MS')
			expect(defaultTestConfig).toHaveProperty('API_RATE_LIMIT_MAX_REQUESTS')
			expect(defaultTestConfig).toHaveProperty('REDIS_URL')
		})

		it('should have sensible test values', () => {
			// Assert - Check that values are appropriate for testing
			expect(defaultTestConfig.NODE_ENV).toBe('test')
			expect(defaultTestConfig.API_KEY).toMatch(/^test-api-key-/)
			expect(defaultTestConfig.COOKIE_DOMAIN).toBe('localhost')
			expect(defaultTestConfig.AWS_COGNITO_REGION).toBe('us-east-1')
			expect(typeof defaultTestConfig.SERVER_PORT).toBe('number')
			expect(typeof defaultTestConfig.AWS_COGNITO_REFRESH_TOKEN_EXPIRY).toBe(
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
			const basicMock = mockConfig.create({ SERVER_PORT: 4000 })
			const envMock = mockConfig.development()
			const featureMock = mockConfig.cognito()

			// Assert - All should return consistent structure
			expect(basicMock).toHaveProperty('config')
			expect(envMock).toHaveProperty('config')
			expect(featureMock).toHaveProperty('config')

			// Assert - Each should have different configurations
			expect(basicMock.config.SERVER_PORT).toBe(4000)
			expect(envMock.config.NODE_ENV).toBe('development')
			expect(featureMock.config.AWS_COGNITO_REGION).toBe('us-west-2')
		})
	})

	describe('Integration and Usage Patterns', () => {
		it('should support chaining and composition patterns', () => {
			// Arrange - Create a complex config by combining features
			const complexOverrides: Partial<ConfigType> = {
				NODE_ENV: 'production',
				SERVER_PORT: 8080,
				AWS_COGNITO_REGION: 'eu-west-1',
				RATE_LIMIT_MAX_REQUESTS: 100,
			}

			// Act
			const mock = mockConfig.create(complexOverrides)

			// Assert
			expect(mock.config.NODE_ENV).toBe('production')
			expect(mock.config.SERVER_PORT).toBe(8080)
			expect(mock.config.AWS_COGNITO_REGION).toBe('eu-west-1')
			expect(mock.config.RATE_LIMIT_MAX_REQUESTS).toBe(100)
			// Should preserve other defaults
			expect(mock.config.API_KEY).toBe(defaultTestConfig.API_KEY)
		})

		it('should demonstrate beforeEach setup with overrides', () => {
			// Arrange - Override the beforeEach setup for this test
			const customMock = mockConfig.setup({ NODE_ENV: 'development' })

			// Assert
			expect(customMock.config.NODE_ENV).toBe('development')
			expect(customMock).toHaveProperty('config')
		})

		it('should support module mocking patterns', () => {
			// Act - Simulate vi.mock() usage
			const moduleMock = mockConfig.createModule({
				REDIS_URL: 'redis://test-server:6379',
			})

			// Assert
			expect(moduleMock.config.REDIS_URL).toBe('redis://test-server:6379')
			expect(moduleMock).toEqual(
				mockConfig.create({ REDIS_URL: 'redis://test-server:6379' }),
			)
		})
	})
})
