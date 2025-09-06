// @ts-check

const nodeConfig = {
	recommended: /** @type {import("typescript-eslint").ConfigWithExtends[]} */ [
		{
			rules: {
				'n/no-missing-import': 'error',
				'n/no-unsupported-features/es-syntax': 'off',
				'n/no-process-exit': 'warn',
			},
		},
	],
}

export { nodeConfig }
