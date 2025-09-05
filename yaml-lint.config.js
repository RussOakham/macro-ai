// YAML Lint Configuration
// This file configures yaml-lint for JavaScript-based YAML validation

module.exports = {
  // Files to lint
  files: [
    '**/*.yml',
    '**/*.yaml',
    '!**/node_modules/**',
    '!**/dist/**',
    '!**/coverage/**',
    '!**/build/**'
  ],

  // YAML parser options
  parser: {
    // Use 2-space indentation
    indent: 2,
    
    // Line length limit
    lineWidth: 120,
    
    // Quote style preference
    singleQuote: true,
    
    // Allow trailing commas in flow collections
    trailingComma: false,
    
    // Allow unquoted strings
    noRefs: false,
    
    // Allow duplicate keys (will be warned)
    noDuplicateKeys: false,
    
    // Allow anchors and aliases
    noAnchors: false,
    
    // Allow tags
    noTags: false
  },

  // Rules configuration
  rules: {
    // Require consistent indentation
    'indent': ['error', 2],
    
    // Enforce line length
    'max-len': ['warn', { code: 120, ignoreUrls: true }],
    
    // Require newline at end of file
    'eol-last': ['error', 'always'],
    
    // Disallow trailing whitespace
    'no-trailing-spaces': 'error',
    
    // Disallow multiple consecutive empty lines
    'no-multiple-empty-lines': ['error', { max: 2, maxEOF: 1 }],
    
    // Require consistent quote style
    'quotes': ['warn', 'single', { avoidEscape: true }],
    
    // Disallow duplicate keys
    'no-duplicate-keys': 'error',
    
    // Require consistent spacing around colons
    'key-spacing': ['error', { beforeColon: false, afterColon: true }],
    
    // Require consistent spacing around commas
    'comma-spacing': ['error', { before: false, after: true }],
    
    // Require consistent spacing around brackets
    'array-bracket-spacing': ['error', 'never'],
    
    // Require consistent spacing around braces
    'object-curly-spacing': ['error', 'never'],
    
    // Require consistent spacing around hyphens in arrays
    'array-bracket-newline': ['error', 'consistent'],
    
    // Require consistent spacing around colons in objects
    'object-colon-spacing': ['error', { before: false, after: true }]
  },

  // Override rules for specific file patterns
  overrides: [
    {
      files: ['docker-compose*.yml', 'docker-compose*.yaml'],
      rules: {
        // Docker Compose files can have longer lines
        'max-len': ['warn', { code: 200, ignoreUrls: true }],
        // Allow more flexible indentation for Docker Compose
        'indent': ['warn', 2]
      }
    },
    {
      files: ['*.workflow.yml', '*.workflow.yaml', '.github/workflows/*.yml', '.github/workflows/*.yaml'],
      rules: {
        // GitHub Actions workflows can have longer lines
        'max-len': ['warn', { code: 200, ignoreUrls: true }],
        // Allow more flexible indentation for workflows
        'indent': ['warn', 2]
      }
    },
    {
      files: ['amplify*.yml', 'amplify*.yaml'],
      rules: {
        // Amplify files can have longer lines
        'max-len': ['warn', { code: 200, ignoreUrls: true }],
        // Allow more flexible indentation for Amplify
        'indent': ['warn', 2]
      }
    }
  ]
};
