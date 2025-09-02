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
		reporter: ['text', 'json', 'html', 'lcov'],
		reportsDirectory: './coverage',
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
		thresholds: {
			global: {
				statements: 80,
				branches: 75,
				functions: 80,
				lines: 80,
			},
		},
		// Include source maps for better debugging
		sourcemap: true,
		// Clean coverage directory before each run
		clean: true,
		// Clean on exit
		cleanOnRerun: true,
	},
	silent: 'passed-only' as const, // Only show errors and failed tests
}

/**
 * React-specific vitest configuration for client-ui
 */
export const reactTestConfig = {
	...commonTestConfig,
	environment: 'jsdom' as const,
	include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
	// Mock CSS modules and other assets
	css: {
		modules: {
			classNameStrategy: 'non-scoped',
		},
	},
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
