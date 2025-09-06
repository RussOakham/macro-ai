// @ts-check
import js from '@eslint/js'
import gitignore from 'eslint-config-flat-gitignore'
import tseslint from 'typescript-eslint'
import unicorn from 'eslint-plugin-unicorn'
import sonarjs from 'eslint-plugin-sonarjs'
import perfectionist from 'eslint-plugin-perfectionist'
import promise from 'eslint-plugin-promise'
import n from 'eslint-plugin-n'
import security from 'eslint-plugin-security'
import securityNode from 'eslint-plugin-security-node'
import importX from 'eslint-plugin-import-x'

/** @type {import('eslint').FlatConfig[]} */
const baseConfig = [
	gitignore(),
	js.configs.recommended,
	...tseslint.configs.recommended,

	{
		plugins: {
			unicorn,
			sonarjs,
			perfectionist,
			promise,
			n,
			security,
			'security-node': securityNode,
			'import-x': importX,
		},
		rules: {
			// Unicorn
			'unicorn/filename-case': ['error', { case: 'kebabCase' }],
			'unicorn/prefer-node-protocol': 'error',

			// SonarJS
			'sonarjs/no-duplicate-string': 'warn',

			// Perfectionist
			'perfectionist/sort-imports': ['error', { type: 'natural' }],

			// Promises
			'promise/always-return': 'error',
			'promise/no-nesting': 'warn',

			// Node.js
			'n/no-deprecated-api': 'error',

			// Security
			'security/detect-object-injection': 'off',
			'security-node/detect-insecure-randomness': 'error',

			// Imports
			'import-x/no-unresolved': 'error',
			'import-x/no-cycle': 'warn',
		},
	},
]

export default baseConfig
