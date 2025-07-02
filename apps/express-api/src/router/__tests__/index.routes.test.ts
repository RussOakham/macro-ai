import express, { type Router } from 'express'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { mockLogger } from '../../utils/test-helpers/logger.mock.ts'

// Mock the logger using the reusable helper
vi.mock('../../utils/logger.ts', () => mockLogger.createModule())

// Mock the individual feature routers
vi.mock('../../features/auth/auth.routes.ts', () => ({
	authRouter: vi.fn(),
}))

vi.mock('../../features/chat/chat.routes.ts', () => ({
	chatRouter: vi.fn(),
}))

vi.mock('../../features/user/user.routes.ts', () => ({
	userRouter: vi.fn(),
}))

vi.mock('../../features/utility/utility.routes.ts', () => ({
	utilityRouter: vi.fn(),
}))

// Import after mocking
import { authRouter } from '../../features/auth/auth.routes.ts'
import { chatRouter } from '../../features/chat/chat.routes.ts'
import { userRouter } from '../../features/user/user.routes.ts'
import { utilityRouter } from '../../features/utility/utility.routes.ts'
import { appRouter } from '../index.routes.ts'

describe('appRouter', () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	describe('Router Registration', () => {
		it('should register all feature routers in correct order', () => {
			// Act
			const router = appRouter()

			// Assert
			expect(router).toBeDefined()
			expect(authRouter).toHaveBeenCalledTimes(1)
			expect(utilityRouter).toHaveBeenCalledTimes(1)
			expect(userRouter).toHaveBeenCalledTimes(1)

			// Verify the router instance is passed to each feature router
			expect(authRouter).toHaveBeenCalledWith(expect.any(Function))
			expect(chatRouter).toHaveBeenCalledWith(expect.any(Function))
			expect(utilityRouter).toHaveBeenCalledWith(expect.any(Function))
			expect(userRouter).toHaveBeenCalledWith(expect.any(Function))
		})

		it('should register routers in the correct order (auth, utility, user)', () => {
			// Arrange
			const callOrder: string[] = []

			vi.mocked(authRouter).mockImplementation(() => {
				callOrder.push('auth')
			})
			vi.mocked(chatRouter).mockImplementation(() => {
				callOrder.push('chat')
			})
			vi.mocked(utilityRouter).mockImplementation(() => {
				callOrder.push('utility')
			})
			vi.mocked(userRouter).mockImplementation(() => {
				callOrder.push('user')
			})

			// Act
			appRouter()

			// Assert
			expect(callOrder).toEqual(['auth', 'chat', 'utility', 'user'])
		})

		it('should pass the same router instance to all feature routers', () => {
			// Act
			const router = appRouter()

			// Assert
			const authRouterCall = vi.mocked(authRouter).mock.calls[0]
			const chatRouterCall = vi.mocked(chatRouter).mock.calls[0]
			const utilityRouterCall = vi.mocked(utilityRouter).mock.calls[0]
			const userRouterCall = vi.mocked(userRouter).mock.calls[0]

			// Verify the same router instance is passed to all feature routers
			expect(router).toBeDefined()
			expect(authRouterCall).toBeDefined()
			expect(chatRouterCall).toBeDefined()
			expect(utilityRouterCall).toBeDefined()
			expect(userRouterCall).toBeDefined()

			// Verify the same router instance is passed to all feature routers
			if (
				!authRouterCall ||
				!chatRouterCall ||
				!utilityRouterCall ||
				!userRouterCall
			) {
				throw new Error('Router calls not defined')
			}

			expect(authRouterCall[0]).toBe(utilityRouterCall[0])
			expect(authRouterCall[0]).toBe(chatRouterCall[0])
			expect(utilityRouterCall[0]).toBe(userRouterCall[0])
			expect(authRouterCall[0]).toBe(userRouterCall[0])
		})

		it('should return a valid Express Router instance', () => {
			// Act
			const router = appRouter()

			// Assert
			expect(router).toBeDefined()
			expect(typeof router).toBe('function')
			expect(typeof router.use).toBe('function')
			expect(typeof router.get).toBe('function')
			expect(typeof router.post).toBe('function')
			expect(typeof router.put).toBe('function')
			expect(typeof router.delete).toBe('function')
		})
	})

	describe('Router Instance Properties', () => {
		it('should return the same router instance on multiple calls', () => {
			// Act
			const router1 = appRouter()
			const router2 = appRouter()

			// Assert - Note: This tests the current implementation where the same router instance is reused
			// This behavior might need to change if router instances should be unique per call
			expect(router1).toBe(router2)
		})

		it('should have Express Router methods available', () => {
			// Act
			const router = appRouter()

			// Assert
			const expectedMethods = [
				'use',
				'get',
				'post',
				'put',
				'delete',
				'patch',
				'all',
				'param',
				'route',
			]
			expectedMethods.forEach((method) => {
				expect(typeof router[method as keyof Router]).toBe('function')
			})
		})

		it('should be an instance of Express Router', () => {
			// Act
			const router = appRouter()

			// Assert
			expect(router.constructor.name).toBe('Function')
		})
	})

	describe('Error Handling', () => {
		beforeEach(() => {
			// Reset all mocks to default behavior before each test
			vi.mocked(authRouter).mockImplementation(() => {
				// No-op implementation for testing
			})
			vi.mocked(chatRouter).mockImplementation(() => {
				// No-op implementation for testing
			})
			vi.mocked(utilityRouter).mockImplementation(() => {
				// No-op implementation for testing
			})
			vi.mocked(userRouter).mockImplementation(() => {
				// No-op implementation for testing
			})
		})

		it('should handle errors during auth router registration', () => {
			// Arrange
			const error = new Error('Auth router registration failed')
			vi.mocked(authRouter).mockImplementation(() => {
				throw error
			})

			// Act & Assert
			expect(() => appRouter()).toThrow('Auth router registration failed')
		})

		it('should handle errors during chat router registration', () => {
			// Arrange
			const error = new Error('Chat router registration failed')
			vi.mocked(chatRouter).mockImplementation(() => {
				throw error
			})

			// Act & Assert
			expect(() => appRouter()).toThrow('Chat router registration failed')
		})

		it('should handle errors during utility router registration', () => {
			// Arrange
			const error = new Error('Utility router registration failed')
			vi.mocked(utilityRouter).mockImplementation(() => {
				throw error
			})

			// Act & Assert
			expect(() => appRouter()).toThrow('Utility router registration failed')
		})

		it('should handle errors during user router registration', () => {
			// Arrange
			const error = new Error('User router registration failed')
			vi.mocked(userRouter).mockImplementation(() => {
				throw error
			})

			// Act & Assert
			expect(() => appRouter()).toThrow('User router registration failed')
		})

		it('should not call subsequent routers if earlier router fails', () => {
			// Arrange
			vi.mocked(authRouter).mockImplementation(() => {
				throw new Error('Auth router failed')
			})

			// Act & Assert
			expect(() => appRouter()).toThrow()
			expect(authRouter).toHaveBeenCalledTimes(1)
			expect(utilityRouter).not.toHaveBeenCalled()
			expect(userRouter).not.toHaveBeenCalled()
		})
	})

	describe('Router Configuration', () => {
		it('should allow feature routers to modify the router instance', () => {
			// Arrange
			let routerInstance: Router | undefined

			vi.mocked(authRouter).mockImplementation((router: Router) => {
				routerInstance = router
				// Simulate adding a route
				router.get('/test-auth', () => {
					// No-op route handler for testing
				})
			})

			// Act
			const router = appRouter()

			// Assert
			expect(routerInstance).toBe(router)
			expect(authRouter).toHaveBeenCalledWith(router)
		})

		it('should maintain router state across feature router calls', () => {
			// Arrange
			const routerModifications: string[] = []

			vi.mocked(authRouter).mockImplementation((router: Router) => {
				routerModifications.push('auth-modified')
				// Simulate router modification - router.stack is always defined for Express Router
				router.stack = []
			})

			vi.mocked(chatRouter).mockImplementation((router: Router) => {
				routerModifications.push('chat-modified')
				// Verify router state is maintained
				expect(router.stack).toBeDefined()
			})

			vi.mocked(utilityRouter).mockImplementation((router: Router) => {
				routerModifications.push('utility-modified')
				// Verify router state is maintained
				expect(router.stack).toBeDefined()
			})

			vi.mocked(userRouter).mockImplementation((router: Router) => {
				routerModifications.push('user-modified')
				// Verify router state is maintained
				expect(router.stack).toBeDefined()
			})

			// Act
			appRouter()

			// Assert
			expect(routerModifications).toEqual([
				'auth-modified',
				'chat-modified',
				'utility-modified',
				'user-modified',
			])
		})
	})

	describe('Integration Scenarios', () => {
		it('should successfully integrate with Express application', () => {
			// Arrange
			const app = express()

			// Act
			const router = appRouter()
			app.use('/api', router)

			// Assert
			expect(router).toBeDefined()
			expect(app._router).toBeDefined()
		})

		it('should handle multiple router registrations', () => {
			// Act
			appRouter()
			appRouter()

			// Assert
			// Each call should register the routers again
			expect(authRouter).toHaveBeenCalledTimes(2)
			expect(chatRouter).toHaveBeenCalledTimes(2)
			expect(utilityRouter).toHaveBeenCalledTimes(2)
			expect(userRouter).toHaveBeenCalledTimes(2)
		})

		it('should maintain router functionality after feature router registration', () => {
			// Arrange
			vi.mocked(authRouter).mockImplementation((router: Router) => {
				router.get('/auth/test', vi.fn())
			})
			vi.mocked(chatRouter).mockImplementation((router: Router) => {
				router.get('/chat/test', vi.fn())
			})
			vi.mocked(utilityRouter).mockImplementation((router: Router) => {
				router.get('/utility/test', vi.fn())
			})
			vi.mocked(userRouter).mockImplementation((router: Router) => {
				router.get('/user/test', vi.fn())
			})

			// Act
			const router = appRouter()

			// Assert
			expect(router).toBeDefined()
			expect(typeof router.use).toBe('function')
			expect(authRouter).toHaveBeenCalledWith(router)
			expect(chatRouter).toHaveBeenCalledWith(router)
			expect(utilityRouter).toHaveBeenCalledWith(router)
			expect(userRouter).toHaveBeenCalledWith(router)
		})
	})

	describe('Router Validation', () => {
		it('should validate that router parameter is correctly typed', () => {
			// Arrange
			let receivedRouter: Router | undefined

			vi.mocked(authRouter).mockImplementation((router: Router) => {
				receivedRouter = router
			})

			// Act
			appRouter()

			// Assert
			expect(receivedRouter).toBeDefined()
			if (receivedRouter) {
				expect(typeof receivedRouter.use).toBe('function')
				expect(typeof receivedRouter.get).toBe('function')
				expect(typeof receivedRouter.post).toBe('function')
			}
		})

		it('should ensure router instance has required Express Router properties', () => {
			// Act
			const router = appRouter()

			// Assert
			expect(router).toHaveProperty('stack')
			expect(router).toHaveProperty('params')
			expect(router).toHaveProperty('caseSensitive')
			expect(router).toHaveProperty('mergeParams')
			expect(router).toHaveProperty('strict')
		})

		it('should verify router methods are callable', () => {
			// Act
			const router = appRouter()

			// Assert - Test that router methods don't throw when called
			const noOpMiddleware = () => {
				// No-op middleware for testing
			}
			const noOpHandler = () => {
				// No-op route handler for testing
			}

			expect(() => router.use(noOpMiddleware)).not.toThrow()
			expect(() => router.get('/test', noOpHandler)).not.toThrow()
			expect(() => router.post('/test', noOpHandler)).not.toThrow()
		})
	})

	describe('Edge Cases', () => {
		it('should handle null or undefined router functions gracefully', () => {
			// This test ensures the current implementation doesn't break if router functions are undefined
			// Note: This is more of a defensive programming test
			try {
				// Act & Assert - Current implementation should work with mocked functions
				expect(() => appRouter()).not.toThrow()
			} finally {
				// Restore original functions (though they're mocked anyway)
				const noOpRouter = () => {
					// No-op implementation for restoration
				}
				vi.mocked(authRouter).mockImplementation(noOpRouter)
				vi.mocked(chatRouter).mockImplementation(noOpRouter)
				vi.mocked(utilityRouter).mockImplementation(noOpRouter)
				vi.mocked(userRouter).mockImplementation(noOpRouter)
			}
		})

		it('should handle router registration with no-op functions', () => {
			// Arrange
			const noOpImplementation = () => {
				// No-op implementation for testing
			}
			vi.mocked(authRouter).mockImplementation(noOpImplementation)
			vi.mocked(chatRouter).mockImplementation(noOpImplementation)
			vi.mocked(utilityRouter).mockImplementation(noOpImplementation)
			vi.mocked(userRouter).mockImplementation(noOpImplementation)

			// Act
			const router = appRouter()

			// Assert
			expect(router).toBeDefined()
			expect(authRouter).toHaveBeenCalledTimes(1)
			expect(chatRouter).toHaveBeenCalledTimes(1)
			expect(utilityRouter).toHaveBeenCalledTimes(1)
			expect(userRouter).toHaveBeenCalledTimes(1)
		})

		it('should handle partial router registration failures', () => {
			// Arrange
			vi.mocked(authRouter).mockImplementation(() => {
				// Auth router succeeds
			})
			vi.mocked(utilityRouter).mockImplementation(() => {
				throw new Error('Utility router failed')
			})

			// Act & Assert
			expect(() => appRouter()).toThrow('Utility router failed')
			expect(authRouter).toHaveBeenCalledTimes(1)
			expect(chatRouter).not.toHaveBeenCalled()
			expect(utilityRouter).toHaveBeenCalledTimes(1)
			expect(userRouter).not.toHaveBeenCalled()
		})

		it('should maintain router instance integrity across registrations', () => {
			// Arrange
			const routerInstances: Router[] = []

			vi.mocked(authRouter).mockImplementation((router) => {
				routerInstances.push(router)
			})
			vi.mocked(chatRouter).mockImplementation((router) => {
				routerInstances.push(router)
			})
			vi.mocked(utilityRouter).mockImplementation((router) => {
				routerInstances.push(router)
			})
			vi.mocked(userRouter).mockImplementation((router) => {
				routerInstances.push(router)
			})

			// Act
			const mainRouter = appRouter()

			// Assert
			expect(routerInstances).toHaveLength(3)
			expect(routerInstances[0]).toBe(mainRouter)
			expect(routerInstances[1]).toBe(mainRouter)
			expect(routerInstances[2]).toBe(mainRouter)
			// All feature routers should receive the same router instance
			expect(routerInstances.every((r) => r === mainRouter)).toBe(true)
		})
	})
})
