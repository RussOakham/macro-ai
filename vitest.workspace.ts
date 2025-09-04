/**
 * Vitest Workspace Configuration
 *
 * Modern workspace configuration using projects field
 * that centralizes test settings and eliminates duplication across the monorepo.
 */

import { defineConfig } from 'vitest/config'
import {
	commonTestConfig,
	unitTestTimeouts,
	integrationTestTimeouts,
} from '@repo/config-testing'

export default defineConfig({
	test: {
		coverage: {
			...commonTestConfig.coverage,
			include: [
				'apps/express-api/src/**/*.ts',
				'packages/macro-ai-api-client/src/**/*.ts',
			],
			exclude: [
				...commonTestConfig.coverage.exclude,
				'apps/express-api/src/**/*.test.ts',
				'apps/express-api/src/**/*.spec.ts',
				'apps/express-api/src/**/*.d.ts',
				'packages/macro-ai-api-client/src/**/*.test.ts',
				'packages/macro-ai-api-client/src/**/*.spec.ts',
				'packages/macro-ai-api-client/src/**/*.d.ts',
				// Exclude auto-generated files from api-client
				'packages/macro-ai-api-client/src/types/',
				'packages/macro-ai-api-client/src/services/',
				'packages/macro-ai-api-client/src/index.ts',
				'packages/macro-ai-api-client/scripts/',
			],
			// 80% coverage for backend and api-client code
			thresholds: {
				global: {
					statements: 80,
					branches: 75,
					functions: 80,
					lines: 80,
				},
			},
		},
		projects: [
			// Express API - Backend tests
			{
				root: './apps/express-api',
				test: {
					...commonTestConfig,
					...unitTestTimeouts,
					name: 'express-api',
					environment: 'node',
					pool: 'threads',
					poolOptions: {
						threads: {
							isolate: true,
						},
					},
					setupFiles: ['./apps/express-api/vitest.setup.ts'],
				},
			},

			// Client UI - Frontend tests
			{
				root: './apps/client-ui',
				plugins: [],
				resolve: {
					alias: {
						'@': './src',
					},
				},
				test: {
					...commonTestConfig,
					...unitTestTimeouts,
					name: 'client-ui',
					environment: 'happy-dom',
					pool: 'threads',
					poolOptions: {
						threads: {
							isolate: true,
						},
					},
					setupFiles: ['./apps/client-ui/src/test/setup.ts'],
					include: ['src/**/*.{test,spec}.{ts,tsx}'],
					exclude: [
						...commonTestConfig.exclude,
						'src/routeTree.gen.ts',
						'src/**/*.e2e.test.{ts,tsx}',
					],
					// Mock CSS modules and other assets
					css: {
						modules: {
							classNameStrategy: 'non-scoped',
						},
					},
					// React-specific globals
					globals: true,
				},
			},

			// API Client - Package tests
			{
				root: './packages/macro-ai-api-client',
				test: {
					...commonTestConfig,
					...unitTestTimeouts,
					name: 'api-client',
					environment: 'node',
					pool: 'threads',
					poolOptions: {
						threads: {
							isolate: true,
						},
					},
				},
			},

			// Integration tests - Separate configuration for longer-running tests
			{
				root: './apps/express-api',
				test: {
					...commonTestConfig,
					...integrationTestTimeouts,
					name: 'integration',
					include: ['src/**/*.integration.test.ts'],
					environment: 'node',
					pool: 'forks',
					poolOptions: {
						forks: {
							isolate: true,
						},
					},
					sequence: {
						concurrent: false,
					},
				},
			},

			// E2E tests - Browser-based tests
			{
				root: './apps/client-ui',
				test: {
					...commonTestConfig,
					name: 'e2e',
					include: ['src/**/*.e2e.test.{ts,tsx}', 'e2e/**/*.test.{ts,tsx}'],
					environment: 'happy-dom',
					pool: 'forks',
					poolOptions: {
						forks: {
							isolate: true,
						},
					},
					testTimeout: 600000,
					hookTimeout: 120000,
					sequence: {
						concurrent: false,
					},
				},
			},
		],
	},
})

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
