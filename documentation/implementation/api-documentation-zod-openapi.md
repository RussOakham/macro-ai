# API Documentation with Zod-to-OpenAPI Integration

## Overview

This document outlines our **completed implementation** of automated API documentation generation using Zod schemas and the `@asteasolutions/zod-to-openapi` package. This approach creates a single source of truth for validation and documentation, ensuring consistency and reducing maintenance overhead.

## Implementation Status ✅ COMPLETE

### 1. Package Installation ✅

- [x] Install required packages
  - [x] Add `@asteasolutions/zod-to-openapi` for schema conversion
  - [x] Add `zod-validation-error` for improved error messages
  - [x] Add `openapi-zod-client` for TypeScript client generation

### 2. OpenAPI Registry Setup ✅

- [x] Create OpenAPI registry utility (`src/utils/swagger/openapi-registry.ts`)
  - [x] Implement `registerZodSchema` helper function
  - [x] Register common schemas (ErrorResponse, etc.)
  - [x] Configure security schemes (cookieAuth, apiKey)
  - [x] Extend Zod with OpenAPI support using `extendZodWithOpenApi`

### 3. Schema Registration ✅

- [x] **Auth feature schemas** - All registered with comprehensive OpenAPI metadata

  - [x] Register `RegisterRequest` schema with password validation
  - [x] Register `ConfirmRegistration` schema
  - [x] Register `ResendConfirmationCode` schema
  - [x] Register `Login` schema
  - [x] Register `AuthResponse` and `LoginResponse` schemas
  - [x] Register `ForgotPassword` schema
  - [x] Register `ConfirmForgotPassword` schema
  - [x] Register `GetAuthUserResponse` schema

- [x] **User feature schemas** - Integrated with Drizzle ORM
  - [x] Register `UserProfile` schema from Drizzle-generated schemas
  - [x] Register `UpdateUserProfile` schema
  - [x] Register `UserResponse` schema
  - [x] Register `UserId` validation schema

- [x] **Utility feature schemas** - Health check and system info
  - [x] Register `HealthResponse` schema
  - [x] Register `HealthErrorResponse` schema
  - [x] Register system info endpoint with inline schema

### 4. Route Registration ✅

- [x] **Auth routes** - Comprehensive OpenAPI documentation with all HTTP status codes

  - [x] Register `/auth/register` endpoint with rate limiting
  - [x] Register `/auth/login` endpoint with authentication responses
  - [x] Register `/auth/confirm-registration` endpoint
  - [x] Register `/auth/resend-confirmation-code` endpoint
  - [x] Register `/auth/forgot-password` endpoint
  - [x] Register `/auth/confirm-forgot-password` endpoint
  - [x] Register `/auth/user` endpoint with security requirements
  - [x] Register `/auth/logout` endpoint
  - [x] Register `/auth/refresh` endpoint

- [x] **User routes** - Secured endpoints with proper authentication
  - [x] Register `/users/me` endpoint with cookieAuth security

- [x] **Utility routes** - System health and monitoring
  - [x] Register `/health` endpoint with rate limiting
  - [x] Register `/system-info` endpoint

### 5. Swagger Generation ✅

- [x] Create Swagger generation script (`src/utils/swagger/generate-swagger.ts`)
  - [x] Generate OpenAPI 3.0.0 document from registry
  - [x] Configure document metadata (title, version, description, license)
  - [x] Add rate limiting documentation in description
  - [x] Write specification to `public/swagger.json`
  - [x] Add generation script to build and dev processes
  - [x] Import all route files to ensure registration

### 6. Integration with Express ✅

- [x] Update Express server configuration (`src/utils/server.ts`)
  - [x] Serve generated Swagger JSON from `/swagger.json`
  - [x] Configure Swagger UI at `/api-docs` endpoint
  - [x] Enable Swagger UI explorer
  - [x] Serve static files from `public` directory

### 7. Client Generation ✅

- [x] **API client package** (`packages/macro-ai-api-client`)
  - [x] Use generated Swagger specification for client generation
  - [x] Generate TypeScript client with `openapi-zod-client`
  - [x] Automated build process with `pnpm generate`
  - [x] Proper TypeScript types from OpenAPI schemas

## Current Implementation Examples

### OpenAPI Registry Setup

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

// Register common schemas that will be reused
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

export { ErrorResponseSchema, registerZodSchema, registry }
```

### Schema Registration with Drizzle Integration

```typescript
// apps/express-api/src/features/user/user.schemas.ts
import { createInsertSchema, createSelectSchema } from 'drizzle-zod'
import { z } from 'zod'
import { registerZodSchema } from '../../utils/swagger/openapi-registry.ts'

// Generate Zod schemas from Drizzle table definition
const insertUserSchema = createInsertSchema(usersTable)
const selectUserSchema = createSelectSchema(usersTable)

// Convert Drizzle-generated schema to OpenAPI
const userProfileSchema = registerZodSchema(
	'UserProfile',
	selectUserSchema.openapi({ description: 'User profile information' }),
)

const updateUserProfileSchema = registerZodSchema(
	'UpdateUserProfile',
	z.object({
		firstName: z
			.string()
			.optional()
			.openapi({ description: 'User first name' }),
		lastName: z.string().optional().openapi({ description: 'User last name' }),
	}),
	'Update user profile request',
)

const userResponseSchema = registerZodSchema(
	'UserResponse',
	z.object({
		user: userProfileSchema.openapi({ description: 'User profile data' }),
	}),
	'User profile response',
)
```

### Route Registration with Comprehensive Error Handling

```typescript
// apps/express-api/src/features/user/user.routes.ts
import { StatusCodes } from 'http-status-codes'
import { registry, ErrorResponseSchema } from '../../utils/swagger/openapi-registry.ts'
import { userResponseSchema } from './user.schemas.ts'

// Register routes with OpenAPI registry - comprehensive status codes
registry.registerPath({
	method: 'get',
	path: '/users/me',
	tags: ['Users'],
	security: [{ cookieAuth: [] }],
	responses: {
		[StatusCodes.OK]: {
			description: 'User profile retrieved successfully',
			content: {
				'application/json': {
					schema: userResponseSchema,
				},
			},
		},
		[StatusCodes.UNAUTHORIZED]: {
			description: 'Unauthorized - Authentication required or token expired',
			content: {
				'application/json': {
					schema: ErrorResponseSchema,
				},
			},
		},
		[StatusCodes.TOO_MANY_REQUESTS]: {
			description: 'Too many requests - rate limit exceeded',
			content: {
				'application/json': {
					schema: ErrorResponseSchema,
				},
			},
		},
		[StatusCodes.INTERNAL_SERVER_ERROR]: {
			description: 'Internal server error',
			content: {
				'application/json': {
					schema: ErrorResponseSchema,
				},
			},
		},
	},
})

// Express route definition
const userRouter = (router: Router) => {
	router.get(
		'/users/me',
		verifyAuth,
		apiRateLimiter,
		userController.getCurrentUser,
	)
}
```

### Swagger Generation with Build Integration

```typescript
// apps/express-api/src/utils/swagger/generate-swagger.ts
import { OpenApiGeneratorV3 } from '@asteasolutions/zod-to-openapi'
import fs from 'fs/promises'
import path from 'path'

// Import all route files to ensure they register with the OpenAPI registry
import '../../features/auth/auth.routes.ts'
import '../../features/user/user.routes.ts'
import '../../features/utility/utility.routes.ts'

import { registry } from './openapi-registry.ts'

const generateSwaggerSpec = async () => {
	try {
		const outputDir = path.resolve(process.cwd(), 'public')

		// Generate OpenAPI document from registry
		const generator = new OpenApiGeneratorV3(registry.definitions)
		const openApiDocument = generator.generateDocument({
			openapi: '3.0.0',
			info: {
				title: 'Macro AI Express API',
				version: '0.0.1',
				description: `API documentation for Macro AI

## Rate Limiting
This API implements rate limiting to protect against abuse:

- **Global Rate Limit**: 100 requests per 15 minutes for all endpoints
- **Authentication Rate Limit**: 10 requests per hour for authentication endpoints
- **API Rate Limit**: 60 requests per minute for API endpoints

Rate limit headers are included in responses to help track usage.`,
				license: {
					name: 'MIT',
					url: 'https://spdx.org/licenses/MIT.html',
				},
			},
			servers: [
				{
					url: 'http://localhost:3030/api',
				},
			],
		})

		// Ensure directory exists
		await fs.mkdir(outputDir, { recursive: true })

		// Write swagger spec to file
		await fs.writeFile(
			path.join(outputDir, 'swagger.json'),
			JSON.stringify(openApiDocument, null, 2),
		)

		logger.info('Swagger spec generated successfully at public/swagger.json')
	} catch (error: unknown) {
		const err = standardizeError(error)
		logger.error('Failed to generate swagger spec:', err.message)
		process.exit(1)
	}
}
```

**Build Integration:**

```json
// package.json scripts
{
  "build": "tsc && tsx src/utils/swagger/generate-swagger.ts",
  "dev": "tsx src/utils/swagger/generate-swagger.ts && nodemon --config nodemon.json",
  "generate-swagger": "tsx src/utils/swagger/generate-swagger.ts"
}
```

### Express Server Integration

```typescript
// apps/express-api/src/utils/server.ts
import swaggerUi from 'swagger-ui-express'

const createServer = (): Express => {
	const app: Express = express()

	// Serve static files (including swagger.json)
	app.use(express.static(path.join(process.cwd(), 'public')))

	// Configure Swagger UI
	app.use(
		'/api-docs',
		swaggerUi.serve,
		swaggerUi.setup(undefined, {
			explorer: true,
			swaggerOptions: {
				url: '/swagger.json',
			},
		}),
	)

	return app
}
```

### API Client Generation

```typescript
// packages/macro-ai-api-client/scripts/generate.ts
import { generateZodClientFromOpenAPI } from 'openapi-zod-client'

const main = async () => {
	const openApiDoc = await SwaggerParser.parse(SWAGGER_PATH)
	await generateZodClientFromOpenAPI({
		openApiDoc,
		distPath: OUTPUT_PATH,
		prettierConfig,
	})
}
```

## Benefits Achieved ✅

1. **Single Source of Truth**: Zod schemas serve as the single source of truth for validation and documentation across the entire application.

2. **Full Type Safety**: Complete type safety from TypeScript, runtime validation from Zod, and accurate documentation from OpenAPI.

3. **Automatic Synchronization**: Documentation automatically stays in sync with validation logic - no manual updates needed.

4. **Zero Duplication**: No need to maintain separate JSDoc comments, validation schemas, or manual API documentation.

5. **Enhanced Developer Experience**:
   - IDE autocomplete for all API schemas
   - Automatic client generation with proper TypeScript types
   - Interactive Swagger UI for API testing
   - Comprehensive error response documentation

6. **Production Ready**:
   - Rate limiting documentation included
   - Comprehensive HTTP status code coverage
   - Security scheme documentation (cookies, API keys)
   - MIT license and proper metadata

## Current Integration Status ✅

- **✅ Drizzle ORM**: Seamlessly integrated with `createSelectSchema` and `createInsertSchema` for database entities
- **✅ Validation Middleware**: All routes use the same Zod schemas for validation and documentation
- **✅ API Client Generation**: Automated TypeScript client generation with `openapi-zod-client`
- **✅ Build Process**: Swagger generation integrated into build and development workflows
- **✅ Error Handling**: Standardized error responses with `AppError` integration
- **✅ Security**: Cookie-based authentication and API key schemes documented
- **✅ Rate Limiting**: All rate limiting policies documented in OpenAPI spec

## Usage Examples

### Accessing the Documentation

1. **Swagger UI**: Visit `http://localhost:3030/api-docs` for interactive API documentation
2. **Raw OpenAPI Spec**: Access `http://localhost:3030/swagger.json` for the JSON specification
3. **Generated Client**: Use the auto-generated TypeScript client in `packages/macro-ai-api-client`

### Development Workflow

1. **Define Schema**: Create Zod schema with OpenAPI metadata

   ```typescript
   const userSchema = registerZodSchema(
     'User',
     z.object({
       email: z.string().email().openapi({ description: 'User email address' }),
     }),
     'User information'
   )
   ```

2. **Register Route**: Add OpenAPI route registration

   ```typescript
   registry.registerPath({
     method: 'post',
     path: '/users',
     tags: ['Users'],
     request: { body: { content: { 'application/json': { schema: userSchema } } } },
     responses: { /* ... */ }
   })
   ```

3. **Build**: Run `pnpm generate-swagger` to update documentation
4. **Test**: Use Swagger UI to test the endpoint
5. **Generate Client**: Run `pnpm build` in the API client package

## Future Enhancements

- [ ] Add schema examples for improved documentation readability
- [ ] Implement request/response logging with schema validation
- [ ] Add API versioning support with schema evolution
- [ ] Generate client-side form validation from the same schemas
- [ ] Add runtime type checking for third-party API integrations
- [ ] Implement OpenAPI spec testing to ensure accuracy

## References

- [@asteasolutions/zod-to-openapi Documentation](https://github.com/asteasolutions/zod-to-openapi)
- [OpenAPI Specification 3.0.0](https://spec.openapis.org/oas/v3.0.0)
- [Zod Documentation](https://zod.dev/)
- [openapi-zod-client](https://github.com/astahmer/openapi-zod-client)
- [Drizzle Zod Integration](https://orm.drizzle.team/docs/zod)
