# API Development Guidelines

## Current Implementation Status ✅ COMPLETE

This document provides comprehensive guidelines for API development in the Macro AI application, including OpenAPI
documentation generation, client generation, and development workflows.

## OpenAPI Documentation with Zod Integration ✅ COMPLETE

### Architecture Overview

Our API documentation system uses a **single source of truth** approach where Zod schemas serve as both validation
and documentation sources. This eliminates duplication and ensures consistency across the entire application.

**Key Components:**

- **Zod Schemas**: Runtime validation and TypeScript types
- **OpenAPI Registry**: Central schema and route registration
- **Swagger Generation**: Automated OpenAPI 3.0.0 specification
- **Client Generation**: Auto-generated TypeScript client with proper types

### Implementation Stack

- **API Documentation**: `@asteasolutions/zod-to-openapi` with comprehensive OpenAPI 3.0.0 spec
- **Client Generation**: `openapi-zod-client` for TypeScript client with Zod validation
- **Authentication**: Cookie-based with automatic refresh using Axios interceptors
- **Validation**: Zod schemas integrated with Drizzle ORM
- **Build Process**: Automated Swagger generation integrated into dev and build workflows

## Development Workflow

### 1. Define API Schema

Create Zod schema with OpenAPI metadata:

```typescript
// apps/express-api/src/features/user/user.schemas.ts
import { registerZodSchema } from '../../utils/swagger/openapi-registry.ts'

const userSchema = registerZodSchema(
	'User',
	z.object({
		email: z.email().openapi({ description: 'User email address' }),
		firstName: z.string().openapi({ description: 'User first name' }),
	}),
	'User information',
)
```

### 2. Register API Route

Add OpenAPI route registration with comprehensive error handling:

```typescript
// apps/express-api/src/features/user/user.routes.ts
import { StatusCodes } from 'http-status-codes'
import {
	registry,
	ErrorResponseSchema,
} from '../../utils/swagger/openapi-registry.ts'

registry.registerPath({
	method: 'post',
	path: '/users',
	tags: ['Users'],
	security: [{ cookieAuth: [] }],
	request: {
		body: {
			content: {
				'application/json': {
					schema: userSchema,
				},
			},
		},
	},
	responses: {
		[StatusCodes.CREATED]: {
			description: 'User created successfully',
			content: {
				'application/json': {
					schema: userResponseSchema,
				},
			},
		},
		[StatusCodes.BAD_REQUEST]: {
			description: 'Invalid request data',
			content: {
				'application/json': {
					schema: ErrorResponseSchema,
				},
			},
		},
		[StatusCodes.UNAUTHORIZED]: {
			description: 'Authentication required',
			content: {
				'application/json': {
					schema: ErrorResponseSchema,
				},
			},
		},
	},
})
```

### 3. Generate Documentation

Run the generation commands:

```bash
# Generate Swagger specification
pnpm generate-swagger

# Generate TypeScript client
cd packages/macro-ai-api-client
pnpm build
```

### 4. Test and Validate

- **Swagger UI**: Visit `http://localhost:3040/api-docs` for interactive testing
- **Raw Spec**: Access `http://localhost:3040/swagger.json` for the JSON specification
- **Generated Client**: Use the auto-generated TypeScript client

## OpenAPI Registry Setup

### Core Registry Configuration

```typescript
// apps/express-api/src/utils/swagger/openapi-registry.ts
import {
	extendZodWithOpenApi,
	OpenAPIRegistry,
} from '@asteasolutions/zod-to-openapi'
import { z } from 'zod'

// Extend Zod with OpenAPI support
extendZodWithOpenApi(z)

// Create a registry to store all schemas and routes
const registry = new OpenAPIRegistry()

// Helper function to register a schema and return it
const registerZodSchema = <T extends z.ZodType>(
	name: string,
	schema: T,
	description?: string,
): T => {
	registry.register(name, schema.openapi({ description }))
	return schema
}

// Register security schemes
registry.registerComponent('securitySchemes', 'cookieAuth', {
	type: 'apiKey',
	in: 'cookie',
	name: 'macro-ai-accessToken',
})

registry.registerComponent('securitySchemes', 'apiKey', {
	type: 'apiKey',
	in: 'header',
	name: 'x-api-key',
})

export { registerZodSchema, registry }
```

### Common Schema Registration

```typescript
// Register reusable schemas
const ErrorResponseSchema = registerZodSchema(
	'ErrorResponse',
	z.object({
		message: z.string().openapi({ description: 'Error message' }),
		details: z
			.record(z.any())
			.optional()
			.openapi({ description: 'Error details' }),
	}),
	'Standard error response',
)
```

## Drizzle ORM Integration

### Schema Generation from Database Tables

```typescript
// apps/express-api/src/features/user/user.schemas.ts
import { createInsertSchema, createSelectSchema } from 'drizzle-zod'
import { usersTable } from '../../db/schema/users.ts'

// Generate Zod schemas from Drizzle table definition
const insertUserSchema = createInsertSchema(usersTable)
const selectUserSchema = createSelectSchema(usersTable)

// Convert to OpenAPI-registered schemas
const userProfileSchema = registerZodSchema(
	'UserProfile',
	selectUserSchema.openapi({ description: 'User profile information' }),
)

const updateUserProfileSchema = registerZodSchema(
	'UpdateUserProfile',
	insertUserSchema
		.partial()
		.openapi({ description: 'Update user profile request' }),
)
```

## Swagger Generation Process

### Automated Generation Script

```typescript
// apps/express-api/src/utils/swagger/generate-swagger.ts
import { OpenApiGeneratorV3 } from '@asteasolutions/zod-to-openapi'
import fs from 'fs/promises'
import path from 'path'

// Import all route files to ensure registration
import '../../features/auth/auth.routes.ts'
import '../../features/user/user.routes.ts'
import { registry } from './openapi-registry.ts'

const generateSwaggerSpec = async () => {
	const generator = new OpenApiGeneratorV3(registry.definitions)
	const openApiDocument = generator.generateDocument({
		openapi: '3.0.0',
		info: {
			title: 'Macro AI Express API',
			version: '0.0.1',
			description: `API documentation for Macro AI

## Rate Limiting
- **Global**: 100 requests per 15 minutes
- **Auth**: 10 requests per hour  
- **API**: 60 requests per minute`,
			license: { name: 'MIT' },
		},
		servers: [{ url: 'http://localhost:3040/api' }],
	})

	await fs.writeFile(
		path.join(process.cwd(), 'public', 'swagger.json'),
		JSON.stringify(openApiDocument, null, 2),
	)
}
```

### Build Integration

```json
{
	"scripts": {
		"build": "tsc && tsx src/utils/swagger/generate-swagger.ts",
		"dev": "tsx src/utils/swagger/generate-swagger.ts && nodemon --config nodemon.json",
		"generate-swagger": "tsx src/utils/swagger/generate-swagger.ts"
	}
}
```

## Client Generation

### API Client Package Structure

```text
packages/macro-ai-api-client/
├── scripts/generate.ts     # Client generation script
├── src/index.ts           # Main client export
├── src/output.ts          # Generated client (auto-generated)
└── package.json           # Package configuration
```

### Generation Script

```typescript
// packages/macro-ai-api-client/scripts/generate.ts
import { generateZodClientFromOpenAPI } from 'openapi-zod-client'
import SwaggerParser from '@apidevtools/swagger-parser'

const main = async () => {
	const openApiDoc = await SwaggerParser.parse(
		'http://localhost:3040/swagger.json',
	)
	await generateZodClientFromOpenAPI({
		openApiDoc,
		distPath: './src/output.ts',
		prettierConfig: { semi: false, singleQuote: true },
	})
}
```

## Best Practices

### Schema Design

1. **Use Descriptive Names**: Schema names should be clear and consistent
2. **Add OpenAPI Metadata**: Include descriptions for all fields
3. **Leverage Drizzle Integration**: Use `createSelectSchema` and `createInsertSchema`
4. **Register Common Schemas**: Reuse error responses and common types

### Route Registration

1. **Comprehensive Status Codes**: Document all possible HTTP responses
2. **Security Requirements**: Specify authentication requirements
3. **Rate Limiting**: Document rate limiting policies
4. **Error Responses**: Use standardized error schemas

### Documentation Quality

1. **Clear Descriptions**: Provide meaningful descriptions for all endpoints
2. **Examples**: Include request/response examples where helpful
3. **Tags**: Group related endpoints with consistent tags
4. **Versioning**: Plan for API versioning from the start

## Access Points

- **Swagger UI**: `http://localhost:3040/api-docs` - Interactive API documentation
- **OpenAPI Spec**: `http://localhost:3040/swagger.json` - Raw JSON specification
- **Generated Client**: `@repo/macro-ai-api-client` - TypeScript client package

## Benefits Achieved ✅

1. **Single Source of Truth**: Zod schemas serve validation and documentation
2. **Full Type Safety**: End-to-end TypeScript types from database to client
3. **Automatic Synchronization**: Documentation stays in sync with code
4. **Zero Duplication**: No manual documentation maintenance required
5. **Enhanced Developer Experience**: IDE autocomplete, interactive testing, proper types
6. **Production Ready**: Rate limiting, security schemes, comprehensive error handling

## Future Enhancements ✅ ACTIVE

- [ ] Add schema examples for improved documentation readability
- [ ] Implement request/response logging with schema validation
- [ ] Add API versioning support with schema evolution
- [ ] Generate client-side form validation from schemas
- [ ] Add runtime type checking for third-party integrations
- [ ] Implement OpenAPI spec testing for accuracy validation

## References

- [@asteasolutions/zod-to-openapi Documentation](https://github.com/asteasolutions/zod-to-openapi)
- [OpenAPI Specification 3.0.0](https://spec.openapis.org/oas/v3.0.0)
- [Zod Documentation](https://zod.dev/)
- [openapi-zod-client](https://github.com/astahmer/openapi-zod-client)
- [Drizzle Zod Integration](https://orm.drizzle.team/docs/zod)
