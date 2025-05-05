# API Documentation and Type Generation

## Express API Swagger Documentation Enhancement (`/apps/express-api`)

- [x] Update Swagger UI Configuration in `apps/express-api/src/utils/server.ts`

  - [x] Add authentication button in Swagger UI for testing secured endpoints
  - [x] Add example values for all request bodies
  - [x] Add detailed descriptions for all parameters
  - [x] Document all possible error responses
  - [x] Ensure OpenAPI spec is complete and accurate for client generation

- [ ] Create API Documentation Guide in `apps/express-api/README.md`

  - [ ] Add section about accessing Swagger UI at <http://localhost:3030/api-docs>
  - [ ] Document how to authenticate in Swagger UI
  - [ ] Add examples of using Swagger UI for testing endpoints
  - [ ] Create documentation for common API testing scenarios

- [x] Update API documentation with new auth endpoints

  - [x] Document forgotten password endpoints in `apps/express-api/src/features/auth/auth.routes.ts`
  - [x] Document token refresh strategy in `apps/express-api/src/features/auth/auth.routes.ts`
  - [x] Document logout flow in `apps/express-api/src/features/auth/auth.routes.ts`

- [ ] Add sequence diagrams for auth flows in `documentation/auth-flows/`

  - [ ] Add forgotten password flow diagram
  - [ ] Add token refresh flow diagram
  - [ ] Add logout flow diagram

- [ ] Update README with new authentication features in `apps/express-api/README.md`
- [x] Document axios interceptor implementation in `apps/client-ui/src/lib/api/README.md`
- [ ] Add examples of handling auth state in components in `apps/client-ui/src/features/auth/README.md`

## API Client Package (`/packages/macro-ai-api-client`)

- [x] Create Package Structure
  - [x] Create directory: `packages/macro-ai-api-client`
  - [x] Initialize `packages/api-client/package.json`
  - [x] Add `packages/api-client/tsconfig.json` using base config from `packages/config-typescript`
  - [x] Set up build process in `packages/api-client/tsup.config.ts`
  - [x] Add OpenAPI Generator configuration
  - [x] Create client generation script that:
    - [x] Fetches OpenAPI spec from running Express API
    - [x] Generates TypeScript client using OpenAPI Generator
    - [x] Adds custom wrappers for authentication and error handling

## Root Repository Updates (`/`)

- [x] Update Workspace Configuration
  - [x] Update `pnpm-workspace.yaml`
  - [x] Update `turbo.json` pipeline

## Client UI Updates (`/apps/client-ui`)

- [x] Update Dependencies in `apps/client-ui/package.json`
- [x] Implementation Updates
  - [x] Replace current API calls in `apps/client-ui/src/api` with generated client
  - [x] Update authentication flow in `apps/client-ui/src/features/auth`
  - [x] Update error handling in `apps/client-ui/src/utils/error`
  - [x] Add proper typing to all API calls using generated types

## Express API Updates (`/apps/express-api`)

- [x] Update API Documentation
  - [x] Add JSDoc comments to all route handlers in `apps/express-api/src/features/**/*.ts`
  - [x] Update Swagger definitions in `apps/express-api/src/utils/server.ts`
  - [x] Add response examples in route handlers
  - [x] Document authentication requirements
- [x] Implement Drizzle-Zod integration
  - [x] Generate Zod schemas from Drizzle tables
  - [x] Use Zod schemas for validation and type safety
  - [x] Update Swagger documentation to match schema definitions

## Documentation Updates

- [x] Root Repository (`/`)
- [x] API Client Package (`/packages/macro-ai-api-client`)

## Testing Setup

- [ ] API Client Tests (`/packages/macro-ai-api-client`)
- [ ] Client UI Integration Tests (`/apps/client-ui`)
