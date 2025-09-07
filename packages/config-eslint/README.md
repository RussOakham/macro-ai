# `@repo/config-eslint`

Shared ESLint configuration for the Macro AI monorepo, providing consistent code quality and style enforcement
across all packages and applications.

## Features

- **Modular Configuration**: Choose exactly what you need with focused config groups
- **Full TypeScript Support**: Complete type inference with IntelliSense and autocompletion
- **Type-Safe Configuration**: JSDoc + TypeScript declaration files for comprehensive type safety
- **ESM-First Design**: Modern JavaScript modules with ESLint Flat Config
- **Comprehensive Coverage**: Testing, documentation, security, and performance rules
- **React Integration**: Specialized rules for React applications with React Compiler
- **Node.js Support**: Backend-specific linting for Express.js applications
- **Testing Support**: Vitest + React Testing Library rules
- **Security Enhanced**: Advanced security scanning and secret detection
- **No Build Step**: Direct JavaScript files with instant configuration updates

## Usage

### Modular Approach

Choose the specific config groups you need for your application:

```javascript
// eslint.config.js
// @ts-check
import { base } from '@repo/config-eslint'
import { reactConfig } from '@repo/config-eslint'

export default [
	...base.core,
	...base.strictTyping,
	...base.codeQuality,
	...base.testing,
	...base.documentation,
	...reactConfig.recommended,
]
```

### TypeScript Support & Type Inference

This package provides complete TypeScript type inference for enhanced developer experience:

```typescript
// eslint.config.js (with .d.ts support)
import { configs } from '@repo/config-eslint'

// Full type inference - IntelliSense shows available properties
export default [
	...configs.base.core, // Type: ConfigWithExtends[]
	...configs.base.strictTyping, // Type: ConfigWithExtends[]
	...configs.react.core, // Type: ConfigWithExtends[]
	...configs.node.security, // Type: ConfigWithExtends[]
]
```

**Type-Safe Usage Examples:**

```typescript
import { configs, config } from '@repo/config-eslint'

// TypeScript knows the exact structure of each config group
const baseConfigs = configs.base.core // BaseConfig['core']
const reactConfigs = configs.react.typescript // ReactConfig['typescript']
const nodeConfigs = configs.node.core // NodeConfig['core']

// The config utility function is also fully typed
const combined = config(baseConfigs, reactConfigs) // ConfigWithExtends[]
```

### Quick Start

For a complete setup, use the recommended configurations:

```javascript
// Full-featured setup
export default [
	...base.core,
	...base.strictTyping,
	...base.codeQuality,
	...base.promises,
	...base.node,
	...base.security,
	...base.imports,
	...base.testing,
	...base.documentation,
	...base.customRules,
	...base.javascript,
]

// Or use the legacy approach (maintains backward compatibility)
import { base } from '@repo/config-eslint'
export default [...base.recommended]
```

## Configuration Groups

### Core Groups

- **`base.core`** - Essential ESLint + TypeScript + Turborepo foundations
- **`base.strictTyping`** - TypeScript strict checking with practical relaxations
- **`base.codeQuality`** - Modern JS best practices (Unicorn, SonarJS, Perfectionist)
- **`base.promises`** - Promise handling and async code patterns
- **`base.node`** - Node.js specific rules and optimizations
- **`base.security`** - Security-focused rules with secret detection
- **`base.imports`** - Import/export organization and validation
- **`base.javascript`** - JavaScript-specific overrides for .js/.jsx files

### Advanced Groups

- **`base.testing`** - Vitest + React Testing Library rules
- **`base.documentation`** - JSDoc validation and comment standards
- **`base.customRules`** - Project-specific preferences (named exports, etc.)

### React Configuration

- **`reactConfig.recommended`** - Complete React setup with JSX prop spreading

## Plugins Included

### Core ESLint

- `eslint` - Core linting rules
- `@eslint/js` - Recommended ESLint configurations
- `typescript-eslint` - TypeScript-specific rules

### Code Quality & Best Practices

- `eslint-plugin-unicorn` - Modern JavaScript patterns
- `eslint-plugin-sonarjs` - Code quality and maintainability
- `eslint-plugin-perfectionist` - Code organization and sorting
- `eslint-plugin-array-func` - Modern array method preferences
- `eslint-plugin-eslint-comments` - ESLint directive management

### Testing

- `eslint-plugin-vitest` - Vitest testing framework rules
- `eslint-plugin-testing-library` - React Testing Library rules

### Documentation & Comments

- `eslint-plugin-jsdoc` - JSDoc validation and standards

### Security

- `eslint-plugin-security` - Security vulnerability detection
- `eslint-plugin-security-node` - Node.js security rules
- `eslint-plugin-no-secrets` - Secret detection in code

### Import Management

- `eslint-plugin-import-x` - Modern import/export validation

### React Ecosystem

- `eslint-plugin-react` - React-specific rules
- `eslint-plugin-react-hooks` - React Hooks validation
- `eslint-plugin-react-refresh` - Fast refresh support
- `eslint-plugin-react-compiler` - React Compiler optimization

### Node.js

- `eslint-plugin-n` - Node.js-specific rules

### Formatting

- `eslint-config-prettier` - Prettier conflict resolution
- `eslint-plugin-prettier` - Prettier integration

### Monorepo

- `eslint-config-turbo/flat` - Turborepo-specific optimizations

## 📚 Documentation

For detailed information about coding standards and linting rules:

- **[Coding Standards](../../docs/development/coding-standards.md)** - Complete code style guidelines
- **[Development Guidelines](../../docs/development/README.md)** - Development best practices
- **[Monorepo Management](../../docs/development/monorepo-management.md)** - Workspace configuration

## Related Packages

- `@repo/config-typescript` - Shared TypeScript configurations
- `@repo/ui-library` - Shared UI components and utilities
