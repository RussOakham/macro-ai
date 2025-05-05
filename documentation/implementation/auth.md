# Authentication Implementation

## Cognito Authentication Enhancement Tasks

### Refresh Token Implementation

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

### Logout Implementation

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

### Review and Refactor

- [x] Access Token - Create access token cookie helper
- [x] Refresh Token - Create refresh token cookie helper
- [ ] Refactor axios interceptor into separate file for better maintainability
- [ ] Add TypeScript types for axios request config with \_retry property
- [ ] Add error handling constants/enums for HTTP status codes

### Forgotten Password Implementation

- [x] Add forgotten password service in `apps/express-api/src/features/auth/auth.services.ts`

  - [x] Implement `forgotPassword` method using Cognito's `ForgotPasswordCommand`
  - [x] Implement `confirmForgotPassword` method using Cognito's `ConfirmForgotPasswordCommand`
  - [x] Add error handling for invalid/expired codes

- [x] Add forgotten password controller in `apps/express-api/src/features/auth/auth.controller.ts`

  - [x] Implement `forgotPassword` controller method
  - [x] Implement `confirmForgotPassword` controller method
  - [x] Add proper error handling and responses

- [x] Create forgotten password endpoints in `apps/express-api/src/features/auth/auth.routes.ts`

  - [x] Add `/auth/forgot-password` POST route
  - [x] Add `/auth/confirm-forgot-password` POST route
  - [x] Document endpoints with Swagger annotations
  - [x] Implement request validation schemas

- [ ] Add client-side forgotten password logic in `apps/client-ui/src/services/auth/`
  - [x] Create `useForgotPassword` hook
  - [x] Create forgotten password form component
  - [x] Create reset password form component
  - [ ] Add proper validation and error handling
  - [ ] Add success/error notifications

### Authorization Middleware Implementation

- [x] Create auth middleware in `apps/express-api/src/middleware/auth.middleware.ts`

  - [x] Implement `verifyAuth` middleware to check Cognito access tokens
  - [x] Extract access token from cookies
  - [x] Verify token with Cognito service
  - [x] Add user ID to request object for route handlers
  - [x] Handle unauthorized errors with appropriate status codes

- [x] Update Express Request type definition

  - [x] Add `userId` property to Request interface in `apps/express-api/src/types/express/index.d.ts`

- [x] Apply middleware to protected routes

  - [x] Add middleware to `/users/me` endpoint
  - [x] Document authentication requirements in Swagger annotations

- [x] Update user service to support auth middleware
  - [x] Add `getUserById` method to retrieve user data
  - [x] Add `getUserByAccessToken` method for token verification
  - [x] Add proper error handling for authentication failures
