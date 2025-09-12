// @ts-check
import js from '@eslint/js'
import gitignore from 'eslint-config-flat-gitignore'
import globals from 'globals'
import tseslint from 'typescript-eslint'
import turboConfig from 'eslint-config-turbo/flat'
import sonarjsPlugin from 'eslint-plugin-sonarjs'
import perfectionistPlugin from 'eslint-plugin-perfectionist'
import securityPlugin from 'eslint-plugin-security'
import securityNodePlugin from 'eslint-plugin-security-node'
import testingLibraryPlugin from 'eslint-plugin-testing-library'
import noSecretsPlugin from 'eslint-plugin-no-secrets'
import eslintCommentsPlugin from 'eslint-plugin-eslint-comments'
import arrayFuncPlugin from 'eslint-plugin-array-func'
import vitestPlugin from 'eslint-plugin-vitest'

const base = {
	// Core ESLint + TypeScript + Turborepo configurations
	core: /** @type {import("typescript-eslint").ConfigWithExtends[]} */ [
		gitignore(),
		js.configs.recommended,
		...tseslint.configs.recommended,
		...turboConfig,
		{
			ignores: ['tsconfig.json'],
			rules: {
				// Note: Basic code style rules are now handled by oxlint
				// Only keeping rules that ESLint handles better or oxlint doesn't support
				'class-methods-use-this': 'warn', // Allow class methods without 'this' usage

				// Disable overly annoying rules
				'sort-keys': 'off',
				'one-var': 'off',
				'no-ternary': 'off',
			},
		},
	],

	// Strict TypeScript type checking
	strictTyping: /** @type {import("typescript-eslint").ConfigWithExtends[]} */ [
		...tseslint.configs.strictTypeChecked,
		...tseslint.configs.stylisticTypeChecked,
		{
			files: ['**/*.{ts,tsx}', '**/*.spec.{ts,tsx}', '**/*.test.{ts,tsx}'],
			rules: {
				// Disable conflicting rules (handled by TypeScript)
				'no-unused-vars': 'off',
				'no-undef': 'off',

				// Note: TypeScript unsafe rules are now handled by oxlint
				// Only keeping rules that require type-aware analysis or oxlint doesn't support
				'@typescript-eslint/no-unsafe-assignment': 'error',
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
				sonarjs: sonarjsPlugin,
				perfectionist: perfectionistPlugin,
				'array-func': arrayFuncPlugin,
				'eslint-comments': eslintCommentsPlugin,
			},
			rules: {
				// SonarJS - Code quality and maintainability
				'sonarjs/no-duplicate-string': 'off',

				// Note: Import sorting and array function rules are now handled by oxlint
				// perfectionist/sort-imports and array-func/* rules removed to avoid duplication

				// ESLint directives - Clean up ESLint disable/enable comments
				'eslint-comments/no-duplicate-disable': 'error',
				'eslint-comments/no-unlimited-disable': 'error',
				'eslint-comments/no-unused-disable': 'error',
				'eslint-comments/no-unused-enable': 'error',
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

	// Testing with Vitest
	testing: /** @type {import("typescript-eslint").ConfigWithExtends[]} */ [
		{
			plugins: {
				vitest: vitestPlugin,
				'testing-library': testingLibraryPlugin,
				globals: globals,
			},
			files: ['**/*.{test,spec}.{js,ts,jsx,tsx}'],
			languageOptions: {
				globals: {
					...globals.node,
				},
			},
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
				'sort-keys': 'off',
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
