// @ts-check

/** @type {import('eslint').Linter.FlatConfig[]} */
const securityConfig = [
	{
		rules: {
			'security/detect-eval-with-expression': 'error',
			'security-node/detect-buffer-noassert': 'error',
		},
	},
]

export default securityConfig
