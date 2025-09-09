import tseslint from 'typescript-eslint'

import * as repoConfig from '../config-eslint/index.js'

/** @type {import("@typescript-eslint/utils").TSESLint.FlatConfig.Config} */
export default repoConfig.config(
	// Global ignores - must be first
	{
		ignores: [
			'**/node_modules/**',
			'**/dist/**',
			'**/build/**',
			'**/coverage/**',
			'**/*.d.ts',
			'**/.next/**',
			'**/.nuxt/**',
			'**/.output/**',
			'**/.vercel/**',
			'**/.netlify/**',
			'**/coverage-final.json',
			'**/coverage-summary.json',
			'**/*.lcov',
			'tsconfig.json',
		],
	},
	// Core configurations - foundation for all code
	...repoConfig.configs.base.core,
	...repoConfig.configs.base.codeQuality,

	// TypeScript-specific configuration with type checking
	{
		files: ['**/*.{ts,tsx}'],
		languageOptions: {
			parserOptions: {
				project: './tsconfig.json',
				tsconfigRootDir: import.meta.dirname,
			},
		},
	},

	// Testing configurations (Vitest)
	...repoConfig.configs.base.testing,

	// Security scanning
	...repoConfig.configs.base.security,

	// Explicit override for ESLint config files to prevent TypeScript parsing
	{
		files: ['eslint.config.{js,ts}'],
		...tseslint.configs.disableTypeChecked,
		languageOptions: {
			parserOptions: {
				ecmaVersion: 'latest',
				sourceType: 'module',
			},
		},
	},

	// Project-specific overrides
	{
		files: ['**/*.{ts,tsx,js,jsx}'],
		languageOptions: {
			globals: {
				console: 'readonly',
				process: 'readonly',
				Buffer: 'readonly',
				setTimeout: 'readonly',
				clearTimeout: 'readonly',
				setInterval: 'readonly',
				clearInterval: 'readonly',
			},
		},
		rules: {
			// Package-specific rules
			'@typescript-eslint/no-unused-vars': 'warn',
			'@typescript-eslint/no-explicit-any': 'warn',
		},
	},
)
