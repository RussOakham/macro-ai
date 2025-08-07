import js from '@eslint/js'
import ts from 'typescript-eslint'
import prettier from 'eslint-config-prettier'
import turboConfig from 'eslint-config-turbo/flat'
import simpleImportSort from 'eslint-plugin-simple-import-sort'

export default ts.config(
	// Base JavaScript rules
	js.configs.recommended,
	// TypeScript rules without strict type checking
	...ts.configs.recommended,
	...ts.configs.stylistic,
	// Turbo config
	...turboConfig,
	{
		files: ['**/*.ts', '**/*.tsx'],
		plugins: { 'simple-import-sort': simpleImportSort },
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
	// Prettier must be last
	prettier,
	{
		ignores: ['dist/**', 'cdk.out/**', '*.d.ts', 'node_modules/**'],
	},
)
