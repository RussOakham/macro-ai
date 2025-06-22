# API Documentation and Type Generation

## Current Implementation Status

This document tracks the implementation status of API documentation and type generation across the Macro AI monorepo. Most core functionality is **✅ COMPLETE** with some documentation and testing enhancements remaining.

## Express API Swagger Documentation ✅ COMPLETE (`/apps/express-api`)

- [x] **Swagger UI Configuration** in `apps/express-api/src/utils/server.ts`

  - [x] ✅ Authentication schemes configured (cookieAuth, apiKey)
  - [x] ✅ Comprehensive OpenAPI 3.0.0 specification generation
  - [x] ✅ All request/response schemas with detailed descriptions
  - [x] ✅ Complete error response documentation with HTTP status codes
  - [x] ✅ Rate limiting documentation included in API description
  - [x] ✅ Swagger UI served at `/api-docs` with explorer enabled

- [ ] **API Documentation Guide** in `apps/express-api/README.md` ⚠️ MISSING

  - [ ] Add section about accessing Swagger UI at <http://localhost:3030/api-docs>
  - [ ] Document how to authenticate in Swagger UI using cookies
  - [ ] Add examples of using Swagger UI for testing endpoints
  - [ ] Create documentation for common API testing scenarios
  - [ ] Document rate limiting policies and headers

- [x] **API Documentation with Auth Endpoints** ✅ COMPLETE

  - [x] ✅ Comprehensive auth flow documentation in OpenAPI spec
  - [x] ✅ Forgot password endpoints with full request/response schemas
  - [x] ✅ Token refresh strategy documented with security requirements
  - [x] ✅ Logout flow with proper cookie handling documentation
  - [x] ✅ All endpoints include rate limiting and error response documentation

- [ ] **Auth Flow Diagrams** in `documentation/auth-flows/` ⚠️ MISSING

  - [ ] Add forgotten password flow diagram (Mermaid/PlantUML)
  - [ ] Add token refresh flow diagram with interceptor logic
  - [ ] Add logout flow diagram with cookie cleanup
  - [ ] Add registration and email confirmation flow diagram

- [ ] **Express API README** ⚠️ MISSING
  - [ ] Create comprehensive `apps/express-api/README.md`
  - [ ] Document authentication features and cookie-based auth
  - [ ] Include API development guidelines and testing instructions

- [x] **Client API Integration Documentation** ✅ COMPLETE
  - [x] ✅ Axios interceptor implementation in `apps/client-ui/src/lib/api/index.ts`
  - [x] ✅ Automatic token refresh with request queuing
  - [x] ✅ Error handling and standardization
  - [x] ✅ Cookie-based authentication flow

- [ ] **Auth Component Documentation** ⚠️ MISSING
  - [ ] Add examples of handling auth state in components in `apps/client-ui/src/features/auth/README.md`

## API Client Package ✅ COMPLETE (`/packages/macro-ai-api-client`)

- [x] **Package Structure** ✅ COMPLETE
  - [x] ✅ Directory: `packages/macro-ai-api-client` with proper workspace setup
  - [x] ✅ Package.json with correct dependencies and scripts
  - [x] ✅ TypeScript configuration using base config from `packages/config-typescript`
  - [x] ✅ Build process with `tsup.config.ts` for CJS/ESM dual output
  - [x] ✅ ESLint configuration with proper ignores for generated files

- [x] **OpenAPI Client Generation** ✅ COMPLETE
  - [x] ✅ Automated generation script using `openapi-zod-client`
  - [x] ✅ Fetches OpenAPI spec from Express API (`public/swagger.json`)
  - [x] ✅ Generates TypeScript client with Zod validation
  - [x] ✅ Custom wrappers for authentication and error handling
  - [x] ✅ Integrated build process: `pnpm generate && tsup`

## Root Repository Updates ✅ COMPLETE (`/`)

- [x] **Workspace Configuration** ✅ COMPLETE
  - [x] ✅ `pnpm-workspace.yaml` includes all packages and applications
  - [x] ✅ `turbo.json` pipeline with proper build dependencies
  - [x] ✅ Root package.json with workspace scripts and tooling

## Client UI Updates ✅ COMPLETE (`/apps/client-ui`)

- [x] **Dependencies and Integration** ✅ COMPLETE
  - [x] ✅ Updated `package.json` with `@repo/macro-ai-api-client` dependency
  - [x] ✅ TanStack Router with proper route configuration
  - [x] ✅ TanStack Query for API state management
  - [x] ✅ Proper TypeScript configuration with path aliases

- [x] **API Integration** ✅ COMPLETE
  - [x] ✅ Generated API client integration in `src/lib/api/index.ts`
  - [x] ✅ Axios interceptors for automatic token refresh
  - [x] ✅ Request queuing during token refresh operations
  - [x] ✅ Cookie-based authentication with proper credential handling
  - [x] ✅ Standardized error handling with `standardizeError`

- [x] **Authentication Flow** ✅ COMPLETE
  - [x] ✅ Complete auth feature implementation in `src/features/auth`
  - [x] ✅ Login, registration, and password reset flows
  - [x] ✅ Automatic logout on token refresh failure
  - [x] ✅ Router integration for auth redirects

## Express API Updates ✅ COMPLETE (`/apps/express-api`)

- [x] **OpenAPI Documentation** ✅ COMPLETE
  - [x] ✅ Comprehensive OpenAPI 3.0.0 specification with `@asteasolutions/zod-to-openapi`
  - [x] ✅ All route handlers documented with proper schemas
  - [x] ✅ Security schemes (cookieAuth, apiKey) configured
  - [x] ✅ Rate limiting documentation included
  - [x] ✅ Complete error response documentation

- [x] **Drizzle-Zod Integration** ✅ COMPLETE
  - [x] ✅ `createSelectSchema` and `createInsertSchema` for all tables
  - [x] ✅ Zod schemas used for validation and OpenAPI generation
  - [x] ✅ Type-safe database operations with proper validation
  - [x] ✅ Automatic schema registration with OpenAPI registry

## Documentation Status

- [x] **Root Repository** ✅ COMPLETE (`/`)
  - [x] ✅ Comprehensive README.md with monorepo structure
  - [x] ✅ Getting started guide with prerequisites
  - [x] ✅ Development workflow documentation

- [x] **API Client Package** ✅ COMPLETE (`/packages/macro-ai-api-client`)
  - [x] ✅ Package structure and build configuration
  - [x] ✅ Generation scripts and automation
  - [x] ✅ TypeScript configuration and ESLint setup

- [ ] **Missing Documentation** ⚠️ NEEDS ATTENTION
  - [ ] Express API README with comprehensive API documentation
  - [ ] Auth flow diagrams and visual documentation
  - [ ] Client UI component usage examples
  - [ ] Testing guides and best practices

## Testing Setup ⚠️ INCOMPLETE

- [ ] **API Client Tests** (`/packages/macro-ai-api-client`)
  - [ ] Unit tests for generated client functions
  - [ ] Integration tests with mock API responses
  - [ ] Error handling and retry logic tests
  - [ ] Authentication flow tests

- [ ] **Client UI Integration Tests** (`/apps/client-ui`)
  - [ ] Auth flow integration tests
  - [ ] API client integration tests
  - [ ] Component tests with API mocking
  - [ ] E2E tests for critical user journeys

- [x] **Express API Testing** ✅ BASIC SETUP
  - [x] ✅ Vitest configuration in `vitest.config.ts`
  - [x] ✅ Test scripts in package.json (`test`, `test:ui`)
  - [ ] Actual test files and test coverage

## Current Architecture Overview

### ✅ **What's Working**

1. **Complete API Documentation Pipeline**
   - Zod schemas → OpenAPI spec → TypeScript client
   - Automatic synchronization between validation and documentation
   - Interactive Swagger UI at `/api-docs`

2. **Production-Ready API Client**
   - Auto-generated TypeScript client with proper types
   - Automatic token refresh with request queuing
   - Standardized error handling across the application

3. **Comprehensive Authentication**
   - Cookie-based auth with secure HTTP-only cookies
   - Automatic token refresh with fallback to logout
   - Complete auth flows (login, register, forgot password)

4. **Type Safety End-to-End**
   - Database schemas → Zod validation → OpenAPI docs → Client types
   - No manual type definitions needed for API operations

### ⚠️ **What Needs Attention**

1. **Documentation Gaps**
   - Missing Express API README
   - No visual auth flow diagrams
   - Limited component usage examples

2. **Testing Infrastructure**
   - No tests for API client package
   - No integration tests for client UI
   - Basic test setup but no actual test coverage

3. **Developer Experience**
   - Could benefit from more comprehensive development guides
   - API testing scenarios documentation needed

## Implementation Details

### Current Tech Stack

- **API Documentation**: `@asteasolutions/zod-to-openapi` with comprehensive OpenAPI 3.0.0 spec
- **Client Generation**: `openapi-zod-client` for TypeScript client with Zod validation
- **Authentication**: Cookie-based with automatic refresh using Axios interceptors
- **Validation**: Zod schemas integrated with Drizzle ORM
- **Build Process**: Automated Swagger generation integrated into dev and build workflows

### Key Files and Structure

```markdown
apps/express-api/
├── src/utils/swagger/
│   ├── openapi-registry.ts     # Central OpenAPI schema registry
│   └── generate-swagger.ts     # Swagger generation script
├── src/features/*/
│   ├── *.routes.ts            # Route definitions with OpenAPI registration
│   └── *.schemas.ts           # Zod schemas with OpenAPI metadata
└── public/swagger.json         # Generated OpenAPI specification

packages/macro-ai-api-client/
├── scripts/generate.ts         # Client generation script
├── src/index.ts               # Main client export
└── src/output.ts              # Generated client (auto-generated)

apps/client-ui/
├── src/lib/api/index.ts       # API client with interceptors
└── src/features/auth/         # Auth components using generated client
```

### Development Workflow

1. **Define API**: Create Zod schema with `.openapi()` metadata
2. **Register Route**: Add OpenAPI route registration in routes file
3. **Generate Docs**: Run `pnpm generate-swagger` (automatic in dev mode)
4. **Generate Client**: Run `pnpm build` in API client package
5. **Use in UI**: Import and use typed client functions

### Access Points

- **Swagger UI**: <http://localhost:3030/api-docs>
- **OpenAPI Spec**: <http://localhost:3030/swagger.json>
- **Generated Client**: `@repo/macro-ai-api-client` package

## Next Steps Priority

### High Priority ⚠️

1. **Create Express API README** - Essential for developer onboarding
2. **Add API Client Tests** - Critical for reliability
3. **Create Auth Flow Diagrams** - Important for understanding complex flows

### Medium Priority

1. **Client UI Integration Tests** - Important for preventing regressions
2. **Component Usage Documentation** - Helpful for team development
3. **API Testing Scenarios Guide** - Useful for manual testing

### Low Priority

1. **Enhanced Developer Guides** - Nice to have for advanced scenarios
2. **Performance Testing** - Future optimization needs
3. **API Versioning Strategy** - For future API evolution
