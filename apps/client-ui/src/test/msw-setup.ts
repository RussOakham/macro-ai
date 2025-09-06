/**
 * MSW Setup for Testing
 *
 * This module provides MSW (Mock Service Worker) setup for testing the actual apiClient
 * instead of testing MSW implementation. It uses auto-generated handlers from the OpenAPI spec
 * to create a like-for-like mock of the actual backend API.
 */

import type { RequestHandler } from 'msw'

import { setupServer } from 'msw/node'
import { afterAll, afterEach, beforeAll } from 'vitest'

import { handlers } from './mocks/handlers.js'

// Create MSW server for Node.js environment (testing)
export const server = setupServer(...handlers)

// Start server for testing
export const startServer = () => {
	server.listen({
		onUnhandledRequest: 'warn',
	})
}

// Stop server
export const stopServer = () => {
	server.close()
}

// Reset handlers between tests
export const resetServer = () => {
	server.resetHandlers()
}

// Setup server with custom handlers
export const setupServerWithHandlers = (customHandlers: RequestHandler[]) => {
	server.use(...customHandlers)
}

// Default setup for tests
export const setupMSWForTests = () => {
	beforeAll(() => {
		startServer()
	})

	afterEach(() => {
		resetServer()
	})

	afterAll(() => {
		stopServer()
	})
}
