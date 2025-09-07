// @ts-check
import js from '@eslint/js'
import gitignore from 'eslint-config-flat-gitignore'
import tseslint from 'typescript-eslint'
import turboConfig from 'eslint-config-turbo/flat'
import unicornPlugin from 'eslint-plugin-unicorn'
import sonarjsPlugin from 'eslint-plugin-sonarjs'
import perfectionistPlugin from 'eslint-plugin-perfectionist'
import promisePlugin from 'eslint-plugin-promise'
import nPlugin from 'eslint-plugin-n'
import securityPlugin from 'eslint-plugin-security'
import securityNodePlugin from 'eslint-plugin-security-node'
import importXPlugin from 'eslint-plugin-import-x'
import vitestPlugin from 'eslint-plugin-vitest'
import testingLibraryPlugin from 'eslint-plugin-testing-library'
import jsdocPlugin from 'eslint-plugin-jsdoc'
import noSecretsPlugin from 'eslint-plugin-no-secrets'
import eslintCommentsPlugin from 'eslint-plugin-eslint-comments'
import arrayFuncPlugin from 'eslint-plugin-array-func'

const base = {
	// Core ESLint + TypeScript + Turborepo configurations
	core: /** @type {import("typescript-eslint").ConfigWithExtends[]} */ [
		gitignore(),
		js.configs.recommended,
		...tseslint.configs.recommended,
		...turboConfig,
		{
			rules: {
				// General code style relaxations
				'no-underscore-dangle': 'warn', // Allow _private members and config objects
				'class-methods-use-this': 'warn', // Allow class methods without 'this' usage
				'no-ternary': 'off', // Allow ternary operators
				'@typescript-eslint/no-unsafe-assignment': 'warn', // Allow unsafe assignment
				'@typescript-eslint/no-unsafe-call': 'warn', // Allow unsafe call
				'@typescript-eslint/no-unsafe-member-access': 'warn', // Allow unsafe member access

				// Variable declaration rules
				'one-var': 'off', // Allow multiple variable declarations - DISABLED

				// Object key sorting
				'sort-keys': 'off', // Warn when object keys are not alphabetically sorted
			},
		},
	],

	// Strict TypeScript type checking
	strictTyping: /** @type {import("typescript-eslint").ConfigWithExtends[]} */ [
		...tseslint.configs.strictTypeChecked,
		...tseslint.configs.stylisticTypeChecked,
		{
			files: ['**/*.{ts,tsx}'],
			rules: {
				// Disable conflicting rules (handled by TypeScript)
				'no-unused-vars': 'off',
				'no-undef': 'off',

				// Relax overly strict TypeScript rules
				'@typescript-eslint/no-unsafe-assignment': 'warn',
				'@typescript-eslint/no-unsafe-call': 'warn',
				'@typescript-eslint/no-unsafe-member-access': 'warn',
				'@typescript-eslint/restrict-template-expressions': 'warn',
				'@typescript-eslint/unbound-method': 'warn',

				// Configure promise handling for async functions
				'@typescript-eslint/no-misused-promises': [
					'error',
					{
						checksVoidReturn: false,
					},
				],
			},
		},
	],

	// Code quality and best practices
	codeQuality: /** @type {import("typescript-eslint").ConfigWithExtends[]} */ [
		{
			plugins: {
				unicorn: unicornPlugin,
				sonarjs: sonarjsPlugin,
				perfectionist: perfectionistPlugin,
				'array-func': arrayFuncPlugin,
				'eslint-comments': eslintCommentsPlugin,
			},
			rules: {
				// Unicorn - Modern JavaScript best practices
				'unicorn/filename-case': [
					'error',
					{ case: 'kebabCase', ignore: ['^\\$'] },
				],
				'unicorn/prefer-node-protocol': 'error',

				// SonarJS - Code quality and maintainability
				'sonarjs/no-duplicate-string': 'off',

				// Perfectionist - Code organization
				'perfectionist/sort-imports': ['error', { type: 'natural' }],

				// Array methods - Modern array method preferences
				'array-func/from-map': 'error',
				'array-func/no-unnecessary-this-arg': 'error',
				'array-func/prefer-array-from': 'error',
				'array-func/avoid-reverse': 'error',
				'array-func/prefer-flat': 'error',
				'array-func/prefer-flat-map': 'error',

				// ESLint directives - Clean up ESLint disable/enable comments
				'eslint-comments/no-duplicate-disable': 'error',
				'eslint-comments/no-unlimited-disable': 'error',
				'eslint-comments/no-unused-disable': 'error',
				'eslint-comments/no-unused-enable': 'error',
			},
		},
	],

	// Promise handling and async code
	promises: /** @type {import("typescript-eslint").ConfigWithExtends[]} */ [
		{
			plugins: {
				promise: promisePlugin,
			},
			rules: {
				'promise/always-return': 'error',
				'promise/no-nesting': 'warn',
			},
		},
	],

	// Node.js specific rules
	node: /** @type {import("typescript-eslint").ConfigWithExtends[]} */ [
		{
			plugins: {
				n: nPlugin,
			},
			rules: {
				'n/no-deprecated-api': 'error',
			},
		},
	],

	// Security-focused rules
	security: /** @type {import("typescript-eslint").ConfigWithExtends[]} */ [
		{
			plugins: {
				security: securityPlugin,
				'security-node': securityNodePlugin,
				'no-secrets': noSecretsPlugin,
			},
			rules: {
				'security/detect-object-injection': 'off',
				'security-node/detect-insecure-randomness': 'error',
				'no-secrets/no-secrets': 'error',
			},
		},
	],

	// Import/export management
	imports: /** @type {import("typescript-eslint").ConfigWithExtends[]} */ [
		{
			plugins: {
				'import-x': importXPlugin,
			},
			rules: {
				// Core import validation
				'import-x/no-unresolved': 'error',
				'import-x/no-cycle': 'warn',

				// Import quality and consistency
				'import-x/no-unused-modules': 'warn',
				'import-x/no-self-import': 'error',
				'import-x/no-absolute-path': 'error',
				'import-x/no-useless-path-segments': 'error',
				'import-x/no-deprecated': 'warn',

				// Export consistency
				'import-x/no-mutable-exports': 'warn',
			},
		},
	],

	// Testing with Vitest
	testing: /** @type {import("typescript-eslint").ConfigWithExtends[]} */ [
		{
			plugins: {
				vitest: vitestPlugin,
				'testing-library': testingLibraryPlugin,
			},
			files: ['**/*.{test,spec}.{js,ts,jsx,tsx}'],
			rules: {
				// Vitest rules
				'vitest/expect-expect': 'error',
				'vitest/no-disabled-tests': 'warn',
				'vitest/no-focused-tests': 'error',
				'vitest/no-identical-title': 'error',
				'vitest/prefer-to-be': 'error',
				'vitest/prefer-to-have-length': 'error',
				'vitest/valid-expect': 'error',

				// Testing Library rules
				'testing-library/no-container': 'error',
				'testing-library/no-node-access': 'error',
				'testing-library/prefer-screen-queries': 'error',
				'testing-library/render-result-naming-convention': 'error',
			},
		},
	],

	// Documentation and JSDoc
	documentation:
		/** @type {import("typescript-eslint").ConfigWithExtends[]} */ [
			{
				plugins: {
					jsdoc: jsdocPlugin,
				},
				rules: {
					'jsdoc/check-alignment': 'error',
					'jsdoc/check-indentation': 'error',
					'jsdoc/check-param-names': 'error',
					'jsdoc/check-tag-names': 'error',
					'jsdoc/check-types': 'error',
					'jsdoc/empty-tags': 'error',
					'jsdoc/no-undefined-types': 'error',
					'jsdoc/require-description': 'error',
					'jsdoc/require-param': 'error',
					'jsdoc/require-param-description': 'error',
					'jsdoc/require-param-name': 'error',
					'jsdoc/require-param-type': 'error',
					'jsdoc/require-returns': 'error',
					'jsdoc/require-returns-description': 'error',
					'jsdoc/require-returns-type': 'error',
					'jsdoc/valid-types': 'error',
				},
			},
		],

	// Custom rules for project preferences
	customRules: /** @type {import("typescript-eslint").ConfigWithExtends[]} */ [
		{
			rules: {
				// Prefer named exports over default exports
				'import-x/no-default-export': 'error',
				// Allow export * from in barrel files
				'import-x/export': 'off', // This allows export * syntax
			},
		},
		{
			// Allow default exports in specific files (like config files, entry points)
			files: [
				'**/eslint.config.{js,ts}',
				'**/vite.config.{js,ts}',
				'**/vitest.config.{js,ts}',
				'**/tailwind.config.{js,ts}',
				'**/postcss.config.{js,ts}',
				'**/next.config.{js,ts}',
				'**/webpack.config.{js,ts}',
				'**/rollup.config.{js,ts}',
				'**/index.{js,ts}', // Entry points
				'**/main.{js,ts}', // Entry points
				'**/app.{js,ts}', // Entry points
			],
			rules: {
				'import-x/no-default-export': 'off',
				'no-ternary': 'off', // Allow ternary operators

				// Variable declaration rules
				'one-var': 'off', // Allow multiple variable declarations - DISABLED

				// Object key sorting
				'sort-keys': 'off', // Warn when object keys are not alphabetically sorted
			},
		},
	],

	// JavaScript-specific overrides (disable TypeScript for .js files)
	javascript: /** @type {import("typescript-eslint").ConfigWithExtends[]} */ [
		{
			files: ['**/*.{js,jsx}', '**/*.config.{js,ts}', 'eslint.config.{js,ts}'],
			...tseslint.configs.disableTypeChecked,
			rules: {
				...js.configs.recommended.rules,
				...js.configs.all.rules,
				// Disable TypeScript-specific rules that require type information
				'@typescript-eslint/await-thenable': 'off',
				'@typescript-eslint/no-floating-promises': 'off',
				'@typescript-eslint/no-misused-promises': 'off',
				'sort-imports': 'off',
			},
		},
		// Explicit override for ESLint config files to prevent TypeScript parsing
		{
			files: ['eslint.config.{js,ts}'],
			...tseslint.configs.disableTypeChecked,
			languageOptions: {
				parserOptions: {
					ecmaVersion: 'latest',
					sourceType: 'module',
				},
			},
		},
	],
}

export { base }
