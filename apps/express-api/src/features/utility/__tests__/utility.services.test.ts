import { beforeEach, describe, expect, it, vi } from 'vitest'

import { InternalError } from '../../../utils/errors.ts'
import { mockErrorHandling } from '../../../utils/test-helpers/error-handling.mock.ts'
import { mockLogger } from '../../../utils/test-helpers/logger.mock.ts'
import { utilityService } from '../utility.services.ts'

// Mock the logger using the reusable helper
vi.mock('../../../utils/logger.ts', () => mockLogger.createModule())

// Mock the error handling module using the helper
vi.mock('../../../utils/error-handling/try-catch.ts', () =>
	mockErrorHandling.createModule(),
)

// Import after mocking
import { tryCatchSync } from '../../../utils/error-handling/try-catch.ts'

describe('UtilityService', () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	describe('getHealthStatus', () => {
		describe.each([
			[
				'successful health check',
				{
					message: 'Api Health Status: OK',
					timestamp: '2023-01-01T00:00:00.000Z',
					uptime: 100,
					memoryUsageMB: 50,
				},
				null,
			],
			[
				'health check error',
				null,
				mockErrorHandling.errors.internal('Health check failed', 'test'),
			],
		])('should handle %s', (scenario, expectedResult, expectedError) => {
			it(`should ${scenario}`, () => {
				// Arrange
				if (expectedError) {
					vi.mocked(tryCatchSync).mockReturnValue(
						mockErrorHandling.errorResult(expectedError),
					)
				} else {
					vi.mocked(tryCatchSync).mockReturnValue(
						mockErrorHandling.successResult(expectedResult),
					)
				}

				// Act
				const [result, error] = utilityService.getHealthStatus()

				// Assert
				expect(tryCatchSync).toHaveBeenCalledOnce()
				expect(result).toEqual(expectedResult)
				expect(error).toEqual(expectedError)
			})
		})

		it('should handle invalid uptime error', () => {
			// Arrange - Mock process.uptime to return negative value
			const originalUptime = process.uptime.bind(process)
			process.uptime = vi.fn().mockReturnValue(-1)

			// Mock tryCatchSync to use real implementation for integration-style testing
			vi.mocked(tryCatchSync).mockImplementation(
				mockErrorHandling.withRealTryCatchSync(),
			)

			// Act
			const [result, error] = utilityService.getHealthStatus()

			// Assert
			expect(result).toBeNull()
			expect(error).toBeInstanceOf(InternalError)
			expect((error as InternalError).message).toBe('Process uptime is invalid')

			// Restore original function
			process.uptime = originalUptime
		})
	})

	describe('getSystemInfo', () => {
		describe.each([
			[
				'successful system info retrieval',
				{
					nodeVersion: 'v18.0.0',
					platform: 'linux',
					architecture: 'x64',
					uptime: 100,
					memoryUsage: {
						rss: 50,
						heapTotal: 30,
						heapUsed: 20,
						external: 5,
					},
					cpuUsage: {
						user: 1000,
						system: 500,
					},
					timestamp: '2023-01-01T00:00:00.000Z',
				},
				null,
			],
			[
				'system info error',
				null,
				mockErrorHandling.errors.internal('System info failed', 'test'),
			],
		])('should handle %s', (scenario, expectedResult, expectedError) => {
			it(`should ${scenario}`, () => {
				// Arrange
				if (expectedError) {
					vi.mocked(tryCatchSync).mockReturnValue(
						mockErrorHandling.errorResult(expectedError),
					)
				} else {
					vi.mocked(tryCatchSync).mockReturnValue(
						mockErrorHandling.successResult(expectedResult),
					)
				}

				// Act
				const [result, error] = utilityService.getSystemInfo()

				// Assert
				expect(tryCatchSync).toHaveBeenCalledOnce()
				expect(result).toEqual(expectedResult)
				expect(error).toEqual(expectedError)
			})
		})
	})
})
