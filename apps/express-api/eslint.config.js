import * as repoConfig from '@repo/config-eslint'
import drizzlePlugin from 'eslint-plugin-drizzle'
import globals from 'globals'

export default repoConfig.config(
	// Global ignores - must be first
	{
		ignores: [
			'dist/**',
			'node_modules/**',
			'coverage/**',
			'coverage-final.json',
			'coverage-summary.json',
			'*.lcov',
			'scripts/**/*',
			'../../scripts/**/*',
			'src/test-helpers/**',
		],
	},
	// Core configurations - foundation for all code
	...repoConfig.configs.base.core,
	...repoConfig.configs.base.codeQuality,
	...repoConfig.configs.base.promises,
	...repoConfig.configs.base.imports,
	...repoConfig.configs.base.javascript,

	// Node.js specific configurations
	...repoConfig.configs.base.node,

	// Testing configurations (Vitest)
	...repoConfig.configs.base.testing,

	// Documentation and code organization
	...repoConfig.configs.base.documentation,
	...repoConfig.configs.base.customRules,

	// Security scanning
	...repoConfig.configs.base.security,

	// Project-specific overrides
	{
		files: ['**/*.{ts,tsx}'],
		languageOptions: {
			globals: globals.node,
			parserOptions: {
				ecmaVersion: 2022,
				project: './tsconfig.json',
			},
		},
		plugins: {
			drizzle: drizzlePlugin,
		},
		rules: {
			// Disable turbo env var rule for Express API
			'turbo/no-undeclared-env-vars': 'warn',
			'@typescript-eslint/no-misused-promises': 'warn',
			'jsdoc/require-jsdoc': ['error', { publicOnly: true }],
			'jsdoc/require-param': 'error',
			'jsdoc/require-param-description': 'off',
			'jsdoc/require-param-type': 'off',
			'jsdoc/check-param-names': 'off',
			'jsdoc/require-returns': 'error',
			'jsdoc/require-returns-description': 'error',
			'jsdoc/require-returns-type': 'off',
		},
	},

	// JavaScript files (like config files) - no TypeScript parser
	{
		files: ['**/*.{js,jsx}'],
		languageOptions: {
			globals: globals.node,
		},
		rules: {
			// Relax JSDoc requirements for config files
			'jsdoc/require-jsdoc': 'off',
			'jsdoc/require-param-description': 'off',
			'jsdoc/require-param-type': 'off',
			'jsdoc/require-returns': 'off',
		},
	},
)
