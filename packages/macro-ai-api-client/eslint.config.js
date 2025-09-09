import * as repoConfig from '@repo/config-eslint'
import globals from 'globals'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const dirname = path.dirname(fileURLToPath(import.meta.url))

/** @type {import("@typescript-eslint/utils").TSESLint.FlatConfig.Config} */
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
			'temp/**',
			'src/client/**/*.gen.ts', // Generated client files
			'tsconfig.json',
		],
	},
	// Core configurations - foundation for all code
	...repoConfig.configs.base.core,
	...repoConfig.configs.base.codeQuality,
	...repoConfig.configs.base.javascript,

	// Testing configurations (Vitest)
	...repoConfig.configs.base.testing,

	// Security scanning
	...repoConfig.configs.base.security,

	// Project-specific overrides
	{
		files: ['**/*.{ts,tsx}'],
		languageOptions: {
			globals: globals.node,
			parserOptions: {
				project: './tsconfig.eslint.json',
				tsconfigRootDir: dirname,
			},
		},
		rules: {
			// API client specific relaxations
			'func-style': 'off',
			'@typescript-eslint/no-misused-promises': 'warn',
			// Allow console.log in API client for debugging
			'no-console': 'off',
			// Allow __dirname for Node.js compatibility
			'no-underscore-dangle': 'off',
			// Allow inline comments in source files
			'no-inline-comments': 'off',
		},
		settings: {
			'import-x/resolver': {
				typescript: {
					alwaysTryTypes: true,
					project: './tsconfig.eslint.json',
				},
			},
		},
	},

	// Scripts directory - more lenient rules
	{
		files: ['scripts/**/*.{ts,tsx}'],
		rules: {
			'no-console': 'off',
			'@typescript-eslint/no-unused-vars': 'off',
			'@typescript-eslint/require-await': 'off',
		},
	},

	// Generated client files - disable problematic rules for auto-generated code
	{
		files: ['src/client/**/*.ts'],
		rules: {
			'@typescript-eslint/consistent-type-definitions': 'off',
			'@typescript-eslint/no-empty-object-type': 'off',
			'@typescript-eslint/no-explicit-any': 'off',
			'@typescript-eslint/no-unsafe-assignment': 'off',
			'@typescript-eslint/no-unsafe-return': 'off',
			'@typescript-eslint/no-unsafe-argument': 'off',
			'@typescript-eslint/no-non-null-assertion': 'off',
			'@typescript-eslint/no-unnecessary-type-assertion': 'off',
			'@typescript-eslint/no-unnecessary-type-parameters': 'off',
			'@typescript-eslint/no-confusing-void-expression': 'off',
			'@typescript-eslint/no-redundant-type-constituents': 'off',
			'@typescript-eslint/consistent-indexed-object-style': 'off',
			'@typescript-eslint/array-type': 'off',
			'@typescript-eslint/no-unnecessary-condition': 'off',
			'@typescript-eslint/restrict-template-expressions': 'off',
			'@typescript-eslint/no-floating-promises': 'off',
			'@typescript-eslint/no-base-to-string': 'off',
			'@typescript-eslint/no-dynamic-delete': 'off',
			'@typescript-eslint/prefer-nullish-coalescing': 'off',
			'@typescript-eslint/dot-notation': 'off',
			'@typescript-eslint/ban-ts-comment': 'off',
			'@typescript-eslint/no-misused-spread': 'off',
			'simple-import-sort/imports': 'off',
			'simple-import-sort/exports': 'off',
			// JSDoc rules for generated code
			'jsdoc/require-jsdoc': 'off',
			'jsdoc/require-param': 'off',
			'jsdoc/require-param-description': 'off',
			'jsdoc/require-param-type': 'off',
			'jsdoc/require-returns': 'off',
			'jsdoc/require-returns-description': 'off',
			'jsdoc/require-returns-type': 'off',
		},
	},

	// Configuration files - allow default exports and relaxed rules
	{
		files: [
			'**/eslint.config.{js,ts}',
			'**/vite.config.{js,ts}',
			'**/vitest.config.{js,ts}',
			'**/tsup.config.{js,ts}',
			'**/openapi-ts.config.{js,ts}',
		],
		rules: {
			'import-x/no-default-export': 'off',
			'no-inline-comments': 'off',
			'sort-keys': 'off',
			'perfectionist/sort-objects': 'off',
		},
	},

	// Main index file - allow flexible import ordering
	{
		files: ['src/index.ts'],
		rules: {
			'perfectionist/sort-imports': 'off',
		},
	},
)
