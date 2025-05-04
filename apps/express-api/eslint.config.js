import * as repoConfig from '@repo/config-eslint'
import globals from 'globals'
import drizzlePlugin from 'eslint-plugin-drizzle'

export default repoConfig.config(...repoConfig.configs.base, {
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
})
