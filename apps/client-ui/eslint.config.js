import * as repoConfig from '@repo/config-eslint'
import globals from 'globals'
import pluginRouter from '@tanstack/eslint-plugin-router'
import pluginQuery from '@tanstack/eslint-plugin-query'

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
		],
	},
	...repoConfig.configs.base,
	...repoConfig.configs.react,
	...pluginRouter.configs['flat/recommended'],
	...pluginQuery.configs['flat/recommended'],
	{
		languageOptions: {
			parserOptions: {
				project: [
					'./tsconfig.node.json',
					'./tsconfig.app.json',
					'./tsconfig.test.json',
				],
				tsconfigRootDir: import.meta.dirname,
				globals: globals.browser,
			},
		},
		rules: {
			'@typescript-eslint/no-misused-promises': [
				2,
				{
					checksVoidReturn: {
						attributes: false,
					},
				},
			],
		},
	},
)
