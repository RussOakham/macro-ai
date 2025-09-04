import { setupServer } from 'msw/node'
import { handlers } from './msw-handlers.js'

/**
 * MSW (Mock Service Worker) Setup Configuration
 *
 * Provides setup for both browser and Node.js environments
 * Used in tests and development environments
 */

// Environment detection
export const isNode = typeof window === 'undefined'
export const isBrowser = typeof window !== 'undefined'

// Node.js environment setup (for Vitest tests)
export const server = setupServer(...handlers)

// Browser environment setup (for development and browser tests)
// Lazy worker creation to avoid issues in test environments
let _worker: ReturnType<typeof import('msw/browser').setupWorker> | null = null

export const worker = (() => {
	// Only create worker when explicitly requested in browser environment
	return null
})()

// Server lifecycle management
export const startServer = () => {
	server.listen({
		onUnhandledRequest: 'warn',
	})
}

export const stopServer = () => {
	server.close()
}

export const resetServer = () => {
	server.resetHandlers()
}

// Worker lifecycle management
export const startWorker = async () => {
	if (isBrowser && !_worker) {
		const { setupWorker } = await import('msw/browser')
		_worker = setupWorker(...handlers)
	}
	if (_worker) {
		await _worker.start({
			onUnhandledRequest: 'warn',
		})
	}
}

export const stopWorker = () => {
	if (_worker) {
		_worker.stop()
	}
}

export const resetWorker = () => {
	if (_worker) {
		_worker.resetHandlers()
	}
}

// Auto-setup removed - individual applications should handle their own MSW setup
// to avoid conflicts between Node.js and browser environments

// Export setup functions for manual control
export { setupServer }
