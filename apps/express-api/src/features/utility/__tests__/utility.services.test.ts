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
		it('should return health status successfully', () => {
			// Arrange
			const mockHealthStatus = {
				message: 'Api Health Status: OK',
				timestamp: '2023-01-01T00:00:00.000Z',
				uptime: 100,
				memoryUsageMB: 50,
			}

			// Mock tryCatchSync to return successful result
			vi.mocked(tryCatchSync).mockReturnValue(
				mockErrorHandling.successResult(mockHealthStatus),
			)

			// Act
			const [result, error] = utilityService.getHealthStatus()

			// Assert
			expect(tryCatchSync).toHaveBeenCalledOnce()
			expect(result).toEqual(mockHealthStatus)
			expect(error).toBeNull()
		})

		it('should handle error in health check', () => {
			// Arrange
			const mockError = mockErrorHandling.errors.internal(
				'Health check failed',
				'test',
			)

			// Mock tryCatchSync to return error
			vi.mocked(tryCatchSync).mockReturnValue(
				mockErrorHandling.errorResult(mockError),
			)

			// Act
			const [result, error] = utilityService.getHealthStatus()

			// Assert
			expect(tryCatchSync).toHaveBeenCalledOnce()
			expect(result).toBeNull()
			expect(error).toEqual(mockError)
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
		it('should return system info successfully', () => {
			// Arrange
			const mockSystemInfo = {
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
			}

			// Mock tryCatchSync to return successful result
			vi.mocked(tryCatchSync).mockReturnValue(
				mockErrorHandling.successResult(mockSystemInfo),
			)

			// Act
			const [result, error] = utilityService.getSystemInfo()

			// Assert
			expect(tryCatchSync).toHaveBeenCalledOnce()
			expect(result).toEqual(mockSystemInfo)
			expect(error).toBeNull()
		})

		it('should handle error in system info retrieval', () => {
			// Arrange
			const mockError = mockErrorHandling.errors.internal(
				'System info failed',
				'test',
			)

			// Mock tryCatchSync to return error
			vi.mocked(tryCatchSync).mockReturnValue(
				mockErrorHandling.errorResult(mockError),
			)

			// Act
			const [result, error] = utilityService.getSystemInfo()

			// Assert
			expect(tryCatchSync).toHaveBeenCalledOnce()
			expect(result).toBeNull()
			expect(error).toEqual(mockError)
		})
	})
})
