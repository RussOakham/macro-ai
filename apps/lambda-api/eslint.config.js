import * as repoConfig from '@repo/config-eslint'
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
			'esbuild.config.js',
		],
	},
	...repoConfig.configs.base,
	{
		languageOptions: {
			globals: globals.node,
			parserOptions: {
				ecmaVersion: 2022,
				project: './tsconfig.json',
			},
		},
	},
)
