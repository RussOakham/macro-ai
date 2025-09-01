import { commonTestConfig, unitTestTimeouts } from '@repo/config-testing'
import { defineConfig } from 'vitest/config'

export default defineConfig({
	test: {
		globals: commonTestConfig.globals,
		environment: commonTestConfig.environment,
		include: commonTestConfig.include,
		exclude: commonTestConfig.exclude,
		silent: commonTestConfig.silent,
		testTimeout: unitTestTimeouts.testTimeout,
		hookTimeout: unitTestTimeouts.hookTimeout,
		teardownTimeout: unitTestTimeouts.teardownTimeout,
		name: 'macro-ai-api-client',
		coverage: {
			provider: commonTestConfig.coverage.provider,
			reporter: commonTestConfig.coverage.reporter,
			exclude: [
				...commonTestConfig.coverage.exclude,
				'scripts/',
				'**/*.test.ts',
				'**/*.config.ts',
			],
		},
	},
})
