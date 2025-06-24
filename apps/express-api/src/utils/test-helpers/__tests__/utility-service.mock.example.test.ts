import { beforeEach, describe, expect, it, vi } from 'vitest'

import { InternalError } from '../../errors.ts'
import { mockUtilityService } from '../utility-service.mock.ts'

// Mock the utility service using the reusable helper
vi.mock('../../../features/utility/utility.services.ts', () =>
	mockUtilityService.createModule(),
)

// Import after mocking
import { utilityService } from '../../../features/utility/utility.services.ts'

/**
 * Example test demonstrating how to use the mockUtilityService helper
 * This shows the recommended patterns for testing with UtilityService
 */
describe('mockUtilityService Example Usage', () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	describe('Service Method Mocking', () => {
		it('should mock getHealthStatus successfully', () => {
			// Arrange - Create mock data using the helper
			const mockHealthStatus = mockUtilityService.createHealthStatus({
				uptime: 150,
				memoryUsageMB: 75,
			})

			// Mock the service method
			vi.mocked(utilityService.getHealthStatus).mockReturnValue([
				mockHealthStatus,
				null,
			])

			// Act
			const [result, error] = utilityService.getHealthStatus()

			// Assert
			expect(utilityService.getHealthStatus).toHaveBeenCalledOnce()
			expect(result).toEqual(mockHealthStatus)
			expect(error).toBeNull()
			expect(result?.uptime).toBe(150)
			expect(result?.memoryUsageMB).toBe(75)
		})

		it('should mock getHealthStatus with error', () => {
			// Arrange
			const mockError = new InternalError(
				'Health check failed',
				'utilityService',
			)

			// Mock the service method to return error
			vi.mocked(utilityService.getHealthStatus).mockReturnValue([
				null,
				mockError,
			])

			// Act
			const [result, error] = utilityService.getHealthStatus()

			// Assert
			expect(utilityService.getHealthStatus).toHaveBeenCalledOnce()
			expect(result).toBeNull()
			expect(error).toEqual(mockError)
		})

		it('should mock getSystemInfo successfully', () => {
			// Arrange - Create mock data using the helper
			const mockSystemInfo = mockUtilityService.createSystemInfo({
				nodeVersion: 'v20.0.0',
				platform: 'darwin',
				memoryUsage: {
					rss: 100,
					heapTotal: 60,
					heapUsed: 40,
					external: 10,
				},
			})

			// Mock the service method
			vi.mocked(utilityService.getSystemInfo).mockReturnValue([
				mockSystemInfo,
				null,
			])

			// Act
			const [result, error] = utilityService.getSystemInfo()

			// Assert
			expect(utilityService.getSystemInfo).toHaveBeenCalledOnce()
			expect(result).toEqual(mockSystemInfo)
			expect(error).toBeNull()
			expect(result?.nodeVersion).toBe('v20.0.0')
			expect(result?.platform).toBe('darwin')
			expect(result?.memoryUsage.rss).toBe(100)
		})

		it('should mock getSystemInfo with error', () => {
			// Arrange
			const mockError = new InternalError(
				'System info failed',
				'utilityService',
			)

			// Mock the service method to return error
			vi.mocked(utilityService.getSystemInfo).mockReturnValue([null, mockError])

			// Act
			const [result, error] = utilityService.getSystemInfo()

			// Assert
			expect(utilityService.getSystemInfo).toHaveBeenCalledOnce()
			expect(result).toBeNull()
			expect(error).toEqual(mockError)
		})
	})

	describe('Mock Data Creation', () => {
		it('should create health status with defaults', () => {
			// Act
			const healthStatus = mockUtilityService.createHealthStatus()

			// Assert
			expect(healthStatus).toEqual({
				message: 'Api Health Status: OK',
				timestamp: '2023-01-01T00:00:00.000Z',
				uptime: 100,
				memoryUsageMB: 50,
			})
		})

		it('should create health status with overrides', () => {
			// Act
			const healthStatus = mockUtilityService.createHealthStatus({
				uptime: 200,
				memoryUsageMB: 80,
				message: 'Custom health message',
			})

			// Assert
			expect(healthStatus).toEqual({
				message: 'Custom health message',
				timestamp: '2023-01-01T00:00:00.000Z',
				uptime: 200,
				memoryUsageMB: 80,
			})
		})

		it('should create system info with defaults', () => {
			// Act
			const systemInfo = mockUtilityService.createSystemInfo()

			// Assert
			expect(systemInfo).toEqual({
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
			})
		})

		it('should create system info with partial overrides', () => {
			// Act
			const systemInfo = mockUtilityService.createSystemInfo({
				nodeVersion: 'v20.0.0',
				memoryUsage: {
					rss: 100,
					heapTotal: 60,
					heapUsed: 40,
					external: 10,
				},
			})

			// Assert
			expect(systemInfo.nodeVersion).toBe('v20.0.0')
			expect(systemInfo.memoryUsage).toEqual({
				rss: 100,
				heapTotal: 60,
				heapUsed: 40,
				external: 10,
			})
			// Other properties should keep defaults
			expect(systemInfo.platform).toBe('linux')
			expect(systemInfo.cpuUsage).toEqual({
				user: 1000,
				system: 500,
			})
		})
	})
})
