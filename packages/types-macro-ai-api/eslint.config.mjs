import * as repoConfig from '@repo/config-eslint'
import globals from 'globals'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default repoConfig.config(
	...repoConfig.configs.base,
	{
		languageOptions: {
			globals: globals.node,
			parserOptions: {
				project: './tsconfig.json',
				tsconfigRootDir: __dirname,
			},
		},
		ignores: ['dist', 'node_modules', 'src/output.ts'],
	},
	// Add specific configuration for scripts directory
	{
		files: ['scripts/**/*.ts'],
		languageOptions: {
			parserOptions: {
				project: './scripts/tsconfig.json',
				tsconfigRootDir: __dirname,
			},
		},
	},
)
