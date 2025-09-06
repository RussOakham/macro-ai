// @ts-check

/** @type {import('eslint').FlatConfig[]} */
const securityConfig = [
	{
		rules: {
			'security/detect-eval-with-expression': 'error',
			'security-node/detect-buffer-noassert': 'error',
		},
	},
]

export default securityConfig
