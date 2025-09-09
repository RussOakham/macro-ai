import * as repoConfig from '@repo/config-eslint'
import pluginQuery from '@tanstack/eslint-plugin-query'
import pluginRouter from '@tanstack/eslint-plugin-router'
import globals from 'globals'
import { createTypeScriptImportResolver } from 'eslint-import-resolver-typescript'

export default repoConfig.config(
	// Global ignores - must be first
	{
		ignores: [
			'dist/**',
			'node_modules/**',
			'coverage/**',
			'coverage-final.json',
			'coverage-summary.json',
			'*.lcov',
			'src/test/mocks/**',
			'src/routeTree.gen.ts',
			'postcss.config.js',
			'eslint.config.js',
		],
	},
	// Core configurations - foundation for all code
	...repoConfig.configs.base.core,
	...repoConfig.configs.base.codeQuality,
	...repoConfig.configs.base.javascript,

	// React-specific configurations
	...repoConfig.configs.react.recommended,

	// Testing configurations (Vitest + React Testing Library)
	...repoConfig.configs.base.testing,

	// Security scanning
	...repoConfig.configs.base.security,

	// Third-party integrations
	...pluginRouter.configs['flat/recommended'],
	...pluginQuery.configs['flat/recommended'],

	// Project-specific overrides
	{
		// Only apply to TypeScript files
		files: ['**/*.{ts,tsx}'],
		languageOptions: {
			parserOptions: {
				globals: globals.browser,
				project: [
					'./tsconfig.node.json',
					'./tsconfig.app.json',
					'./tsconfig.test.json',
				],
				tsconfigRootDir: import.meta.dirname,
			},
		},
		rules: {
			'@typescript-eslint/no-misused-promises': 'warn',
			'react/jsx-props-no-spreading': 'off',
			'react/require-default-props': 'off',
			// Disable rules that oxlint handles better
			'sort-keys': 'off',
			'one-var': 'off',
			'no-ternary': 'off',
		},
		settings: {
			'import-x/resolver-next': [
				createTypeScriptImportResolver({
					alwaysTryTypes: true,
				}),
			],
		},
	},

	// TypeScript-specific configurations (applied after JavaScript configs)
	...repoConfig.configs.base.strictTyping,
)
