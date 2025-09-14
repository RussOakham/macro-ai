import * as repoConfig from '@repo/config-eslint'
import drizzlePlugin from 'eslint-plugin-drizzle'
import globals from 'globals'

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
			'scripts/**/*',
			'../../scripts/**/*',
			'src/test-helpers/**',
			'src/utils/test-helpers/**',
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
				ecmaVersion: 2022,
				project: './tsconfig.json',
				allowImportingTsExtensions: true,
			},
		},
		plugins: {
			drizzle: drizzlePlugin,
		},
		rules: {
			'@typescript-eslint/no-misused-promises': 'warn',
			// Disable turbo env var rule for Express API
			'turbo/no-undeclared-env-vars': 'warn',
		},
	},
)
