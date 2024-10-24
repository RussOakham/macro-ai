import { fixupConfigRules, fixupPluginRules } from '@eslint/compat'
import js from '@eslint/js'
import prettier from 'eslint-config-prettier'
import react from 'eslint-plugin-react'
import hooks from 'eslint-plugin-react-hooks'
import turbo from 'eslint-config-turbo'
import reactRefresh from 'eslint-plugin-react-refresh'
import reactCompiler from 'eslint-plugin-react-compiler'
import simpleImportSort from 'eslint-plugin-simple-import-sort'
import ts from 'typescript-eslint'
import { FlatCompat } from '@eslint/eslintrc'

const compat = new FlatCompat({
	recommendedConfig: js.configs.recommended,
	allConfig: js.configs.all,
})

const removeDuplicatePlugins = (...configs) => {
	let found = []
	for (const config of configs) {
		if (Boolean(config.plugins)) {
			for (const key of Object.keys(config.plugins)) {
				if (found.includes(key)) {
					delete config.plugins[key]
				} else {
					found.push(key)
				}
			}
		}
	}
	return configs
}

const overrides = {
	files: ['*/.{ts,tsx}'],
	rules: {
		// remove conflicting rules (tsserver/prettier)
		'no-unused-vars': 'off',
		'no-undef': 'off',
		'import/extensions': 'off',
		'import/prefer-default-export': 'off',
		'import/order': 'off',
		// remove hyper-restrictive rules
		'no-underscore-dangle': 'warn',
		'class-methods-use-this': 'warn',
		'react/jsx-props-no-spreading': 'off',
		'@typescript-eslint/no-unsafe-assignment': 'warn',
		'@typescript-eslint/no-unsafe-call': 'warn',
		'@typescript-eslint/no-unsafe-member-access': 'warn',
		'@typescript-eslint/restrict-template-expressions': 'warn',
		'@typescript-eslint/unbound-method': 'warn',
		'@typescript-eslint/no-misused-promises': [
			'error',
			{
				checksVoidReturn: false,
			},
		],
	},
}

/**
 * Utility function to make it easy to strictly type your "Flat" config file.
 * Ensures that prettier conflict resolution is applied last.
 *
 * @param {...import("typescript-eslint").ConfigWithExtends} configs - flat configs to include
 *
 * @example
 *
typescript
 * import * as travelchapter from '@travelchapter/config-eslint';
 *
 * export default travelchapter.config(
 *   ...travelchapter.configs.base,
 *   ...travelchapter.configs.react,
 *   {
 *     rules: {
 *       '@typescript-eslint/array-type': 'error',
 *     },
 *   },
 * );
 * 
 */
export const config = (...configs) =>
	ts.config(
		...removeDuplicatePlugins(...configs),
		// enable type checking
		// {
		//   languageOptions: {
		//     parserOptions: {
		//       project: true,
		//       // allow tsconfig bubbling
		//       tsconfigRootDir: import.meta.dirname,
		//     },
		//   },
		// },
		overrides,
		prettier,
		{
			ignores: ['tsconfig.json', 'dist', 'node_modules', 'eslint.config.js'],
		},
	)

export const configs = {
	/** Generic rules for all JavaScript/Typescript code. */
	base: [
		...fixupConfigRules(compat.extends('turbo')),
		// typescript base
		...ts.configs.strictTypeChecked,
		...ts.configs.stylisticTypeChecked,
		// disable type checking for non-ts files
		{
			files: ['*.{js,jsx}'],
			...ts.configs.disableTypeChecked,
			plugins: { 'simple-import-sort': simpleImportSort },

			rules: {
				...js.configs.recommended.rules,
				...js.configs.all.rules,
				'simple-import-sort/imports': [
					'error',
					{
						groups: [
							// Packages `react` related packages come first.
							['^react', '^@?\\w'],
							// Internal packages.
							['^(@|components)(/.*|$)'],
							// Side effect imports.
							['^\\u0000'],
							// Parent imports. Put `..` last.
							['^\\.\\.(?!/?$)', '^\\.\\./?$'],
							// Other relative imports. Put same-folder imports and `.` last.
							['^\\./(?=.*/)(?!/?$)', '^\\.(?!/?$)', '^\\./?$'],
							// Style imports.
							['^.+\\.?(css)$'],
						],
					},
				],
				'simple-import-sort/exports': 'error',
			},
		},
	],
	/** Rules specific to React and React Hooks */
	react: [
		{
			files: ['*/.{ts,tsx}'],
			...react.configs.flat.all,
			rules: {
				'func-style': 'off', // allow Capitalised component names
				'react/react-in-jsx-scope': 'off', // no-longer needed in newer React versions
			},
		},
		// NOTE hooks doesnt provide flat config yet
		{
			files: ['*/.{ts,tsx}'],
			plugins: {
				'react-hooks': fixupPluginRules(hooks),
				'react-compiler': reactCompiler,
				'react-refresh': reactRefresh,
			},
			rules: {
				...hooks.configs.recommended.rules,
				'react-refresh/only-export-components': [
					'warn',
					{ allowConstantExport: true },
				],
			},
		},
		// overrides
		{
			files: ['*/.{tsx}'],
			rules: {
				// remove hyper-restrictive rules
			},
		},
	],
}
