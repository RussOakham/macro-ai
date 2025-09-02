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

export default defineConfig({
	// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
	plugins: [
		tanstackRouter(),
		react({
			babel: {
				plugins: babelPlugins,
			},
		}),
	] as any, // eslint-disable-line @typescript-eslint/no-explicit-any -- Type assertion to resolve Vite version conflicts
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
				global: {
					statements: 60, // Lower threshold for React components initially
					branches: 50,
					functions: 60,
					lines: 60,
				},
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
