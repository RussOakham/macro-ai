import * as repoConfig from '@repo/config-eslint'
import globals from 'globals'
import pluginRouter from '@tanstack/eslint-plugin-router'

export default repoConfig.config(
	...repoConfig.configs.base,
	...repoConfig.configs.react,
	...pluginRouter.configs['flat/recommended'],
	{
		languageOptions: {
			parserOptions: {
				project: ['./tsconfig.node.json', './tsconfig.app.json'],
				tsconfigRootDir: import.meta.dirname,
				globals: globals.browser,
			},
		},
		ignores: ['dist', 'node_modules'],
	},
)
