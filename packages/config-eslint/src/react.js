// @ts-check
import react from 'eslint-plugin-react'
import * as reactHooks from 'eslint-plugin-react-hooks'
import jsxA11y from 'eslint-plugin-jsx-a11y'
import reactRefresh from 'eslint-plugin-react-refresh'
import tailwind from 'eslint-plugin-tailwindcss'
import * as reactCompiler from 'eslint-plugin-react-compiler'

const reactConfig = {
	recommended: /** @type {import("typescript-eslint").ConfigWithExtends[]} */ [
		{
			files: ['*/.{ts,tsx,js,jsx}'],
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
				'react/jsx-props-no-spreading': 'off', // Allow JSX prop spreading for composition

				// Hooks
				'react-hooks/rules-of-hooks': 'error',
				'react-hooks/exhaustive-deps': 'warn',

				// A11y
				'jsx-a11y/alt-text': 'warn',
				'jsx-a11y/no-autofocus': 'warn',

				// Fast refresh
				'react-refresh/only-export-components': [
					'warn',
					{ allowConstantExport: true },
				],

				// Tailwind
				'tailwindcss/classnames-order': 'warn',

				// React Compiler
				'react-compiler/react-compiler': 'error',
			},
		},
	],
}

export { reactConfig }
