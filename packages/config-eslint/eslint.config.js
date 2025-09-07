import js from '@eslint/js'
import prettier from 'eslint-config-prettier'

export default [
	// Global ignores
	{
		ignores: ['dist/**', 'node_modules/**', 'tsconfig.json'],
	},
	// JavaScript recommended rules
	js.configs.recommended,
	// Prettier (must be last)
	prettier,
	{
		rules: {
			'no-unused-vars': 'error',
			'prefer-const': 'error',
			'no-var': 'error',
		},
	},
]
