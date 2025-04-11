# Macro AI Monorepo - Development Tasks

This document outlines the development tasks and enhancements planned for the Macro AI monorepo. It includes both immediate and long-term goals, as well as specific tasks and their statuses.

## Immediate Tasks

### Cognito Authentication Enhancement Tasks

#### Refresh Token Implementation

- [ ] Add refresh token service in `apps/express-api/src/features/auth/auth.services.ts`

  - [ ] Implement `refreshToken` method using Cognito's `InitiateAuthCommand` with `REFRESH_TOKEN_AUTH` flow
  - [ ] Add error handling for expired/invalid refresh tokens

- [ ] Add refresh token controller in `apps/express-api/src/features/auth/auth.controller.ts`

  - [ ] Implement `refreshToken` controller method
  - [ ] Extract refresh token from HTTP-only cookie
  - [ ] Set new access and refresh tokens in cookies
  - [ ] Add proper error handling and responses

- [ ] Create refresh token endpoint in `apps/express-api/src/features/auth/auth.routes.ts`

  - [ ] Add `/auth/refresh` POST route
  - [ ] Document endpoint with Swagger annotations
  - [ ] Implement request validation schema

- [ ] Add client-side refresh token logic in `apps/client-ui/src/services/auth/`
  - [ ] Create `useRefreshToken` hook
  - [ ] Implement automatic token refresh in axios interceptors
  - [ ] Add refresh token retry logic with exponential backoff
  - [ ] Handle refresh token errors and force logout if needed

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

### UI Updates

- [ ] Add logout button in header/navigation
- [ ] Implement session timeout modal
- [ ] Add automatic logout on token expiration
- [ ] Show appropriate loading states during token refresh

### Testing

- [ ] Add unit tests for new auth services
- [ ] Add integration tests for token refresh flow
- [ ] Add E2E tests for logout flow
- [ ] Test error scenarios and recovery

### Documentation

- [ ] Update API documentation with new endpoints
- [ ] Document token refresh strategy
- [ ] Add sequence diagrams for auth flows
- [ ] Update README with new authentication features
