import { commonTestConfig, unitTestTimeouts } from '@repo/config-testing'
import { defineConfig } from 'vitest/config'

export default defineConfig({
	test: {
		...commonTestConfig,
		...unitTestTimeouts,
		name: 'macro-ai-api-client',
		environment: 'node',
		coverage: {
			...commonTestConfig.coverage,
			exclude: [
				...commonTestConfig.coverage.exclude,
				'scripts/',
				'**/*.test.ts',
				'**/*.config.ts',
			],
		},
	},
})
