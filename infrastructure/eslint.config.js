import * as repoConfig from '@repo/config-eslint'
import globals from 'globals'

export default repoConfig.config(
	// Global ignores - must be first
	{
		ignores: [
			'dist/**',
			'cdk.out/**',
			'node_modules/**',
			'coverage/**',
			'*.d.ts',
			'*.js',
			'vitest.config.ts',
			'tsconfig.json',
		],
	},
	// Core configurations - foundation for all code
	...repoConfig.configs.base.core,
	...repoConfig.configs.base.codeQuality,
	...repoConfig.configs.base.javascript,

	// Testing configurations (Vitest)
	...repoConfig.configs.base.testing,

	// Security scanning
	...repoConfig.configs.base.security,

	// Project-specific overrides
	{
		files: ['**/*.{ts,tsx}'],
		languageOptions: {
			globals: globals.node,
			parserOptions: {
				project: './tsconfig.json',
				tsconfigRootDir: import.meta.dirname,
			},
		},
		rules: {
			'@typescript-eslint/no-misused-promises': 'warn',
			'@typescript-eslint/no-non-null-assertion': 'off',
			// Infrastructure-specific rule relaxations for CDK
			'@typescript-eslint/no-unused-expressions': 'off',
			'@typescript-eslint/no-unused-vars': 'warn',
			'@typescript-eslint/require-await': 'off',
			'@typescript-eslint/restrict-template-expressions': 'off',
			'func-style': 'off',
			// Allow inline comments in infrastructure code
			'no-inline-comments': 'off',
			// CDK constructs often use `new` without assignment
			'no-new': 'off',
			// Relax import sorting for CDK files
			'perfectionist/sort-imports': 'off',
			'perfectionist/sort-objects': 'off',
			'turbo/no-undeclared-env-vars': 'off',
		},
		settings: {
			'import-x/resolver': {
				typescript: {
					alwaysTryTypes: true,
					project: './tsconfig.json',
				},
			},
		},
	},

	// CDK-specific constructs and stacks
	{
		files: ['src/constructs/**/*.{ts,tsx}', 'src/stacks/**/*.{ts,tsx}'],
		rules: {
			// CDK often uses snake_case for AWS resource names
			'@typescript-eslint/naming-convention': [
				'error',
				{
					filter: {
						match: false,
						regex: '^(AWS_|CDK_).*',
					},
					format: ['camelCase', 'PascalCase', 'snake_case', 'UPPER_CASE'],
					selector: 'variableLike',
				},
			],
			// Allow console.log in CDK constructs for debugging
			'no-console': 'off',
		},
	},

	// Scripts directory - more lenient rules
	{
		files: ['scripts/**/*.{ts,tsx}'],
		rules: {
			'@typescript-eslint/no-unused-vars': 'off',
			'@typescript-eslint/require-await': 'off',
			'no-console': 'off',
		},
	},
)
