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

	describe('getPublicReadinessStatus', () => {
		it('should return ready status when database and configuration are ready', () => {
			// Arrange
			vi.mocked(tryCatchSync).mockReturnValue(
				mockErrorHandling.successResult({
					ready: true,
					message: 'Application is ready to receive traffic',
					timestamp: '2023-01-01T00:00:00.000Z',
					checks: {
						database: true,
						configuration: true,
					},
				}),
			)

			// Act
			const [result, error] = utilityService.getPublicReadinessStatus()

			// Assert
			expect(tryCatchSync).toHaveBeenCalledOnce()
			expect(result).toEqual({
				ready: true,
				message: 'Application is ready to receive traffic',
				timestamp: '2023-01-01T00:00:00.000Z',
				checks: {
					database: true,
					configuration: true,
				},
			})
			expect(error).toBeNull()
		})

		it('should return not ready status when database is not ready', () => {
			// Arrange
			vi.mocked(tryCatchSync).mockReturnValue(
				mockErrorHandling.successResult({
					ready: false,
					message: 'Application is not ready to receive traffic',
					timestamp: '2023-01-01T00:00:00.000Z',
					checks: {
						database: false,
						configuration: true,
					},
				}),
			)

			// Act
			const [result, error] = utilityService.getPublicReadinessStatus()

			// Assert
			expect(result?.ready).toBe(false)
			expect(result?.message).toContain('not ready')
			expect(error).toBeNull()
		})

		it('should handle errors during readiness check', () => {
			// Arrange
			const serviceError = mockErrorHandling.errors.internal('Readiness check failed', 'test')
			vi.mocked(tryCatchSync).mockReturnValue(
				mockErrorHandling.errorResult(serviceError),
			)

			// Act
			const [result, error] = utilityService.getPublicReadinessStatus()

			// Assert
			expect(result).toBeNull()
			expect(error).toEqual(serviceError)
		})
	})

	describe('getDetailedHealthStatus', () => {
		it('should return healthy status when all checks pass', () => {
			// Arrange
			vi.mocked(tryCatchSync).mockReturnValue(
				mockErrorHandling.successResult({
					status: 'healthy',
					message: 'All systems operational',
					timestamp: '2023-01-01T00:00:00.000Z',
					checks: {
						database: { status: 'healthy', responseTime: 10 },
						memory: { status: 'healthy', usagePercent: 50 },
						disk: { status: 'healthy' },
						dependencies: {
							status: 'healthy',
							services: [{ name: 'API', status: 'healthy' }],
						},
						configuration: {
							status: 'healthy',
							critical: { ready: true, missing: [] },
							important: { ready: true, missing: [] },
							optional: { ready: true, missing: [] },
						},
					},
				}),
			)

			// Act
			const [result, error] = utilityService.getDetailedHealthStatus()

			// Assert
			expect(result?.status).toBe('healthy')
			expect(result?.message).toBe('All systems operational')
			expect(error).toBeNull()
		})

		it('should return degraded status when some checks fail', () => {
			// Arrange
			vi.mocked(tryCatchSync).mockReturnValue(
				mockErrorHandling.successResult({
					status: 'degraded',
					message: 'Some systems experiencing issues',
					timestamp: '2023-01-01T00:00:00.000Z',
					checks: {
						database: { status: 'healthy', responseTime: 10 },
						memory: { status: 'healthy', usagePercent: 50 },
						disk: { status: 'healthy' },
						dependencies: {
							status: 'unhealthy',
							services: [{ name: 'API', status: 'unhealthy' }],
						},
						configuration: {
							status: 'healthy',
							critical: { ready: true, missing: [] },
							important: { ready: true, missing: [] },
							optional: { ready: true, missing: [] },
						},
					},
				}),
			)

			// Act
			const [result, error] = utilityService.getDetailedHealthStatus()

			// Assert
			expect(result?.status).toBe('degraded')
			expect(error).toBeNull()
		})

		it('should handle errors during detailed health check', () => {
			// Arrange
			const serviceError = mockErrorHandling.errors.internal('Health check failed', 'test')
			vi.mocked(tryCatchSync).mockReturnValue(
				mockErrorHandling.errorResult(serviceError),
			)

			// Act
			const [result, error] = utilityService.getDetailedHealthStatus()

			// Assert
			expect(result).toBeNull()
			expect(error).toEqual(serviceError)
		})
	})
})
