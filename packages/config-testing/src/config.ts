/**
 * Common vitest configuration options shared across packages
 */
export const commonTestConfig = {
	globals: true,
	environment: 'node' as const,
	include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts}'],
	exclude: [
		'**/node_modules/**',
		'**/dist/**',
		'**/.{idea,git,cache,output,temp}/**',
		'**/*.config.*',
	],
	coverage: {
		provider: 'v8' as const,
		reporter: ['text', 'json', 'html'],
		exclude: [
			'node_modules/',
			'dist/',
			'**/*.test.ts',
			'**/*.spec.ts',
			'**/*.d.ts',
			'**/*.config.*',
			'coverage/**',
		],
	},
	silent: 'passed-only' as const, // Only show errors and failed tests
}

/**
 * Common timeout configuration for integration tests
 */
export const integrationTestTimeouts = {
	testTimeout: 60000, // 60 seconds for integration tests
	hookTimeout: 30000, // 30 seconds for setup/teardown
	teardownTimeout: 30000,
}

/**
 * Common timeout configuration for unit tests
 */
export const unitTestTimeouts = {
	testTimeout: 30000, // 30 seconds for individual tests
	hookTimeout: 30000, // 30 seconds for hooks
	teardownTimeout: 30000,
}
