import * as repoConfig from '@repo/config-eslint'

export default repoConfig.config(
	...repoConfig.configs.base,
	...repoConfig.configs.react,
	{
		languageOptions: {
			parserOptions: {
				project: ['./tsconfig.node.json', './tsconfig.app.json'],
				tsconfigRootDir: import.meta.dirname,
			},
		},
		ignores: ['dist', 'node_modules'],
	},
)
