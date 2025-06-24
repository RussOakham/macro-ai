/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { mockErrorHandling } from '../error-handling.mock.ts'

/**
 * Example test file demonstrating usage patterns for the error handling mock helper
 * This file shows practical examples of how to use the mock helper in real test scenarios
 */

// Mock the error handling module using the helper
vi.mock('../../error-handling/try-catch.ts', () =>
	mockErrorHandling.createModule(),
)

// Import after mocking
import { tryCatch, tryCatchSync } from '../../error-handling/try-catch.ts'
import { AppError, Result } from '../../errors.ts'

// Example service that uses error handling utilities
class ExampleService {
	async fetchUserData(
		userId: string,
	): Promise<Result<{ id: string; name: string }>> {
		return await tryCatch(
			this.simulateApiCall(userId),
			'ExampleService - fetchUserData',
		)
	}

	parseUserConfig(
		configString: string,
	): Result<{ theme: string; language: string }> {
		return tryCatchSync(
			() => this.simulateConfigParsing(configString),
			'ExampleService - parseUserConfig',
		)
	}

	private async simulateApiCall(
		userId: string,
	): Promise<{ id: string; name: string }> {
		// This would normally be an actual API call
		if (userId === 'invalid') {
			throw new Error('User not found')
		}
		return Promise.resolve({ id: userId, name: 'John Doe' })
	}

	private simulateConfigParsing(configString: string): {
		theme: string
		language: string
	} {
		// This would normally be actual JSON parsing
		if (configString === 'invalid') {
			throw new Error('Invalid JSON')
		}
		return { theme: 'dark', language: 'en' }
	}
}

describe('Error Handling Mock Helper - Usage Examples', () => {
	let exampleService: ExampleService

	beforeEach(() => {
		// Setup fresh mocks for each test
		mockErrorHandling.setup()
		exampleService = new ExampleService()
	})

	describe('Basic Mock Usage', () => {
		it('should mock tryCatch to return success result', async () => {
			// Arrange - Mock tryCatch to return success
			const mockData = { id: '123', name: 'John Doe' }
			vi.mocked(tryCatch).mockResolvedValue(
				mockErrorHandling.successResult(mockData),
			)

			// Act
			const [result, error] = await exampleService.fetchUserData('123')

			// Assert
			expect(tryCatch).toHaveBeenCalledWith(
				expect.any(Promise),
				'ExampleService - fetchUserData',
			)
			expect(result).toEqual(mockData)
			expect(error).toBeNull()
		})

		it('should mock tryCatch to return error result', async () => {
			// Arrange - Mock tryCatch to return error
			const mockError = mockErrorHandling.errors.notFound(
				'User not found',
				'ExampleService',
			)
			vi.mocked(tryCatch).mockResolvedValue(
				mockErrorHandling.errorResult(mockError),
			)

			// Act - Use a valid ID to avoid the actual promise rejection
			const [result, error] = await exampleService.fetchUserData('valid-id')

			// Assert
			expect(tryCatch).toHaveBeenCalledWith(
				expect.any(Promise),
				'ExampleService - fetchUserData',
			)
			expect(result).toBeNull()
			expect(error).toEqual(mockError)
		})

		it('should mock tryCatchSync to return success result', () => {
			// Arrange - Mock tryCatchSync to return success
			const mockConfig = { theme: 'dark', language: 'en' }
			vi.mocked(tryCatchSync).mockReturnValue(
				mockErrorHandling.successResult(mockConfig),
			)

			// Act
			const [result, error] = exampleService.parseUserConfig('valid-config')

			// Assert
			expect(tryCatchSync).toHaveBeenCalledWith(
				expect.any(Function),
				'ExampleService - parseUserConfig',
			)
			expect(result).toEqual(mockConfig)
			expect(error).toBeNull()
		})

		it('should mock tryCatchSync to return error result', () => {
			// Arrange - Mock tryCatchSync to return error
			const mockError = mockErrorHandling.errors.validation(
				'Invalid JSON',
				undefined,
				'ExampleService',
			)
			vi.mocked(tryCatchSync).mockReturnValue(
				mockErrorHandling.errorResult(mockError),
			)

			// Act
			const [result, error] = exampleService.parseUserConfig('invalid')

			// Assert
			expect(tryCatchSync).toHaveBeenCalledWith(
				expect.any(Function),
				'ExampleService - parseUserConfig',
			)
			expect(result).toBeNull()
			expect(error).toEqual(mockError)
		})
	})

	describe('Real Implementation Usage', () => {
		it('should use real tryCatch implementation for integration-style testing', async () => {
			// Arrange - Use real implementation that actually catches errors
			vi.mocked(tryCatch).mockImplementation(
				mockErrorHandling.withRealTryCatch(),
			)

			// Act - This will actually call the service method and catch the error
			const [result, error] = await exampleService.fetchUserData('invalid')

			// Assert - The real implementation caught the error and converted it to AppError
			expect(result).toBeNull()
			expect(error).toBeInstanceOf(AppError)
			expect(error!.message).toBe('User not found')
			expect(error!.service).toBe('ExampleService - fetchUserData')
		})

		it('should use real tryCatchSync implementation for integration-style testing', () => {
			// Arrange - Use real implementation that actually catches errors
			vi.mocked(tryCatchSync).mockImplementation(
				mockErrorHandling.withRealTryCatchSync(),
			)

			// Act - This will actually call the service method and catch the error
			const [result, error] = exampleService.parseUserConfig('invalid')

			// Assert - The real implementation caught the error and converted it to AppError
			expect(result).toBeNull()
			expect(error).toBeInstanceOf(AppError)
			expect(error!.message).toBe('Invalid JSON')
			expect(error!.service).toBe('ExampleService - parseUserConfig')
		})

		it('should use real implementation for successful operations', async () => {
			// Arrange - Use real implementation
			vi.mocked(tryCatch).mockImplementation(
				mockErrorHandling.withRealTryCatch(),
			)

			// Act - This will actually call the service method successfully
			const [result, error] = await exampleService.fetchUserData('123')

			// Assert - The real implementation returned the actual result
			expect(result).toEqual({ id: '123', name: 'John Doe' })
			expect(error).toBeNull()
		})
	})

	describe('Error Scenario Testing', () => {
		it('should test different error types using error helpers', async () => {
			// Test validation error
			const validationError = mockErrorHandling.errors.validation(
				'Invalid user ID format',
				{ field: 'userId' },
				'ExampleService',
			)
			vi.mocked(tryCatch).mockResolvedValue(
				mockErrorHandling.errorResult(validationError),
			)

			const [result1, error1] =
				await exampleService.fetchUserData('invalid-format')
			expect(result1).toBeNull()
			expect(error1?.type).toBe('ValidationError')
			expect(error1?.status).toBe(400)

			// Test unauthorized error
			const unauthorizedError = mockErrorHandling.errors.unauthorized(
				'Access token expired',
				'ExampleService',
			)
			vi.mocked(tryCatch).mockResolvedValue(
				mockErrorHandling.errorResult(unauthorizedError),
			)

			const [result2, error2] =
				await exampleService.fetchUserData('expired-token')
			expect(result2).toBeNull()
			expect(error2?.type).toBe('UnauthorizedError')
			expect(error2?.status).toBe(401)

			// Test internal error
			const internalError = mockErrorHandling.errors.internal(
				'Database connection failed',
				'ExampleService',
			)
			vi.mocked(tryCatch).mockResolvedValue(
				mockErrorHandling.errorResult(internalError),
			)

			const [result3, error3] = await exampleService.fetchUserData('db-error')
			expect(result3).toBeNull()
			expect(error3?.type).toBe('InternalError')
			expect(error3?.status).toBe(500)
		})
	})

	describe('Advanced Usage Patterns', () => {
		it('should demonstrate conditional mocking based on input', async () => {
			// Arrange - Mock different behaviors based on input
			vi.mocked(tryCatch).mockImplementation(async (promise, context) => {
				// You can inspect the context or other factors to return different results
				if (context?.includes('fetchUserData')) {
					try {
						const result = await promise
						return mockErrorHandling.successResult(result)
					} catch {
						// Properly handle the error to prevent unhandled rejection
						// Note: In this mock, we intentionally ignore the actual error
						// and return a predefined mock error for testing purposes
						return mockErrorHandling.errorResult(
							mockErrorHandling.errors.notFound(
								'User not found',
								'ExampleService',
							),
						)
					}
				}
				return mockErrorHandling.errorResult(
					mockErrorHandling.errors.internal(
						'Unknown operation',
						'ExampleService',
					),
				)
			})

			// Act & Assert - Test successful case
			const [result, error] = await exampleService.fetchUserData('123')
			expect(result).toEqual({ id: '123', name: 'John Doe' })
			expect(error).toBeNull()

			// Test error case
			const [result2, error2] = await exampleService.fetchUserData('invalid')
			expect(result2).toBeNull()
			expect(error2).toBeInstanceOf(AppError)
			expect(error2?.message).toBe('User not found')
		})

		it('should demonstrate spy functionality while using real implementation', async () => {
			// Arrange - Use real implementation but spy on calls
			const realTryCatch = mockErrorHandling.withRealTryCatch()
			vi.mocked(tryCatch).mockImplementation(realTryCatch)

			// Act
			await exampleService.fetchUserData('123')
			await exampleService.fetchUserData('invalid')

			// Assert - Can verify calls while still getting real behavior
			expect(tryCatch).toHaveBeenCalledTimes(2)
			expect(tryCatch).toHaveBeenNthCalledWith(
				1,
				expect.any(Promise),
				'ExampleService - fetchUserData',
			)
			expect(tryCatch).toHaveBeenNthCalledWith(
				2,
				expect.any(Promise),
				'ExampleService - fetchUserData',
			)
		})
	})
})
