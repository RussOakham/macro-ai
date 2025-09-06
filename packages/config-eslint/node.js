// @ts-check

/** @type {import('eslint').Linter.FlatConfig[]} */
const nodeConfig = [
	{
		rules: {
			'n/no-missing-import': 'error',
			'n/no-unsupported-features/es-syntax': 'off',
			'n/no-process-exit': 'warn',
		},
	},
]

export default nodeConfig
