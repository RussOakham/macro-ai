/**
 * Common vitest configuration options shared across packages
 */
export const commonTestConfig = {
	coverage: {
		// Clean coverage directory before each run
		clean: true,
		// Clean on exit
		cleanOnRerun: true,
		exclude: [
			'node_modules/',
			'dist/',
			'**/*.test.ts',
			'**/*.spec.ts',
			'**/*.d.ts',
			'**/*.config.*',
			'coverage/**',
			'**/*.gen.ts', // Exclude generated files (API clients, etc.)
			'**/routeTree.gen.ts', // Exclude generated route tree
			'**/main.tsx', // Exclude main entry points
			'**/main.ts', // Exclude main entry points
		],
		provider: 'v8' as const,
		reporter: ['text', 'json-summary', 'html', 'lcov'],
		reportsDirectory: './coverage',
		// Include source maps for better debugging
		sourcemap: true,
		thresholds: {
			global: {
				branches: 75,
				functions: 80,
				lines: 80,
				statements: 80,
			},
			warnOnFailure: true, // Use warnings instead of errors for coverage failures
		},
	},
	environment: 'node' as const,
	exclude: [
		'**/node_modules/**',
		'**/dist/**',
		'**/.{idea,git,cache,output,temp}/**',
		'**/*.config.*',
	],
	globals: true,
	include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts}'],
	silent: 'passed-only' as const, // Only show errors and failed tests
}

/**
 * React-specific vitest configuration for client-ui
 */
export const reactTestConfig = {
	...commonTestConfig,
	// Mock CSS modules and other assets
	css: {
		modules: {
			classNameStrategy: 'non-scoped',
		},
	},
	environment: 'happy-dom' as const,
	include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
}

/**
 * Common timeout configuration for integration tests
 */
export const integrationTestTimeouts = {
	hookTimeout: 30000, // 30 seconds for setup/teardown
	teardownTimeout: 30000,
	testTimeout: 60000, // 60 seconds for integration tests
}

/**
 * Common timeout configuration for unit tests
 */
export const unitTestTimeouts = {
	hookTimeout: 30000, // 30 seconds for hooks
	teardownTimeout: 30000,
	testTimeout: 30000, // 30 seconds for individual tests
}
