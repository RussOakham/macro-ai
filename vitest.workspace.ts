/**
 * Vitest Workspace Configuration
 *
 * Configures test parallelization and workspace-wide test settings
 * for optimal performance across the monorepo.
 */

import { defineWorkspace } from 'vitest/config'

export default defineWorkspace([
	// Express API - Backend tests
	{
		extends: './apps/express-api/vitest.config.ts',
		test: {
			name: 'express-api',
			root: './apps/express-api',
			include: ['src/**/*.test.ts', 'src/**/*.spec.ts'],
			exclude: [
				'src/**/*.integration.test.ts',
				'src/**/*.e2e.test.ts',
				'node_modules/**',
				'dist/**',
			],
			environment: 'node',
			pool: 'threads',
			poolOptions: {
				threads: {
					minThreads: 1,
					maxThreads: 4,
				},
			},
			testTimeout: 30000,
			hookTimeout: 10000,
			teardownTimeout: 5000,
			isolate: true,
			// Optimize for CI/CD
			reporter: process.env.CI ? ['junit', 'verbose'] : ['verbose'],
			outputFile: {
				junit: './test-results.xml',
			},
		},
	},

	// Client UI - Frontend tests
	{
		extends: './apps/client-ui/vitest.config.ts',
		test: {
			name: 'client-ui',
			root: './apps/client-ui',
			include: ['src/**/*.test.{ts,tsx}', 'src/**/*.spec.{ts,tsx}'],
			exclude: [
				'src/**/*.integration.test.{ts,tsx}',
				'src/**/*.e2e.test.{ts,tsx}',
				'node_modules/**',
				'dist/**',
				'src/routeTree.gen.ts',
			],
			environment: 'jsdom',
			pool: 'threads',
			poolOptions: {
				threads: {
					minThreads: 1,
					maxThreads: 3,
				},
			},
			testTimeout: 20000,
			hookTimeout: 10000,
			isolate: true,
			// React-specific optimizations
			setupFiles: ['./src/test/setup.ts'],
			reporter: process.env.CI ? ['junit', 'verbose'] : ['verbose'],
			outputFile: {
				junit: './test-results.xml',
			},
		},
	},

	// API Client - Package tests
	{
		extends: './packages/macro-ai-api-client/vitest.config.ts',
		test: {
			name: 'api-client',
			root: './packages/macro-ai-api-client',
			include: ['src/**/*.test.ts', 'src/**/*.spec.ts'],
			exclude: ['node_modules/**', 'dist/**'],
			environment: 'node',
			pool: 'threads',
			poolOptions: {
				threads: {
					minThreads: 1,
					maxThreads: 2,
				},
			},
			testTimeout: 15000,
			hookTimeout: 5000,
			isolate: true,
			reporter: process.env.CI ? ['junit', 'verbose'] : ['verbose'],
			outputFile: {
				junit: './test-results.xml',
			},
		},
	},

	// Integration tests - Separate configuration for longer-running tests
	{
		test: {
			name: 'integration',
			root: './apps/express-api',
			include: ['src/**/*.integration.test.ts'],
			exclude: ['node_modules/**', 'dist/**'],
			environment: 'node',
			pool: 'forks', // Use forks for isolation in integration tests
			poolOptions: {
				forks: {
					minForks: 1,
					maxForks: 2, // Limit concurrent integration tests
				},
			},
			testTimeout: 300000, // 5 minutes for integration tests
			hookTimeout: 60000, // 1 minute for setup/teardown
			teardownTimeout: 30000,
			isolate: true,
			// Sequential execution for integration tests that might share resources
			sequence: {
				concurrent: false,
			},
			reporter: process.env.CI ? ['junit', 'verbose'] : ['verbose'],
			outputFile: {
				junit: './integration-test-results.xml',
			},
		},
	},

	// E2E tests - Browser-based tests
	{
		test: {
			name: 'e2e',
			root: './apps/client-ui',
			include: ['src/**/*.e2e.test.{ts,tsx}', 'e2e/**/*.test.{ts,tsx}'],
			exclude: ['node_modules/**', 'dist/**'],
			environment: 'jsdom',
			pool: 'forks',
			poolOptions: {
				forks: {
					minForks: 1,
					maxForks: 1, // Single fork for E2E tests to avoid conflicts
				},
			},
			testTimeout: 600000, // 10 minutes for E2E tests
			hookTimeout: 120000, // 2 minutes for setup/teardown
			isolate: true,
			sequence: {
				concurrent: false, // E2E tests run sequentially
			},
			reporter: process.env.CI ? ['junit', 'verbose'] : ['verbose'],
			outputFile: {
				junit: './e2e-test-results.xml',
			},
		},
	},
])

/**
 * Workspace Configuration Notes:
 *
 * 1. **Thread Allocation**: Threads are allocated based on test complexity and resource requirements
 *    - Express API: 4 threads (CPU-intensive backend logic)
 *    - Client UI: 3 threads (React component testing)
 *    - API Client: 2 threads (lightweight package tests)
 *
 * 2. **Pool Selection**:
 *    - threads: Fast, shared memory, good for unit tests
 *    - forks: Isolated processes, better for integration/E2E tests
 *
 * 3. **Timeout Strategy**:
 *    - Unit tests: 15-30 seconds
 *    - Integration tests: 5 minutes
 *    - E2E tests: 10 minutes
 *
 * 4. **Isolation**:
 *    - All test suites use isolation for predictable results
 *    - Integration and E2E tests use process isolation
 *
 * 5. **CI Optimization**:
 *    - JUnit reporter for CI/CD integration
 *    - Verbose reporter for debugging
 *    - Structured output files for result aggregation
 *
 * 6. **Performance Considerations**:
 *    - Thread limits prevent resource exhaustion
 *    - Sequential execution for resource-heavy tests
 *    - Optimized timeouts based on test type
 */
