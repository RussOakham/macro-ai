
# Cognito Authentication Enhancement Tasks

## Refresh Token Implementation

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

## Logout Implementation

- [X] Add logout service in `apps/express-api/src/features/auth/auth.services.ts`
  - [X] Implement `signOut` method using Cognito's `GlobalSignOutCommand`
  - [X] Add revocation of refresh tokens

- [X] Add logout controller in `apps/express-api/src/features/auth/auth.controller.ts`
  - [X] Implement `logout` controller method
  - [X] Extract tokens from cookies
  - [X] Clear auth cookies on successful logout
  - [X] Add proper error handling and responses

- [X] Create logout endpoint in `apps/express-api/src/features/auth/auth.routes.ts`
  - [X] Add `/auth/logout` POST route
  - [X] Document endpoint with Swagger annotations

- [ ] Add client-side logout logic in `apps/client-ui/src/services/auth/`
  - [ ] Create `useLogout` hook
  - [ ] Implement cookie cleanup
  - [ ] Clear TanStack Query cache
  - [ ] Add logout redirect to login page

## UI Updates

- [ ] Add logout button in header/navigation
- [ ] Implement session timeout modal
- [ ] Add automatic logout on token expiration
- [ ] Show appropriate loading states during token refresh

## Testing

- [ ] Add unit tests for new auth services
- [ ] Add integration tests for token refresh flow
- [ ] Add E2E tests for logout flow
- [ ] Test error scenarios and recovery

## Documentation

- [ ] Update API documentation with new endpoints
- [ ] Document token refresh strategy
- [ ] Add sequence diagrams for auth flows
- [ ] Update README with new authentication features
