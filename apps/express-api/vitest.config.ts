import { defineConfig } from 'vitest/config'

export default defineConfig({
	test: {
		name: 'express-api',
		setupFiles: ['./vitest.setup.ts'],
		environment: 'node',
		globals: true,
		include: ['src/**/*.test.ts', 'src/**/*.spec.ts'],
		// Timeout configurations to prevent CI failures
		testTimeout: 30000, // 30 seconds for individual tests
		hookTimeout: 30000, // 30 seconds for hooks (beforeEach, afterEach, etc.)
		teardownTimeout: 30000, // 30 seconds for teardown
		// Coverage configuration
		coverage: {
			provider: 'v8',
			reporter: ['text', 'json', 'html'],
			include: ['src/**/*.ts'],
			exclude: ['src/**/*.test.ts', 'src/**/*.spec.ts', 'src/**/*.d.ts'],
		},
		silent: 'passed-only', // Only show errors and failed tests
		reporters: ['default'],
	},
})
