import { config } from 'dotenv'
import { resolve } from 'path'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fromError, ValidationError } from 'zod-validation-error'

import { AppError, ErrorType } from '../errors.ts'
import { loadConfig } from '../load-config.ts'

// Mock external dependencies
vi.mock('dotenv', () => ({
	config: vi.fn(),
}))

vi.mock('path', () => ({
	resolve: vi.fn(),
}))

vi.mock('zod-validation-error', () => ({
	fromError: vi.fn(),
}))

vi.mock('../logger.ts', () => ({
	pino: {
		logger: {
			error: vi.fn(),
			info: vi.fn(),
			warn: vi.fn(),
			debug: vi.fn(),
		},
	},
	configureLogger: vi.fn(),
}))

const mockConfig = vi.mocked(config)
const mockResolve = vi.mocked(resolve)
const mockFromError = vi.mocked(fromError)

describe('loadConfig', () => {
	const mockEnvPath = '/test/path/.env'

	beforeEach(() => {
		vi.clearAllMocks()
		mockResolve.mockReturnValue(mockEnvPath)

		// Reset process.env to a clean state
		process.env = {}
	})

	describe('Success Cases', () => {
		it('should successfully load and validate environment configuration', () => {
			// Arrange
			const validEnv: Record<string, string> = {
				API_KEY: 'test-api-key-with-32-characters-min',
				NODE_ENV: 'development',
				SERVER_PORT: '3040',
				AWS_COGNITO_REGION: 'us-east-1',
				AWS_COGNITO_USER_POOL_ID: 'us-east-1_test123',
				AWS_COGNITO_USER_POOL_CLIENT_ID: 'test-client-id',
				AWS_COGNITO_USER_POOL_SECRET_KEY: 'test-secret-key',
				AWS_COGNITO_ACCESS_KEY: 'test-access-key',
				AWS_COGNITO_SECRET_KEY: 'test-cognito-secret',
				AWS_COGNITO_REFRESH_TOKEN_EXPIRY: '30',
				COOKIE_DOMAIN: 'localhost',
				COOKIE_ENCRYPTION_KEY: 'test-cookie-key-with-32-chars-min',
				NON_RELATIONAL_DATABASE_URL: 'mongodb://localhost:27017/test',
				RELATIONAL_DATABASE_URL: 'postgresql://localhost:5432/test',
				OPENAI_API_KEY: 'sk-test-openai-key',
				RATE_LIMIT_WINDOW_MS: '900000',
				RATE_LIMIT_MAX_REQUESTS: '100',
				AUTH_RATE_LIMIT_WINDOW_MS: '3600000',
				AUTH_RATE_LIMIT_MAX_REQUESTS: '10',
				API_RATE_LIMIT_WINDOW_MS: '60000',
				API_RATE_LIMIT_MAX_REQUESTS: '60',
			}

			process.env = validEnv
			mockConfig.mockReturnValue({ parsed: validEnv })

			// Act
			const [result, error] = loadConfig()

			// Assert
			expect(error).toBeNull()
			expect(result).not.toBeNull()
			expect(mockResolve).toHaveBeenCalledWith(process.cwd(), '.env')
			expect(mockConfig).toHaveBeenCalledWith({
				path: mockEnvPath,
				encoding: 'UTF-8',
				debug: true, // NODE_ENV !== 'production' && NODE_ENV !== 'test'
			})
			expect(result).toEqual(
				expect.objectContaining({
					API_KEY: validEnv.API_KEY,
					NODE_ENV: 'development',
					SERVER_PORT: 3040,
					AWS_COGNITO_REGION: validEnv.AWS_COGNITO_REGION,
				}),
			)
		})

		it('should use default values for optional environment variables', () => {
			// Arrange
			const minimalValidEnv: Record<string, string> = {
				API_KEY: 'test-api-key-with-32-characters-min',
				AWS_COGNITO_REGION: 'us-east-1',
				AWS_COGNITO_USER_POOL_ID: 'us-east-1_test123',
				AWS_COGNITO_USER_POOL_CLIENT_ID: 'test-client-id',
				AWS_COGNITO_USER_POOL_SECRET_KEY: 'test-secret-key',
				AWS_COGNITO_ACCESS_KEY: 'test-access-key',
				AWS_COGNITO_SECRET_KEY: 'test-cognito-secret',
				COOKIE_ENCRYPTION_KEY: 'test-cookie-key-with-32-chars-min',
				NON_RELATIONAL_DATABASE_URL: 'mongodb://localhost:27017/test',
				RELATIONAL_DATABASE_URL: 'postgresql://localhost:5432/test',
				OPENAI_API_KEY: 'sk-test-openai-key',
			}

			process.env = minimalValidEnv
			mockConfig.mockReturnValue({ parsed: minimalValidEnv })

			// Act
			const [result, error] = loadConfig()

			// Assert
			expect(error).toBeNull()
			expect(result).not.toBeNull()
			expect(result?.NODE_ENV).toBe('development') // default value
			expect(result?.SERVER_PORT).toBe(3040) // default value
			expect(result?.COOKIE_DOMAIN).toBe('localhost') // default value
			expect(result?.AWS_COGNITO_REFRESH_TOKEN_EXPIRY).toBe(30) // default value
		})

		it('should handle production environment correctly', () => {
			// Arrange
			const prodEnv: Record<string, string> = {
				API_KEY: 'prod-api-key-with-32-characters-min',
				NODE_ENV: 'production',
				AWS_COGNITO_REGION: 'us-east-1',
				AWS_COGNITO_USER_POOL_ID: 'us-east-1_prod123',
				AWS_COGNITO_USER_POOL_CLIENT_ID: 'prod-client-id',
				AWS_COGNITO_USER_POOL_SECRET_KEY: 'prod-secret-key',
				AWS_COGNITO_ACCESS_KEY: 'prod-access-key',
				AWS_COGNITO_SECRET_KEY: 'prod-cognito-secret',
				COOKIE_ENCRYPTION_KEY: 'prod-cookie-key-with-32-chars-min',
				NON_RELATIONAL_DATABASE_URL: 'mongodb://prod:27017/app',
				RELATIONAL_DATABASE_URL: 'postgresql://prod:5432/app',
				OPENAI_API_KEY: 'sk-prod-openai-key',
			}

			process.env = prodEnv
			mockConfig.mockReturnValue({ parsed: prodEnv })

			// Act
			const [result, error] = loadConfig()

			// Assert
			expect(error).toBeNull()
			expect(result).not.toBeNull()
			expect(mockConfig).toHaveBeenCalledWith({
				path: mockEnvPath,
				encoding: 'UTF-8',
				debug: false, // NODE_ENV === 'production' && NODE_ENV !== 'test'
			})
			expect(result?.NODE_ENV).toBe('production')
		})

		it('should handle optional REDIS_URL field correctly', () => {
			// Arrange - With REDIS_URL
			const validEnvWithRedis: Record<string, string> = {
				API_KEY: 'test-api-key-with-32-characters-min',
				AWS_COGNITO_REGION: 'us-east-1',
				AWS_COGNITO_USER_POOL_ID: 'test',
				AWS_COGNITO_USER_POOL_CLIENT_ID: 'test',
				AWS_COGNITO_USER_POOL_SECRET_KEY: 'test',
				AWS_COGNITO_ACCESS_KEY: 'test',
				AWS_COGNITO_SECRET_KEY: 'test',
				COOKIE_ENCRYPTION_KEY: 'test-cookie-key-with-32-chars-min',
				NON_RELATIONAL_DATABASE_URL: 'mongodb://localhost:27017/test',
				OPENAI_API_KEY: 'sk-test-openai-key',
				RELATIONAL_DATABASE_URL: 'postgresql://localhost:5432/test',
				REDIS_URL: 'redis://localhost:6379',
			}
			process.env = validEnvWithRedis
			mockConfig.mockReturnValue({ parsed: validEnvWithRedis })

			// Act
			const [result, error] = loadConfig()

			// Assert
			expect(error).toBeNull()
			expect(result).not.toBeNull()
			expect(result?.REDIS_URL).toBe('redis://localhost:6379')
		})

		it('should handle missing optional REDIS_URL field correctly', () => {
			// Arrange - Without REDIS_URL
			const validEnvWithoutRedis: Record<string, string> = {
				API_KEY: 'test-api-key-with-32-characters-min',
				AWS_COGNITO_REGION: 'us-east-1',
				AWS_COGNITO_USER_POOL_ID: 'test',
				AWS_COGNITO_USER_POOL_CLIENT_ID: 'test',
				AWS_COGNITO_USER_POOL_SECRET_KEY: 'test',
				AWS_COGNITO_ACCESS_KEY: 'test',
				AWS_COGNITO_SECRET_KEY: 'test',
				COOKIE_ENCRYPTION_KEY: 'test-cookie-key-with-32-chars-min',
				OPENAI_API_KEY: 'sk-test-openai-key',
				NON_RELATIONAL_DATABASE_URL: 'mongodb://localhost:27017/test',
				RELATIONAL_DATABASE_URL: 'postgresql://localhost:5432/test',
			}
			process.env = validEnvWithoutRedis
			mockConfig.mockReturnValue({ parsed: validEnvWithoutRedis })

			// Act
			const [result, error] = loadConfig()

			// Assert
			expect(error).toBeNull()
			expect(result).not.toBeNull()
			expect(result?.REDIS_URL).toBeUndefined()
		})
	})

	describe('Error Cases', () => {
		it('should return AppError when .env file cannot be parsed', () => {
			// Arrange
			const dotenvError = new Error('ENOENT: no such file or directory')
			mockConfig.mockReturnValue({ error: dotenvError })

			// Act
			const [result, error] = loadConfig()

			// Assert
			expect(result).toBeNull()
			expect(error).toBeInstanceOf(AppError)
			expect(error?.type).toBe(ErrorType.ValidationError)
			expect(error?.message).toContain('Cannot parse .env file')
			expect(error?.message).toContain(mockEnvPath)
			expect(error?.service).toBe('configLoader')
			expect(error?.details).toEqual({
				envPath: mockEnvPath,
				error: dotenvError,
			})
		})

		it('should return AppError when required environment variables are missing', () => {
			// Arrange
			process.env = {
				// Missing required API_KEY
				NODE_ENV: 'development',
			}
			mockConfig.mockReturnValue({ parsed: {} })

			const mockValidationError = {
				name: 'ValidationError',
				message: 'API_KEY is required',
				details: [{ path: ['API_KEY'], message: 'Required' }],
			}
			mockFromError.mockReturnValue(mockValidationError as ValidationError)

			// Act
			const [result, error] = loadConfig()

			// Assert
			expect(result).toBeNull()
			expect(error).toBeInstanceOf(AppError)
			expect(error?.type).toBe(ErrorType.ValidationError)
			expect(error?.message).toContain('Invalid environment configuration')
			expect(error?.message).toContain(mockEnvPath)
			expect(error?.service).toBe('configLoader')
			expect(error?.details).toEqual({
				envPath: mockEnvPath,
				errors: mockValidationError.details,
			})
		})

		it('should return AppError when environment variables have invalid values', () => {
			// Arrange
			process.env = {
				API_KEY: 'too-short', // Less than 32 characters
				NODE_ENV: 'invalid-env', // Not in enum
				SERVER_PORT: 'not-a-number',
				AWS_COGNITO_REGION: '', // Empty string
			}
			mockConfig.mockReturnValue({ parsed: {} })

			const mockValidationError = {
				name: 'ValidationError',
				message: 'Multiple validation errors',
				details: [
					{
						path: ['API_KEY'],
						message: 'String must contain at least 32 character(s)',
					},
					{ path: ['NODE_ENV'], message: 'Invalid enum value' },
				],
			}
			mockFromError.mockReturnValue(mockValidationError as ValidationError)

			// Act
			const [result, error] = loadConfig()

			// Assert
			expect(result).toBeNull()
			expect(error).toBeInstanceOf(AppError)
			expect(error?.type).toBe(ErrorType.ValidationError)
			expect(error?.message).toContain('Invalid environment configuration')
			expect(error?.service).toBe('configLoader')
		})
	})

	describe('Number Coercion', () => {
		it('should correctly coerce string numbers to actual numbers', () => {
			// Arrange
			const validEnv: Record<string, string> = {
				API_KEY: 'test-api-key-with-32-characters-min',
				SERVER_PORT: '8080',
				AWS_COGNITO_REFRESH_TOKEN_EXPIRY: '90',
				RATE_LIMIT_WINDOW_MS: '1200000',
				RATE_LIMIT_MAX_REQUESTS: '150',
				AUTH_RATE_LIMIT_WINDOW_MS: '5400000',
				AUTH_RATE_LIMIT_MAX_REQUESTS: '15',
				API_RATE_LIMIT_WINDOW_MS: '90000',
				API_RATE_LIMIT_MAX_REQUESTS: '90',
				AWS_COGNITO_REGION: 'us-east-1',
				AWS_COGNITO_USER_POOL_ID: 'test',
				AWS_COGNITO_USER_POOL_CLIENT_ID: 'test',
				AWS_COGNITO_USER_POOL_SECRET_KEY: 'test',
				AWS_COGNITO_ACCESS_KEY: 'test',
				AWS_COGNITO_SECRET_KEY: 'test',
				COOKIE_ENCRYPTION_KEY: 'test-cookie-key-with-32-chars-min',
				NON_RELATIONAL_DATABASE_URL: 'mongodb://localhost:27017/test',
				RELATIONAL_DATABASE_URL: 'postgresql://localhost:5432/test',
				OPENAI_API_KEY: 'sk-test-openai-key',
			}
			process.env = validEnv
			mockConfig.mockReturnValue({ parsed: validEnv })

			// Act
			const [result, error] = loadConfig()

			// Assert
			expect(error).toBeNull()
			expect(result).not.toBeNull()

			// All should be actual numbers, not strings
			expect(typeof result?.SERVER_PORT).toBe('number')
			expect(result?.SERVER_PORT).toBe(8080)
			expect(typeof result?.AWS_COGNITO_REFRESH_TOKEN_EXPIRY).toBe('number')
			expect(result?.AWS_COGNITO_REFRESH_TOKEN_EXPIRY).toBe(90)
			expect(typeof result?.RATE_LIMIT_WINDOW_MS).toBe('number')
			expect(result?.RATE_LIMIT_WINDOW_MS).toBe(1200000)
		})

		it('should return error when numeric fields contain non-numeric values', () => {
			// Arrange
			process.env = {
				API_KEY: 'test-api-key-with-32-characters-min',
				SERVER_PORT: 'not-a-number',
				AWS_COGNITO_REGION: 'us-east-1',
				AWS_COGNITO_USER_POOL_ID: 'test',
				AWS_COGNITO_USER_POOL_CLIENT_ID: 'test',
				AWS_COGNITO_USER_POOL_SECRET_KEY: 'test',
				AWS_COGNITO_ACCESS_KEY: 'test',
				AWS_COGNITO_SECRET_KEY: 'test',
				COOKIE_ENCRYPTION_KEY: 'test-cookie-key-with-32-chars-min',
				NON_RELATIONAL_DATABASE_URL: 'mongodb://localhost:27017/test',
				RELATIONAL_DATABASE_URL: 'postgresql://localhost:5432/test',
			}
			mockConfig.mockReturnValue({ parsed: {} })

			const mockValidationError = {
				name: 'ValidationError',
				message: 'SERVER_PORT must be a number',
				details: [
					{ path: ['SERVER_PORT'], message: 'Expected number, received nan' },
				],
			}
			mockFromError.mockReturnValue(mockValidationError as ValidationError)

			// Act
			const [result, error] = loadConfig()

			// Assert
			expect(result).toBeNull()
			expect(error).toBeInstanceOf(AppError)
		})
	})

	describe('Path Resolution', () => {
		it('should resolve .env path relative to current working directory', () => {
			// Arrange
			const validEnv: Record<string, string> = {
				API_KEY: 'test-api-key-with-32-characters-min',
				AWS_COGNITO_REGION: 'us-east-1',
				AWS_COGNITO_USER_POOL_ID: 'test',
				AWS_COGNITO_USER_POOL_CLIENT_ID: 'test',
				AWS_COGNITO_USER_POOL_SECRET_KEY: 'test',
				AWS_COGNITO_ACCESS_KEY: 'test',
				AWS_COGNITO_SECRET_KEY: 'test',
				COOKIE_ENCRYPTION_KEY: 'test-cookie-key-with-32-chars-min',
				NON_RELATIONAL_DATABASE_URL: 'mongodb://localhost:27017/test',
				RELATIONAL_DATABASE_URL: 'postgresql://localhost:5432/test',
			}
			process.env = validEnv
			mockConfig.mockReturnValue({ parsed: validEnv })

			// Act
			loadConfig()

			// Assert
			expect(mockResolve).toHaveBeenCalledWith(process.cwd(), '.env')
		})
	})

	describe('Type Safety and Return Value', () => {
		it('should return properly typed Result<TEnv> tuple', () => {
			// Arrange
			const validEnv: Record<string, string> = {
				API_KEY: 'test-api-key-with-32-characters-min',
				NODE_ENV: 'test',
				SERVER_PORT: '4000',
				AWS_COGNITO_REGION: 'us-west-2',
				AWS_COGNITO_USER_POOL_ID: 'us-west-2_test456',
				AWS_COGNITO_USER_POOL_CLIENT_ID: 'test-client-456',
				AWS_COGNITO_USER_POOL_SECRET_KEY: 'test-secret-456',
				AWS_COGNITO_ACCESS_KEY: 'test-access-456',
				AWS_COGNITO_SECRET_KEY: 'test-cognito-456',
				AWS_COGNITO_REFRESH_TOKEN_EXPIRY: '60',
				COOKIE_DOMAIN: 'example.com',
				COOKIE_ENCRYPTION_KEY: 'test-cookie-key-with-32-chars-456',
				NON_RELATIONAL_DATABASE_URL: 'mongodb://test:27017/testdb',
				RELATIONAL_DATABASE_URL: 'postgresql://test:5432/testdb',
				OPENAI_API_KEY: 'sk-test-openai-key-456',
				RATE_LIMIT_WINDOW_MS: '1800000',
				RATE_LIMIT_MAX_REQUESTS: '200',
				AUTH_RATE_LIMIT_WINDOW_MS: '7200000',
				AUTH_RATE_LIMIT_MAX_REQUESTS: '20',
				API_RATE_LIMIT_WINDOW_MS: '120000',
				API_RATE_LIMIT_MAX_REQUESTS: '120',
				REDIS_URL: 'redis://localhost:6379',
			}
			process.env = validEnv
			mockConfig.mockReturnValue({ parsed: validEnv })

			// Act
			const [result, error] = loadConfig()

			// Assert - TypeScript compilation ensures type safety
			expect(error).toBeNull()
			expect(result).not.toBeNull()
			expect(result?.API_KEY).toBe(validEnv.API_KEY)
			expect(result?.NODE_ENV).toBe('test')
			expect(result?.SERVER_PORT).toBe(4000) // Coerced to number
			expect(result?.AWS_COGNITO_REFRESH_TOKEN_EXPIRY).toBe(60) // Coerced to number
			expect(result?.REDIS_URL).toBe(validEnv.REDIS_URL) // Optional field
		})
	})
})
