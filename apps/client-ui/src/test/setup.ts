import { vi } from 'vitest'
// oxlint-disable-next-line no-unassigned-import
import '@testing-library/jest-dom/vitest'

// Setup MSW for testing
import { setupMSWForTests } from './msw-setup'

// Set up environment variables for tests
Object.defineProperty(import.meta, 'env', {
	value: {
		VITE_API_KEY: 'test-api-key-that-is-at-least-32-characters-long',
		VITE_API_URL: 'http://localhost:3000',
		VITE_APP_ENV: 'test',
	},
	writable: true,
})

// Mock environment variables
vi.mock('@/lib/validation/environment', () => ({
	validateEnvironment: vi.fn(() => ({
		VITE_API_KEY: 'test-api-key-that-is-at-least-32-characters-long',
		VITE_API_URL: 'http://localhost:3000',
		VITE_APP_ENV: 'test',
	})),
}))

// Mock router
vi.mock('@/main', () => ({
	router: {
		navigate: vi.fn(),
		state: {
			location: {
				pathname: '/test',
			},
		},
	},
}))

// Mock logger
vi.mock('@/lib/logger/logger', () => ({
	logger: {
		debug: vi.fn(),
		error: vi.fn(),
		info: vi.fn(),
		warn: vi.fn(),
	},
}))

// Mock shared refresh promise utilities
vi.mock('@/lib/auth/shared-refresh-promise', () => ({
	clearSharedRefreshPromise: vi.fn(),
	getSharedRefreshPromise: vi.fn(() => null),
	setSharedRefreshPromise: vi.fn(),
	waitForRefreshCompletion: vi.fn(() => Promise.resolve()),
}))

// Mock error standardization
vi.mock('@/lib/errors/standardize-error', () => ({
	standardizeError: vi.fn((error: unknown) => ({
		details: error,
		message: 'An unknown error occurred',
		name: 'UnknownError',
		stack: '',
		status: 500,
		type: 'UnknownError',
	})),
}))

// Global test utilities
globalThis.ResizeObserver = vi.fn().mockImplementation(() => ({
	disconnect: vi.fn(),
	observe: vi.fn(),
	unobserve: vi.fn(),
}))

// Mock IntersectionObserver
globalThis.IntersectionObserver = vi.fn().mockImplementation(() => ({
	disconnect: vi.fn(),
	observe: vi.fn(),
	unobserve: vi.fn(),
}))

// Mock matchMedia
Object.defineProperty(globalThis.window, 'matchMedia', {
	value: vi.fn().mockImplementation((query: string) => ({
		addEventListener: vi.fn(),
		addListener: vi.fn(), // deprecated
		dispatchEvent: vi.fn(),
		matches: false,
		media: query,
		onchange: null,
		removeEventListener: vi.fn(),
		removeListener: vi.fn(), // deprecated
	})),
	writable: true,
})

// Setup MSW for all tests
setupMSWForTests()
