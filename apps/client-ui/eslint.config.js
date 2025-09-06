import * as repoConfig from '@repo/config-eslint'
import pluginQuery from '@tanstack/eslint-plugin-query'
import pluginRouter from '@tanstack/eslint-plugin-router'
import globals from 'globals'
import tsParser from '@typescript-eslint/parser'
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
		],
	},
	// Core configurations - foundation for all code
	...repoConfig.configs.base.core,
	...repoConfig.configs.base.codeQuality,
	...repoConfig.configs.base.promises,
	...repoConfig.configs.base.imports,
	...repoConfig.configs.base.javascript,

	// React-specific configurations
	...repoConfig.configs.react.recommended,

	// Testing configurations (Vitest + React Testing Library)
	...repoConfig.configs.base.testing,

	// Documentation and code organization
	...repoConfig.configs.base.documentation,
	...repoConfig.configs.base.customRules,

	// Security scanning
	...repoConfig.configs.base.security,

	// Third-party integrations
	...pluginRouter.configs['flat/recommended'],
	...pluginQuery.configs['flat/recommended'],

	// TypeScript-specific configurations (applied after base configs)
	...repoConfig.configs.base.strictTyping,

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
			'@typescript-eslint/no-misused-promises': 'off',
			'jsdoc/require-jsdoc': 'off',
			'jsdoc/require-param-description': 'off',
			'jsdoc/require-param-type': 'off',
			'jsdoc/require-returns': 'off',
			'jsdoc/require-returns-description': 'off',
			'jsdoc/require-returns-type': 'off',
			'react/jsx-props-no-spreading': 'off',
			'react/require-default-props': 'off',
		},
		settings: {
			'import-x/resolver-next': [
				createTypeScriptImportResolver({
					alwaysTryTypes: true,
				}),
			],
		},
	},

	// Test files - relaxed TypeScript rules
	{
		files: ['src/test/**/*.{ts,tsx,js,jsx}'],
		rules: {
			'@typescript-eslint/no-explicit-any': 'off',
			'@typescript-eslint/no-unsafe-member-access': 'off',
		},
	},

	// JavaScript files (like config files) - no TypeScript parser
	{
		files: ['**/*.{js,jsx}'],
		languageOptions: {
			globals: globals.browser,
		},
		rules: {
			// Relax JSDoc requirements for config files
			'jsdoc/require-jsdoc': 'off',
			'jsdoc/require-param-description': 'off',
			'jsdoc/require-param-type': 'off',
			'jsdoc/require-returns': 'off',
		},
	},
)
