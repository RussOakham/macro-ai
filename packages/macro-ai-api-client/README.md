# Macro AI API Client

Modular TypeScript client for the Macro AI Express API, built with Zodios and Zod for full type safety.

## Features

- 🔒 **Full Type Safety** - Built with Zod schemas for runtime validation
- 🏗️ **Modular Architecture** - Domain-specific clients for better tree-shaking
- 🚀 **Production Ready** - Stable modular implementation
- 📦 **Multiple Export Formats** - ESM, CJS, and TypeScript declarations
- 🎯 **Domain Separation** - Auth, Chat, and User clients

## Installation

```bash
# This is a workspace package, installed automatically
pnpm install
```

## Usage

### Modular Client Usage

```typescript
// Import specific domain clients for better tree-shaking
import {
	createAuthClient,
	createChatClient,
	createUserClient,
} from '@repo/macro-ai-api-client'

// Create domain-specific clients
const authClient = createAuthClient('http://localhost:3030/api')
const chatClient = createChatClient('http://localhost:3030/api')
const userClient = createUserClient('http://localhost:3030/api')

// Use schemas for validation
import { postAuthlogin_Body } from '@repo/macro-ai-api-client'

const loginData = postAuthlogin_Body.parse({
	email: 'user@example.com',
	password: 'password123',
})

// Make API calls with domain-specific clients
const authResponse = await authClient.post('/auth/login', loginData)
const chats = await chatClient.get('/chats')
const profile = await userClient.get('/users/me')
```

### Client Configuration

```typescript
import { createAuthClient } from '@repo/macro-ai-api-client'

// Basic client
const authClient = createAuthClient('http://localhost:3030/api')

// Client with custom configuration
const authClient = createAuthClient('http://localhost:3030/api', {
	axiosConfig: {
		headers: {
			'X-API-KEY': 'your-api-key',
		},
		withCredentials: true,
	},
})
```

## Architecture

### Modular Structure

```markdown
src/
├── index.ts # Main exports
├── schemas/ # Domain-specific schemas
│ ├── auth.schemas.ts # Authentication schemas
│ ├── chat.schemas.ts # Chat and messaging schemas
│ ├── user.schemas.ts # User management schemas
│ ├── shared.schemas.ts # Common schemas
│ └── index.ts # Schema re-exports
└── clients/ # Domain-specific clients
├── auth.client.ts # Auth API client
├── chat.client.ts # Chat API client
├── user.client.ts # User API client
├── unified.client.ts # Combined client
└── index.ts # Client re-exports
```

### API Domains

- **Auth Domain** (9 endpoints): Registration, login, password reset, token refresh
- **Chat Domain** (6 endpoints): Chat CRUD operations, streaming responses
- **User Domain** (2 endpoints): User profile management

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

The package uses **automatic code generation** from the OpenAPI specification:

1. **Zero Manual Maintenance**: All clients and schemas are auto-generated from the API spec
2. **Always in Sync**: Clients automatically reflect the latest API changes
3. **Domain Separation**: Auth, Chat, and User clients are generated separately
4. **Tree Shaking**: Import only the clients you need
5. **Type Safety**: Full TypeScript support with auto-generated Zod schemas
6. **Build Integration**: Generation runs automatically during dev and build processes

## Available Exports

### Client Creators

```typescript
import {
	createAuthClient,
	createChatClient,
	createUserClient,
} from '@repo/macro-ai-api-client'
```

### Schema Exports

```typescript
import {
	// Auth schemas
	postAuthlogin_Body,
	postAuthregister_Body,
	postAuthconfirmRegistration_Body,
	postAuthforgotPassword_Body,
	postAuthconfirmForgotPassword_Body,

	// Chat schemas
	postChats_Body,
	postChatsId_Body,
	postChatsIdstream_Body,

	// User schemas
	userSchemas,
} from '@repo/macro-ai-api-client'
```

## Contributing

This package uses **automatic code generation**. To make changes:

1. **API Changes**: Modify the OpenAPI specification in the express-api project
2. **Generation Logic**: Update `scripts/generate-modular.ts` or `scripts/utils/` if needed
3. **Test Changes**: Run `pnpm test` to ensure compatibility
4. **Regenerate**: Run `pnpm generate` to update clients and schemas
5. **Update Documentation**: Keep this README current with any architectural changes

### Important Notes

- **Never edit generated files manually** - they will be overwritten on next generation
- **All client and schema files are auto-generated** from the OpenAPI specification
- **Changes to the API** automatically flow through to the clients when regenerated
- **The generation process** runs automatically during `pnpm dev` and `pnpm build`

The auto-generation approach ensures that the API clients are always in sync with the backend specification,
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
- `@zodios/core` - The underlying HTTP client library
- `zod` - Schema validation library

## Support

- **Issues**: [GitHub Issues](https://github.com/RussOakham/macro-ai/issues)
- **Documentation**: [Complete Documentation](../../docs/README.md)
- **Development Guide**: [Development Setup](../../docs/getting-started/development-setup.md)
