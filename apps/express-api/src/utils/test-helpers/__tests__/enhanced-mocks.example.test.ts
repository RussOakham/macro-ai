import { beforeEach, describe, expect, it } from 'vitest'

import {
	createEnhancedMock,
	createMockExpressObjects,
	createMockUserService,
	createServiceMocks,
	mockUtils,
	resetAllMocks,
} from '../enhanced-mocks.ts'

/**
 * ⚠️ ANTI-PATTERN EXAMPLES - DO NOT USE IN PRODUCTION
 *
 * This file demonstrates TESTING ANTI-PATTERNS that violate CLAUDE.md guidelines.
 * These examples show what NOT to do in real test suites.
 *
 * CLAUDE.md Rule Violations:
 * - Over-testing of mock setup and configuration
 * - Testing implementation details of mocking utilities
 * - Exhaustive testing of helper functions
 *
 * Use these examples to LEARN what to AVOID, not what to emulate.
 *
 * For production tests, focus on:
 * ✅ Core logic correctness
 * ✅ Critical failure paths
 * ✅ Integration with external systems (mocked where possible)
 * ✅ Realistic and valuable test cases only
 */

// Example usage of enhanced mocks
describe('Enhanced Mocks Examples', () => {
	beforeEach(() => {
		resetAllMocks()
	})

	describe('Service Mocks', () => {
		it('ANTI-PATTERN: should create user service mock with exhaustive type inference testing', async () => {
			// ❌ VIOLATION: Testing mock setup and type inference instead of business logic
			// ✅ PRODUCTION: Use mocks to test your code, don't test the mocks themselves
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

		it('ANTI-PATTERN: should create multiple service mocks with exhaustive setup testing', () => {
			// ❌ VIOLATION: Testing mock creation and setup instead of business logic
			// ✅ PRODUCTION: Focus on testing what your code does with the mocks, not the mocks themselves
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
		it('ANTI-PATTERN: should create mock Express objects with exhaustive property testing', () => {
			// ❌ VIOLATION: Testing mock setup and configuration instead of Express middleware logic
			// ✅ PRODUCTION: Use Express mocks to test your middleware, don't test the mock setup
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

		it('ANTI-PATTERN: should create mock Express objects with exhaustive custom option testing', () => {
			// ❌ VIOLATION: Testing mock configuration options instead of middleware behavior
			// ✅ PRODUCTION: Test your middleware logic, not the mock configuration details
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
		it('ANTI-PATTERN: should create enhanced mock with exhaustive type and method testing', () => {
			// ❌ VIOLATION: Testing mock creation and method setup instead of business logic
			// ✅ PRODUCTION: Use generic mocks to test your code, don't test the mock framework
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
		it('ANTI-PATTERN: should create resolving mock with exhaustive utility testing', async () => {
			// ❌ VIOLATION: Testing mock utility functions instead of business logic
			// ✅ PRODUCTION: Use mock utilities to support testing, don't test the utilities themselves
			const mock = mockUtils.createResolvingMock('test value')

			const result = (await mock()) as string
			expect(result).toBe('test value')
		})

		it('ANTI-PATTERN: should create rejecting mock with exhaustive error testing', async () => {
			// ❌ VIOLATION: Testing mock error creation instead of error handling logic
			// ✅ PRODUCTION: Test how your code handles errors, not how mocks create them
			const error = new Error('Test error')
			const mock = mockUtils.createRejectingMock(error)

			await expect(mock()).rejects.toThrow(error)
		})

		it('ANTI-PATTERN: should create returning mock with exhaustive behavior testing', () => {
			// ❌ VIOLATION: Testing mock return behavior instead of business logic
			// ✅ PRODUCTION: Use returning mocks to test your code, don't test the mock behavior
			const mock = mockUtils.createReturningMock('test value')

			const result = mock() as string
			expect(result).toBe('test value')
		})

		it('ANTI-PATTERN: should create throwing mock with exhaustive exception testing', () => {
			// ❌ VIOLATION: Testing mock exception throwing instead of exception handling
			// ✅ PRODUCTION: Test how your code handles exceptions, not how mocks throw them
			const error = new Error('Test error')
			const mock = mockUtils.createThrowingMock(error)

			expect(() => mock() as never).toThrow('Test error')
		})
	})
})
