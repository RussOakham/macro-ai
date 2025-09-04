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
		environment: 'jsdom',
		setupFiles: ['./src/test/setup.ts'],
		include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
		// Configure parallel test execution using Vitest's built-in capabilities
		pool: 'threads',
		poolOptions: {
			threads: {
				singleThread: isActEnvironment, // Run single-threaded in act for faster execution
				minThreads: 1,
				maxThreads: isActEnvironment ? 1 : 4, // Limit to 1 thread in act
			},
		},
		// Enable parallel execution (but limit in act environment)
		fileParallelism: !isActEnvironment,
		// Optimize timeouts for act environment
		...(isActEnvironment && {
			testTimeout: 10000, // 10 seconds instead of 30 for act
			hookTimeout: 15000, // 15 seconds instead of 30 for act
			teardownTimeout: 10000, // 10 seconds instead of 30 for act
		}),
		coverage: {
			...commonTestConfig.coverage,
			exclude: [
				...commonTestConfig.coverage.exclude,
				'src/test/',
				'**/*.d.ts',
				'**/*.config.*',
				'**/coverage/**',
				'**/dist/**',
				'**/.{idea,git,cache,output,temp}/**',
				'src/routeTree.gen.ts', // Exclude generated route tree
				'src/main.tsx', // Exclude main entry point
				// Note: React components (.tsx) are included for coverage
				// Focus on testing hooks and business logic per CLAUDE.md guidelines
			],
			thresholds: {
				// Lower threshold for React components initially
				statements: 60,
				branches: 50,
				functions: 60,
				lines: 60,
			},
		},
		// Mock CSS modules and other assets
		css: {
			modules: {
				classNameStrategy: 'non-scoped',
			},
		},
	},
})
