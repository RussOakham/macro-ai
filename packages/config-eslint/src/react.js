// @ts-check
import reactRefresh from 'eslint-plugin-react-refresh'
import tailwind from 'eslint-plugin-tailwindcss'
import * as reactCompiler from 'eslint-plugin-react-compiler'

const reactConfig = {
	recommended: /** @type {import("typescript-eslint").ConfigWithExtends[]} */ [
		{
			files: ['*/.{ts,tsx,js,jsx}'],
			plugins: {
				'react-refresh': reactRefresh,
				tailwind,
				'react-compiler': reactCompiler,
			},
			settings: { react: { version: 'detect' } },
			rules: {
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
