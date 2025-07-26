# Macro AI API Client

Auto-generated TypeScript client for the Macro AI Express API, built with Zodios and Zod for full type safety.

## Features

- 🔒 **Full Type Safety** - Generated from OpenAPI spec with Zod schemas
- 🏗️ **Modular Architecture** - Domain-specific clients for better tree-shaking
- 🔄 **Backward Compatible** - Existing imports continue to work
- 🚀 **Auto-generated** - Always in sync with the API specification
- 📦 **Multiple Export Formats** - ESM, CJS, and TypeScript declarations

## Installation

```bash
# This is a workspace package, installed automatically
pnpm install
```

## Usage

### Current Usage (Backward Compatible)

```typescript
import { createApiClient, schemas } from '@repo/macro-ai-api-client'

// Create API client
const apiClient = createApiClient('http://localhost:3030/api')

// Use schemas for validation
const loginData = schemas.postAuthlogin_Body.parse({
	email: 'user@example.com',
	password: 'password123',
})

// Make API calls
const response = await apiClient.post('/auth/login', loginData)
```

### Future Modular Usage (Coming Soon)

```typescript
// Import specific domain clients for better tree-shaking
import { createAuthClient } from '@repo/macro-ai-api-client/auth'
import { createChatClient } from '@repo/macro-ai-api-client/chat'
import { createUserClient } from '@repo/macro-ai-api-client/user'

// Or import specific schemas
import { authSchemas } from '@repo/macro-ai-api-client/schemas/auth'
```

## Architecture

### Current Structure

```markdown
src/
├── index.ts # Main exports (backward compatible)
├── output.ts # Auto-generated unified client
├── schemas/ # Domain-specific schemas (future)
│ ├── auth.schemas.ts # Authentication schemas
│ ├── chat.schemas.ts # Chat and messaging schemas
│ ├── user.schemas.ts # User management schemas
│ ├── shared.schemas.ts # Common schemas
│ └── index.ts # Schema re-exports
└── clients/ # Domain-specific clients (future)
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
# Generate API client from OpenAPI spec
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

### Generation Process

1. **Swagger Generation**: Express API generates `swagger.json`
2. **Client Generation**: `openapi-zod-client` creates TypeScript client
3. **Modular Split**: Custom script splits into domain-specific files
4. **Build**: `tsup` creates distribution files

## Migration Guide

### Current State (v0.0.1)

All existing imports continue to work without changes:

```typescript
// ✅ These imports still work
import { createApiClient, schemas, api } from '@repo/macro-ai-api-client'
```

### Future State (v0.1.0+)

New modular imports will be available:

```typescript
// 🚀 Future modular imports
import { createAuthClient } from '@repo/macro-ai-api-client/auth'
import { authSchemas } from '@repo/macro-ai-api-client/schemas/auth'
```

## Contributing

This package is auto-generated. To make changes:

1. Update the Express API OpenAPI specifications
2. Run `pnpm generate` to regenerate the client
3. Test with `pnpm type-check` and `pnpm build`

## Related Packages

- `@repo/express-api` - The source API that generates the OpenAPI spec
- `@zodios/core` - The underlying HTTP client library
- `openapi-zod-client` - Code generation tool
