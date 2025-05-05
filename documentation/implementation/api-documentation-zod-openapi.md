# API Documentation with Zod-to-OpenAPI Integration

## Overview

This document outlines the implementation of automated API documentation generation using Zod schemas and the `zod-to-openapi` package. This approach creates a single source of truth for validation and documentation, ensuring consistency and reducing maintenance overhead.

## Implementation Steps

### 1. Package Installation

- [x] Install required packages
  - [x] Add `zod-to-openapi` for schema conversion
  - [x] Add `zod-validation-error` for improved error messages

### 2. OpenAPI Registry Setup

- [x] Create OpenAPI registry utility
  - [x] Implement `registerSchema` helper function
  - [x] Register common schemas (ErrorResponse, etc.)
  - [x] Configure security schemes (cookies, API keys)

### 3. Schema Registration

- [x] Update Auth feature schemas

  - [x] Register `RegisterRequest` schema
  - [x] Register `ConfirmRegistration` schema
  - [x] Register `ResendConfirmationCode` schema
  - [x] Register `Login` schema
  - [x] Register `AuthResponse` schema
  - [x] Register `ForgotPassword` schema
  - [x] Register `ConfirmForgotPassword` schema

- [x] Update User feature schemas
  - [x] Register `UserProfile` schema from Drizzle-generated schemas
  - [x] Register `UpdateUserProfile` schema
  - [x] Register `UserResponse` schema

### 4. Route Registration

- [x] Update Auth routes with OpenAPI metadata

  - [x] Register `/auth/register` endpoint
  - [x] Register `/auth/login` endpoint
  - [x] Register `/auth/logout` endpoint
  - [x] Register `/auth/refresh` endpoint
  - [x] Register `/auth/confirm-registration` endpoint
  - [x] Register `/auth/resend-confirmation-code` endpoint
  - [x] Register `/auth/forgot-password` endpoint
  - [x] Register `/auth/confirm-forgot-password` endpoint
  - [x] Register `/auth/user` endpoint

- [x] Update User routes with OpenAPI metadata
  - [x] Register `/users/me` endpoint
  - [x] Register `/users/:id` endpoint
  - [x] Register `/users/me/profile` endpoint

### 5. Swagger Generation

- [x] Create Swagger generation script
  - [x] Generate OpenAPI document from registry
  - [x] Configure document metadata (title, version, etc.)
  - [x] Write specification to file
  - [x] Add generation script to build process

### 6. Integration with Express

- [x] Update Express server configuration
  - [x] Serve generated Swagger JSON
  - [x] Configure Swagger UI with new specification
  - [x] Update authentication for Swagger UI

### 7. Client Generation

- [x] Update API client generation script
  - [x] Use generated Swagger specification
  - [x] Generate TypeScript client with proper types

## Code Examples

### OpenAPI Registry Setup

```typescript
// apps/express-api/src/utils/swagger/openapi-registry.ts
import { OpenAPIRegistry } from 'zod-to-openapi'
import { z } from 'zod'

// Create a registry to store all schemas and routes
export const registry = new OpenAPIRegistry()

// Helper function to register a schema and return it
export function registerSchema<T extends z.ZodType>(
	name: string,
	schema: T,
	description?: string,
): T {
	registry.register(name, schema, { description })
	return schema
}

// Register common schemas that will be reused
export const ErrorResponseSchema = registerSchema(
	'ErrorResponse',
	z.object({
		message: z.string().describe('Error message'),
		details: z.record(z.any()).optional().describe('Error details'),
	}),
	'Standard error response',
)

// Register security schemes
registry.registerComponent('securitySchemes', 'cookieAuth', {
	type: 'apiKey',
	in: 'cookie',
	name: 'macro-ai-accessToken',
})
```

### Schema Registration

```typescript
// apps/express-api/src/features/user/user.schemas.ts
import { z } from 'zod'
import { registerSchema } from '../../utils/swagger/openapi-registry.ts'
import { selectUserSchema } from './user.schema.ts'

// Convert Drizzle-generated schema to OpenAPI
export const userProfileSchema = registerSchema(
	'UserProfile',
	selectUserSchema,
	'User profile information',
)

export const updateUserProfileSchema = registerSchema(
	'UpdateUserProfile',
	z.object({
		firstName: z.string().optional().describe('User first name'),
		lastName: z.string().optional().describe('User last name'),
	}),
	'Update user profile request',
)
```

### Route Registration

```typescript
// apps/express-api/src/features/user/user.routes.ts
import { registry } from '../../utils/swagger/openapi-registry.ts'
import { userProfileSchema } from './user.schemas.ts'
import { ErrorResponseSchema } from '../../utils/swagger/openapi-registry.ts'

// Register routes with OpenAPI registry
registry.registerPath({
	method: 'get',
	path: '/users/me',
	tags: ['Users'],
	security: [{ cookieAuth: [] }],
	responses: {
		200: {
			description: 'User profile retrieved successfully',
			content: {
				'application/json': {
					schema: userProfileSchema,
				},
			},
		},
		401: {
			description: 'Unauthorized - Authentication required or token expired',
			content: {
				'application/json': {
					schema: ErrorResponseSchema,
				},
			},
		},
		500: {
			description: 'Internal server error',
			content: {
				'application/json': {
					schema: ErrorResponseSchema,
				},
			},
		},
	},
})

router.get('/users/me', verifyAuth, userController.getCurrentUser)
```

### Swagger Generation

```typescript
// apps/express-api/src/utils/generate-swagger.ts
import { OpenApiGeneratorV3 } from 'zod-to-openapi'
import { registry } from './swagger/openapi-registry.ts'

const generateSwaggerSpec = async () => {
	// Generate OpenAPI document from registry
	const generator = new OpenApiGeneratorV3(registry.definitions)
	const openApiDocument = generator.generateDocument({
		openapi: '3.1.0',
		info: {
			title: 'Macro AI Express API',
			version: '0.0.1',
			description: 'API documentation for Macro AI',
		},
		servers: [
			{
				url: 'http://localhost:3030/api',
			},
		],
	})

	// Write to file
	await fs.writeFile(
		path.join(outputDir, 'swagger.json'),
		JSON.stringify(openApiDocument, null, 2),
	)
}
```

## Benefits

1. **Single Source of Truth**: Zod schemas serve as the single source of truth for validation and documentation.

2. **Type Safety**: Full type safety from TypeScript, validation from Zod, and documentation from OpenAPI.

3. **Automatic Updates**: Documentation automatically stays in sync with validation logic.

4. **Reduced Duplication**: No need to maintain separate JSDoc comments and validation schemas.

5. **Improved Developer Experience**: Better tooling and IDE support for schema definitions.

## Integration with Existing Systems

- **Drizzle ORM**: Leverages existing Drizzle-generated Zod schemas for database entities.
- **Validation Middleware**: Works with existing validation middleware by using the same schemas.
- **API Client Generation**: Generated Swagger spec is used to create the TypeScript API client.

## Future Enhancements

- [ ] Add schema examples for improved documentation
- [ ] Implement request/response logging with schema validation
- [ ] Add schema versioning for API evolution
- [ ] Generate client-side form validation from the same schemas
- [ ] Add runtime type checking for third-party integrations

## References

- [zod-to-openapi Documentation](https://github.com/asteasolutions/zod-to-openapi)
- [OpenAPI Specification](https://spec.openapis.org/oas/v3.1.0)
- [Zod Documentation](https://zod.dev/)
