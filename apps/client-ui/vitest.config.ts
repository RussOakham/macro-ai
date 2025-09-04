import { commonTestConfig, unitTestTimeouts } from '@repo/config-testing'
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
		...commonTestConfig,
		...unitTestTimeouts,
		name: 'client-ui',
		setupFiles: ['./src/test/setup.ts'],
		environment: 'happy-dom',
		pool: 'threads',
		poolOptions: {
			threads: {
				isolate: true,
			},
		},
		include: ['src/**/*.{test,spec}.{ts,tsx}'],
		exclude: [
			...commonTestConfig.exclude,
			'src/routeTree.gen.ts',
			'src/**/*.e2e.test.{ts,tsx}',
			'src/test/mocks/**/*',
		],
		// Mock CSS modules and other assets
		css: {
			modules: {
				classNameStrategy: 'non-scoped',
			},
		},
		// React-specific globals
		globals: true,
		coverage: {
			...commonTestConfig.coverage,
			include: ['src/**/*.{ts,tsx}'],
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
			thresholds: {
				global: {
					statements: 30,
					branches: 20,
					functions: 30,
					lines: 30,
				},
			},
		},
		// Optimize timeouts for act environment
		...(isActEnvironment && {
			testTimeout: 10000,
			hookTimeout: 15000,
			teardownTimeout: 10000,
		}),
	},
})
