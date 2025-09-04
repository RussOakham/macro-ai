import { commonTestConfig, unitTestTimeouts } from '@repo/config-testing'
import { defineConfig } from 'vitest/config'

export default defineConfig({
	test: {
		...commonTestConfig,
		...unitTestTimeouts,
		name: 'macro-ai-api-client',
		environment: 'node',
		pool: 'threads',
		poolOptions: {
			threads: {
				isolate: true,
			},
		},
		coverage: {
			...commonTestConfig.coverage,
			include: ['src/**/*.ts'],
			exclude: [
				...commonTestConfig.coverage.exclude,
				'src/**/*.test.ts',
				'src/**/*.spec.ts',
				'src/**/*.d.ts',
				// Exclude auto-generated files
				'src/client/',
				'src/types/',
				'src/services/',
				'src/index.ts',
				'scripts/',
			],
			// Per-package coverage reporting
			reportsDirectory: './coverage',
			reporter: ['text', 'json-summary', 'lcov'],
			thresholds: {
				global: {
					statements: 80,
					branches: 75,
					functions: 80,
					lines: 80,
				},
			},
		},
	},
})
