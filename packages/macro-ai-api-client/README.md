# Macro AI API Client

TypeScript client for the Macro AI Express API, built with Hey API and Zod for full type safety.

> 📚 **For comprehensive documentation, see [docs/features/api-client/README.md](../../docs/features/api-client/README.md)**

## Features

- 🔒 **Full Type Safety** - Built with Zod schemas for runtime validation
- 🚀 **Production Ready** - Stable implementation with Hey API
- 📦 **ESM Only** - Modern ES modules output for optimal tree-shaking
- 🎯 **Auto-Generated** - Zero-maintenance client generation from OpenAPI spec
- ⚡ **Fast & Lightweight** - Optimized for performance and bundle size

## Installation

```bash
# This is a workspace package, installed automatically
pnpm install
```

## Usage

### Basic Client Usage

```typescript
// Import the client creator and types
import { createApiClient } from '@repo/macro-ai-api-client'

// Create a configured client instance
const apiClient = createApiClient('http://localhost:3030/api')

// Make API calls with full type safety
const loginResponse = await apiClient.POST('/auth/login', {
	body: {
		email: 'user@example.com',
		password: 'password123',
	},
})

const chats = await apiClient.GET('/chats')
const profile = await apiClient.GET('/users/me')
```

### Client Configuration

```typescript
import { createApiClient } from '@repo/macro-ai-api-client'

// Basic client
const apiClient = createApiClient('http://localhost:3030/api')

// Client with custom configuration
const apiClient = createApiClient('http://localhost:3030/api', {
	headers: {
		'X-API-KEY': 'your-api-key',
	},
	timeout: 10000,
	withCredentials: true,
})
```

## Architecture

### Generated Structure

```markdown
src/
├── index.ts # Main exports and client creator
└── client/ # Auto-generated Hey API client
├── index.ts # Client exports
├── client.gen.ts # Core client implementation
├── types.gen.ts # TypeScript type definitions
├── schemas.gen.ts # Zod schema definitions
├── sdk.gen.ts # SDK functions
├── zod.gen.ts # Zod validation schemas
└── core/ # Core utilities and types
├── auth.gen.ts # Authentication utilities
├── types.gen.ts # Core type definitions
└── utils.gen.ts # Utility functions
```

### API Coverage

- **Authentication** (9 endpoints): Registration, login, password reset, token refresh
- **Chat Management** (6 endpoints): Chat CRUD operations, streaming responses
- **User Management** (2 endpoints): User profile management
- **System Health** (2 endpoints): Health checks and system information

## Development

### Scripts

```bash
# Generate API clients and schemas from OpenAPI spec
pnpm generate

# Build the package (includes auto-generation)
pnpm build

# Start development mode with watch (includes auto-generation)
pnpm dev

# Type check
pnpm type-check

# Run tests
pnpm test

# Lint code
pnpm lint

# Clean generated files
pnpm clean
```

### Auto-Generated Architecture

The package uses **Hey API** for automatic code generation from the OpenAPI specification:

1. **Zero Manual Maintenance**: All clients and schemas are auto-generated from the API spec
2. **Always in Sync**: Clients automatically reflect the latest API changes
3. **Modern Tooling**: Built with Hey API for optimal performance and developer experience
4. **Tree Shaking**: ESM-only output for optimal bundle size
5. **Type Safety**: Full TypeScript support with auto-generated Zod schemas
6. **Build Integration**: Generation runs automatically during dev and build processes

## Available Exports

### Client Creator

```typescript
import { createApiClient } from '@repo/macro-ai-api-client'

// Create a configured client instance
const apiClient = createApiClient('http://localhost:3030/api')
```

### Type Exports

```typescript
import type {
	// Request/Response types
	PostAuthLoginRequest,
	PostAuthLoginResponse,
	PostChatsRequest,
	PostChatsResponse,
	GetUsersMeResponse,

	// Client configuration types
	ClientOptions,
	Config,
} from '@repo/macro-ai-api-client'
```

### Schema Exports

```typescript
import {
	// Zod schemas for validation
	postAuthLoginBodySchema,
	postChatsBodySchema,
	userSchema,

	// Type inference from schemas
	PostAuthLoginBody,
	PostChatsBody,
	User,
} from '@repo/macro-ai-api-client'
```

## Contributing

This package uses **Hey API automatic code generation**. To make changes:

1. **API Changes**: Modify the OpenAPI specification in the express-api project
2. **Configuration**: Update `openapi-ts.config.ts` if generation settings need changes
3. **Test Changes**: Run `pnpm test` to ensure compatibility
4. **Regenerate**: Run `pnpm generate` to update clients and schemas
5. **Update Documentation**: Keep this README current with any architectural changes

### Important Notes

- **Never edit generated files manually** - they will be overwritten on next generation
- **All client and schema files are auto-generated** from the OpenAPI specification using Hey API
- **Changes to the API** automatically flow through to the clients when regenerated
- **The generation process** runs automatically during `pnpm dev` and `pnpm build`

The Hey API auto-generation approach ensures that the API clients are always in sync with the backend specification,
eliminating manual maintenance overhead and reducing the risk of inconsistencies.

## 📚 Documentation

For comprehensive documentation and usage examples:

- **[API Client Feature Documentation](../../docs/features/api-client/README.md)** - Complete feature overview
- **[Auto-Generation Guide](../../docs/features/api-client/auto-generation.md)** - Generation process and architecture
- **[Usage Examples](../../docs/features/api-client/usage-examples.md)** - Practical usage patterns and examples
- **[API Reference](../../docs/reference/api-reference.md)** - Complete API endpoint documentation
- **[ADR-004: API Client Generation](../../docs/adr/004-api-client-generation.md)** - Architectural decision rationale

## Related Packages

- `@repo/express-api` - The source API specification
- `@hey-api/openapi-ts` - The API client generation tool
- `@hey-api/client-axios` - Axios-based HTTP client
- `zod` - Schema validation library

## Support

- **Issues**: [GitHub Issues](https://github.com/RussOakham/macro-ai/issues)
- **Documentation**: [Complete Documentation](../../docs/README.md)
- **Development Guide**: [Development Setup](../../docs/getting-started/development-setup.md)
