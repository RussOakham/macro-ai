// @ts-check

const securityConfig = {
	recommended: /** @type {import("typescript-eslint").ConfigWithExtends[]} */ [
		{
			rules: {
				'security/detect-eval-with-expression': 'error',
				'security-node/detect-buffer-noassert': 'error',
			},
		},
	],
}

export { securityConfig }
