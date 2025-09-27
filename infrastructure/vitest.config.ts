/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { commonTestConfig } from '@repo/config-testing'
import { defineConfig } from 'vitest/config'

export default defineConfig({
	test: {
		...commonTestConfig,
		name: 'infrastructure',
		environment: 'node',
		include: ['src/**/*.test.{ts,tsx}'],
		passWithNoTests: true,
	},
})
