# Client-UI Unit Test Migration Plan

## Overview

This document outlines the comprehensive plan for migrating existing unit tests in the client-ui folder to use the new
enhanced testing methods, including testing utilities, mocks, and OpenAPI spec MSW server integration.

## Current State Analysis

### Test Files Inventory

**Total Test Files Found: 13**

#### API Client Tests (6 files in `src/lib/api/__tests__/`)

- `clients.test.ts` - Basic client configuration tests
- `interceptors.test.ts` - Token refresh interceptor tests
- `validation.test.ts` - Client validation tests
- `performance-reliability.test.ts` - Client stability tests
- `token-refresh-integration.test.ts` - Token refresh integration
- `shared-refresh-promise.test.ts` - Shared refresh promise tests

#### Enhanced Testing Examples (7 files in `src/test/`)

- `pilot-enhanced-testing.test.tsx` - Comprehensive form testing examples
- `react-testing-library.examples.test.tsx` - RTL best practices
- `simple-form-test.test.tsx` - Basic form testing validation
- `msw-basic-react.example.test.tsx` - MSW integration examples
- `router-testing.examples.test.tsx` - Router testing examples
- `standalone-test.test.tsx` - Standalone component tests

## New Testing Infrastructure Available

### 1. Enhanced Testing Utilities (`src/test/`)

#### Core Utilities (`test-utils.ts`)

- **MSW Integration**: `setupMSWServer`, `createMSWHandlers`
- **API Client Mocking**: `createMockApiClient`, `createMockAxiosInstance`
- **Authentication**: `createMockAuthState`, `createAuthenticatedUserState`
- **Test Data Factories**: `clientUITestData` with user/chat/message factories
- **Enhanced Assertions**: `clientUITestAssertions` for API responses and auth state

#### Component Testing (`component-test-utils.tsx`)

- **Enhanced Rendering**: `renderComponent`, `renderWithAuth`, `renderWithoutAuth`
- **Form Testing**: `formTesting` utilities for all form field types
- **Component Assertions**: `componentAssertions` for accessibility and state
- **Router Testing**: `testRouterNavigation` utilities
- **User Interaction**: `simulateUserInteraction` helpers

#### API Testing (`api-test-utils.ts`)

- **Mock Adapters**: `createMockAdapter`, `setupMockAdapter`
- **MSW Integration**: `createDynamicMSWHandlers`, `setupDynamicMSWServer`
- **Interceptor Testing**: `createMockInterceptors`, `testInterceptor`
- **Token Refresh**: `createMockTokenRefreshFunction`, `createMockSharedRefreshPromise`
- **Error Scenarios**: `createNetworkErrorScenarios`, `testErrorHandling`
- **Performance Testing**: `createPerformanceTestScenarios`

### 2. MSW Integration (`msw-setup.ts`)

#### Auto-Generated Handlers

- **Complete API Coverage**: All endpoints from OpenAPI spec
- **Realistic Mock Data**: Using Faker.js for consistent test data
- **Error Scenarios**: Comprehensive HTTP status codes (400, 401, 403, 404, 500, etc.)
- **API Endpoints Covered**:
  - Authentication: `/auth/login`, `/auth/register`, `/auth/refresh`, `/auth/user`
  - Chat Management: `/chats`, `/chats/:id`, `/chats/:id/stream`
  - User Management: `/users/:id`, `/users/me`
  - Health Checks: `/health`, `/health/detailed`, `/health/ready`

### 3. Enhanced Mocking Capabilities

#### Factory Functions

- **User Factory**: `userFactory.create()` with realistic user data
- **Chat Factory**: `chatFactory.create()` with messages and metadata
- **API Response Factory**: `apiResponseFactory.create()` with consistent structure
- **Auth Factory**: `authFactory.create()` with token management

#### Mock API Clients

- **Tracking Capabilities**: `createTrackingMockApiClient` for call history
- **Hybrid Testing**: `createHybridTestSetup` combining Axios Mock Adapter + MSW
- **Error Simulation**: `createNetworkErrorScenarios` for comprehensive error testing

## Migration Plan - Prioritized by Impact

### 🔴 HIGH PRIORITY - API Client Tests (Immediate Impact)

#### 1. `src/lib/api/__tests__/clients.test.ts` - ⭐ **HIGHEST PRIORITY**

**Current Issues:**

- Uses basic mocking with `vi.mock()`
- Limited MSW integration
- No real HTTP request testing
- Basic configuration validation only

**Migration Benefits:**

- Test actual HTTP requests using OpenAPI spec handlers
- Comprehensive error scenario testing
- Real API client behavior validation
- Better integration testing

**Specific Improvements:**

```typescript
// Before: Manual mocking
vi.mock('@repo/macro-ai-api-client', () => ({
  createApiClient: vi.fn((baseURL: string, config: Partial<Config>) => ({...}))
}))

// After: MSW integration
import { setupMSWForTests } from '../../../test/msw-setup'
import { createTrackingMockApiClient } from '../../../test/api-test-utils'

setupMSWForTests()

// Test real API calls
const response = await apiClient.get('/health')
expect(response.data.message).toBe('Api Health Status: OK')
```

**New Test Scenarios to Add:**

- Real HTTP request testing with MSW handlers
- Error response handling (400, 401, 500)
- API client configuration validation
- Interceptor integration testing
- Token refresh flow testing

#### 2. `src/lib/api/__tests__/interceptors.test.ts` - ⭐ **HIGH PRIORITY**

**Current Issues:**

- Basic interceptor testing with mocked functions
- No real HTTP scenarios
- Limited error handling testing
- No token refresh integration

**Migration Benefits:**

- Test interceptors with actual API calls
- Comprehensive error handling scenarios
- Token refresh flow validation
- Real-world integration testing

**Specific Improvements:**

```typescript
// Before: Basic mock testing
mockAxiosInstance.interceptors.response.use = vi.fn()

// After: Enhanced interceptor testing
import {
	createMockAxiosWithInterceptors,
	testInterceptor,
} from '../../../test/api-test-utils'

const mockInstance = createMockAxiosWithInterceptors()
const result = await testInterceptor(mockInstance.requestInterceptor, testData)
```

**New Test Scenarios to Add:**

- Request/response interceptor testing with real HTTP calls
- Token refresh interceptor integration
- Error handling in interceptors
- Retry logic testing
- Authentication header management

#### 3. `src/lib/api/__tests__/token-refresh-integration.test.ts` - ⭐ **HIGH PRIORITY**

**Current Issues:**

- Limited integration testing
- No real API endpoint testing
- Basic token refresh simulation
- No error scenario coverage

**Migration Benefits:**

- Full integration testing with MSW
- Real token refresh API calls
- Comprehensive error scenarios
- Authentication flow validation

**Specific Improvements:**

```typescript
// Before: Basic token refresh testing
const mockRefresh = vi.fn().mockResolvedValue({ accessToken: 'new-token' })

// After: Enhanced token refresh testing
import {
	createMockTokenRefreshFunction,
	createMockSharedRefreshPromise,
	createAuthTestScenarios,
} from '../../../test/api-test-utils'

const mockRefresh = createMockTokenRefreshFunction({
	shouldSucceed: true,
	accessToken: 'new-access-token',
	refreshToken: 'new-refresh-token',
})
```

**New Test Scenarios to Add:**

- Real token refresh API calls using MSW handlers
- Token expiration and refresh flow
- Concurrent refresh request handling
- Error scenarios (401, 500, network errors)
- Shared refresh promise coordination

### 🟡 MEDIUM PRIORITY - Enhanced Testing Examples (Learning & Documentation)

#### 4. `src/test/pilot-enhanced-testing.test.tsx` - ⭐ **MEDIUM PRIORITY**

**Current Status:**

- Already uses new utilities extensively
- Good form testing examples
- Comprehensive component testing

**Improvements to Add:**

- MSW integration examples
- API call testing scenarios
- Authentication state testing
- Error handling examples

#### 5. `src/test/react-testing-library.examples.test.tsx` - ⭐ **MEDIUM PRIORITY**

**Current Status:**

- Good RTL examples
- Limited new utility usage
- Basic form testing

**Improvements to Add:**

- Replace manual form testing with `formTesting` utilities
- Add `componentTesting` utilities usage
- Include MSW integration examples
- Enhanced user interaction testing

### 🟢 LOW PRIORITY - Validation & Performance Tests (Maintenance)

#### 6. `src/lib/api/__tests__/validation.test.ts` - ⭐ **LOW PRIORITY**

**Current Status:**

- Basic validation tests
- Configuration testing
- Type safety validation

**Improvements to Add:**

- Use new assertion utilities
- Add comprehensive error testing
- Enhanced validation scenarios

#### 7. `src/lib/api/__tests__/performance-reliability.test.ts` - ⭐ **LOW PRIORITY**

**Current Status:**

- Basic stability tests
- Client configuration validation
- Interceptor management testing

**Improvements to Add:**

- Use `createPerformanceTestScenarios` utility
- Add load testing scenarios
- Enhanced reliability testing

### ✅ EXAMPLES - Reference Implementations (Keep as-is)

#### Files to Keep as Reference Examples

- `src/test/simple-form-test.test.tsx` - Good example of new utilities usage
- `src/test/msw-basic-react.example.test.tsx` - Good MSW integration example
- `src/test/router-testing.examples.test.tsx` - Router testing examples
- `src/test/standalone-test.test.tsx` - Standalone component testing

## Detailed Migration Examples

### Example 1: API Client Testing Migration

**Before:**

```typescript
// Manual mocking approach
vi.mock('@repo/macro-ai-api-client', () => ({
	createApiClient: vi.fn((baseURL: string, config: Partial<Config>) => ({
		instance: {
			defaults: { baseURL, headers: config.headers ?? {} },
			interceptors: { response: { use: vi.fn(), eject: vi.fn() } },
		},
		post: vi.fn(),
		get: vi.fn(),
	})),
}))

it('should have proper axios configuration', () => {
	expect(apiClient.instance.defaults.baseURL).toBe('http://localhost:3000')
	expect(apiClient.instance.defaults.headers['X-API-KEY']).toBe('test-api-key')
})
```

**After:**

```typescript
// MSW integration approach
import { setupMSWForTests } from '../../../test/msw-setup'
import { createTrackingMockApiClient } from '../../../test/api-test-utils'

setupMSWForTests()

it('should make real API calls with proper configuration', async () => {
	const trackingClient = createTrackingMockApiClient()

	// Test real HTTP request
	const response = await apiClient.get('/health')
	expect(response.status).toBe(200)
	expect(response.data.message).toBe('Api Health Status: OK')

	// Verify client configuration
	expect(apiClient.instance.defaults.baseURL).toBe('http://localhost:3000')
	expect(apiClient.instance.defaults.headers['X-API-KEY']).toBe('test-api-key')
})

it('should handle API errors gracefully', async () => {
	// Override MSW handler for error scenario
	setupServerWithHandlers([
		http.get('http://localhost:3000/health', () => {
			return HttpResponse.json(
				{ message: 'Internal server error' },
				{ status: 500 },
			)
		}),
	])

	await expect(apiClient.get('/health')).rejects.toThrow()
})
```

### Example 2: Form Testing Migration

**Before:**

```typescript
// Manual form interaction
const { container } = render(<LoginForm />)
const form = container.querySelector('form')!
const emailInput = form.querySelector('input[name="email"]')!
const passwordInput = form.querySelector('input[name="password"]')!

fireEvent.change(emailInput, { target: { value: 'test@example.com' } })
fireEvent.change(passwordInput, { target: { value: 'password123' } })
fireEvent.submit(form)
```

**After:**

```typescript
// Enhanced form testing utilities
import { formTesting, componentTesting } from '../test/component-test-utils'

const { container } = render(<LoginForm />)
const form = container.querySelector('form')!

// Use enhanced form testing utilities
await formTesting.fillTextInputs(form, {
  email: 'test@example.com',
  password: 'password123'
})

await formTesting.submitForm(form)

// Validate form state
formTesting.validateTextInputs(form, {
  email: 'test@example.com',
  password: 'password123'
})
```

### Example 3: Authentication Testing Migration

**Before:**

```typescript
// Basic auth state mocking
const mockAuthState = {
	isAuthenticated: true,
	user: { id: '1', email: 'test@example.com' },
	token: 'mock-token',
}
```

**After:**

```typescript
// Enhanced auth testing utilities
import {
  renderWithAuth,
  createAuthenticatedUserState,
  createAuthTestScenarios
} from '../test/test-utils'

// Render component with authentication
const { getByText } = renderWithAuth(<UserProfile />, {
  email: 'test@example.com',
  name: 'Test User'
})

// Test auth scenarios
const authScenarios = createAuthTestScenarios()
const results = await testApiCallScenarios(apiClient, authScenarios)
```

## Implementation Timeline

### Phase 1: High Priority (Week 1-2)

1. **Day 1-2**: Migrate `clients.test.ts`
2. **Day 3-4**: Migrate `interceptors.test.ts`
3. **Day 5-7**: Migrate `token-refresh-integration.test.ts`
4. **Day 8-10**: Test and validate high-priority migrations

### Phase 2: Medium Priority (Week 3-4)

1. **Day 11-13**: Enhance `pilot-enhanced-testing.test.tsx`
2. **Day 14-16**: Update `react-testing-library.examples.test.tsx`
3. **Day 17-19**: Add MSW integration examples
4. **Day 20-21**: Documentation and validation

### Phase 3: Low Priority (Week 5-6)

1. **Day 22-24**: Update `validation.test.ts`
2. **Day 25-27**: Enhance `performance-reliability.test.ts`
3. **Day 28-30**: Final testing and documentation

## Expected Benefits

### Immediate Benefits

- **Better Test Coverage**: Real API testing with MSW handlers
- **More Realistic Tests**: Using actual OpenAPI spec responses
- **Improved Reliability**: Comprehensive error scenario testing
- **Enhanced Debugging**: Better error messages and test output

### Long-term Benefits

- **Improved Maintainability**: Centralized testing utilities
- **Enhanced Developer Experience**: Consistent testing patterns
- **Better Documentation**: Comprehensive test examples
- **Reduced Test Flakiness**: More stable and predictable tests

### Quality Improvements

- **Authentication Testing**: Complete auth flow testing with MSW
- **Error Handling**: All HTTP status codes and error scenarios
- **Integration Testing**: Real API client behavior validation
- **Performance Testing**: Load and reliability testing capabilities

## Success Metrics

### Quantitative Metrics

- **Test Coverage**: Increase from ~70% to ~90%
- **Test Execution Time**: Maintain or improve current performance
- **Test Reliability**: Reduce flaky tests by 80%
- **Error Scenario Coverage**: Cover all HTTP status codes (400, 401, 403, 404, 500, etc.)

### Qualitative Metrics

- **Developer Experience**: Improved test writing and debugging
- **Code Maintainability**: Easier to add new tests and modify existing ones
- **Documentation Quality**: Better examples and patterns for future development
- **Test Consistency**: Standardized testing patterns across the codebase

## Next Steps

1. **Review and Approve Plan**: Team review of migration priorities and timeline
2. **Set Up Development Environment**: Ensure all new testing utilities are properly configured
3. **Start with High Priority**: Begin migration with `clients.test.ts`
4. **Iterative Implementation**: Migrate files in priority order with validation at each step
5. **Documentation Updates**: Update testing documentation as migrations complete
6. **Team Training**: Share new testing patterns and utilities with the development team

---

_This migration plan will significantly improve the quality and reliability of the client-ui test suite while providing
better examples and patterns for future development._
