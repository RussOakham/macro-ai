/**
 * MSW Browser Setup for Application Testing
 *
 * This module provides MSW setup for the browser environment, allowing the application
 * to use MSW instead of the real backend when NODE_ENV === 'test'.
 */

import { setupWorker } from 'msw/browser'

import { handlers } from './mocks/handlers.js'

// Create MSW worker for browser environment
export const worker = setupWorker(...handlers)

// Start worker for browser testing
export const startWorker = async () => {
	await worker.start({
		onUnhandledRequest: 'warn',
	})
}

// Stop worker
export const stopWorker = () => {
	worker.stop()
}

// Reset handlers
export const resetWorker = () => {
	worker.resetHandlers()
}

// Setup worker with custom handlers
import type { RequestHandler } from 'msw'

export const setupWorkerWithHandlers = (customHandlers: RequestHandler[]) => {
	worker.use(...customHandlers)
}

// Enable mocking when NODE_ENV is 'test'
export const enableMocking = async () => {
	if (
		(import.meta.env as any).MODE === 'test' ||
		(import.meta.env as any).NODE_ENV === 'test'
	) {
		await startWorker()
		console.log('MSW: Mocking enabled for testing environment')
	}
}
