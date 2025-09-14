import * as repoConfig from './packages/config-eslint/index.js'
import oxlintPlugin from 'eslint-plugin-oxlint'

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

	// Project-specific overrides for root
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
			// Root-level specific rules
			'@typescript-eslint/no-unused-vars': 'warn',
			'@typescript-eslint/no-explicit-any': 'warn',
			'sort-keys': 'off',
		},
	},
	{
		rules: {
			'import/no-cycle': 'off',
		},
	},

	// Oxlint configurations
	...oxlintPlugin.buildFromOxlintConfigFile('./.oxlintrc.json'),
)
