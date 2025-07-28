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

## Available Configurations

### Base Configuration (`tsconfig-base.json`)

Core TypeScript configuration with strict type checking and modern JavaScript features.

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

### React Configuration (`tsconfig-react.json`)

Specialized configuration for React applications with JSX support.

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

### Express Configuration (`tsconfig-express.json`)

Backend-specific configuration for Express.js applications.

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

### Vite Node Configuration (`tsconfig-vite-node.json`)

Configuration for Vite-based tooling and testing environments.

```json
{
	"extends": "@repo/config-typescript/tsconfig-vite-node.json"
}
```

**Features:**

- Vite-specific module resolution
- Testing environment support
- Development tooling optimizations

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

### Strict Type Checking

All configurations enable strict type checking:

```json
{
	"strict": true,
	"noImplicitAny": true,
	"strictNullChecks": true,
	"strictFunctionTypes": true,
	"noImplicitReturns": true,
	"noFallthroughCasesInSwitch": true
}
```

### Module Resolution

Optimized module resolution for monorepo structure:

```json
{
	"moduleResolution": "bundler",
	"allowImportingTsExtensions": true,
	"resolveJsonModule": true,
	"isolatedModules": true
}
```

### Build Optimization

Performance-optimized build settings:

```json
{
	"incremental": true,
	"skipLibCheck": true,
	"forceConsistentCasingInFileNames": true
}
```

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
