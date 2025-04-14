# Macro AI Monorepo - Development Tasks

This document outlines the development tasks and enhancements planned for the Macro AI monorepo. It includes both immediate and long-term goals, as well as specific tasks and their statuses.

## Immediate Tasks

### Cognito Authentication Enhancement Tasks

#### Refresh Token Implementation

- [x] Add refresh token service in `apps/express-api/src/features/auth/auth.services.ts`

  - [x] Implement `refreshToken` method using Cognito's `InitiateAuthCommand` with `REFRESH_TOKEN_AUTH` flow
  - [x] Add error handling for expired/invalid refresh tokens

- [x] Add refresh token controller in `apps/express-api/src/features/auth/auth.controller.ts`

  - [x] Implement `refreshToken` controller method
  - [x] Extract refresh token from HTTP-only cookie
  - [x] Set new access and refresh tokens in cookies
  - [x] Add proper error handling and responses

- [x] Create refresh token endpoint in `apps/express-api/src/features/auth/auth.routes.ts`

  - [x] Add `/auth/refresh` POST route
  - [x] Document endpoint with Swagger annotations
  - [x] Implement request validation schema

- [x] Add client-side refresh token logic in `apps/client-ui/src/services/auth/`
  - [x] Implement automatic token refresh in axios interceptors with:
    - [x] Request queue management during refresh
    - [x] Proper error handling and status code checks (401, 403)
    - [x] Cookie management for tokens
    - [x] Integration with TanStack Router for navigation
  - [x] Handle refresh token errors and force logout if needed

#### Logout Implementation

- [x] Add logout service in `apps/express-api/src/features/auth/auth.services.ts`

  - [x] Implement `signOut` method using Cognito's `GlobalSignOutCommand`
  - [x] Add revocation of refresh tokens

- [x] Add logout controller in `apps/express-api/src/features/auth/auth.controller.ts`

  - [x] Implement `logout` controller method
  - [x] Extract tokens from cookies
  - [x] Clear auth cookies on successful logout
  - [x] Add proper error handling and responses

- [x] Create logout endpoint in `apps/express-api/src/features/auth/auth.routes.ts`

  - [x] Add `/auth/logout` POST route
  - [x] Document endpoint with Swagger annotations

- [x] Add client-side logout logic in `apps/client-ui/src/services/auth/`
  - [x] Create `useLogout` hook
  - [x] Clear TanStack Query cache
  - [x] Add logout redirect to login page

#### Review and Refactor

- [ ] Access Token - Create bearer token authorization header helper
- [ ] Access Token - Create access token cookie helper
- [ ] Refresh Token - Create refresh token cookie helper
- [ ] Refactor axios interceptor into separate file for better maintainability
- [ ] Add TypeScript types for axios request config with \_retry property
- [ ] Add error handling constants/enums for HTTP status codes

### UI Updates

- [X] Add logout button in header/navigation
- [ ] Implement session timeout modal
- [ ] Add automatic logout on token expiration
- [ ] Show appropriate loading states during token refresh
- [ ] Add toast notifications for auth state changes

### Testing

- [ ] Add unit tests for new auth services
- [ ] Add integration tests for token refresh flow
- [ ] Add E2E tests for logout flow
- [ ] Test error scenarios and recovery
- [ ] Add tests for axios interceptor logic
- [ ] Test request queue behavior during token refresh

### Documentation

- [ ] Update API documentation with new endpoints
- [ ] Document token refresh strategy
- [ ] Add sequence diagrams for auth flows
- [ ] Update README with new authentication features
- [ ] Document axios interceptor implementation
- [ ] Add examples of handling auth state in components

## API Documentation and Type Generation Tasks

### Express API Swagger Documentation Enhancement (`/apps/express-api`)

- [ ] Update Swagger UI Configuration in `apps/express-api/src/utils/server.ts`
  - [ ] Add authentication button in Swagger UI for testing secured endpoints
  - [ ] Add example values for all request bodies
  - [ ] Add detailed descriptions for all parameters
  - [ ] Document all possible error responses

- [ ] Create API Documentation Guide in `apps/express-api/README.md`
  - [ ] Add section about accessing Swagger UI at http://localhost:3030/api-docs
  - [ ] Document how to authenticate in Swagger UI
  - [ ] Add examples of using Swagger UI for testing endpoints
  - [ ] Create documentation for common API testing scenarios

### Type Generation Package (`/packages/types-api`)

- [ ] Create new package structure
  - [ ] Create directory: `packages/types-api`
  - [ ] Initialize `packages/types-api/package.json`:

    ```json
    {
      "name": "@repo/types-api",
      "version": "0.0.1",
      "private": true,
      "main": "./dist/index.js",
      "module": "./dist/index.mjs",
      "types": "./dist/index.d.ts",
      "scripts": {
        "build": "tsup",
        "dev": "tsup --watch",
        "clean": "rm -rf dist"
      }
    }
    ```

  - [ ] Add `packages/types-api/tsconfig.json` using base config from `packages/config-typescript`
  - [ ] Set up build process with tsup in `packages/types-api/tsup.config.ts`

- [ ] Implement Type Generation in `/packages/types-api`
  - [ ] Install dependencies in package directory:

    ```bash
    cd packages/types-api
    pnpm add -D openapi-typescript swagger-typescript-api tsup
    ```

  - [ ] Create type generation script in `packages/types-api/scripts/generate.ts`
    - [ ] Add script to fetch OpenAPI spec from running API
    - [ ] Generate TypeScript interfaces from OpenAPI spec
    - [ ] Add type generation to build process

### API Client Package (`/packages/api-client`)

- [ ] Create Package Structure
  - [ ] Create directory: `packages/api-client`
  - [ ] Initialize `packages/api-client/package.json`:

    ```json
    {
      "name": "@repo/api-client",
      "version": "0.0.1",
      "private": true,
      "main": "./dist/index.js",
      "module": "./dist/index.mjs",
      "types": "./dist/index.d.ts",
      "scripts": {
        "build": "tsup",
        "dev": "tsup --watch",
        "clean": "rm -rf dist"
      },
      "peerDependencies": {
        "axios": "^1.0.0"
      },
      "dependencies": {
        "@repo/types-api": "workspace:*"
      }
    }
    ```

  - [ ] Add `packages/api-client/tsconfig.json` using base config from `packages/config-typescript`
  - [ ] Set up build process in `packages/api-client/tsup.config.ts`

### Root Repository Updates (`/`)

- [ ] Update Workspace Configuration
  - [ ] Add new packages to `pnpm-workspace.yaml`:

    ```yaml
    packages:
      - 'apps/*'
      - 'packages/*'
      - 'packages/types-api'
      - 'packages/api-client'
    ```

  - [ ] Update `turbo.json` pipeline:

    ```json
    {
      "pipeline": {
        "build": {
          "dependsOn": ["^build"],
          "outputs": ["dist/**"]
        }
      }
    }
    ```

### Client UI Updates (`/apps/client-ui`)

- [ ] Update Dependencies in `apps/client-ui/package.json`

  ```json
  {
    "dependencies": {
      "@repo/api-client": "workspace:*",
      "@repo/types-api": "workspace:*"
    }
  }
  ```

- [ ] Implementation Updates
  - [ ] Replace current API calls in `apps/client-ui/src/api` with new client
  - [ ] Update authentication flow in `apps/client-ui/src/features/auth`
  - [ ] Update error handling in `apps/client-ui/src/utils/error`
  - [ ] Add proper typing to all API calls

### Express API Updates (`/apps/express-api`)

- [ ] Update API Documentation
  - [ ] Add JSDoc comments to all route handlers in `apps/express-api/src/features/**/*.ts`
  - [ ] Update Swagger definitions in `apps/express-api/src/utils/server.ts`
  - [ ] Add response examples in route handlers
  - [ ] Document authentication requirements

### Documentation Updates

- [ ] Root Repository (`/`)
  - [ ] Update main `README.md` with new package information
  - [ ] Add development workflow for API documentation and client generation

- [ ] Types API Package (`/packages/types-api`)
  - [ ] Create comprehensive `README.md`
  - [ ] Add usage examples
  - [ ] Add type generation documentation

- [ ] API Client Package (`/packages/api-client`)
  - [ ] Create comprehensive `README.md`
  - [ ] Add usage examples
  - [ ] Add authentication documentation
  - [ ] Add error handling documentation

### Testing Setup

- [ ] API Client Tests (`/packages/api-client`)
  - [ ] Set up Jest configuration
  - [ ] Add unit tests for client methods
  - [ ] Add integration tests
  - [ ] Add test coverage reporting

- [ ] Types Package Tests (`/packages/types-api`)
  - [ ] Add type generation tests
  - [ ] Add validation tests for generated types

- [ ] Client UI Integration Tests (`/apps/client-ui`)
  - [ ] Add tests for API client integration
  - [ ] Add authentication flow tests
  - [ ] Add error handling tests

## Security Enhancement Tasks

### API Security Layer Implementation

#### Express API Security Updates (`/apps/express-api`)

- [ ] Implement API Key Authentication
  - [ ] Create `src/middleware/apiKeyAuth.ts`
  - [ ] Add API key validation middleware
  - [ ] Update environment variables
  - [ ] Add API key documentation
  - Resources:
    - [Express.js Security Best Practices](https://expressjs.com/en/advanced/best-practice-security.html)
    - [OWASP API Security Top 10](https://owasp.org/www-project-api-security/)

- [ ] Enhanced Security Headers
  - [ ] Create `src/middleware/securityHeaders.ts`
  - [ ] Implement Helmet configuration
  - [ ] Add custom security headers
  - [ ] Configure CORS properly
  - Resources:
    - [Helmet.js Documentation](https://helmetjs.github.io/)
    - [OWASP Secure Headers Project](https://owasp.org/www-project-secure-headers/)

- [ ] Rate Limiting Implementation
  - [ ] Add Express rate limiter middleware
  - [ ] Configure rate limits per endpoint
  - [ ] Add rate limit headers
  - [ ] Implement rate limit bypass for trusted clients
  - Resources:
    - [Express Rate Limit](https://github.com/express-rate-limit/express-rate-limit)
    - [Rate Limiting Best Practices](https://cloud.google.com/architecture/rate-limiting-strategies-patterns)

- [ ] Request Validation Enhancement
  - [ ] Add request validation middleware
  - [ ] Implement input sanitization
  - [ ] Add schema validation for all endpoints
  - [ ] Create custom validation error responses
  - Resources:
    - [Zod Documentation](https://zod.dev/)
    - [Express Validator](https://express-validator.github.io/)

- [ ] Audit Logging System
  - [ ] Create `src/middleware/auditLogger.ts`
  - [ ] Log security-relevant events
  - [ ] Add request tracking IDs
  - [ ] Implement structured logging format
  - Resources:
    - [Pino Logger Best Practices](https://getpino.io/#/docs/best-practices)
    - [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)

#### Client UI Security Updates (`/apps/client-ui`)

- [ ] API Client Security
  - [ ] Update Axios configuration with API key
  - [ ] Add request/response interceptors
  - [ ] Implement retry logic with backoff
  - [ ] Add request timeout handling
  - Resources:
    - [Axios Documentation](https://axios-http.com/docs/interceptors)
    - [HTTP Client Best Practices](https://docs.microsoft.com/en-us/azure/architecture/best-practices/api-implementation#handle-exceptions)

- [ ] Environment Configuration
  - [ ] Add security-related environment variables
  - [ ] Implement environment validation
  - [ ] Add environment type definitions
  - Resources:
    - [Vite Env Variables](https://vitejs.dev/guide/env-and-mode.html)
    - [TypeScript Environment Configuration](https://www.typescriptlang.org/docs/handbook/declaration-files/templates/global-modifying-module-d-ts.html)

### Documentation Updates - API Security

- [ ] Security Documentation (`/docs/security.md`)
  - [ ] Document API key usage
  - [ ] List security headers and their purpose
  - [ ] Describe rate limiting configuration
  - [ ] Add security best practices guide
  - [ ] Document error handling procedures
  - Resources:
    - [API Security Documentation Template](https://github.com/shieldfy/API-Security-Checklist)
    - [REST Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html)

### Testing Updates

- [ ] Security Testing (`/apps/express-api/tests/security`)
  - [ ] Add API key authentication tests
  - [ ] Test rate limiting functionality
  - [ ] Validate security headers
  - [ ] Test input validation
  - [ ] Add audit logging tests
  - Resources:
    - [Jest Security Testing](https://jestjs.io/docs/testing-async)
    - [SuperTest Documentation](https://github.com/visionmedia/supertest)

### Deployment Updates - Production Environment

- [ ] Security Configuration for Production
  - [ ] Configure SSL/TLS settings
  - [ ] Set up secure headers for production
  - [ ] Configure production-ready rate limits
  - [ ] Set up production logging
  - Resources:
    - [Node.js Production Best Practices](https://expressjs.com/en/advanced/best-practice-security.html)
    - [AWS Security Best Practices](https://docs.aws.amazon.com/general/latest/gr/aws-security-best-practices.html)

### Monitoring and Maintenance

- [ ] Security Monitoring Setup
  - [ ] Implement security event monitoring
  - [ ] Set up alerts for suspicious activity
  - [ ] Configure error tracking
  - [ ] Add performance monitoring
  - Resources:
    - [Application Monitoring Guide](https://sematext.com/guides/application-monitoring/)
    - [Security Monitoring Best Practices](https://cloud.google.com/security/security-best-practices)

- [ ] Dependency Management
  - [ ] Set up automated dependency updates
  - [ ] Configure security vulnerability scanning
  - [ ] Implement dependency audit process
  - [ ] Add license compliance checking
  - Resources:
    - [npm audit documentation](https://docs.npmjs.com/cli/v8/commands/npm-audit)
    - [Dependabot documentation](https://docs.github.com/en/code-security/dependabot)
