/**
 * TanStack Router Testing Utilities
 *
 * Based on the approach from https://dev.to/saltorgil/testing-tanstack-router-4io3
 * Provides utilities for testing route components with a minimal router setup.
 */

import {
	type AnyRoute,
	createMemoryHistory,
	createRootRoute,
	createRoute,
	createRouter,
	Outlet,
	type Router,
	RouterProvider,
} from '@tanstack/react-router'
import { render, RenderOptions, RenderResult } from '@testing-library/react'
import React from 'react'

// Mock types for testing
interface MockAuthContext {
	auth: {
		user: {
			id: string
			email: string
			name: string
		} | null
		isAuthenticated: boolean
	}
}

type MockRouterContext = MockAuthContext & Record<string, unknown>

/**
 * Renders a component under a minimal TanStack Router instance with memory history.
 * Based on the approach from https://dev.to/saltorgil/testing-tanstack-router-4io3
 *
 * @param Component - The React component to mount
 * @param options - Render options including path pattern and initial entry
 * @returns Object with router instance and render result
 */

export const renderWithRouter = async (
	Component: React.ComponentType,
	options: {
		pathPattern: string
		initialEntry?: string
		context?: MockRouterContext
		renderOptions?: RenderOptions
		uniqueId?: string
	} = { pathPattern: '/' },
): Promise<{ router: Router<AnyRoute>; renderResult: RenderResult }> => {
	const {
		pathPattern,
		initialEntry = pathPattern,
		context = mockUnauthenticatedContext,
		renderOptions,
		uniqueId,
	} = options

	// Root route with minimal Outlet for rendering child routes
	const rootRoute = createRootRoute({
		component: () => (
			<>
				<div data-testid={`root-layout${uniqueId ? `-${uniqueId}` : ''}`} />
				<Outlet />
			</>
		),
	})

	// Index route so '/' always matches
	const indexRoute = createRoute({
		getParentRoute: () => rootRoute,
		path: '/',
		component: () => <div>Index</div>,
	})

	// Test route mounting the Component at the dynamic path
	const testRoute = createRoute({
		getParentRoute: () => rootRoute,
		path: pathPattern,
		// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
		component: Component as any, // eslint-disable-line @typescript-eslint/no-explicit-any
	})

	// Create the router instance with memory history
	const router = createRouter({
		routeTree: rootRoute.addChildren([indexRoute, testRoute]),
		history: createMemoryHistory({ initialEntries: [initialEntry] }),
		defaultPendingMinMs: 0,
		context,
	})

	// Render and wait for the route to resolve and the component to mount
	const renderResult = render(<RouterProvider router={router} />, renderOptions)

	// Wait for router hydration
	await renderResult.findByTestId(
		`root-layout${uniqueId ? `-${uniqueId}` : ''}`,
	)

	return { router, renderResult }
}

/**
 * Legacy render function for backward compatibility
 * @param _ui
 * @param options
 * @param options.initialLocation
 * @param options.routerContext
 * @param options.useGeneratedRoutes
 * @param options.customRoutes
 * @param options.renderOptions
 * @deprecated Use the new renderWithRouter function instead
 */
export const renderWithRouterLegacy = async (
	_ui: React.ReactElement,
	options: {
		initialLocation?: string
		routerContext?: MockRouterContext
		useGeneratedRoutes?: boolean
		customRoutes?: AnyRoute[]
		renderOptions?: RenderOptions
	} = {},
): Promise<{ router: unknown; renderResult: RenderResult }> => {
	const {
		initialLocation = '/',
		routerContext = mockUnauthenticatedContext,
		renderOptions,
	} = options

	// Use the new approach with a simple component
	return renderWithRouter(() => <div>Test Component</div>, {
		pathPattern: initialLocation,
		initialEntry: initialLocation,
		context: routerContext,
		renderOptions,
	})
}

/**
 * Create mock route for isolated testing
 * @param path
 * @param component
 * @param options
 */
export const createMockRoute = (
	path: string,
	component: React.ComponentType,
	options: Record<string, any> = {}, // eslint-disable-line @typescript-eslint/no-explicit-any
): AnyRoute => {
	// eslint-disable-next-line @typescript-eslint/no-unsafe-argument
	return createRoute({
		getParentRoute: () => createRootRoute(),
		path,
		// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
		component: component as any, // eslint-disable-line @typescript-eslint/no-explicit-any
		...options,
	} as any) // eslint-disable-line @typescript-eslint/no-explicit-any
}

/**
 * Common test components for router testing
 * @param root0
 * @param root0.title
 */
export const TestComponent = ({ title = 'Test' }: { title?: string }) => {
	return <div data-testid="test-component">{title}</div>
}

export const LoadingComponent = () => {
	return <div data-testid="loading">Loading...</div>
}

export const ErrorComponent = ({ error }: { error: Error }) => {
	return <div data-testid="error">Error: {error.message}</div>
}

/**
 * Mock authentication context for testing
 */
export const mockAuthContext = {
	auth: {
		user: {
			id: 'test-user-id',
			email: 'test@example.com',
			name: 'Test User',
		},
		isAuthenticated: true,
	},
}

export const mockUnauthenticatedContext = {
	auth: {
		user: null,
		isAuthenticated: false,
	},
}

/**
 * Helper to create authenticated router context for testing
 * @param user
 */
export const createAuthenticatedContext = (
	user = mockAuthContext.auth.user,
): MockRouterContext => ({
	auth: {
		user,
		isAuthenticated: true,
	},
})

/**
 * Helper to create unauthenticated router context for testing
 */
export const createUnauthenticatedContext = (): MockRouterContext =>
	mockUnauthenticatedContext

/**
 * Test utilities for common router scenarios
 */
export const routerTestUtils = {
	/**
	 * Navigate to a route programmatically
	 * @param router
	 * @param to
	 * @param search
	 */
	navigateTo: (
		router: ReturnType<typeof createRouter>,
		to: string,
		search?: Record<string, unknown>,
	): void => {
		void router.navigate({ to, search })
	},

	/**
	 * Get current route information
	 * @param router
	 */
	getCurrentRoute: (router: ReturnType<typeof createRouter>) => ({
		pathname: router.state.location.pathname,
		// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
		search: router.state.location.search,
		// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
		params: (router.state.location as any).params as Record<string, string>, // eslint-disable-line @typescript-eslint/no-explicit-any
	}),

	/**
	 * Mock route loader data
	 * @param _router
	 * @param routeId
	 * @param data
	 */
	mockLoaderData: (
		_router: ReturnType<typeof createRouter>,
		routeId: string,
		data: unknown,
	): void => {
		// Placeholder: if TanStack Router exposes a way to inject loader data,
		// this can be strongly typed later.
		console.warn(`mockLoaderData not implemented yet for ${routeId}`, data)
	},
}
