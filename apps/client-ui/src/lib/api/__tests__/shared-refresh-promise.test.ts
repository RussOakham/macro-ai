import { http, HttpResponse } from 'msw'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// Import enhanced testing utilities
import {
	createNetworkErrorScenarios,
	createTrackingMockApiClient,
	testErrorHandling,
} from '../../../test/api-test-utils.test-utils'
import {
	setupMSWForTests,
	setupServerWithHandlers,
} from '../../../test/msw-setup'

describe('Shared Refresh Promise', () => {
	// Setup MSW for all tests in this describe block
	setupMSWForTests()

	beforeEach(() => {
		vi.clearAllMocks()
	})

	describe('Module Integration', () => {
		it('should have shared refresh promise utilities available', async () => {
			// Test that the module can be imported
			const module = await import('../../auth/shared-refresh-promise')

			expect(module.setSharedRefreshPromise).toBeDefined()
			expect(module.getSharedRefreshPromise).toBeDefined()
			expect(module.clearSharedRefreshPromise).toBeDefined()
			expect(module.waitForRefreshCompletion).toBeDefined()

			expect(typeof module.setSharedRefreshPromise).toBe('function')
			expect(typeof module.getSharedRefreshPromise).toBe('function')
			expect(typeof module.clearSharedRefreshPromise).toBe('function')
			expect(typeof module.waitForRefreshCompletion).toBe('function')
		})

		it('should handle basic promise coordination', async () => {
			// Test basic functionality without relying on global mocks
			const module = await import('../../auth/shared-refresh-promise')

			// Test that waitForRefreshCompletion resolves
			await expect(module.waitForRefreshCompletion()).resolves.toBeUndefined()
		})
	})

	describe('Enhanced Shared Refresh Promise Testing', () => {
		it('should coordinate refresh operations correctly', async () => {
			const module = await import('../../auth/shared-refresh-promise')

			// Create a mock refresh promise
			let resolveRefresh: () => void = () => {
				/* no-op */
			}
			const refreshPromise = new Promise<void>((resolve) => {
				resolveRefresh = resolve
			})

			// Set the shared refresh promise
			module.setSharedRefreshPromise(refreshPromise)

			// Test waitForRefreshCompletion
			const waitPromise = module.waitForRefreshCompletion()

			// Resolve the refresh promise
			resolveRefresh()

			// Wait for completion
			await expect(waitPromise).resolves.toBeUndefined()

			// Clear the shared promise
			module.clearSharedRefreshPromise()
		})

		it('should handle refresh promise errors gracefully', async () => {
			const module = await import('../../auth/shared-refresh-promise')

			// Create a mock refresh promise that rejects
			const refreshPromise = Promise.reject(new Error('Refresh failed'))

			// Ensure the rejection is handled by catching it
			refreshPromise.catch(() => {
				// Expected error - this is intentional for testing
			})

			// Set the shared refresh promise
			module.setSharedRefreshPromise(refreshPromise)

			// Test waitForRefreshCompletion with error
			const waitPromise = module.waitForRefreshCompletion()

			// Should resolve even if the refresh promise rejects
			await expect(waitPromise).resolves.toBeUndefined()

			// Clear the shared promise
			module.clearSharedRefreshPromise()
		})

		it('should handle concurrent waitForRefreshCompletion calls', async () => {
			const module = await import('../../auth/shared-refresh-promise')

			// Create a mock refresh promise
			let resolveRefresh: () => void = () => {
				/* no-op */
			}
			const refreshPromise = new Promise<void>((resolve) => {
				resolveRefresh = resolve
			})

			// Set the shared refresh promise
			module.setSharedRefreshPromise(refreshPromise)

			// Create multiple wait calls
			const waitPromises = [
				module.waitForRefreshCompletion(),
				module.waitForRefreshCompletion(),
				module.waitForRefreshCompletion(),
			]

			// Resolve the refresh promise
			resolveRefresh()

			// All wait promises should resolve
			await expect(Promise.all(waitPromises)).resolves.toEqual([
				undefined,
				undefined,
				undefined,
			])

			// Clear the shared promise
			module.clearSharedRefreshPromise()
		})

		it('should handle refresh promise lifecycle correctly', async () => {
			const module = await import('../../auth/shared-refresh-promise')

			// Initially no shared promise
			expect(module.getSharedRefreshPromise()).toBeNull()

			// Create and set a refresh promise
			const refreshPromise = Promise.resolve()
			module.setSharedRefreshPromise(refreshPromise)

			// Wait for completion
			await module.waitForRefreshCompletion()

			// Clear the promise
			module.clearSharedRefreshPromise()
			expect(module.getSharedRefreshPromise()).toBeNull()

			// Wait for completion when no promise is set
			await expect(module.waitForRefreshCompletion()).resolves.toBeUndefined()
		})

		it('should integrate with real HTTP refresh operations', async () => {
			// Setup MSW handler for refresh endpoint
			setupServerWithHandlers([
				http.post('http://localhost:3000/auth/refresh', () => {
					return HttpResponse.json(
						{
							message: 'Token refreshed',
							tokens: {
								accessToken: 'new-access-token',
								refreshToken: 'new-refresh-token',
								expiresIn: 3600,
							},
						},
						{ status: 200 },
					)
				}),
			])

			const module = await import('../../auth/shared-refresh-promise')

			// Create a real refresh operation
			const refreshOperation = async (): Promise<void> => {
				const response = await fetch('http://localhost:3000/auth/refresh', {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
					},
					body: JSON.stringify({ refreshToken: 'test-token' }),
				})
				const result = (await response.json()) as {
					message: string
					tokens: {
						accessToken: string
						refreshToken: string
						expiresIn: number
					}
				}
				expect(result.message).toBe('Token refreshed')
				expect(result.tokens.accessToken).toBe('new-access-token')
				expect(result.tokens.refreshToken).toBe('new-refresh-token')
				expect(result.tokens.expiresIn).toBe(3600)
			}

			// Set the shared refresh promise
			module.setSharedRefreshPromise(refreshOperation())

			// Wait for completion
			await module.waitForRefreshCompletion()

			// Clear the shared promise
			module.clearSharedRefreshPromise()

			// Verify the shared promise was cleared
			expect(module.getSharedRefreshPromise()).toBeNull()
		})

		it('should handle network errors during refresh operations', async () => {
			const mockClient = createTrackingMockApiClient()
			const errorScenarios = createNetworkErrorScenarios()

			// Test error handling
			const results = await testErrorHandling(mockClient, errorScenarios)

			// Verify all error scenarios were handled
			expect(results).toHaveLength(Object.keys(errorScenarios).length)
			results.forEach((result) => {
				expect(result.scenario).toBeDefined()
				expect(result.handled).toBe(true)
				expect(result.error).toBeDefined()
			})
		})

		it('should maintain promise state consistency across operations', async () => {
			const module = await import('../../auth/shared-refresh-promise')

			// Test multiple set/clear cycles
			for (let i = 0; i < 5; i++) {
				// Initially no promise
				expect(module.getSharedRefreshPromise()).toBeNull()

				// Create and set a promise
				const promise = Promise.resolve()
				module.setSharedRefreshPromise(promise)

				// Wait for completion
				await module.waitForRefreshCompletion()

				// Clear the promise
				module.clearSharedRefreshPromise()
				expect(module.getSharedRefreshPromise()).toBeNull()
			}
		})
	})
})
