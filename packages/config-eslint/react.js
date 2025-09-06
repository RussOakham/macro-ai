// @ts-check
import react from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'
import jsxA11y from 'eslint-plugin-jsx-a11y'
import reactRefresh from 'eslint-plugin-react-refresh'
import tailwind from 'eslint-plugin-tailwindcss'
import reactCompiler from 'eslint-plugin-react-compiler'

/** @type {import('eslint').FlatConfig[]} */
const reactConfig = [
	{
		plugins: {
			react,
			'react-hooks': reactHooks,
			'jsx-a11y': jsxA11y,
			'react-refresh': reactRefresh,
			tailwind,
			'react-compiler': reactCompiler,
		},
		settings: { react: { version: 'detect' } },
		rules: {
			// React core
			'react/jsx-uses-react': 'off',
			'react/react-in-jsx-scope': 'off',

			// Hooks
			'react-hooks/rules-of-hooks': 'error',
			'react-hooks/exhaustive-deps': 'warn',

			// A11y
			'jsx-a11y/alt-text': 'warn',
			'jsx-a11y/no-autofocus': 'warn',

			// Fast refresh
			'react-refresh/only-export-components': 'warn',

			// Tailwind
			'tailwindcss/classnames-order': 'warn',

			// React Compiler
			'react-compiler/react-compiler': 'error',
		},
	},
]

export default reactConfig
