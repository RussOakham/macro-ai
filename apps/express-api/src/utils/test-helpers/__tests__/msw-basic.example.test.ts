import { faker } from '@faker-js/faker'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

/**
 * Basic MSW Examples - Working Implementation
 *
 * This file demonstrates basic MSW functionality with proper setup
 */

// Create a simple server for this test
const server = setupServer(
	http.get('http://localhost:3000/api/test', () => {
		return HttpResponse.json({ message: 'Hello from MSW!' })
	}),

	http.post('http://localhost:3000/api/login', async ({ request }) => {
		const body = (await request.json()) as { email: string; password: string }

		if (body.email === 'test@example.com' && body.password === 'password') {
			return HttpResponse.json({
				success: true,
				data: {
					user: {
						id: faker.string.uuid(),
						email: body.email,
						name: faker.person.fullName(),
						avatar: faker.image.avatar(),
						createdAt: faker.date.past().toISOString(),
					},
					token: faker.string.alphanumeric(64),
				},
			})
		}

		return HttpResponse.json(
			{ success: false, error: { message: 'Invalid credentials' } },
			{ status: 401 },
		)
	}),

	http.get('http://localhost:3000/api/user', ({ request }) => {
		const authHeader = request.headers.get('Authorization')

		if (authHeader === 'Bearer mock-token') {
			return HttpResponse.json({
				success: true,
				data: {
					id: faker.string.uuid(),
					email: faker.internet.email(),
					name: faker.person.fullName(),
					avatar: faker.image.avatar(),
					createdAt: faker.date.past().toISOString(),
					lastLoginAt: faker.date.recent().toISOString(),
				},
			})
		}

		return HttpResponse.json(
			{ success: false, error: { message: 'Unauthorized' } },
			{ status: 401 },
		)
	}),
)

describe('Basic MSW Examples', () => {
	beforeEach(() => {
		server.listen({ onUnhandledRequest: 'warn' })
	})

	afterEach(() => {
		server.resetHandlers()
		server.close()
	})

	describe('1. Basic GET Request', () => {
		it('should mock a simple GET request', async () => {
			const response = await fetch('http://localhost:3000/api/test')
			const data = (await response.json()) as { message: string }

			expect(response.ok).toBe(true)
			expect(data.message).toBe('Hello from MSW!')
		})
	})

	describe('2. Authentication Flow', () => {
		it('should handle successful login', async () => {
			const response = await fetch('http://localhost:3000/api/login', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					email: 'test@example.com',
					password: 'password',
				}),
			})

			expect(response.ok).toBe(true)

			const data = (await response.json()) as {
				success: boolean
				data: {
					user: {
						id: string
						email: string
						name: string
						avatar: string
						createdAt: string
					}
					token: string
				}
				error?: { message: string }
			}

			expect(data.success).toBe(true)
			expect(data.data.user.email).toBe('test@example.com')
			expect(data.data.user.id).toBeDefined()
			expect(data.data.user.name).toBeDefined()
			expect(data.data.user.avatar).toBeDefined()
			expect(data.data.user.createdAt).toBeDefined()
			expect(data.data.token).toBeDefined()
			expect(data.data.token).toHaveLength(64)
		})

		it('should handle failed login', async () => {
			const response = await fetch('http://localhost:3000/api/login', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					email: 'test@example.com',
					password: 'wrong-password',
				}),
			})

			expect(response.ok).toBe(false)
			expect(response.status).toBe(401)

			const data = (await response.json()) as {
				success: boolean
				data?: {
					user: {
						id: string
						email: string
						name: string
						avatar: string
						createdAt: string
					}
					token: string
				}
				error?: { message: string }
			}

			expect(data.success).toBe(false)
			expect(data.error?.message).toBe('Invalid credentials')
		})
	})

	describe('3. Authenticated Requests', () => {
		it('should handle authenticated GET request', async () => {
			const response = await fetch('http://localhost:3000/api/user', {
				headers: { Authorization: 'Bearer mock-token' },
			})

			expect(response.ok).toBe(true)

			const data = (await response.json()) as {
				success: boolean
				data?: {
					id: string
					email: string
					name: string
					avatar: string
					createdAt: string
					lastLoginAt: string
				}
				error?: { message: string }
			}

			expect(data.success).toBe(true)
			expect(data.data?.id).toBeDefined()
			expect(data.data?.email).toBeDefined()
			expect(data.data?.name).toBeDefined()
			expect(data.data?.avatar).toBeDefined()
			expect(data.data?.createdAt).toBeDefined()
			expect(data.data?.lastLoginAt).toBeDefined()
		})

		it('should handle unauthorized request', async () => {
			const response = await fetch('http://localhost:3000/api/user', {
				headers: { Authorization: 'Bearer invalid-token' },
			})

			expect(response.ok).toBe(false)
			expect(response.status).toBe(401)

			const data = (await response.json()) as {
				success: boolean
				data?: {
					user: {
						id: string
						email: string
						name: string
						avatar: string
						createdAt: string
						lastLoginAt: string
					}
					token: string
				}
				error?: { message: string }
			}

			expect(data.success).toBe(false)
			expect(data.error?.message).toBe('Unauthorized')
		})
	})

	describe('4. Dynamic Handler Override', () => {
		it('should override handlers for specific tests', async () => {
			// Override the test endpoint for this specific test
			server.use(
				http.get('http://localhost:3000/api/test', () => {
					return HttpResponse.json({ message: 'Overridden response!' })
				}),
			)

			const response = await fetch('http://localhost:3000/api/test')
			const data = (await response.json()) as { message: string }

			expect(response.ok).toBe(true)
			expect(data.message).toBe('Overridden response!')
		})
	})

	describe('5. Error Handling', () => {
		it('should handle server errors', async () => {
			// Override to return server error
			server.use(
				http.get('http://localhost:3000/api/test', () => {
					return HttpResponse.json(
						{ error: 'Internal server error' },
						{ status: 500 },
					)
				}),
			)

			const response = await fetch('http://localhost:3000/api/test')

			expect(response.ok).toBe(false)
			expect(response.status).toBe(500)

			const data = (await response.json()) as { error: string }
			expect(data.error).toBe('Internal server error')
		})
	})
})
