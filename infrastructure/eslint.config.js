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
				project: './tsconfig.json',
				tsconfigRootDir: import.meta.dirname,
			},
		},
		rules: {
			// Infrastructure-specific rule relaxations for CDK
			'@typescript-eslint/no-unused-expressions': 'off',
			'@typescript-eslint/no-non-null-assertion': 'off',
			'@typescript-eslint/restrict-template-expressions': 'off',
			'@typescript-eslint/require-await': 'off',
			'@typescript-eslint/no-unused-vars': 'warn',
			'func-style': 'off',
			'turbo/no-undeclared-env-vars': 'off',
			// CDK constructs often use `new` without assignment
			'no-new': 'off',
			'@typescript-eslint/no-misused-promises': 'warn',
			// Allow inline comments in infrastructure code
			'no-inline-comments': 'off',
			// Relax JSDoc requirements for infrastructure code
			'jsdoc/require-jsdoc': 'off',
			'jsdoc/require-param': 'off',
			'jsdoc/require-param-description': 'off',
			'jsdoc/require-param-type': 'off',
			'jsdoc/require-returns': 'off',
			'jsdoc/require-returns-description': 'off',
			'jsdoc/require-returns-type': 'off',
			// Disable strict JSDoc param checking
			'jsdoc/check-param-names': 'off',
			// Relax import sorting for CDK files
			'perfectionist/sort-imports': 'off',
			'perfectionist/sort-objects': 'off',
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

	// CDK-specific constructs and stacks
	{
		files: ['src/constructs/**/*.{ts,tsx}', 'src/stacks/**/*.{ts,tsx}'],
		rules: {
			// Allow console.log in CDK constructs for debugging
			'no-console': 'off',
			// Disable no-secrets rule for CloudFormation output names (false positives)
			'no-secrets/no-secrets': 'off',
			// CDK often uses snake_case for AWS resource names
			'@typescript-eslint/naming-convention': [
				'error',
				{
					selector: 'variableLike',
					format: ['camelCase', 'PascalCase', 'snake_case', 'UPPER_CASE'],
					filter: {
						regex: '^(AWS_|CDK_).*',
						match: false,
					},
				},
			],
		},
	},

	// Scripts directory - more lenient rules
	{
		files: ['scripts/**/*.{ts,tsx}'],
		rules: {
			'no-console': 'off',
			'@typescript-eslint/no-unused-vars': 'off',
			'@typescript-eslint/require-await': 'off',
		},
	},
)
