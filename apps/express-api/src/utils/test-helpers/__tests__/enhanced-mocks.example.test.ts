import { beforeEach, describe, expect, it } from 'vitest'

import {
	createEnhancedMock,
	createMockExpressObjects,
	createMockUserService,
	createServiceMocks,
	mockUtils,
	resetAllMocks,
} from '../enhanced-mocks.ts'

// Example usage of enhanced mocks
describe('Enhanced Mocks Examples', () => {
	beforeEach(() => {
		resetAllMocks()
	})

	describe('Service Mocks', () => {
		it('should create user service mock with automatic type inference', async () => {
			const mockUserService = createMockUserService()

			// Mock the getUserById method - it returns a Result<TUser> tuple
			const mockUser = {
				id: '123',
				email: 'test@example.com',
				emailVerified: false,
				firstName: 'John',
				lastName: 'Doe',
				createdAt: new Date(),
				updatedAt: new Date(),
				lastLogin: null,
			}
			mockUserService.getUserById.mockResolvedValue([mockUser, null])

			// Call the mocked method
			const [result, error] = await mockUserService.getUserById({
				userId: '123',
			})

			// Verify the result
			expect(result).toEqual(mockUser)
			expect(error).toBeNull()

			// Verify the method was called with correct arguments
			expect(mockUserService.getUserById).toHaveBeenCalledWith({
				userId: '123',
			})
			expect(mockUserService.getUserById).toHaveBeenCalledTimes(1)
		})

		it('should create multiple service mocks at once', () => {
			const mocks = createServiceMocks()

			// All services are automatically mocked with proper types
			expect(mocks.userService).toBeDefined()
			expect(mocks.chatService).toBeDefined()
			expect(mocks.authService).toBeDefined()

			// You can mock methods on any of them
			mocks.userService.getUserById.mockResolvedValue([
				{ id: '123' } as never,
				null,
			])
			mocks.chatService.createChat.mockResolvedValue([
				{ id: 'chat-123' } as never,
				null,
			])
			mocks.authService.getAuthUser.mockResolvedValue([
				{ Username: 'test-user' } as never,
				null,
			])
		})
	})

	describe('Express Object Mocks', () => {
		it('should create mock Express request and response objects', () => {
			const { req, res } = createMockExpressObjects({
				body: { email: 'test@example.com' },
				params: { id: '123' },
				query: { page: '1' },
				headers: { 'content-type': 'application/json' },
			})

			// Verify the mocks work
			expect(req.body).toEqual({ email: 'test@example.com' })
			expect(req.params).toEqual({ id: '123' })
			expect(req.query).toEqual({ page: '1' })
			expect(req.headers).toEqual({ 'content-type': 'application/json' })

			// Test response chaining with node-mocks-http
			res.status(200).json({ success: true })
			expect(res._getStatusCode()).toBe(200)
			expect(res._getJSONData()).toEqual({ success: true })
		})

		it('should create mock Express objects with custom options', () => {
			const { req, res } = createMockExpressObjects(
				{
					method: 'POST',
					url: '/api/users',
					body: { name: 'John Doe' },
				},
				{
					locals: { user: { id: '123' } },
				},
			)

			expect(req.method).toBe('POST')
			expect(req.url).toBe('/api/users')
			expect(req.body).toEqual({ name: 'John Doe' })
			expect(res.locals.user).toEqual({ id: '123' })
		})
	})

	describe('Generic Enhanced Mocks', () => {
		it('should create enhanced mock for any type', () => {
			// Create a mock for a hypothetical service
			const mockService = createEnhancedMock<{
				getData: () => Promise<string>
				setData: (data: string) => Promise<void>
				deleteData: (id: string) => Promise<boolean>
			}>()

			// Mock the methods
			mockService.getData.mockResolvedValue('test data')
			mockService.setData.mockResolvedValue(undefined)
			mockService.deleteData.mockResolvedValue(true)

			// Use the mocked service
			void expect(mockService.getData()).resolves.toBe('test data')
			void expect(mockService.setData('new data')).resolves.toBeUndefined()
			void expect(mockService.deleteData('123')).resolves.toBe(true)
		})
	})

	describe('Mock Utilities', () => {
		it('should create resolving mock', async () => {
			const mock = mockUtils.createResolvingMock('test value')

			const result = (await mock()) as string
			expect(result).toBe('test value')
		})

		it('should create rejecting mock', async () => {
			const error = new Error('Test error')
			const mock = mockUtils.createRejectingMock(error)

			await expect(mock()).rejects.toThrow(error)
		})

		it('should create returning mock', () => {
			const mock = mockUtils.createReturningMock('test value')

			const result = mock() as string
			expect(result).toBe('test value')
		})

		it('should create throwing mock', () => {
			const error = new Error('Test error')
			const mock = mockUtils.createThrowingMock(error)

			expect(() => mock() as never).toThrow('Test error')
		})
	})
})
