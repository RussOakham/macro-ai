// @ts-check
import nPlugin from 'eslint-plugin-n'

const nodeConfig = {
	recommended: /** @type {import("typescript-eslint").ConfigWithExtends[]} */ [
		{
			plugins: {
				n: nPlugin,
			},
			rules: {
				'n/no-missing-import': 'error',
				'n/no-unsupported-features/es-syntax': 'off',
				'n/no-process-exit': 'warn',
			},
		},
	],
}

export { nodeConfig }
