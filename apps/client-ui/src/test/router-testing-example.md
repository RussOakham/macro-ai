# TanStack Router Testing Example

This example shows how to use the new simplified router testing approach based on the [DEV.to article](https://dev.to/saltorgil/testing-tanstack-router-4io3).

## Basic Usage

```typescript
import { useParams } from '@tanstack/react-router'
import {
	renderWithRouter,
	createAuthenticatedContext,
} from './router-testing-utils'
import { screen } from '@testing-library/react'

// Test a simple component
test('renders user profile', async () => {
	const UserProfile = () => <div>User Profile</div>

	const { router } = await renderWithRouter(UserProfile, {
		pathPattern: '/profile',
		initialEntry: '/profile',
		context: createAuthenticatedContext(),
	})

	expect(screen.getByText('User Profile')).toBeInTheDocument()
})

// Test with dynamic routes
test('renders user by ID', async () => {
	const UserDetail = () => {
		const { userId } = useParams({ from: '/users/$userId' })
		return <div>User {userId}</div>
	}

	await renderWithRouter(UserDetail, {
		pathPattern: '/users/$userId',
		initialEntry: '/users/123',
	})

	expect(screen.getByText('User 123')).toBeInTheDocument()
})
```

## Key Benefits

1. **Simpler Setup**: No need to manage complex router configurations
2. **Better Type Safety**: Reduced use of `any` types
3. **Cleaner API**: Single function handles router setup and rendering
4. **Memory History**: Uses memory history for isolated testing
5. **Automatic Hydration**: Waits for router to be ready before returning

## Migration from Old Approach

### Before (Complex)

```typescript
const router = createTestRouterFromFiles('/profile', mockContext)
const result = render(<RouterProvider router={router} />)
// Manual waiting for router ready...
```

### After (Simple)

```typescript
const { router, renderResult } = await renderWithRouter(Component, {
	pathPattern: '/profile',
	context: mockContext,
})
// Router is automatically ready!
```
