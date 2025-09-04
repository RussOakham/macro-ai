import { http, HttpResponse } from 'msw'
import { faker } from '@faker-js/faker'

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
			success: true,
			data,
			timestamp: new Date().toISOString(),
		},
		{ status },
	)
}

// Helper function to create error responses
const createErrorResponse = (message: string, status = 400, code?: string) => {
	return HttpResponse.json(
		{
			success: false,
			error: {
				message,
				code: code || 'API_ERROR',
				timestamp: new Date().toISOString(),
			},
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
			id: faker.string.uuid(),
			email: body.email,
			name: faker.person.fullName(),
			createdAt: faker.date.past().toISOString(),
		}

		const tokens = {
			accessToken: faker.string.alphanumeric(64),
			refreshToken: faker.string.alphanumeric(64),
			expiresIn: 3600,
		}

		return createApiResponse({
			user,
			tokens,
		})
	}),

	// POST /auth/register
	http.post(`${API_BASE_URL}/auth/register`, async ({ request }) => {
		const body = (await request.json()) as {
			email: string
			password: string
			name: string
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
			id: faker.string.uuid(),
			email: body.email,
			name: body.name,
			createdAt: new Date().toISOString(),
		}

		return createApiResponse(
			{
				user,
				message:
					'Registration successful. Please check your email for verification.',
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
			refreshToken: faker.string.alphanumeric(64),
			expiresIn: 3600,
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
			id: faker.string.uuid(),
			email: faker.internet.email(),
			name: faker.person.fullName(),
			avatar: faker.image.avatar(),
			createdAt: faker.date.past().toISOString(),
			lastLoginAt: faker.date.recent().toISOString(),
		}

		return createApiResponse(user)
	}),

	// PUT /user/profile
	http.put(`${API_BASE_URL}/user/profile`, async ({ request }) => {
		const authHeader = request.headers.get('Authorization')

		if (!authHeader || authHeader === 'Bearer invalid') {
			return createErrorResponse('Unauthorized', 401, 'UNAUTHORIZED')
		}

		const body = (await request.json()) as { name?: string; avatar?: string }

		// Simulate successful profile update
		const updatedUser = {
			id: faker.string.uuid(),
			email: faker.internet.email(),
			name: body.name || faker.person.fullName(),
			avatar: body.avatar || faker.image.avatar(),
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
			{ length: faker.number.int({ min: 3, max: 10 }) },
			() => ({
				id: faker.string.uuid(),
				title: faker.lorem.sentence(3),
				createdAt: faker.date.past().toISOString(),
				updatedAt: faker.date.recent().toISOString(),
				messageCount: faker.number.int({ min: 1, max: 50 }),
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
			id: faker.string.uuid(),
			title: body.title || faker.lorem.sentence(3),
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString(),
			messageCount: 0,
		}

		return createApiResponse(newChat, 201)
	}),

	// GET /chats/:id
	http.get(`${API_BASE_URL}/chats/:id`, ({ request, params }) => {
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
			id,
			title: faker.lorem.sentence(3),
			createdAt: faker.date.past().toISOString(),
			updatedAt: faker.date.recent().toISOString(),
			messages: Array.from(
				{ length: faker.number.int({ min: 1, max: 20 }) },
				(_, index) => ({
					id: faker.string.uuid(),
					content: faker.lorem.paragraph(),
					role: index % 2 === 0 ? 'user' : 'assistant',
					createdAt: faker.date.recent().toISOString(),
				}),
			),
		}

		return createApiResponse(chat)
	}),

	// POST /chats/:id/messages
	http.post(
		`${API_BASE_URL}/chats/:id/messages`,
		async ({ request, params }) => {
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
				id: faker.string.uuid(),
				content: body.content,
				role: 'user' as const,
				createdAt: new Date().toISOString(),
			}

			return createApiResponse(message, 201)
		},
	),

	// DELETE /chats/:id
	http.delete(`${API_BASE_URL}/chats/:id`, ({ request, params }) => {
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
				success: false,
				error: {
					message: 'Rate limit exceeded',
					code: 'RATE_LIMIT_EXCEEDED',
					retryAfter: 60,
				},
			},
			{
				status: 429,
				headers: {
					'Retry-After': '60',
				},
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
export { authHandlers, userHandlers, chatHandlers, errorHandlers }
