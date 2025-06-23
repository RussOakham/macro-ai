import { vi } from 'vitest'

// Type inference helper - this will be used inside functions to avoid hoisting issues
type UserServiceType =
	typeof import('../../features/user/user.services.ts').userService

// Type inference from actual userService instance - following established pattern
// This ensures our mocks stay in sync with the real implementation
type MockUserServiceType = {
	[K in keyof UserServiceType]: ReturnType<typeof vi.fn>
}

/**
 * Reusable mock for UserService supporting service method mocking
 *
 * Service Method Mock Usage (for controller tests):
 * ```typescript
 * import { mockUserService } from '../../utils/test-helpers/user-service.mock.ts'
 *
 * vi.mock('../user.services.ts', () => mockUserService.createModule())
 *
 * describe('User Controller', () => {
 *   let userMocks: ReturnType<typeof mockUserService.setup>
 *
 *   beforeEach(() => {
 *     userMocks = mockUserService.setup()
 *   })
 *
 *   it('should test something', () => {
 *     const mockUser = mockUserService.createUser({ email: 'test@example.com' })
 *     userMocks.getUserById.mockResolvedValue([mockUser, null])
 *   })
 * })
 * ```
 */

/**
 * Creates a basic service mock with all methods
 * Use this for creating fresh mock instances
 * Creates mocks for all known UserService methods based on the type inference
 */
export const createUserServiceMock = (): MockUserServiceType => {
	// Create mocks for all known methods - these are inferred from the type
	// This maintains type safety while avoiding hoisting issues
	return {
		getUserById: vi.fn(),
		getUserByEmail: vi.fn(),
		getUserByAccessToken: vi.fn(),
		registerOrLoginUserById: vi.fn(),
	} as MockUserServiceType
}

/**
 * Creates a mock factory for vi.mock() to mock the UserService
 * Use this for controller tests that use the UserService
 */
export const createServiceMock = (): {
	userService: MockUserServiceType
} => {
	const serviceMock = createUserServiceMock()

	return {
		userService: serviceMock,
	}
}

/**
 * Sets up and returns the service method mocks for easy access in tests
 * Use this in beforeEach for controller tests
 */
export const setupServiceMock = (): MockUserServiceType => {
	vi.clearAllMocks()
	return createUserServiceMock()
}

/**
 * Creates a mock TUser object with proper defaults
 * Use this to create consistent user test data
 */
export const createMockUser = (
	overrides: Partial<{
		id: string
		email: string
		emailVerified: boolean
		firstName: string | null
		lastName: string | null
		createdAt: Date
		updatedAt: Date
		lastLogin: Date | null
	}> = {},
) => ({
	id: '123e4567-e89b-12d3-a456-426614174000',
	email: 'test@example.com',
	emailVerified: true,
	firstName: 'John',
	lastName: 'Doe',
	createdAt: new Date('2023-01-01T00:00:00.000Z'),
	updatedAt: new Date('2023-01-01T00:00:00.000Z'),
	lastLogin: new Date('2023-01-01T00:00:00.000Z'),
	...overrides,
})

/**
 * Creates a mock TInsertUser object with proper defaults
 * Use this to create consistent user insertion test data
 */
export const createMockInsertUser = (
	overrides: Partial<{
		id: string
		email: string
		firstName?: string
		lastName?: string
	}> = {},
) => ({
	id: '123e4567-e89b-12d3-a456-426614174000',
	email: 'test@example.com',
	firstName: 'John',
	lastName: 'Doe',
	...overrides,
})

/**
 * Creates a mock TUserResponse object with proper defaults
 * Use this to create consistent API response test data
 */
export const createMockUserResponse = (
	overrides: Partial<{
		id: string
		email: string
		emailVerified: boolean
		firstName: string | null
		lastName: string | null
		createdAt: string
		updatedAt: string
		lastLogin: string | null
	}> = {},
) => ({
	id: '123e4567-e89b-12d3-a456-426614174000',
	email: 'test@example.com',
	emailVerified: true,
	firstName: 'John',
	lastName: 'Doe',
	createdAt: '2023-01-01T00:00:00.000Z',
	updatedAt: '2023-01-01T00:00:00.000Z',
	lastLogin: '2023-01-01T00:00:00.000Z',
	...overrides,
})

/**
 * Unified export object supporting service method mocking
 * Following the established pattern from other mock helpers
 */
export const mockUserService = {
	// Core factory functions
	create: createUserServiceMock,
	createModule: createServiceMock,
	setup: setupServiceMock,

	// Mock data creators
	createUser: createMockUser,
	createInsertUser: createMockInsertUser,
	createUserResponse: createMockUserResponse,
}
