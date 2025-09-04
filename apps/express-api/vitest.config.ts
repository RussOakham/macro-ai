import { defineConfig } from 'vitest/config'

export default defineConfig({
	test: {
		// Minimal config - workspace handles the rest
		name: 'express-api',
		setupFiles: ['./vitest.setup.ts'],
	},
})
