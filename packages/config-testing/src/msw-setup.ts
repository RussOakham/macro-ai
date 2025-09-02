import { setupServer } from 'msw/node'
import { setupWorker } from 'msw/browser'
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
export const worker = isBrowser ? setupWorker(...handlers) : null

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
	if (worker) {
		await worker.start({
			onUnhandledRequest: 'warn',
		})
	}
}

export const stopWorker = () => {
	if (worker) {
		worker.stop()
	}
}

export const resetWorker = () => {
	if (worker) {
		worker.resetHandlers()
	}
}

// Auto-setup based on environment
if (isNode) {
	// Node.js environment - typically for tests
	startServer()
} else if (isBrowser && process.env.NODE_ENV === 'development') {
	// Browser environment - only in development
	startWorker()
}

// Export setup functions for manual control
export { setupServer, setupWorker }
