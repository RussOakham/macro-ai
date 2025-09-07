import { commonTestConfig, unitTestTimeouts } from '@repo/config-testing'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'
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
		...commonTestConfig,
		...unitTestTimeouts,
		coverage: {
			...commonTestConfig.coverage,
			exclude: [
				...commonTestConfig.coverage.exclude,
				'src/test/',
				'**/*.d.ts',
				'**/*.config.*',
				'**/coverage/**',
				'**/dist/**',
				'**/routeTree.gen.ts',
				'**/main.tsx',
				'src/**/*.stories.{ts,tsx}',
			],
			include: ['src/**/*.{ts,tsx}'],
			// Per-package coverage reporting
			reportsDirectory: './coverage',
			thresholds: {
				global: {
					branches: 20,

					functions: 30,
					lines: 30,
					statements: 30,
				},
			},
		},
		// Mock CSS modules and other assets
		css: {
			modules: {
				classNameStrategy: 'non-scoped',
			},
		},
		environment: 'happy-dom',
		exclude: [
			...commonTestConfig.exclude,
			'src/routeTree.gen.ts',
			'src/**/*.e2e.test.{ts,tsx}',
			'src/test/mocks/**/*',
		],
		// React-specific globals
		globals: true,
		include: ['src/**/*.{test,spec}.{ts,tsx}'],
		name: 'client-ui',
		pool: 'threads',
		poolOptions: {
			threads: {
				isolate: true,
			},
		},
		setupFiles: ['./src/test/setup.ts'],
		// Optimize timeouts for act environment
		...(isActEnvironment && {
			hookTimeout: 15000,
			teardownTimeout: 10000,
			testTimeout: 10000,
		}),
	},
})
