import * as repoConfig from '@repo/config-eslint'
import globals from 'globals'
import drizzlePlugin from 'eslint-plugin-drizzle'

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
		],
	},
	...repoConfig.configs.base.core,
	...repoConfig.configs.base.codeQuality,
	...repoConfig.configs.base.promises,
	...repoConfig.configs.base.imports,
	...repoConfig.configs.base.javascript,
	...repoConfig.configs.base.node,
	{
		languageOptions: {
			globals: globals.node,
			parserOptions: {
				ecmaVersion: 2022,
				project: './tsconfig.json',
			},
		},
		plugins: {
			drizzle: drizzlePlugin,
		},
		rules: {
			// Disable turbo env var rule for Express API
			'turbo/no-undeclared-env-vars': 'off',
		},
	},
)
