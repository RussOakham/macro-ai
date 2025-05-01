import * as repoConfig from '@repo/config-eslint'
import globals from 'globals'

export default repoConfig.config(...repoConfig.configs.base, {
	languageOptions: {
		globals: globals.node,
		parserOptions: {
			ecmaVersion: 2022,
			project: './tsconfig.json',
		},
	},
	rules: {
		'@typescript-eslint/no-deprecated': 'off',
	},
})
