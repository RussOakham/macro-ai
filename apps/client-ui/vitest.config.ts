import { tanstackRouter } from '@tanstack/router-plugin/vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { defineConfig } from 'vitest/config'

const ReactCompilerConfig = {
	target: '19',
}

// Conditionally include React Compiler plugin based on environment variable
const shouldUseReactCompiler =
	process.env.PREVIEW === 'true' || process.env.NODE_ENV === 'development'

const babelPlugins = shouldUseReactCompiler
	? [['babel-plugin-react-compiler', ReactCompilerConfig]]
	: []

// Detect if running in act environment
const isActEnvironment = process.env.ACT_LOCAL === 'true'

export default defineConfig({
	plugins: [
		tanstackRouter(),
		react({
			babel: {
				plugins: babelPlugins,
			},
		}),
	],
	resolve: {
		alias: {
			'@': path.resolve(__dirname, './src'),
		},
	},
	test: {
		name: 'client-ui',
		setupFiles: ['./src/test/setup.ts'],
		environment: 'happy-dom',
		// Optimize timeouts for act environment
		...(isActEnvironment && {
			testTimeout: 10000,
			hookTimeout: 15000,
			teardownTimeout: 10000,
		}),
	},
})
