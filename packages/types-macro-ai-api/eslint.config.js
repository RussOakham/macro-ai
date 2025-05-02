import * as repoConfig from '@repo/config-eslint'
import globals from 'globals'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const absolutePathToOutput = path.resolve(__dirname, 'src/output.ts')

/** @type {import("@typescript-eslint/utils").TSESLint.FlatConfig.Config} */
export default repoConfig.config(
	...repoConfig.configs.base,
	{
		languageOptions: {
			globals: globals.node,
			parserOptions: {
				project: './tsconfig.eslint.json',
				tsconfigRootDir: __dirname,
				ecmaVersion: 2022,
			},
		},
		// Use absolute path for output.ts
		ignores: ['dist/**', 'node_modules/**', absolutePathToOutput],
		rules: {
			'func-style': 'off',
		},
	},
	// Add specific configuration for scripts directory
	{
		files: ['scripts/**/*.ts'],
		languageOptions: {
			parserOptions: {
				project: './scripts/tsconfig.json',
				tsconfigRootDir: __dirname,
				ecmaVersion: 2022,
			},
		},
		ignores: ['dist/**', 'node_modules/**', absolutePathToOutput],
	},
)
