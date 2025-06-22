import { beforeEach, describe, expect, it, vi } from 'vitest'

import { tryCatchSync } from '../../../utils/error-handling/try-catch.ts'
import { InternalError } from '../../../utils/errors.ts'
import { utilityService } from '../utility.services.ts'

// Mock the logger
vi.mock('../../../utils/logger.ts', () => ({
	pino: {
		logger: {
			error: vi.fn(),
			info: vi.fn(),
		},
	},
}))

// Mock the tryCatchSync utility
vi.mock('../../../utils/error-handling/try-catch.ts', () => ({
	tryCatchSync: vi.fn(),
}))

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
			vi.mocked(tryCatchSync).mockReturnValue([mockHealthStatus, null])

			// Act
			const [result, error] = utilityService.getHealthStatus()

			// Assert
			expect(tryCatchSync).toHaveBeenCalledOnce()
			expect(result).toEqual(mockHealthStatus)
			expect(error).toBeNull()
		})

		it('should handle error in health check', () => {
			// Arrange
			const mockError = new InternalError('Health check failed', 'test')

			// Mock tryCatchSync to return error
			vi.mocked(tryCatchSync).mockReturnValue([null, mockError])

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

			// Mock tryCatchSync to call the actual function and catch the error
			vi.mocked(tryCatchSync).mockImplementation((fn) => {
				try {
					const result = fn()
					return [result, null]
				} catch (error) {
					return [null, error as InternalError]
				}
			})

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
			vi.mocked(tryCatchSync).mockReturnValue([mockSystemInfo, null])

			// Act
			const [result, error] = utilityService.getSystemInfo()

			// Assert
			expect(tryCatchSync).toHaveBeenCalledOnce()
			expect(result).toEqual(mockSystemInfo)
			expect(error).toBeNull()
		})

		it('should handle error in system info retrieval', () => {
			// Arrange
			const mockError = new InternalError('System info failed', 'test')

			// Mock tryCatchSync to return error
			vi.mocked(tryCatchSync).mockReturnValue([null, mockError])

			// Act
			const [result, error] = utilityService.getSystemInfo()

			// Assert
			expect(tryCatchSync).toHaveBeenCalledOnce()
			expect(result).toBeNull()
			expect(error).toEqual(mockError)
		})
	})
})
