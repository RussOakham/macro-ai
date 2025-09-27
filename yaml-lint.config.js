/* eslint-disable no-magic-numbers */
// YAML Lint Configuration
// This file configures yaml-lint for JavaScript-based YAML validation

export default {
	// Files to lint - Focus on project files only
	files: [
		'**/*.yml',
		'**/*.yaml',
		// Exclude dependency files that are outside our control
		'!**/node_modules/**',
		'!**/node_modules/**/*',
		'!**/.pnpm/**',
		'!**/.pnpm/**/*',
		// Exclude build outputs and generated files
		'!**/dist/**',
		'!**/coverage/**',
		'!**/build/**',
		'!**/*.d.ts',
		'!**/coverage-reports/**',
		'!**/test-results/**',
		// Exclude specific generated files
		'!**/routeTree.gen.ts',
		'!**/main.tsx',
		'!**/*.gen.ts',
		'!**/*.gen.js',
	],

	// YAML parser options - Focus on syntax correctness
	parser: {
		// Use 2-space indentation
		indent: 2,

		// Disable strict line width checking (we'll handle this per file type)
		lineWidth: -1,

		// Allow flexible quote styles
		singleQuote: false,

		// Allow trailing commas in flow collections
		trailingComma: true,

		// Allow unquoted strings where safe
		noRefs: false,

		// Disallow duplicate keys (will be caught by rules)
		noDuplicateKeys: true,

		// Allow anchors and aliases
		noAnchors: false,

		// Allow tags
		noTags: false,
	},

	// Rules configuration - Focus on syntax issues that could break GitHub Actions
	rules: {
		// Critical: YAML syntax errors that will break parsing
		indent: ['error', 2],

		// Critical: Prevents unpredictable behavior in GitHub Actions
		'no-duplicate-keys': 'error',

		// Critical: Required for valid YAML
		'eol-last': ['error', 'always'],

		// Important: Can cause GitHub Actions failures
		'no-trailing-spaces': 'warn',

		// Style only: Doesn't break functionality, just formatting
		'max-len': 'off',
		'no-multiple-empty-lines': 'off',
		quotes: 'off',
		'key-spacing': 'off',
		'comma-spacing': 'off',
		'array-bracket-spacing': 'off',
		'object-curly-spacing': 'off',
		'array-bracket-newline': 'off',
		'object-colon-spacing': 'off',
	},

	// Override rules for specific file patterns - simplified
	overrides: [
		{
			files: ['docker-compose*.yml', 'docker-compose*.yaml'],
			rules: {
				// Allow more flexible indentation for Docker Compose
				indent: ['warn', 2],
			},
		},
		{
			files: [
				'*.workflow.yml',
				'*.workflow.yaml',
				'.github/workflows/*.yml',
				'.github/workflows/*.yaml',
			],
			rules: {
				// Allow more flexible indentation for workflows
				indent: ['warn', 2],
			},
		},
		{
			files: ['amplify*.yml', 'amplify*.yaml'],
			rules: {
				// Allow more flexible indentation for Amplify
				indent: ['warn', 2],
			},
		},
	],
}
