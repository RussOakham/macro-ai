import { commonTestConfig, unitTestTimeouts } from '@repo/config-testing'
import { defineConfig } from 'vitest/config'

export default defineConfig({
	test: {
		...unitTestTimeouts,
		name: 'express-api',
		setupFiles: ['./vitest.setup.ts'],
		environment: 'node',
		// Use the shared config but override specific settings
		globals: commonTestConfig.globals,
		include: commonTestConfig.include,
		exclude: commonTestConfig.exclude,
		silent: commonTestConfig.silent,
		coverage: {
			...commonTestConfig.coverage,
			include: ['src/**/*.ts'],
			exclude: [
				...commonTestConfig.coverage.exclude,
				'src/**/*.test.ts',
				'src/**/*.spec.ts',
				'src/**/*.d.ts',
			],
		},
	},
})
