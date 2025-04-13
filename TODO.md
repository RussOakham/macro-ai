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

- [ ] Add logout button in header/navigation
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
