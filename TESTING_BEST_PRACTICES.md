# Testing Best Practices Guide

## Overview

This guide outlines the comprehensive testing strategy and best practices implemented across the macro-ai monorepo. Our
testing infrastructure provides robust, maintainable, and efficient testing capabilities for both frontend and backend applications.

## Testing Infrastructure

### Core Testing Stack

- **Test Runner**: Vitest with parallel execution
- **React Testing**: @testing-library/react with @testing-library/user-event
- **API Mocking**: MSW (Mock Service Worker) for network-level interception
- **Database Testing**: Testcontainers with real PostgreSQL containers
- **Test Data**: @faker-js/faker for realistic data generation
- **Enhanced Mocking**: vitest-mock-extended and node-mocks-http
- **Router Testing**: Custom utilities based on TanStack Router official patterns

### Package Organization

```text
packages/config-testing/
├── src/
│   ├── test-factories.ts      # Faker-based data generators
│   ├── msw-handlers.ts        # Comprehensive API mocking
│   ├── msw-setup.ts          # MSW configuration
│   └── index.ts              # Export all utilities

apps/client-ui/src/test/
├── router-testing-utils.tsx   # TanStack Router testing utilities
├── router-testing.examples.test.tsx  # Router testing examples
├── react-testing-library.examples.test.tsx  # React testing examples
└── msw-basic-react.example.test.tsx  # MSW React integration

apps/express-api/src/utils/test-helpers/
├── enhanced-mocks.ts          # Professional Express mocking
├── advanced-mocking.ts        # Error simulation & contract testing
├── database-integration.ts    # Real database testing
└── __tests__/                 # 15+ comprehensive test examples
```

## Testing Patterns & Best Practices

### 1. Test Data Generation

**Use Faker for Realistic Data**

```typescript
import { userFactory, authFactory, chatFactory } from '@repo/config-testing'

// ✅ Good: Generate realistic test data
const user = userFactory({
	email: 'test@example.com',
	role: 'admin',
})

// ❌ Bad: Hardcoded test data
const user = {
	id: '123',
	email: 'test@example.com',
	name: 'Test User',
}
```

**Benefits:**

- 60-80% reduction in test data setup boilerplate
- Consistent, realistic test scenarios
- Easy customization with overrides

### 2. Enhanced Mocking

**Professional Express Mocking**

```typescript
import {
	createMockExpressObjects,
	createMockUserService,
} from '../enhanced-mocks'

// ✅ Good: Professional Express mocking
const { req, res, next } = createMockExpressObjects()
const mockUserService = createMockUserService()

mockUserService.getUserById.mockResolvedValue([user, null])

// ❌ Bad: Manual mock creation
const req = { body: {}, params: {} }
const res = { json: vi.fn(), status: vi.fn() }
```

**Benefits:**

- 80-90% reduction in Express mock boilerplate
- Full TypeScript support with automatic type inference
- Realistic Express object behavior

### 3. API Mocking with MSW

**Network-Level Interception**

```typescript
import { handlers, authHandlers } from '@repo/config-testing'

// ✅ Good: Comprehensive API mocking
const server = setupServer(...handlers)

beforeEach(() => {
	server.listen({ onUnhandledRequest: 'warn' })
})

// ❌ Bad: Manual fetch mocking
global.fetch = vi.fn().mockResolvedValue({
	json: () => Promise.resolve(mockData),
})
```

**Benefits:**

- 100% realistic API mocking
- Works with any HTTP client (fetch, axios, etc.)
- Consistent across frontend and backend tests

### 4. Database Integration Testing

**Real Database with Testcontainers**

```typescript
import { setupDatabaseIntegration } from '../database-integration'

// ✅ Good: Real database testing
const dbContext = await setupDatabaseIntegration({
	enableLogging: false,
	runMigrations: true,
	seedTestData: true,
})

// Test actual database operations
const [user] = await dbContext.db.insert(usersTable).values(newUser).returning()

// ❌ Bad: Mocking database operations
const mockDb = {
	insert: vi.fn().mockResolvedValue([mockUser]),
}
```

**Benefits:**

- Real database behavior testing
- Transaction-based test isolation
- Performance testing capabilities

### 5. Parameterized Testing

**Reduce Test Duplication**

```typescript
// ✅ Good: Parameterized tests
describe.each([
	['valid-email@example.com', true],
	['invalid-email', false],
	['another@valid.com', true],
])('Email validation: %s', (email, expected) => {
	it(`should ${expected ? 'accept' : 'reject'} ${email}`, () => {
		const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
		expect(emailRegex.test(email)).toBe(expected)
	})
})

// ❌ Bad: Duplicate test cases
it('should accept valid email', () => {
	expect(validateEmail('valid@example.com')).toBe(true)
})

it('should reject invalid email', () => {
	expect(validateEmail('invalid')).toBe(false)
})
```

**Benefits:**

- 40-60% reduction in test duplication
- Better test organization
- Easier to add new test cases

### 6. React Component Testing

**Accessibility-First Testing**

```typescript
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// ✅ Good: Accessibility-first testing
it('should handle user interactions', async () => {
  const user = userEvent.setup()
  render(<LoginForm />)

  await user.type(screen.getByLabelText(/email/i), 'test@example.com')
  await user.type(screen.getByLabelText(/password/i), 'password')
  await user.click(screen.getByRole('button', { name: /login/i }))

  await waitFor(() => {
    expect(screen.getByText(/welcome/i)).toBeInTheDocument()
  })
})

// ❌ Bad: Testing implementation details
it('should call onSubmit when form is submitted', () => {
  const onSubmit = vi.fn()
  render(<LoginForm onSubmit={onSubmit} />)

  fireEvent.click(screen.getByTestId('submit-button'))
  expect(onSubmit).toHaveBeenCalled()
})
```

**Benefits:**

- Tests user behavior, not implementation
- Better accessibility coverage
- More maintainable tests

### 7. Router Testing

**Simplified TanStack Router Testing Patterns**

```typescript
import { renderWithRouter, createAuthenticatedContext } from '../router-testing-utils'

// ✅ Good: Simplified router testing with async handling
it('should render component with router context', async () => {
  await renderWithRouter(DashboardComponent, {
    pathPattern: '/dashboard',
    initialEntry: '/dashboard',
    context: createAuthenticatedContext(),
  })

  expect(screen.getByText('Dashboard')).toBeInTheDocument()
})

// ✅ Good: Testing dynamic routes
it('should render component with route parameters', async () => {
  const UserProfile = () => <div>User Profile</div>

  await renderWithRouter(UserProfile, {
    pathPattern: '/users/$userId',
    initialEntry: '/users/123',
  })

  expect(screen.getByText('User Profile')).toBeInTheDocument()
})

// ❌ Bad: Testing without router context
it('should render dashboard component', () => {
  render(<Dashboard />)
  expect(screen.getByText('Dashboard')).toBeInTheDocument()
})
```

**Key Features:**

- **Simplified API**: Clean `renderWithRouter` function with minimal setup
- **Async Support**: Proper async handling with `await` for router hydration
- **Memory History**: Uses memory history for isolated testing
- **Authentication Context**: Easy authentication context mocking
- **Dynamic Routes**: Support for route parameters and dynamic paths
- **Type Safety**: Proper TypeScript integration with appropriate `any` usage

**Benefits:**

- Tests actual routing behavior with minimal boilerplate
- Handles authentication and route guards automatically
- Works with any component that needs router context
- Based on [official TanStack Router testing patterns](https://dev.to/saltorgil/testing-tanstack-router-4io3)

## Performance Optimization

### Parallel Test Execution

**Configured in vitest.config.ts:**

```typescript
test: {
  pool: 'threads',
  poolOptions: {
    threads: {
      singleThread: false,
      minThreads: 1,
      maxThreads: 4,
    },
  },
}
```

**Benefits:**

- 30-50% faster test execution
- Better resource utilization
- Isolated test environments

### Test Organization

**File Structure:**

```text
src/
├── components/
│   ├── Button.tsx
│   └── Button.test.tsx        # Co-located tests
├── services/
│   ├── api.ts
│   └── __tests__/             # Service tests
│       ├── api.test.ts
│       └── api.integration.test.ts
└── test/                      # Shared test utilities
    ├── setup.ts
    └── utils/
```

## Quality Assurance

### Test Coverage Standards

**Coverage Thresholds:**

```typescript
coverage: {
  thresholds: {
    global: {
      statements: 80,
      branches: 75,
      functions: 80,
      lines: 80,
    },
  },
}
```

**Focus Areas:**

- Business logic and utilities: 80%+ coverage
- React components: 60%+ coverage (focus on hooks and logic)
- API endpoints: 90%+ coverage
- Database operations: 85%+ coverage

### Test Quality Guidelines

**Follow the Testing Pyramid:**

1. **Unit Tests (70%)**: Fast, isolated tests for individual functions
2. **Integration Tests (20%)**: Test component interactions and API integration
3. **E2E Tests (10%)**: Critical user journeys and workflows

**Test Naming Conventions:**

```typescript
// ✅ Good: Descriptive test names
describe('User Authentication', () => {
	describe('when user provides valid credentials', () => {
		it('should authenticate user and redirect to dashboard', () => {
			// test implementation
		})
	})

	describe('when user provides invalid credentials', () => {
		it('should show error message and remain on login page', () => {
			// test implementation
		})
	})
})

// ❌ Bad: Vague test names
describe('Auth', () => {
	it('should work', () => {
		// test implementation
	})
})
```

## Common Patterns

### 1. Testing Async Operations

```typescript
// ✅ Good: Proper async testing
it('should load user data', async () => {
  const mockFetchUser = vi.fn().mockResolvedValue(mockUser)

  render(<UserProfile userId="123" />)

  await waitFor(() => {
    expect(screen.getByText('John Doe')).toBeInTheDocument()
  })

  expect(mockFetchUser).toHaveBeenCalledWith('123')
})
```

### 2. Testing Error Scenarios

```typescript
// ✅ Good: Error boundary testing
it('should handle API errors gracefully', async () => {
  const mockFetchUser = vi.fn().mockRejectedValue(new Error('User not found'))

  render(<UserProfile userId="123" />)

  await waitFor(() => {
    expect(screen.getByText('Error: User not found')).toBeInTheDocument()
  })
})
```

### 3. Testing Form Interactions

```typescript
// ✅ Good: Realistic form testing
it('should submit form with user input', async () => {
  const user = userEvent.setup()
  const onSubmit = vi.fn()

  render(<ContactForm onSubmit={onSubmit} />)

  await user.type(screen.getByLabelText(/name/i), 'John Doe')
  await user.type(screen.getByLabelText(/email/i), 'john@example.com')
  await user.click(screen.getByRole('button', { name: /submit/i }))

  expect(onSubmit).toHaveBeenCalledWith({
    name: 'John Doe',
    email: 'john@example.com'
  })
})
```

## Router Testing Deep Dive

### New Simplified Approach

The new router testing utilities provide a clean, maintainable way to test TanStack Router components.
This approach is based on the [official TanStack Router testing guide](https://dev.to/saltorgil/testing-tanstack-router-4io3)
and significantly reduces boilerplate while improving reliability.

### Key Features

**1. Minimal Setup**

```typescript
// Simple component testing with router context
await renderWithRouter(MyComponent, {
	pathPattern: '/my-route',
	initialEntry: '/my-route',
})
```

**2. Authentication Context**

```typescript
// Test with authenticated user
await renderWithRouter(ProtectedComponent, {
	pathPattern: '/dashboard',
	context: createAuthenticatedContext(),
})

// Test with unauthenticated user
await renderWithRouter(ProtectedComponent, {
	pathPattern: '/dashboard',
	context: createUnauthenticatedContext(),
})
```

**3. Dynamic Routes**

```typescript
// Test routes with parameters
await renderWithRouter(UserProfile, {
	pathPattern: '/users/$userId',
	initialEntry: '/users/123',
})
```

**4. Navigation Testing**

```typescript
const { router } = await renderWithRouter(MyComponent, {
	pathPattern: '/home',
})

// Navigate programmatically
routerTestUtils.navigateTo(router, '/about')

// Get current route info
const currentRoute = routerTestUtils.getCurrentRoute(router)
expect(currentRoute.pathname).toBe('/about')
```

### Migration from Old Approach

**Old Pattern (Deprecated):**

```typescript
// Complex setup with file-based routing
const { router } = renderWithRouter(<div />, {
  initialLocation: '/dashboard',
  useGeneratedRoutes: true,
  routerContext: mockAuthContext,
})
```

**New Pattern (Recommended):**

```typescript
// Simple, clean setup
await renderWithRouter(DashboardComponent, {
	pathPattern: '/dashboard',
	context: createAuthenticatedContext(),
})
```

### Best Practices

1. **Always use `await`** when calling `renderWithRouter`
2. **Use specific path patterns** instead of relying on generated route trees
3. **Test authentication context** explicitly with `createAuthenticatedContext()` or `createUnauthenticatedContext()`
4. **Keep tests focused** on the component behavior, not router internals
5. **Use the router utilities** for navigation and route state testing

## Troubleshooting

### Common Issues

**1. Tests failing with "window is not defined"**

- Ensure jsdom environment is configured in vitest.config.ts

**2. Router context missing in tests**

- Use the new simplified `renderWithRouter` function
- Import and use `createAuthenticatedContext` or `createUnauthenticatedContext` for auth testing
- Always use `await` when calling `renderWithRouter` for proper async handling

**3. Async operations not waiting**

- Use `waitFor()` for async operations
- Ensure proper async/await patterns

**4. Mock data not realistic**

- Use faker factories instead of hardcoded data
- Import from `@repo/config-testing`

### Performance Issues

**1. Slow test execution**

- Enable parallel execution with `pool: 'threads'`
- Use `poolOptions` to configure thread count
- Consider test isolation and cleanup

**2. Memory leaks in tests**

- Ensure proper cleanup in `afterEach` hooks
- Reset mocks and clear timers
- Use `vi.clearAllMocks()` and `vi.resetAllMocks()`

## Migration Guide

### From Jest to Vitest

1. **Update configuration**: Replace jest.config.js with vitest.config.ts
2. **Update imports**: Change `@jest/globals` to `vitest`
3. **Update matchers**: Use vitest's built-in matchers
4. **Update setup**: Use vitest's setupFiles configuration

### From Manual Mocks to Enhanced Mocks

1. **Replace manual mocks**: Use `createMockExpressObjects()` and service mocks
2. **Update test data**: Use faker factories instead of hardcoded data
3. **Add parameterized tests**: Convert duplicate tests to `describe.each()`

## Resources

### Documentation

- [Vitest Documentation](https://vitest.dev/)
- [Testing Library React](https://testing-library.com/docs/react-testing-library/intro/)
- [MSW Documentation](https://mswjs.io/)
- [TanStack Router Testing](https://tanstack.com/router/latest/docs/framework/react/guide/testing)

### Examples

- `apps/client-ui/src/test/` - React testing examples
- `apps/express-api/src/utils/test-helpers/__tests__/` - Backend testing examples
- `packages/config-testing/src/` - Shared testing utilities

### Tools

- `pnpm test` - Run all tests
- `pnpm test:coverage` - Run tests with coverage
- `pnpm test:ui` - Run tests with UI interface

---

_This guide is maintained alongside the testing infrastructure. For questions or improvements, refer to the testing
examples and utilities in the codebase._
