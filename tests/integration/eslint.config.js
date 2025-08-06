import { config, configs } from '@repo/config-eslint'

export default config(...configs.base, {
	languageOptions: {
		parserOptions: {
			project: './tsconfig.json',
			tsconfigRootDir: import.meta.dirname,
		},
	},
	rules: {
		// Disable some rules that are not relevant for integration tests
		'@typescript-eslint/no-explicit-any': 'off',
		'@typescript-eslint/no-unsafe-assignment': 'off',
		'@typescript-eslint/no-unsafe-member-access': 'off',
		'@typescript-eslint/no-unsafe-call': 'off',
		'@typescript-eslint/no-unsafe-return': 'off',
		'@typescript-eslint/no-unsafe-argument': 'off',
		// Allow console.log in tests for debugging
		'no-console': 'off',
		// Allow floating promises in tests
		'@typescript-eslint/no-floating-promises': 'off',
		// Allow unbound methods in tests
		'@typescript-eslint/unbound-method': 'off',
	},
})
