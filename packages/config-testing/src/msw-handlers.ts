import { faker } from '@faker-js/faker'
import { http, HttpResponse } from 'msw'

/**
 * MSW (Mock Service Worker) Handlers
 *
 * Comprehensive API mocking handlers for testing scenarios
 * Covers authentication, user management, chat operations, and error cases
 */

// Base API URL - can be configured per environment
const API_BASE_URL = process.env.VITE_API_BASE_URL || 'http://localhost:3000'

// Helper function to create consistent API responses
const createApiResponse = <T>(data: T, status = 200) => {
	return HttpResponse.json(
		{
			data,
			success: true,
			timestamp: new Date().toISOString(),
		},
		{ status },
	)
}

// Helper function to create error responses
const createErrorResponse = (message: string, status = 400, code?: string) => {
	return HttpResponse.json(
		{
			error: {
				code: code || 'API_ERROR',
				message,
				timestamp: new Date().toISOString(),
			},
			success: false,
		},
		{ status },
	)
}

// Authentication Handlers
const authHandlers = [
	// POST /auth/login
	http.post(`${API_BASE_URL}/auth/login`, async ({ request }) => {
		const body = (await request.json()) as { email: string; password: string }

		// Simulate validation
		if (!body.email || !body.password) {
			return createErrorResponse(
				'Email and password are required',
				400,
				'VALIDATION_ERROR',
			)
		}

		// Simulate invalid credentials
		if (body.password === 'wrongpassword') {
			return createErrorResponse(
				'Invalid credentials',
				401,
				'INVALID_CREDENTIALS',
			)
		}

		// Simulate successful login
		const user = {
			createdAt: faker.date.past().toISOString(),
			email: body.email,
			id: faker.string.uuid(),
			name: faker.person.fullName(),
		}

		const tokens = {
			accessToken: faker.string.alphanumeric(64),
			expiresIn: 3600,
			refreshToken: faker.string.alphanumeric(64),
		}

		return createApiResponse({
			tokens,
			user,
		})
	}),

	// POST /auth/register
	http.post(`${API_BASE_URL}/auth/register`, async ({ request }) => {
		const body = (await request.json()) as {
			email: string
			name: string
			password: string
		}

		// Simulate validation
		if (!body.email || !body.password || !body.name) {
			return createErrorResponse(
				'Email, password, and name are required',
				400,
				'VALIDATION_ERROR',
			)
		}

		// Simulate email already exists
		if (body.email === 'existing@example.com') {
			return createErrorResponse('Email already exists', 409, 'EMAIL_EXISTS')
		}

		// Simulate successful registration
		const user = {
			createdAt: new Date().toISOString(),
			email: body.email,
			id: faker.string.uuid(),
			name: body.name,
		}

		return createApiResponse(
			{
				message:
					'Registration successful. Please check your email for verification.',
				user,
			},
			201,
		)
	}),

	// POST /auth/refresh
	http.post(`${API_BASE_URL}/auth/refresh`, async ({ request }) => {
		const body = (await request.json()) as { refreshToken: string }

		// Simulate invalid refresh token
		if (!body.refreshToken || body.refreshToken === 'invalid') {
			return createErrorResponse(
				'Invalid refresh token',
				401,
				'INVALID_REFRESH_TOKEN',
			)
		}

		// Simulate successful token refresh
		const tokens = {
			accessToken: faker.string.alphanumeric(64),
			expiresIn: 3600,
			refreshToken: faker.string.alphanumeric(64),
		}

		return createApiResponse(tokens)
	}),

	// POST /auth/logout
	http.post(`${API_BASE_URL}/auth/logout`, () => {
		return createApiResponse({ message: 'Logged out successfully' })
	}),
]

// User Management Handlers
const userHandlers = [
	// GET /user/profile
	http.get(`${API_BASE_URL}/user/profile`, ({ request }) => {
		const authHeader = request.headers.get('Authorization')

		// Simulate missing or invalid auth
		if (!authHeader || authHeader === 'Bearer invalid') {
			return createErrorResponse('Unauthorized', 401, 'UNAUTHORIZED')
		}

		// Simulate successful profile fetch
		const user = {
			avatar: faker.image.avatar(),
			createdAt: faker.date.past().toISOString(),
			email: faker.internet.email(),
			id: faker.string.uuid(),
			lastLoginAt: faker.date.recent().toISOString(),
			name: faker.person.fullName(),
		}

		return createApiResponse(user)
	}),

	// PUT /user/profile
	http.put(`${API_BASE_URL}/user/profile`, async ({ request }) => {
		const authHeader = request.headers.get('Authorization')

		if (!authHeader || authHeader === 'Bearer invalid') {
			return createErrorResponse('Unauthorized', 401, 'UNAUTHORIZED')
		}

		const body = (await request.json()) as { avatar?: string; name?: string }

		// Simulate successful profile update
		const updatedUser = {
			avatar: body.avatar || faker.image.avatar(),
			email: faker.internet.email(),
			id: faker.string.uuid(),
			name: body.name || faker.person.fullName(),
			updatedAt: new Date().toISOString(),
		}

		return createApiResponse(updatedUser)
	}),
]

// Chat System Handlers
const chatHandlers = [
	// GET /chats
	http.get(`${API_BASE_URL}/chats`, ({ request }) => {
		const authHeader = request.headers.get('Authorization')

		if (!authHeader || authHeader === 'Bearer invalid') {
			return createErrorResponse('Unauthorized', 401, 'UNAUTHORIZED')
		}

		// Simulate chat list
		const chats = Array.from(
			{ length: faker.number.int({ max: 10, min: 3 }) },
			() => ({
				createdAt: faker.date.past().toISOString(),
				id: faker.string.uuid(),
				messageCount: faker.number.int({ max: 50, min: 1 }),
				title: faker.lorem.sentence(3),
				updatedAt: faker.date.recent().toISOString(),
			}),
		)

		return createApiResponse(chats)
	}),

	// POST /chats
	http.post(`${API_BASE_URL}/chats`, async ({ request }) => {
		const authHeader = request.headers.get('Authorization')

		if (!authHeader || authHeader === 'Bearer invalid') {
			return createErrorResponse('Unauthorized', 401, 'UNAUTHORIZED')
		}

		const body = (await request.json()) as { title: string }

		// Simulate successful chat creation
		const newChat = {
			createdAt: new Date().toISOString(),
			id: faker.string.uuid(),
			messageCount: 0,
			title: body.title || faker.lorem.sentence(3),
			updatedAt: new Date().toISOString(),
		}

		return createApiResponse(newChat, 201)
	}),

	// GET /chats/:id
	http.get(`${API_BASE_URL}/chats/:id`, ({ params, request }) => {
		const authHeader = request.headers.get('Authorization')

		if (!authHeader || authHeader === 'Bearer invalid') {
			return createErrorResponse('Unauthorized', 401, 'UNAUTHORIZED')
		}

		const { id } = params as { id: string }

		// Simulate chat not found
		if (id === 'not-found') {
			return createErrorResponse('Chat not found', 404, 'CHAT_NOT_FOUND')
		}

		// Simulate successful chat fetch
		const chat = {
			createdAt: faker.date.past().toISOString(),
			id,
			messages: Array.from(
				{ length: faker.number.int({ max: 20, min: 1 }) },
				(_, index) => ({
					content: faker.lorem.paragraph(),
					createdAt: faker.date.recent().toISOString(),
					id: faker.string.uuid(),
					role: index % 2 === 0 ? 'user' : 'assistant',
				}),
			),
			title: faker.lorem.sentence(3),
			updatedAt: faker.date.recent().toISOString(),
		}

		return createApiResponse(chat)
	}),

	// POST /chats/:id/messages
	http.post(
		`${API_BASE_URL}/chats/:id/messages`,
		async ({ params, request }) => {
			const authHeader = request.headers.get('Authorization')

			if (!authHeader || authHeader === 'Bearer invalid') {
				return createErrorResponse('Unauthorized', 401, 'UNAUTHORIZED')
			}

			const { id } = params as { id: string }
			const body = (await request.json()) as { content: string }

			// Simulate chat not found
			if (id === 'not-found') {
				return createErrorResponse('Chat not found', 404, 'CHAT_NOT_FOUND')
			}

			// Simulate validation error
			if (!body.content || body.content.trim().length === 0) {
				return createErrorResponse(
					'Message content is required',
					400,
					'VALIDATION_ERROR',
				)
			}

			// Simulate successful message creation
			const message = {
				content: body.content,
				createdAt: new Date().toISOString(),
				id: faker.string.uuid(),
				role: 'user' as const,
			}

			return createApiResponse(message, 201)
		},
	),

	// DELETE /chats/:id
	http.delete(`${API_BASE_URL}/chats/:id`, ({ params, request }) => {
		const authHeader = request.headers.get('Authorization')

		if (!authHeader || authHeader === 'Bearer invalid') {
			return createErrorResponse('Unauthorized', 401, 'UNAUTHORIZED')
		}

		const { id } = params as { id: string }

		// Simulate chat not found
		if (id === 'not-found') {
			return createErrorResponse('Chat not found', 404, 'CHAT_NOT_FOUND')
		}

		return createApiResponse({ message: 'Chat deleted successfully' })
	}),
]

// Error Simulation Handlers
const errorHandlers = [
	// Simulate network errors
	http.get(`${API_BASE_URL}/network-error`, () => {
		return HttpResponse.error()
	}),

	// Simulate server errors
	http.get(`${API_BASE_URL}/server-error`, () => {
		return createErrorResponse('Internal server error', 500, 'INTERNAL_ERROR')
	}),

	// Simulate timeout
	http.get(`${API_BASE_URL}/timeout`, () => {
		return new Promise(() => {
			// Never resolves to simulate timeout
		})
	}),

	// Simulate rate limiting
	http.get(`${API_BASE_URL}/rate-limit`, () => {
		return HttpResponse.json(
			{
				error: {
					code: 'RATE_LIMIT_EXCEEDED',
					message: 'Rate limit exceeded',
					retryAfter: 60,
				},
				success: false,
			},
			{
				headers: {
					'Retry-After': '60',
				},
				status: 429,
			},
		)
	}),
]

// Combine all handlers
export const handlers = [
	...authHandlers,
	...userHandlers,
	...chatHandlers,
	...errorHandlers,
]

// Export individual handler groups for selective use
export { authHandlers, chatHandlers, errorHandlers, userHandlers }
