import * as repoConfig from '@repo/config-eslint'
import turboConfig from 'eslint-config-turbo/flat'
import simpleImportSort from 'eslint-plugin-simple-import-sort'

export default repoConfig.config(
	// Global ignores - must be first
	{
		ignores: ['dist/**', 'cdk.out/**', '*.d.ts', 'node_modules/**'],
	},
	// Use shared base config
	...repoConfig.configs.base,
	// Turbo config
	...turboConfig,
	// Infrastructure-specific overrides
	{
		files: ['**/*.ts', '**/*.tsx'],
		plugins: {
			'simple-import-sort': simpleImportSort,
		},
		languageOptions: {
			parserOptions: {
				project: './tsconfig.json',
				tsconfigRootDir: import.meta.dirname,
			},
		},
		rules: {
			// Disable turbo env var rule for infrastructure package
			'turbo/no-undeclared-env-vars': 'off',
			// Allow unused expressions for CDK stack instantiation
			'@typescript-eslint/no-unused-expressions': 'off',
			// Import sorting
			'simple-import-sort/imports': [
				'error',
				{
					groups: [
						// Packages `react` related packages come first.
						['^react', '^@?\\w'],
						// Internal packages.
						['^(@|components)(/.*|$)'],
						// Side effect imports.
						['^\\u0000'],
						// Parent imports. Put `..` last.
						['^\\.\\.(?!/?$)', '^\\.\\./?$'],
						// Other relative imports. Put same-folder imports and `.` last.
						['^\\./(?=.*/)(?!/?$)', '^\\.(?!/?$)', '^\\./?$'],
						// Style imports.
						['^.+\\.?(css)$'],
					],
				},
			],
			'simple-import-sort/exports': 'error',
		},
	},
)
