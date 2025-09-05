import * as repoConfig from '@repo/config-eslint'
import simpleImportSort from 'eslint-plugin-simple-import-sort'

export default repoConfig.config(
	// Global ignores - must be first
	{
		ignores: [
			'dist/**',
			'cdk.out/**',
			'*.d.ts',
			'node_modules/**',
			'*.js',
			'examples/**',
			'vitest.config.ts',
		],
	},
	// Use shared base config
	...repoConfig.configs.base,
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
			// Infrastructure-specific rule relaxations
			'@typescript-eslint/no-unused-expressions': 'off',
			'@typescript-eslint/no-non-null-assertion': 'off',
			'@typescript-eslint/restrict-template-expressions': 'off',
			'@typescript-eslint/require-await': 'off',
			'@typescript-eslint/no-unused-vars': 'warn',
			'func-style': 'off',
			'turbo/no-undeclared-env-vars': 'off',
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
