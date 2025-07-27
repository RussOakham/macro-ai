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
# Verify modular structure
pnpm generate

# Build the package
pnpm build

# Type check
pnpm type-check

# Lint code
pnpm lint

# Clean generated files
pnpm clean
```

### Modular Architecture

The package uses a modular architecture with domain-specific clients:

1. **Domain Separation**: Auth, Chat, and User clients are separate
2. **Tree Shaking**: Import only the clients you need
3. **Type Safety**: Full TypeScript support with Zod schemas
4. **Maintainability**: Each domain is independently maintained

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

This package uses a modular architecture. To make changes:

1. Update the individual client or schema files in `src/clients/` or `src/schemas/`
2. Run `pnpm type-check` to verify TypeScript compatibility
3. Run `pnpm build` to create distribution files
4. Test the changes in the consuming applications

## Related Packages

- `@repo/express-api` - The source API specification
- `@zodios/core` - The underlying HTTP client library
- `zod` - Schema validation library
