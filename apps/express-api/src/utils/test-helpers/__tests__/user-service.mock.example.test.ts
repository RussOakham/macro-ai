import { beforeEach, describe, expect, it, vi } from 'vitest'

import { NotFoundError } from '../../errors.ts'
import { mockUserService } from '../user-service.mock.ts'

// Mock the user service using the reusable helper
vi.mock('../../../features/user/user.services.ts', () =>
	mockUserService.createModule(),
)

// Import after mocking
import { userService } from '../../../features/user/user.services.ts'

/**
 * Example test demonstrating how to use the mockUserService helper
 * This shows the recommended patterns for testing with UserService
 */
describe('mockUserService Example Usage', () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	describe('Service Method Mocking', () => {
		it('should mock getUserById successfully', async () => {
			// Arrange - Create mock data using the helper
			const mockUser = mockUserService.createUser({
				id: 'custom-user-id',
				email: 'custom@example.com',
			})

			// Mock the service method
			vi.mocked(userService.getUserById).mockResolvedValue([mockUser, null])

			// Act
			const [result, error] = await userService.getUserById({
				userId: 'custom-user-id',
			})

			// Assert
			expect(userService.getUserById).toHaveBeenCalledWith({
				userId: 'custom-user-id',
			})
			expect(result).toEqual(mockUser)
			expect(error).toBeNull()
			expect(result?.id).toBe('custom-user-id')
			expect(result?.email).toBe('custom@example.com')
		})

		it('should mock getUserById with error', async () => {
			// Arrange
			const mockError = new NotFoundError('User not found', 'userService')

			// Mock the service method to return error
			vi.mocked(userService.getUserById).mockResolvedValue([null, mockError])

			// Act
			const [result, error] = await userService.getUserById({
				userId: 'non-existent-id',
			})

			// Assert
			expect(userService.getUserById).toHaveBeenCalledWith({
				userId: 'non-existent-id',
			})
			expect(result).toBeNull()
			expect(error).toEqual(mockError)
		})

		it('should mock getUserByEmail successfully', async () => {
			// Arrange - Create mock data using the helper
			const mockUser = mockUserService.createUser({
				email: 'test@domain.com',
				firstName: 'Jane',
				lastName: 'Smith',
			})

			// Mock the service method
			vi.mocked(userService.getUserByEmail).mockResolvedValue([mockUser, null])

			// Act
			const [result, error] = await userService.getUserByEmail({
				email: 'test@domain.com',
			})

			// Assert
			expect(userService.getUserByEmail).toHaveBeenCalledWith({
				email: 'test@domain.com',
			})
			expect(result).toEqual(mockUser)
			expect(error).toBeNull()
			expect(result?.firstName).toBe('Jane')
			expect(result?.lastName).toBe('Smith')
		})

		it('should mock getUserByAccessToken successfully', async () => {
			// Arrange - Create mock data using the helper
			const mockUser = mockUserService.createUser({
				email: 'token-user@example.com',
			})

			// Mock the service method
			vi.mocked(userService.getUserByAccessToken).mockResolvedValue([
				mockUser,
				null,
			])

			// Act
			const [result, error] = await userService.getUserByAccessToken({
				accessToken: 'valid-access-token',
			})

			// Assert
			expect(userService.getUserByAccessToken).toHaveBeenCalledWith({
				accessToken: 'valid-access-token',
			})
			expect(result).toEqual(mockUser)
			expect(error).toBeNull()
		})

		it('should mock registerOrLoginUserById successfully', async () => {
			// Arrange - Create mock data using the helper
			const mockUser = mockUserService.createUser({
				id: 'new-user-id',
				email: 'newuser@example.com',
				firstName: 'New',
				lastName: 'User',
			})

			// Mock the service method
			vi.mocked(userService.registerOrLoginUserById).mockResolvedValue([
				mockUser,
				null,
			])

			// Act
			const [result, error] = await userService.registerOrLoginUserById({
				id: 'new-user-id',
				email: 'newuser@example.com',
				firstName: 'New',
				lastName: 'User',
			})

			// Assert
			expect(userService.registerOrLoginUserById).toHaveBeenCalledWith({
				id: 'new-user-id',
				email: 'newuser@example.com',
				firstName: 'New',
				lastName: 'User',
			})
			expect(result).toEqual(mockUser)
			expect(error).toBeNull()
		})
	})

	describe('Mock Data Creation', () => {
		it('should create user with defaults', () => {
			// Act
			const user = mockUserService.createUser()

			// Assert
			expect(user).toEqual({
				id: '123e4567-e89b-12d3-a456-426614174000',
				email: 'test@example.com',
				emailVerified: true,
				firstName: 'John',
				lastName: 'Doe',
				createdAt: new Date('2023-01-01T00:00:00.000Z'),
				updatedAt: new Date('2023-01-01T00:00:00.000Z'),
				lastLogin: new Date('2023-01-01T00:00:00.000Z'),
			})
		})

		it('should create user with overrides', () => {
			// Act
			const user = mockUserService.createUser({
				email: 'custom@example.com',
				firstName: 'Custom',
				emailVerified: false,
			})

			// Assert
			expect(user.email).toBe('custom@example.com')
			expect(user.firstName).toBe('Custom')
			expect(user.emailVerified).toBe(false)
			// Other properties should keep defaults
			expect(user.lastName).toBe('Doe')
			expect(user.id).toBe('123e4567-e89b-12d3-a456-426614174000')
		})

		it('should create insert user with defaults', () => {
			// Act
			const insertUser = mockUserService.createInsertUser()

			// Assert
			expect(insertUser).toEqual({
				id: '123e4567-e89b-12d3-a456-426614174000',
				email: 'test@example.com',
				firstName: 'John',
				lastName: 'Doe',
			})
		})

		it('should create user response with defaults', () => {
			// Act
			const userResponse = mockUserService.createUserResponse()

			// Assert
			expect(userResponse).toEqual({
				id: '123e4567-e89b-12d3-a456-426614174000',
				email: 'test@example.com',
				emailVerified: true,
				firstName: 'John',
				lastName: 'Doe',
				createdAt: '2023-01-01T00:00:00.000Z',
				updatedAt: '2023-01-01T00:00:00.000Z',
				lastLogin: '2023-01-01T00:00:00.000Z',
			})
		})

		it('should create user response with partial overrides', () => {
			// Act
			const userResponse = mockUserService.createUserResponse({
				email: 'response@example.com',
				firstName: 'Response',
				lastLogin: null,
			})

			// Assert
			expect(userResponse.email).toBe('response@example.com')
			expect(userResponse.firstName).toBe('Response')
			expect(userResponse.lastLogin).toBeNull()
			// Other properties should keep defaults
			expect(userResponse.lastName).toBe('Doe')
			expect(userResponse.emailVerified).toBe(true)
		})
	})
})
