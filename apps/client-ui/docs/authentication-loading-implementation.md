# Authentication Loading UI Implementation

## Overview

This implementation provides a comprehensive loading UI system for authentication processes, specifically addressing the
blank screen issue that occurs during the `beforeLoad` authentication check in TanStack Router.

## Problem Solved

When users navigate to the root route (`/`), the `attemptAuthenticationWithRefresh` function runs in the `beforeLoad`
hook, which can take time to:

- Validate existing tokens
- Refresh expired tokens
- Make API calls to verify authentication
- Redirect to appropriate routes

During this process, users previously saw a blank screen, creating a poor user experience.

## Components Created

### 1. AuthLoading (`src/components/auth/auth-loading.tsx`)

A flexible, reusable authentication loading component with the following features:

**Props:**

- `message?: string` - Custom loading message (default: "Authenticating...")
- `showIcon?: boolean` - Show/hide shield icon (default: true)
- `size?: 'sm' | 'md' | 'lg'` - Size variant (default: 'md')
- `className?: string` - Additional CSS classes

**Design Features:**

- Uses semantic color tokens (`bg-background`, `text-foreground`, `text-muted-foreground`, `text-primary`)
- Supports light/dark/system theme toggle functionality
- Consistent with existing chat interface loading patterns
- Configurable sizing for different use cases

### 2. AuthLoadingCompact (`src/components/auth/auth-loading.tsx`)

A compact version for inline use within forms or smaller components:

- Horizontal layout with spinner and text
- Smaller size optimized for inline use
- Simple API with just message customization

### 3. AuthRouteLoading (`src/components/auth/auth-route-loading.tsx`)

A full-screen loading component specifically designed for route transitions:

- Full viewport height (`min-h-screen`)
- Centered layout with large size variant
- Optimized message for authentication verification
- Consistent with the application's layout structure

## Integration Points

### 1. Route-Level Integration

Added `pendingComponent: AuthRouteLoading` to routes with authentication checks:

**Routes Updated:**

- `/` (index.tsx) - Primary authentication entry point
- `/chat` (chat.tsx) - Chat layout with auth check
- `/chat/$chatId` (chat/$chatId.tsx) - Individual chat with auth check

### 2. Global Router Integration

Added `defaultPendingComponent: AuthRouteLoading` to the main router configuration in `main.tsx`:

- Provides fallback loading state for any route without a specific pending component
- Ensures consistent loading experience across the application

## Technical Implementation

### TanStack Router Integration

The implementation leverages TanStack Router's built-in pending component system:

```tsx
export const Route = createFileRoute('/')({
	component: Index,
	pendingComponent: AuthRouteLoading, // Shows during beforeLoad execution
	beforeLoad: async ({ context, location }) => {
		// Authentication logic here
		const authResult = await attemptAuthenticationWithRefresh(queryClient)
		// ... redirect logic
	},
})
```

### Design System Compliance

**Color Tokens Used:**

- `bg-background` - Main background color
- `text-foreground` - Primary text color
- `text-muted-foreground` - Secondary text color
- `text-primary` - Accent color for icons
- `border-border` - Consistent border styling

**Icons:**

- `Loader2` from Lucide React - Spinning animation
- `Shield` from Lucide React - Security/authentication context

**Animations:**

- `animate-spin` - Smooth rotation for loading spinner
- Respects user motion preferences through CSS

## Usage Examples

### Route-Level Loading

```tsx
import { AuthRouteLoading } from '@/components/auth/auth-route-loading'

export const Route = createFileRoute('/protected')({
	component: ProtectedPage,
	pendingComponent: AuthRouteLoading,
	beforeLoad: async ({ context }) => {
		// Authentication check
	},
})
```

### Component-Level Loading

```tsx
import { AuthLoading, AuthLoadingCompact } from '@/components/auth'

// Full loading state
<AuthLoading message="Verifying credentials..." size="lg" />

// Compact inline loading
<AuthLoadingCompact message="Checking..." />
```

## Benefits

1. **Improved User Experience**

   - No more blank screens during authentication
   - Clear visual feedback about what's happening
   - Consistent loading states across the application

2. **Design System Consistency**

   - Matches existing chat interface patterns
   - Uses semantic color tokens for theme support
   - Consistent with Shadcn/ui design principles

3. **Developer Experience**

   - Reusable components with clear APIs
   - Easy integration with TanStack Router
   - TypeScript support with proper typing

4. **Performance**
   - Lightweight components with minimal overhead
   - Efficient rendering during route transitions
   - Respects user accessibility preferences

## Future Enhancements

- Add skeleton loading variants for specific content types
- Implement progress indicators for longer authentication processes
- Add animation variants for different loading states
- Consider adding sound feedback for accessibility
