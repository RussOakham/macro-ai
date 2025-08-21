import { defineConfig } from 'vitest/config'

export default defineConfig({
	test: {
		name: 'integration-tests',
		setupFiles: ['./vitest.setup.ts'],
		environment: 'node',
		globals: true,
		include: ['**/*.test.ts'],
		exclude: [
			'**/node_modules/**',
			'**/dist/**',
			'**/.{idea,git,cache,output,temp}/**',
		],
		testTimeout: 60000, // 60 seconds for integration tests
		hookTimeout: 30000, // 30 seconds for setup/teardown
		teardownTimeout: 30000,
		// Run tests sequentially to avoid overwhelming the API
		pool: 'forks',
		poolOptions: {
			forks: {
				singleFork: true,
			},
		},
		// Retry failed tests once (network issues, etc.)
		retry: 1,
		// Reporter configuration
		reporters: ['default', 'json'],
		outputFile: {
			json: './results/integration-test-results.json',
		},
		coverage: {
			enabled: false, // Coverage not applicable for integration tests
		},
		// Environment variables for tests
		env: {
			NODE_ENV: 'test',
			VITEST_INTEGRATION: 'true',
		},
		silent: 'passed-only', // Only show errors and failed tests
	},
})
