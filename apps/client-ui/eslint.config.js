import * as repoConfig from '@repo/config-eslint'
import globals from 'globals'
import pluginRouter from '@tanstack/eslint-plugin-router'
import pluginQuery from '@tanstack/eslint-plugin-query'

export default repoConfig.config(
	...repoConfig.configs.base,
	...repoConfig.configs.react,
	...pluginRouter.configs['flat/recommended'],
	...pluginQuery.configs['flat/recommended'],
	{
		languageOptions: {
			parserOptions: {
				project: ['./tsconfig.node.json', './tsconfig.app.json'],
				tsconfigRootDir: import.meta.dirname,
				globals: globals.browser,
			},
		},
		ignores: ['dist', 'node_modules'],
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
