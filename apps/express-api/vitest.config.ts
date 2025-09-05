import { commonTestConfig, unitTestTimeouts } from '@repo/config-testing'
import { defineConfig } from 'vitest/config'

export default defineConfig({
	test: {
		...commonTestConfig,
		...unitTestTimeouts,
		name: 'express-api',
		setupFiles: ['./vitest.setup.ts'],
		include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts}', 'src/**/*.integration.test.{js,mjs,cjs,ts,mts,cts}'],
		coverage: {
			...commonTestConfig.coverage,
			include: ['src/**/*.ts'],
			exclude: [
				...commonTestConfig.coverage.exclude,
				'src/**/*.test.ts',
				'src/**/*.spec.ts',
				'src/**/*.d.ts',
				// Exclude root level config files
				'../drizzle.config.ts',
				'../**/*.config.ts',
				'../**/*.config.js',
				'../**/*.config.cjs',
				// Exclude scripts folder
				'../scripts/',
				'../scripts/**/*',
			],
			// Per-package coverage reporting
			reportsDirectory: './coverage',
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
