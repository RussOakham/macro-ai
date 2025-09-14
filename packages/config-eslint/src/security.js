// @ts-check
import securityPlugin from 'eslint-plugin-security'
import securityNodePlugin from 'eslint-plugin-security-node'

const securityConfig = {
	recommended: /** @type {import("typescript-eslint").ConfigWithExtends[]} */ [
		{
			plugins: {
				security: securityPlugin,
				'security-node': securityNodePlugin,
			},
			rules: {
				'security/detect-eval-with-expression': 'error',
				'security-node/detect-buffer-noassert': 'error',
			},
		},
	],
}

export { securityConfig }
