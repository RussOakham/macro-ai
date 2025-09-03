/**
 * Client-UI Testing Utilities Index
 * 
 * Central export point for all enhanced testing utilities in the client-ui project.
 * This provides a clean interface for importing testing utilities across the project.
 */

// Main testing utilities
export * from './test-utils'

// Specialized testing utilities
export * from './api-test-utils'
export * from './component-test-utils'

// Re-export commonly used testing utilities from config-testing
export {
	apiResponseFactory,
	authFactory,
	chatFactory,
	testUtils,
	userFactory,
} from '@repo/config-testing'

// Re-export MSW utilities
export {
	authHandlers,
	chatHandlers,
	errorHandlers,
	handlers,
	server,
	userHandlers,
} from '@repo/config-testing'

// Re-export React Testing Library utilities
export {
	act,
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
} from '@testing-library/react'

// Re-export Vitest utilities
export {
	afterAll,
	afterEach,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
	test,
	vi,
} from 'vitest'
