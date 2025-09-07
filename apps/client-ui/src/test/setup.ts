import { vi } from 'vitest'
import '@testing-library/jest-dom/vitest'

// Setup MSW for testing
import { setupMSWForTests } from './msw-setup'

// Set up environment variables for tests
Object.defineProperty(import.meta, 'env', {
	value: {
		VITE_API_URL: 'http://localhost:3000',
		VITE_API_KEY: 'test-api-key-that-is-at-least-32-characters-long',
		VITE_APP_ENV: 'test',
	},
	writable: true,
})

// Mock environment variables
vi.mock('@/lib/validation/environment', () => ({
	validateEnvironment: vi.fn(() => ({
		VITE_API_URL: 'http://localhost:3000',
		VITE_API_KEY: 'test-api-key-that-is-at-least-32-characters-long',
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
		error: vi.fn(),
		warn: vi.fn(),
		info: vi.fn(),
		debug: vi.fn(),
	},
}))

// Mock shared refresh promise utilities
vi.mock('@/lib/auth/shared-refresh-promise', () => ({
	setSharedRefreshPromise: vi.fn(),
	clearSharedRefreshPromise: vi.fn(),
	getSharedRefreshPromise: vi.fn(() => null),
	waitForRefreshCompletion: vi.fn(() => Promise.resolve()),
}))

// Mock error standardization
vi.mock('@/lib/errors/standardize-error', () => ({
	standardizeError: vi.fn((error: unknown) => ({
		type: 'UnknownError',
		name: 'UnknownError',
		message: 'An unknown error occurred',
		status: 500,
		stack: '',
		details: error,
	})),
}))

// Global test utilities
global.ResizeObserver = vi.fn().mockImplementation(() => ({
	observe: vi.fn(),
	unobserve: vi.fn(),
	disconnect: vi.fn(),
}))

// Mock IntersectionObserver
global.IntersectionObserver = vi.fn().mockImplementation(() => ({
	observe: vi.fn(),
	unobserve: vi.fn(),
	disconnect: vi.fn(),
}))

// Mock matchMedia
Object.defineProperty(window, 'matchMedia', {
	writable: true,
	value: vi.fn().mockImplementation((query: string) => ({
		matches: false,
		media: query,
		onchange: null,
		addListener: vi.fn(), // deprecated
		removeListener: vi.fn(), // deprecated
		addEventListener: vi.fn(),
		removeEventListener: vi.fn(),
		dispatchEvent: vi.fn(),
	})),
})

// Setup MSW for all tests
setupMSWForTests()
