# `@repo/config-eslint`

Shared ESLint configuration for the Macro AI monorepo, providing consistent code quality and style enforcement
across all packages and applications.

## Features

- **Consistent Code Style**: Unified linting rules across the entire monorepo
- **TypeScript Support**: Optimized rules for TypeScript projects
- **React Integration**: Specialized rules for React applications
- **Node.js Support**: Backend-specific linting for Express.js applications
- **Import Organization**: Automatic import sorting and organization
- **Security Rules**: Built-in security-focused linting rules

## Usage

This package is automatically used by all applications and packages in the monorepo through their
`eslint.config.js` files.

### In Applications

```javascript
// apps/client-ui/eslint.config.js
import baseConfig from '@repo/config-eslint'

export default [...baseConfig]
```

### In Packages

```javascript
// packages/*/eslint.config.js
import baseConfig from '@repo/config-eslint'

export default [...baseConfig]
```

## Configuration

The ESLint configuration includes:

- **Base Rules**: Core ESLint recommended rules
- **TypeScript Rules**: `@typescript-eslint` plugin with strict rules
- **React Rules**: React-specific linting for frontend applications
- **Import Rules**: Import/export organization and validation
- **Security Rules**: Security-focused linting patterns

## 📚 Documentation

For detailed information about coding standards and linting rules:

- **[Coding Standards](../../docs/development/coding-standards.md)** - Complete code style guidelines
- **[Development Guidelines](../../docs/development/README.md)** - Development best practices
- **[Monorepo Management](../../docs/development/monorepo-management.md)** - Workspace configuration

## Related Packages

- `@repo/config-typescript` - Shared TypeScript configurations
- `@repo/ui-library` - Shared UI components and utilities
