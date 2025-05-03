# UI Implementation

## UI Updates

- [x] Add logout button in header/navigation
- [ ] Implement session timeout modal
- [ ] Add automatic logout on token expiration
- [ ] Show appropriate loading states during token refresh
- [ ] Add toast notifications for auth state changes
- [ ] Add forgotten password UI flow
  - [x] Create forgotten password page
  - [x] Create reset password page
  - [x] Add navigation links to/from login page

## Testing

- [ ] Add unit tests for new auth services
  - [ ] Test forgotten password flow
  - [ ] Test token refresh flow
  - [ ] Test logout flow
- [ ] Add integration tests for auth flows
  - [ ] Test password reset journey
  - [ ] Test token refresh journey
  - [ ] Test logout journey
- [ ] Test error scenarios and recovery
- [ ] Add tests for axios interceptor logic
- [ ] Test request queue behavior during token refresh
