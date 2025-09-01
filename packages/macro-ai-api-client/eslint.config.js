import * as repoConfig from '@repo/config-eslint'
import globals from 'globals'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const absolutePathToOutput = path.resolve(__dirname, 'src/output.ts')

/** @type {import("@typescript-eslint/utils").TSESLint.FlatConfig.Config} */
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
			absolutePathToOutput,
		],
	},
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
	},
	// Add specific configuration for generated files to disable problematic rules
	{
		files: ['src/client/**/*.ts'],
		rules: {
			'@typescript-eslint/consistent-type-definitions': 'off',
			'@typescript-eslint/no-empty-object-type': 'off',
			'@typescript-eslint/no-explicit-any': 'off',
			'@typescript-eslint/no-unsafe-assignment': 'off',
			'@typescript-eslint/no-unsafe-return': 'off',
			'@typescript-eslint/no-unsafe-argument': 'off',
			'@typescript-eslint/no-non-null-assertion': 'off',
			'@typescript-eslint/no-unnecessary-type-assertion': 'off',
			'@typescript-eslint/no-unnecessary-type-parameters': 'off',
			'@typescript-eslint/no-confusing-void-expression': 'off',
			'@typescript-eslint/no-redundant-type-constituents': 'off',
			'@typescript-eslint/consistent-indexed-object-style': 'off',
			'@typescript-eslint/array-type': 'off',
			'@typescript-eslint/no-unnecessary-condition': 'off',
			'@typescript-eslint/restrict-template-expressions': 'off',
			'@typescript-eslint/no-floating-promises': 'off',
			'@typescript-eslint/no-base-to-string': 'off',
			'@typescript-eslint/no-dynamic-delete': 'off',
			'@typescript-eslint/prefer-nullish-coalescing': 'off',
			'@typescript-eslint/dot-notation': 'off',
			'@typescript-eslint/ban-ts-comment': 'off',
			'@typescript-eslint/no-misused-spread': 'off',
			'simple-import-sort/imports': 'off',
			'simple-import-sort/exports': 'off',
		},
	},
)
