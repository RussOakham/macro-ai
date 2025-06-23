import { vi } from 'vitest'

// Type inference helper - this will be used inside functions to avoid hoisting issues
type UtilityServiceType =
	typeof import('../../features/utility/utility.services.ts').utilityService

// Type inference from actual utilityService instance - following established pattern
// This ensures our mocks stay in sync with the real implementation
type MockUtilityServiceType = {
	[K in keyof UtilityServiceType]: ReturnType<typeof vi.fn>
}

/**
 * Reusable mock for UtilityService supporting service method mocking
 *
 * Service Method Mock Usage (for controller tests):
 * ```typescript
 * import { mockUtilityService } from '../../utils/test-helpers/utility-service.mock.ts'
 *
 * vi.mock('../utility.services.ts', () => mockUtilityService.createModule())
 *
 * describe('Utility Controller', () => {
 *   let utilityMocks: ReturnType<typeof mockUtilityService.setup>
 *
 *   beforeEach(() => {
 *     utilityMocks = mockUtilityService.setup()
 *   })
 *
 *   it('should test something', () => {
 *     const mockHealthStatus = mockUtilityService.createHealthStatus({ uptime: 100 })
 *     utilityMocks.getHealthStatus.mockReturnValue([mockHealthStatus, null])
 *   })
 * })
 * ```
 */

/**
 * Creates a basic service mock with all methods
 * Use this for creating fresh mock instances
 * Creates mocks for all known UtilityService methods based on the type inference
 */
export const createUtilityServiceMock = (): MockUtilityServiceType => {
	// Create mocks for all known methods - these are inferred from the type
	// This maintains type safety while avoiding hoisting issues
	return {
		getHealthStatus: vi.fn(),
		getSystemInfo: vi.fn(),
	} as MockUtilityServiceType
}

/**
 * Creates a mock factory for vi.mock() to mock the UtilityService
 * Use this for controller tests that use the UtilityService
 */
export const createServiceMock = (): {
	utilityService: MockUtilityServiceType
} => {
	const serviceMock = createUtilityServiceMock()

	return {
		utilityService: serviceMock,
	}
}

/**
 * Sets up and returns the service method mocks for easy access in tests
 * Use this in beforeEach for controller tests
 */
export const setupServiceMock = (): MockUtilityServiceType => {
	vi.clearAllMocks()
	return createUtilityServiceMock()
}

/**
 * Creates a mock THealthStatus object with proper defaults
 * Use this to create consistent health status test data
 */
export const createMockHealthStatus = (
	overrides: Partial<{
		message: string
		timestamp: string
		uptime: number
		memoryUsageMB: number
	}> = {},
) => ({
	message: 'Api Health Status: OK',
	timestamp: '2023-01-01T00:00:00.000Z',
	uptime: 100,
	memoryUsageMB: 50,
	...overrides,
})

/**
 * Creates a mock TSystemInfo object with proper defaults
 * Use this to create consistent system info test data
 */
export const createMockSystemInfo = (
	overrides: Partial<{
		nodeVersion: string
		platform: string
		architecture: string
		uptime: number
		memoryUsage: {
			rss: number
			heapTotal: number
			heapUsed: number
			external: number
		}
		cpuUsage: {
			user: number
			system: number
		}
		timestamp: string
	}> = {},
) => ({
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
	...overrides,
})

/**
 * Unified export object supporting service method mocking
 * Following the established pattern from other mock helpers
 */
export const mockUtilityService = {
	// Core factory functions
	create: createUtilityServiceMock,
	createModule: createServiceMock,
	setup: setupServiceMock,

	// Mock data creators
	createHealthStatus: createMockHealthStatus,
	createSystemInfo: createMockSystemInfo,
}
