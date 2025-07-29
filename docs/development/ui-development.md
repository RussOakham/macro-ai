# UI Development Guidelines

## Current Implementation Status ✅ PRODUCTION-READY

This document provides comprehensive guidelines for UI development in the Macro AI client application. The UI
development system is **fully implemented and production-ready** with React 19, TanStack Router, TanStack Query,
Shadcn/ui components, and modern development tooling.

## UI Architecture Overview

### Core Technology Stack ✅ COMPLETE

- **React 19** - Latest React with React Compiler for automatic optimization
- **TypeScript** - Strict type checking throughout the application
- **TanStack Router** - Type-safe routing with automatic route generation
- **TanStack Query** - Intelligent server state management with caching
- **Shadcn/ui** - Modern component library with Tailwind CSS
- **Vite** - Fast development server and build tool

### Application Structure

```text
apps/client-ui/
├── src/
│   ├── components/          # Reusable UI components
│   │   ├── auth/           # Authentication-specific components
│   │   └── ui/             # Base UI components (Shadcn/ui)
│   ├── features/           # Feature-specific components and logic
│   ├── lib/                # Utility functions and configurations
│   ├── routes/             # TanStack Router route definitions
│   └── main.tsx            # Application entry point
├── components.json         # Shadcn/ui configuration
├── tailwind.config.js      # Tailwind CSS configuration
└── vite.config.ts          # Vite build configuration
```

## Development Setup ✅ COMPLETE

### Core Application Configuration

#### React 19 with React Compiler ✅ COMPLETE

**Main Application Setup** (`main.tsx`):

```typescript
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider, createRouter } from '@tanstack/react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// React Compiler automatically optimizes components
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        // Only retry on 500 errors, max 3 times
        return error.status === 500 && failureCount < 3
      },
      staleTime: 5 * 60 * 1000, // 5 minutes
    },
  },
})

const router = createRouter({
  routeTree,
  context: { queryClient },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>
)
```

#### Vite Configuration ✅ COMPLETE

**Build Configuration** (`vite.config.ts`):

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { TanStackRouterVite } from '@tanstack/router-vite-plugin'
import path from 'path'

export default defineConfig({
	plugins: [
		react({
			babel: {
				plugins: [['babel-plugin-react-compiler', {}]],
			},
		}),
		TanStackRouterVite(),
	],
	resolve: {
		alias: {
			'@': path.resolve(__dirname, './src'),
		},
	},
	server: {
		port: 3000,
	},
})
```

### TypeScript Configuration ✅ COMPLETE

**Strict Type Checking** (`tsconfig.json`):

```json
{
	"compilerOptions": {
		"strict": true,
		"noUncheckedIndexedAccess": true,
		"exactOptionalPropertyTypes": true,
		"baseUrl": ".",
		"paths": {
			"@/*": ["./src/*"]
		}
	}
}
```

## Component Development Guidelines

### Design System Integration ✅ COMPLETE

#### Shadcn/ui Configuration ✅ COMPLETE

**Component Configuration** (`components.json`):

```json
{
	"style": "new-york",
	"rsc": false,
	"tsx": true,
	"tailwind": {
		"config": "tailwind.config.js",
		"css": "src/index.css",
		"baseColor": "zinc",
		"cssVariables": true
	},
	"aliases": {
		"components": "@/components",
		"utils": "@/lib/utils"
	}
}
```

#### Theme System Implementation ✅ COMPLETE

**Theme Provider** (`components/theme-provider.tsx`):

```typescript
import { createContext, useContext, useEffect, useState } from 'react'

type Theme = 'dark' | 'light' | 'system'

const ThemeProviderContext = createContext<{
  theme: Theme
  setTheme: (theme: Theme) => void
}>({
  theme: 'system',
  setTheme: () => null,
})

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() =>
    (localStorage.getItem('ui-theme') as Theme) || 'system'
  )

  useEffect(() => {
    const root = window.document.documentElement
    root.classList.remove('light', 'dark')

    if (theme === 'system') {
      const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light'
      root.classList.add(systemTheme)
    } else {
      root.classList.add(theme)
    }
  }, [theme])

  return (
    <ThemeProviderContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeProviderContext.Provider>
  )
}
```

### Form Development Patterns ✅ COMPLETE

#### React Hook Form Integration ✅ COMPLETE

**Form Component Pattern**:

```typescript
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'

const formSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
})

type FormData = z.infer<typeof formSchema>

export function LoginForm() {
  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  })

  const onSubmit = async (data: FormData) => {
    // Handle form submission
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input placeholder="Enter your email" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        {/* Additional fields */}
      </form>
    </Form>
  )
}
```

#### Custom Input Components ✅ COMPLETE

**Password Input with Toggle**:

```typescript
import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

export function PasswordInput({ ...props }) {
  const [showPassword, setShowPassword] = useState(false)

  return (
    <div className="relative">
      <Input
        type={showPassword ? 'text' : 'password'}
        {...props}
      />
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
        onClick={() => setShowPassword(!showPassword)}
      >
        {showPassword ? (
          <EyeOff className="h-4 w-4" />
        ) : (
          <Eye className="h-4 w-4" />
        )}
      </Button>
    </div>
  )
}
```

## State Management Patterns

### TanStack Query Integration ✅ COMPLETE

#### Query Configuration ✅ COMPLETE

**Custom Hooks Pattern**:

```typescript
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/api'
import { toast } from 'sonner'

// Query hook for user data
export function useGetUser() {
	return useQuery({
		queryKey: ['user'],
		queryFn: () => apiClient.getCurrentUser(),
		staleTime: 5 * 60 * 1000, // 5 minutes
		retry: false, // Don't retry auth failures
	})
}

// Mutation hook for login
export function usePostLoginMutation() {
	const queryClient = useQueryClient()

	return useMutation({
		mutationFn: apiClient.login,
		onSuccess: (data) => {
			// Invalidate and refetch user data
			queryClient.invalidateQueries({ queryKey: ['user'] })
			toast.success('Login successful!')
		},
		onError: (error) => {
			toast.error(error.message || 'Login failed')
		},
	})
}
```

#### Authentication State Management ✅ COMPLETE

**Authentication Hook**:

```typescript
import { useGetUser } from './queries'

export function useIsAuthenticated() {
  const { data: user, isLoading, error } = useGetUser()

  return {
    isAuthenticated: !!user && !error,
    user,
    isLoading,
  }
}

// Usage in components
export function Navigation() {
  const { isAuthenticated, user, isLoading } = useIsAuthenticated()

  if (isLoading) return <NavigationSkeleton />

  return (
    <nav>
      {isAuthenticated ? (
        <UserMenu user={user} />
      ) : (
        <AuthButtons />
      )}
    </nav>
  )
}
```

### Error Handling Patterns ✅ COMPLETE

#### Error Standardization ✅ COMPLETE

**Error Utility**:

```typescript
export function standardizeError(error: unknown): {
	message: string
	status?: number
} {
	if (error instanceof Error) {
		return { message: error.message }
	}

	if (typeof error === 'object' && error !== null && 'message' in error) {
		return {
			message: String(error.message),
			status: 'status' in error ? Number(error.status) : undefined,
		}
	}

	return { message: 'An unexpected error occurred' }
}
```

#### Error Boundaries ✅ COMPLETE

**Component Error Boundary**:

```typescript
import { Component, ErrorInfo, ReactNode } from 'react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Error boundary caught an error:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="p-4 text-center">
          <h2>Something went wrong</h2>
          <button onClick={() => this.setState({ hasError: false })}>
            Try again
          </button>
        </div>
      )
    }

    return this.props.children
  }
}
```

## Routing and Navigation

### TanStack Router Configuration ✅ COMPLETE

#### Route Definition Pattern ✅ COMPLETE

**Route File Structure**:

```typescript
// routes/__root.tsx
import { createRootRoute, Outlet } from '@tanstack/react-router'
import { QueryClient } from '@tanstack/react-query'

interface RouterContext {
  queryClient: QueryClient
}

export const Route = createRootRoute<RouterContext>()({
  component: () => (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-8">
        <Outlet />
      </main>
      <Footer />
    </div>
  ),
})

// routes/login.tsx
import { createFileRoute, redirect } from '@tanstack/react-router'
import { LoginForm } from '@/components/auth/login-form'

export const Route = createFileRoute('/login')({
  beforeLoad: ({ context }) => {
    // Redirect if already authenticated
    const user = context.queryClient.getQueryData(['user'])
    if (user) {
      throw redirect({ to: '/dashboard' })
    }
  },
  component: LoginPage,
})

function LoginPage() {
  return (
    <div className="max-w-md mx-auto">
      <h1 className="text-2xl font-bold mb-6">Sign In</h1>
      <LoginForm />
    </div>
  )
}
```

#### Navigation Components ✅ COMPLETE

**Navigation with Authentication State**:

```typescript
import { Link } from '@tanstack/react-router'
import { useIsAuthenticated } from '@/hooks/auth'
import { Button } from '@/components/ui/button'

export function Navigation() {
  const { isAuthenticated, user } = useIsAuthenticated()

  return (
    <nav className="flex items-center justify-between p-4">
      <Link to="/" className="text-xl font-bold">
        Macro AI
      </Link>

      <div className="flex items-center gap-4">
        {isAuthenticated ? (
          <>
            <Link to="/dashboard">
              <Button variant="ghost">Dashboard</Button>
            </Link>
            <UserMenu user={user} />
          </>
        ) : (
          <>
            <Link to="/login">
              <Button variant="ghost">Sign In</Button>
            </Link>
            <Link to="/register">
              <Button>Sign Up</Button>
            </Link>
          </>
        )}
      </div>
    </nav>
  )
}
```

## Development Tools and Debugging

### Developer Experience ✅ COMPLETE

#### Development Tools Configuration ✅ COMPLETE

**Router and Query Devtools**:

```typescript
import { TanStackRouterDevtools } from '@tanstack/router-devtools'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'

export function App() {
  return (
    <>
      <RouterProvider router={router} />
      {process.env.NODE_ENV === 'development' && (
        <>
          <TanStackRouterDevtools router={router} />
          <ReactQueryDevtools initialIsOpen={false} />
        </>
      )}
    </>
  )
}
```

#### Code Quality Tools ✅ COMPLETE

**ESLint Configuration** (`.eslintrc.js`):

```javascript
module.exports = {
	extends: ['@repo/eslint-config/react-internal.js'],
	rules: {
		// React 19 specific rules
		'react/react-in-jsx-scope': 'off',
		'react-hooks/exhaustive-deps': 'warn',
	},
}
```

## Best Practices

### Component Development

1. **Use TypeScript Strictly** - Enable all strict mode options
2. **Follow Composition Patterns** - Prefer composition over inheritance
3. **Implement Proper Error Boundaries** - Wrap components that might fail
4. **Use Semantic HTML** - Ensure accessibility with proper HTML elements
5. **Implement Loading States** - Provide feedback during async operations

### State Management

1. **Colocate State** - Keep state close to where it's used
2. **Use TanStack Query for Server State** - Don't duplicate server state in local state
3. **Implement Optimistic Updates** - Provide immediate feedback for user actions
4. **Handle Error States** - Always handle and display errors appropriately
5. **Cache Strategically** - Use appropriate cache times for different data types

### Performance

1. **Use React Compiler** - Let React Compiler handle optimizations automatically
2. **Implement Code Splitting** - Split routes and heavy components
3. **Optimize Images** - Use appropriate formats and lazy loading
4. **Monitor Bundle Size** - Keep bundle sizes reasonable
5. **Profile Performance** - Use React DevTools Profiler for optimization

### Accessibility

1. **Use Semantic HTML** - Proper heading hierarchy and landmarks
2. **Implement ARIA Attributes** - When semantic HTML isn't sufficient
3. **Ensure Keyboard Navigation** - All interactive elements must be keyboard accessible
4. **Provide Focus Management** - Proper focus handling for dynamic content
5. **Test with Screen Readers** - Verify accessibility with assistive technology

## Testing Strategies

### Component Testing

```typescript
import { render, screen, fireEvent } from '@testing-library/react'
import { LoginForm } from '@/components/auth/login-form'

describe('LoginForm', () => {
  it('should validate email format', async () => {
    render(<LoginForm />)

    const emailInput = screen.getByLabelText(/email/i)
    const submitButton = screen.getByRole('button', { name: /sign in/i })

    fireEvent.change(emailInput, { target: { value: 'invalid-email' } })
    fireEvent.click(submitButton)

    expect(await screen.findByText(/please enter a valid email/i)).toBeInTheDocument()
  })
})
```

### Integration Testing

```typescript
import { renderWithProviders } from '@/test-utils'
import { App } from '@/App'

describe('Authentication Flow', () => {
  it('should redirect to dashboard after login', async () => {
    const { user } = renderWithProviders(<App />)

    // Navigate to login
    await user.click(screen.getByText(/sign in/i))

    // Fill and submit form
    await user.type(screen.getByLabelText(/email/i), 'user@example.com')
    await user.type(screen.getByLabelText(/password/i), 'password123')
    await user.click(screen.getByRole('button', { name: /sign in/i }))

    // Verify redirect
    expect(await screen.findByText(/dashboard/i)).toBeInTheDocument()
  })
})
```

## Related Documentation

- **[Profile Management](../features/user-management/profile-management.md)** - User-facing profile features
- **[Authentication System](../features/authentication/README.md)** - Authentication implementation
- **[API Client](../features/api-client/README.md)** - API integration patterns
- **[Testing Strategy](./testing-strategy.md)** - Comprehensive testing guidelines
