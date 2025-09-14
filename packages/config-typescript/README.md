# `@repo/config-typescript`

Shared TypeScript configurations for the Macro AI monorepo, providing consistent TypeScript settings
across all packages and applications with environment-specific optimizations.

## Features

- **Consistent TypeScript Settings**: Unified compiler options across the monorepo
- **Environment-Specific Configs**: Optimized configurations for different environments
- **Strict Type Checking**: Comprehensive type safety with strict mode enabled
- **Path Mapping**: Consistent module resolution and path mapping
- **Build Optimization**: Optimized build settings for development and production
- **IDE Integration**: Enhanced IDE support with proper type checking
- **Industry Standard**: Built on top of [@total-typescript/tsconfig](https://github.com/total-typescript/tsconfig)

## Available Configurations

### Base Configuration (`tsconfig-base.json`)

Core TypeScript configuration with strict type checking and modern JavaScript features.
Extends `@total-typescript/tsconfig/bundler/no-dom/library-monorepo`.

```json
{
	"extends": "@repo/config-typescript/tsconfig-base.json"
}
```

**Features:**

- Strict mode enabled for maximum type safety
- Modern ES2022 target with Node.js 20+ support
- Comprehensive type checking options
- Optimized module resolution
- DOM types included for compatibility

### React Configuration (`tsconfig-react.json`)

Specialized configuration for React applications with JSX support.
Extends `@total-typescript/tsconfig/bundler/dom/app`.

```json
{
	"extends": "@repo/config-typescript/tsconfig-react.json"
}
```

**Features:**

- JSX support with React 19+ optimizations
- DOM type definitions included
- React-specific compiler options
- Vite integration support
- TypeScript strict mode enabled

### Express Configuration (`tsconfig-express.json`)

Backend-specific configuration for Express.js applications.
Extends `@total-typescript/tsconfig/tsc/no-dom/app`.

```json
{
	"extends": "@repo/config-typescript/tsconfig-express.json"
}
```

**Features:**

- Node.js type definitions
- CommonJS and ESM module support
- Server-side optimizations
- Express.js compatibility
- TypeScript strict mode enabled

### Vite Node Configuration (`tsconfig-vite-node.json`)

Configuration for Vite-based tooling and testing environments.
Extends `@total-typescript/tsconfig/bundler/no-dom/app`.

```json
{
	"extends": "@repo/config-typescript/tsconfig-vite-node.json"
}
```

**Features:**

- Vite-specific module resolution
- Testing environment support
- Development tooling optimizations
- TypeScript strict mode enabled

## Usage

### In Applications

```json
// apps/client-ui/tsconfig.json
{
	"extends": "@repo/config-typescript/tsconfig-react.json",
	"compilerOptions": {
		"baseUrl": ".",
		"paths": {
			"@/*": ["./src/*"]
		}
	},
	"include": ["src/**/*"],
	"exclude": ["node_modules", "dist"]
}
```

```json
// apps/express-api/tsconfig.json
{
	"extends": "@repo/config-typescript/tsconfig-express.json",
	"compilerOptions": {
		"baseUrl": ".",
		"outDir": "./dist"
	},
	"include": ["src/**/*", "config/**/*"],
	"exclude": ["node_modules", "dist", "**/*.test.ts"]
}
```

### In Packages

```json
// packages/ui-library/tsconfig.json
{
	"extends": "@repo/config-typescript/tsconfig-react.json",
	"compilerOptions": {
		"declaration": true,
		"declarationMap": true,
		"outDir": "./dist"
	}
}
```

## Configuration Details

### Base Framework

All configurations are built on top of [@total-typescript/tsconfig](https://github.com/total-typescript/tsconfig),
which provides industry-standard TypeScript configurations optimized for different use cases:

- **Bundler configurations**: For apps using Vite, Webpack, or other bundlers
- **TSC configurations**: For apps using TypeScript compiler directly
- **DOM vs No-DOM**: Separate configs for browser and server environments
- **App vs Library**: Different optimization strategies for applications vs libraries

### Compatibility Overrides

To maintain compatibility with existing codebase patterns, the following overrides are applied:

```json
{
	"allowImportingTsExtensions": true,
	"verbatimModuleSyntax": false,
	"noEmit": false
}
```

These settings allow:

- Direct `.ts` file imports in test files
- Mixed import/export syntax patterns
- Declaration file generation for project references

### Strict Type Checking

All configurations enable strict type checking with additional safety features:

- Strict mode enabled for maximum type safety
- `noUncheckedIndexedAccess` for safer array/object access
- `noImplicitOverride` for method override safety
- `exactOptionalPropertyTypes` for precise optional handling

### Module Resolution

Optimized module resolution for monorepo structure with modern bundler support:

- Bundler-aware module resolution
- JSON module resolution enabled
- Isolated modules for better incremental compilation
- Consistent file name casing enforcement

## 📚 Documentation

For detailed information about TypeScript usage and configuration:

- **[Coding Standards](../../docs/development/coding-standards.md)** - TypeScript coding guidelines
- **[Development Guidelines](../../docs/development/README.md)** - Development best practices
- **[Monorepo Management](../../docs/development/monorepo-management.md)** - Workspace TypeScript setup
- **[Development Setup](../../docs/getting-started/development-setup.md)** - IDE and TypeScript configuration

## Related Packages

- `@repo/config-eslint` - Shared ESLint configurations
- `@repo/ui-library` - Shared UI components with TypeScript
- `@repo/macro-ai-api-client` - Type-safe API client

## Support

- **Issues**: [GitHub Issues](https://github.com/RussOakham/macro-ai/issues)
- **Documentation**: [Complete Documentation](../../docs/README.md)
- **Development Guide**: [Development Setup](../../docs/getting-started/development-setup.md)
