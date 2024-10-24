import * as repoConfig from '@repo/config-eslint'
import globals from 'globals'

export default repoConfig.config(
	...repoConfig.configs.base,
	...repoConfig.configs.react,
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
