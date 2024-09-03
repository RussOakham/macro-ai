/** @type {import("eslint").Linter.Config} */
module.exports = {
	extends: [
		'@repo/eslint-config/index.js',
		'airbnb',
		'airbnb-typescript',
		'airbnb/hooks',
		'plugin:react-hooks/recommended',
		'plugin:react/jsx-runtime',
		'prettier',
	],
	ignorePatterns: ['dist', '.eslintrc.cjs'],
	plugins: ['react-refresh'],
	parserOptions: {
		ecmaVersion: 'latest',
		sourceType: 'module',
		project: ['./tsconfig.json', './tsconfig.node.json', './tsconfig.app.json'],
		tsconfigRootDir: __dirname,
	},
	root: true,
	rules: {
		'react-refresh/only-export-components': [
			'warn',
			{ allowConstantExport: true },
		],
		'@typescript-eslint/no-misused-promises': [
			2,
			{
				checksVoidReturn: {
					attributes: false,
				},
			},
		],
		'react/prop-types': 'off',
		'react/require-default-props': 'off',
		'react/jsx-props-no-spreading': 'off',
		'react/function-component-definition': [
			2,
			{
				namedComponents: [
					'function-declaration',
					'function-expression',
					'arrow-function',
				],
				unnamedComponents: ['function-expression', 'arrow-function'],
			},
		],
	},
}
