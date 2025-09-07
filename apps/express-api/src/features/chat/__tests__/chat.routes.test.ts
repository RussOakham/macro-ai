import express, { NextFunction, Request, Response } from 'express'
import { describe, expect, it, vi } from 'vitest'

import { mockChatService } from '../../../utils/test-helpers/chat-service.mock.ts'
import { mockLogger } from '../../../utils/test-helpers/logger.mock.ts'
import { chatRouter } from '../chat.routes.ts'

// Mock the logger using the reusable helper
vi.mock('../../../utils/logger.ts', () => mockLogger.createModule())

// Mock the chat service using the reusable helper
vi.mock('../chat.service.ts', () => mockChatService.createModule())

// Mock middleware
vi.mock('../../../middleware/auth.middleware.ts', () => ({
	verifyAuth: vi.fn((req: Request, _res: Response, next: NextFunction) => {
		// Simulate successful authentication by default
		req.userId = '123e4567-e89b-12d3-a456-426614174000'
		next()
	}),
}))

vi.mock('../../../middleware/rate-limit.middleware.ts', () => ({
	apiRateLimiter: vi.fn((_req: Request, _res: Response, next: NextFunction) => {
		// Simulate successful rate limit check by default
		next()
	}),
}))

vi.mock('../../../middleware/validation.middleware.ts', () => ({
	validate: vi.fn(() => (_req: Request, _res: Response, next: NextFunction) => {
		// Simulate successful validation by default
		next()
	}),
}))

// Mock the chat controller
vi.mock('../chat.controller.ts', () => ({
	chatController: {
		getChats: vi.fn((_req: Request, res: Response) =>
			res.status(200).json({ success: true }),
		),
		createChat: vi.fn((_req: Request, res: Response) =>
			res.status(201).json({ success: true }),
		),
		getChatById: vi.fn((_req: Request, res: Response) =>
			res.status(200).json({ success: true }),
		),
		updateChat: vi.fn((_req: Request, res: Response) =>
			res.status(200).json({ success: true }),
		),
		deleteChat: vi.fn((_req: Request, res: Response) =>
			res.status(200).json({ success: true }),
		),
		streamChatMessage: vi.fn((_req: Request, res: Response) => {
			// Mock SSE response
			res.writeHead(200, {
				'Content-Type': 'text/event-stream',
				'Cache-Control': 'no-cache',
				Connection: 'keep-alive',
			})
			res.write('data: {"type":"connected","message":"Stream connected"}\n\n')
			res.end()
		}),
	},
}))

describe('Chat Routes Integration', () => {
	it('should register routes without errors', () => {
		// Create a fresh Express app
		const app = express()
		app.use(express.json())

		// This should not throw any errors
		expect(() => {
			chatRouter(app)
		}).not.toThrow()
	})

	it('should export chatRouter function', () => {
		expect(typeof chatRouter).toBe('function')
	})

	it('should have proper route structure', () => {
		// Test that the router function exists and can be called
		const app = express()

		// Mock the router methods to verify they're called
		const routerSpy = {
			get: vi.fn(),
			post: vi.fn(),
			put: vi.fn(),
			delete: vi.fn(),
		}

		// Replace app methods with spies
		app.get = routerSpy.get
		app.post = routerSpy.post
		app.put = routerSpy.put
		app.delete = routerSpy.delete

		// Call the router
		chatRouter(app)

		// Verify that expected routes were registered by checking for specific route paths
		// This approach is more resilient to route additions/modifications than exact call counts

		// Check GET routes
		const getCalls = routerSpy.get.mock.calls

		const getRoutes = getCalls.map((call) => call[0])
		expect(getRoutes).toContain('/chats') // List user's chats
		expect(getRoutes).toContain('/chats/:id') // Get specific chat with messages

		// Check POST routes
		const postCalls = routerSpy.post.mock.calls

		const postRoutes = postCalls.map((call) => call[0])
		expect(postRoutes).toContain('/chats') // Create new chat
		expect(postRoutes).toContain('/chats/:id/stream') // Stream chat message response

		// Check PUT routes
		const putCalls = routerSpy.put.mock.calls

		const putRoutes = putCalls.map((call) => call[0])
		expect(putRoutes).toContain('/chats/:id') // Update chat title

		// Check DELETE routes
		const deleteCalls = routerSpy.delete.mock.calls

		const deleteRoutes = deleteCalls.map((call) => call[0])
		expect(deleteRoutes).toContain('/chats/:id') // Delete chat
	})

	it('should register streaming endpoint with proper middleware', () => {
		const app = express()
		const routerSpy = {
			get: vi.fn(),
			post: vi.fn(),
			put: vi.fn(),
			delete: vi.fn(),
		}

		app.get = routerSpy.get
		app.post = routerSpy.post
		app.put = routerSpy.put
		app.delete = routerSpy.delete

		chatRouter(app)

		// Verify streaming endpoint is registered
		const streamingCall = routerSpy.post.mock.calls.find(
			(call) => typeof call[0] === 'string' && call[0].includes('/stream'),
		)
		expect(streamingCall).toBeDefined()
		if (streamingCall) {
			expect(streamingCall[0]).toBe('/chats/:id/stream')
			// Verify middleware order: verifyAuth, apiRateLimiter, validate, controller
			expect(streamingCall).toHaveLength(5) // path + 3 middleware + controller
		}
	})

	it('should handle streaming endpoint route registration', () => {
		const app = express()
		app.use(express.json())

		// Should not throw when registering streaming route
		expect(() => {
			chatRouter(app)
		}).not.toThrow()

		// Verify the router function can be called multiple times
		expect(() => {
			chatRouter(app)
		}).not.toThrow()
	})
})
