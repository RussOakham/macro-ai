import { NextFunction, Request, Response } from 'express'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { UnauthorizedError } from '../../utils/errors.ts'
import { mockConfig } from '../../utils/test-helpers/config.mock.ts'
import { mockExpress } from '../../utils/test-helpers/express-mocks.ts'
import { mockLogger } from '../../utils/test-helpers/logger.mock.ts'

// Mock the logger using the reusable helper
vi.mock('../../utils/logger.ts', () => mockLogger.createModule())

// Mock the config using the reusable helper
vi.mock('../../../config/default.ts', () => mockConfig.createModule())

// Import after mocking
import { apiKeyAuth } from '../api-key.middleware.ts'

let originalApiKey: string | undefined

describe('apiKeyAuth Middleware', () => {
	let mockRequest: Partial<Request>
	let mockResponse: Partial<Response>
	let mockNext: NextFunction

	beforeEach(() => {
		// Setup config and logger mocks for consistent test environment
		mockConfig.setup()
		mockLogger.setup()

		// Save original API key so we can restore it after each test
		originalApiKey = process.env.API_KEY

		// Set API key in environment for middleware to read
		process.env.API_KEY = 'test-api-key-12345678901234567890'

		// Setup Express mocks with default properties for API key middleware tests
		const expressMocks = mockExpress.setup({
			path: '/api/test',
			headers: {},
			ip: '127.0.0.1',
		})

		afterEach(() => {
			// Restore original API key to avoid leaking state across tests
			process.env.API_KEY = originalApiKey
		})

		mockRequest = expressMocks.req
		mockResponse = expressMocks.res
		mockNext = expressMocks.next
	})

	describe('Swagger Documentation Bypass', () => {
		it('should skip API key check for /api-docs paths', () => {
			// Arrange
			const request = { ...mockRequest, path: '/api-docs' } as Request

			// Act
			apiKeyAuth(request, mockResponse as Response, mockNext)

			// Assert
			expect(mockNext).toHaveBeenCalledWith()
			expect(mockNext).toHaveBeenCalledTimes(1)
		})

		it('should skip API key check for /api-docs subpaths', () => {
			// Arrange
			const request = {
				...mockRequest,
				path: '/api-docs/swagger.json',
			} as Request

			// Act
			apiKeyAuth(request, mockResponse as Response, mockNext)

			// Assert
			expect(mockNext).toHaveBeenCalledWith()
			expect(mockNext).toHaveBeenCalledTimes(1)
		})
	})

	describe('API Key Configuration Validation', () => {
		// Note: These tests verify the middleware behavior when a valid API key is configured
		// Testing undefined/empty API key scenarios would require module-level mocking
		// which is complex due to the top-level config import in the middleware

		it('should work correctly when API key is properly configured', () => {
			// Arrange
			mockRequest.headers = {
				'x-api-key': 'test-api-key-12345678901234567890',
			}

			// Act
			apiKeyAuth(mockRequest as Request, mockResponse as Response, mockNext)

			// Assert
			expect(mockNext).toHaveBeenCalledWith()
			expect(mockNext).toHaveBeenCalledTimes(1)
		})

		it('should reject requests when API key does not match configured key', () => {
			// Arrange
			mockRequest.headers = {
				'x-api-key': 'wrong-api-key',
			}

			// Act
			apiKeyAuth(mockRequest as Request, mockResponse as Response, mockNext)

			// Assert
			expect(mockNext).toHaveBeenCalledWith(expect.any(UnauthorizedError))
			const error = vi.mocked(mockNext).mock
				.calls[0]?.[0] as unknown as UnauthorizedError
			expect(error.message).toBe('Invalid API key')
			expect(error.service).toBe('apiKeyAuth middleware')
		})
	})

	describe('Client API Key Validation', () => {
		it('should return UnauthorizedError when no API key header is provided', () => {
			// Arrange
			mockRequest.headers = {}

			// Act
			apiKeyAuth(mockRequest as Request, mockResponse as Response, mockNext)

			// Assert
			expect(mockNext).toHaveBeenCalledWith(expect.any(UnauthorizedError))
			const error = vi.mocked(mockNext).mock
				.calls[0]?.[0] as unknown as UnauthorizedError
			expect(error.message).toBe('Invalid API key')
			expect(error.service).toBe('apiKeyAuth middleware')
		})

		it('should return UnauthorizedError when API key header is empty', () => {
			// Arrange
			mockRequest.headers = {
				'x-api-key': '',
			}

			// Act
			apiKeyAuth(mockRequest as Request, mockResponse as Response, mockNext)

			// Assert
			expect(mockNext).toHaveBeenCalledWith(expect.any(UnauthorizedError))
			const error = vi.mocked(mockNext).mock
				.calls[0]?.[0] as unknown as UnauthorizedError
			expect(error.message).toBe('Invalid API key')
		})

		it('should return UnauthorizedError when API key is incorrect', () => {
			// Arrange
			mockRequest.headers = {
				'x-api-key': 'wrong-api-key',
			}

			// Act
			apiKeyAuth(mockRequest as Request, mockResponse as Response, mockNext)

			// Assert
			expect(mockNext).toHaveBeenCalledWith(expect.any(UnauthorizedError))
			const error = vi.mocked(mockNext).mock
				.calls[0]?.[0] as unknown as UnauthorizedError
			expect(error.message).toBe('Invalid API key')
		})

		it('should accept valid API key with correct header name', () => {
			// Arrange - The middleware looks for 'x-api-key' header specifically
			mockRequest.headers = {
				'x-api-key': 'test-api-key-12345678901234567890',
			}

			// Act
			apiKeyAuth(mockRequest as Request, mockResponse as Response, mockNext)

			// Assert
			expect(mockNext).toHaveBeenCalledWith()
			expect(mockNext).toHaveBeenCalledTimes(1)
		})

		it('should reject API key with wrong header case (Express normalizes headers)', () => {
			// Arrange - Express normalizes headers to lowercase, but this tests the behavior
			mockRequest.headers = {
				'X-API-KEY': 'test-api-key-12345678901234567890',
			}

			// Act
			apiKeyAuth(mockRequest as Request, mockResponse as Response, mockNext)

			// Assert - This should fail because Express would normalize to 'x-api-key'
			// but our mock doesn't do that normalization
			expect(mockNext).toHaveBeenCalledWith(expect.any(UnauthorizedError))
		})
	})

	describe('Successful Authentication', () => {
		it('should call next() without error when valid API key is provided', () => {
			// Arrange
			mockRequest.headers = {
				'x-api-key': 'test-api-key-12345678901234567890',
			}

			// Act
			apiKeyAuth(mockRequest as Request, mockResponse as Response, mockNext)

			// Assert
			expect(mockNext).toHaveBeenCalledWith()
			expect(mockNext).toHaveBeenCalledTimes(1)
		})

		it('should proceed when API key matches exactly', () => {
			// Arrange
			mockRequest.headers = {
				'x-api-key': 'test-api-key-12345678901234567890',
			}

			// Act
			apiKeyAuth(mockRequest as Request, mockResponse as Response, mockNext)

			// Assert
			expect(mockNext).toHaveBeenCalledWith()
			expect(mockNext).not.toHaveBeenCalledWith(expect.any(Error))
		})
	})

	describe('Logging Behavior', () => {
		// Note: Testing API key not configured scenario requires complex module mocking
		// due to top-level config import. Focusing on testable logging scenarios.
		// Can not easily test when api key is undefined or empty string.

		it('should log warning with IP when invalid API key is provided', async () => {
			// Arrange
			const { pino } = await import('../../utils/logger.ts')
			const request = {
				...mockRequest,
				headers: { 'x-api-key': 'invalid-key' },
				ip: '192.168.1.1',
			} as Request

			// Act
			apiKeyAuth(request, mockResponse as Response, mockNext)

			// Assert
			expect(pino.logger.warn).toHaveBeenCalledWith(
				'[apiKeyAuth]: Invalid API key attempt from IP: 192.168.1.1',
			)
		})

		it('should log warning with empty string when IP is undefined', async () => {
			// Arrange
			const { pino } = await import('../../utils/logger.ts')
			const request = {
				...mockRequest,
				headers: { 'x-api-key': 'invalid-key' },
				ip: undefined,
			} as Request

			// Act
			apiKeyAuth(request, mockResponse as Response, mockNext)

			// Assert
			expect(pino.logger.warn).toHaveBeenCalledWith(
				'[apiKeyAuth]: Invalid API key attempt from IP: ',
			)
		})

		it('should log debug message when API key validation is successful', async () => {
			// Arrange
			const { pino } = await import('../../utils/logger.ts')
			mockRequest.headers = {
				'x-api-key': 'test-api-key-12345678901234567890',
			}

			// Act
			apiKeyAuth(mockRequest as Request, mockResponse as Response, mockNext)

			// Assert
			expect(pino.logger.debug).toHaveBeenCalledWith(
				'[middleware - apiKeyAuth]: API key validation successful',
			)
		})
	})

	describe('Edge Cases', () => {
		it('should handle API key as array (Express header behavior)', () => {
			// Arrange - Express can sometimes parse headers as arrays
			const request = {
				...mockRequest,
				headers: {
					'x-api-key': ['test-api-key-12345678901234567890', 'duplicate'],
				},
			} as Request

			// Act
			apiKeyAuth(request, mockResponse as Response, mockNext)

			// Assert
			expect(mockNext).toHaveBeenCalledWith(expect.any(UnauthorizedError))
		})

		it('should handle whitespace in API key', () => {
			// Arrange
			mockRequest.headers = {
				'x-api-key': ' test-api-key-12345678901234567890 ',
			}

			// Act
			apiKeyAuth(mockRequest as Request, mockResponse as Response, mockNext)

			// Assert
			expect(mockNext).toHaveBeenCalledWith(expect.any(UnauthorizedError))
		})

		it('should handle null header value', () => {
			// Arrange
			const request = {
				...mockRequest,
				headers: {
					'x-api-key': null,
				},
			} as unknown as Request

			// Act
			apiKeyAuth(request, mockResponse as Response, mockNext)

			// Assert
			expect(mockNext).toHaveBeenCalledWith(expect.any(UnauthorizedError))
		})

		it('should handle undefined header value', () => {
			// Arrange
			const request = {
				...mockRequest,
				headers: {
					'x-api-key': undefined,
				},
			} as unknown as Request

			// Act
			apiKeyAuth(request, mockResponse as Response, mockNext)

			// Assert
			expect(mockNext).toHaveBeenCalledWith(expect.any(UnauthorizedError))
		})

		it('should handle numeric header value', () => {
			// Arrange
			const request = {
				...mockRequest,
				headers: {
					'x-api-key': 12345,
				},
			} as unknown as Request

			// Act
			apiKeyAuth(request, mockResponse as Response, mockNext)

			// Assert
			expect(mockNext).toHaveBeenCalledWith(expect.any(UnauthorizedError))
		})

		it('should handle boolean header value', () => {
			// Arrange
			const request = {
				...mockRequest,
				headers: {
					'x-api-key': true,
				},
			} as unknown as Request

			// Act
			apiKeyAuth(request, mockResponse as Response, mockNext)

			// Assert
			expect(mockNext).toHaveBeenCalledWith(expect.any(UnauthorizedError))
		})
	})

	describe('Security Considerations', () => {
		it('should not leak the expected API key in error messages', () => {
			// Arrange
			mockRequest.headers = {
				'x-api-key': 'wrong-key',
			}

			// Act
			apiKeyAuth(mockRequest as Request, mockResponse as Response, mockNext)

			// Assert
			expect(mockNext).toHaveBeenCalledWith(expect.any(UnauthorizedError))
			const error = vi.mocked(mockNext).mock
				.calls[0]?.[0] as unknown as UnauthorizedError
			expect(error.message).toBe('Invalid API key')
			expect(error.message).not.toContain('test-api-key-12345678901234567890')
		})

		it('should not leak the provided API key in error messages', () => {
			// Arrange
			const maliciousKey = 'malicious-attempt-key'
			mockRequest.headers = {
				'x-api-key': maliciousKey,
			}

			// Act
			apiKeyAuth(mockRequest as Request, mockResponse as Response, mockNext)

			// Assert
			expect(mockNext).toHaveBeenCalledWith(expect.any(UnauthorizedError))
			const error = vi.mocked(mockNext).mock
				.calls[0]?.[0] as unknown as UnauthorizedError
			expect(error.message).toBe('Invalid API key')
			expect(error.message).not.toContain(maliciousKey)
		})

		it('should handle very long API key attempts', () => {
			// Arrange
			const longKey = 'a'.repeat(10000)
			mockRequest.headers = {
				'x-api-key': longKey,
			}

			// Act
			apiKeyAuth(mockRequest as Request, mockResponse as Response, mockNext)

			// Assert
			expect(mockNext).toHaveBeenCalledWith(expect.any(UnauthorizedError))
		})

		it('should handle special characters in API key attempts', () => {
			// Arrange
			mockRequest.headers = {
				'x-api-key': '!@#$%^&*()_+-=[]{}|;:,.<>?',
			}

			// Act
			apiKeyAuth(mockRequest as Request, mockResponse as Response, mockNext)

			// Assert
			expect(mockNext).toHaveBeenCalledWith(expect.any(UnauthorizedError))
		})
	})

	describe('Path Validation', () => {
		it('should validate API key for non-swagger paths', () => {
			// Arrange
			const request = {
				...mockRequest,
				path: '/api/users',
				headers: {},
			} as Request

			// Act
			apiKeyAuth(request, mockResponse as Response, mockNext)

			// Assert
			expect(mockNext).toHaveBeenCalledWith(expect.any(UnauthorizedError))
		})

		it('should validate API key for root path', () => {
			// Arrange
			const request = { ...mockRequest, path: '/', headers: {} } as Request

			// Act
			apiKeyAuth(request, mockResponse as Response, mockNext)

			// Assert
			expect(mockNext).toHaveBeenCalledWith(expect.any(UnauthorizedError))
		})

		it('should validate API key for paths that contain api-docs but do not start with it', () => {
			// Arrange
			const request = {
				...mockRequest,
				path: '/some/api-docs/path',
				headers: {},
			} as Request

			// Act
			apiKeyAuth(request, mockResponse as Response, mockNext)

			// Assert
			expect(mockNext).toHaveBeenCalledWith(expect.any(UnauthorizedError))
		})
	})
})
