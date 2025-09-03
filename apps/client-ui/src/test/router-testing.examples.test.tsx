/**
 * TanStack Router Testing Examples
 *
 * Key examples demonstrating the new simplified router testing approach
 * based on https://dev.to/saltorgil/testing-tanstack-router-4io3
 */

import { screen, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import {
	createAuthenticatedContext,
	createMockRoute,
	createUnauthenticatedContext,
	renderWithRouter,
	routerTestUtils,
} from './router-testing-utils'

// Mock components for testing
const HomePage = () => {
	return (
		<div>
			<h1>Home Page</h1>
			<nav>
				<a href="/about" data-testid="about-link">
					About
				</a>
				<a href="/dashboard" data-testid="dashboard-link">
					Dashboard
				</a>
			</nav>
		</div>
	)
}

const AboutPage = () => {
	return (
		<div>
			<h1>About Page</h1>
			<p>This is the about page</p>
		</div>
	)
}

const UserProfile = ({ userId }: { userId: string }) => {
	return (
		<div>
			<h1>User Profile</h1>
			<p>User ID: {userId}</p>
		</div>
	)
}

const ProtectedPage = () => {
	return (
		<div>
			<h1>Protected Content</h1>
			<p>This page requires authentication</p>
		</div>
	)
}

describe('TanStack Router Testing Examples', () => {
	describe('Basic Component Rendering', () => {
		it('renders a simple component with router context', async () => {
			await renderWithRouter(HomePage, {
				pathPattern: '/home',
				initialEntry: '/home',
			})

			expect(screen.getByText('Home Page')).toBeInTheDocument()
			expect(screen.getByTestId('about-link')).toBeInTheDocument()
		})

		it('renders component at specific route', async () => {
			await renderWithRouter(AboutPage, {
				pathPattern: '/about',
				initialEntry: '/about',
			})

			expect(screen.getByText('About Page')).toBeInTheDocument()
			expect(screen.getByText('This is the about page')).toBeInTheDocument()
		})
	})

	describe('Dynamic Routes', () => {
		it('renders component with route parameters', async () => {
			// Create a component that uses route params
			const UserDetail = () => {
				// In a real test, you'd use useParams hook
				// For this example, we'll pass the userId as a prop
				return <UserProfile userId="123" />
			}

			await renderWithRouter(UserDetail, {
				pathPattern: '/users/$userId',
				initialEntry: '/users/123',
			})

			expect(screen.getByText('User Profile')).toBeInTheDocument()
			expect(screen.getByText('User ID: 123')).toBeInTheDocument()
		})
	})

	describe('Authentication Context', () => {
		it('renders component with authenticated context', async () => {
			await renderWithRouter(ProtectedPage, {
				pathPattern: '/dashboard',
				initialEntry: '/dashboard',
				context: createAuthenticatedContext(),
			})

			expect(screen.getByText('Protected Content')).toBeInTheDocument()
		})

		it('renders component with unauthenticated context', async () => {
			await renderWithRouter(ProtectedPage, {
				pathPattern: '/dashboard',
				initialEntry: '/dashboard',
				context: createUnauthenticatedContext(),
			})

			expect(screen.getByText('Protected Content')).toBeInTheDocument()
		})
	})

	describe('Router Utilities', () => {
		it('can navigate programmatically', async () => {
			const { router } = await renderWithRouter(HomePage, {
				pathPattern: '/home',
				initialEntry: '/home',
			})

			// Navigate to a different route
			// eslint-disable-next-line @typescript-eslint/no-unsafe-argument
			routerTestUtils.navigateTo(router as any, '/about') // eslint-disable-line @typescript-eslint/no-explicit-any

			// Wait for navigation to complete
			await waitFor(() => {
				// eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-explicit-any
				expect(routerTestUtils.getCurrentRoute(router as any).pathname).toBe(
					'/about',
				)
			})
		})

		it('can get current route information', async () => {
			const { router } = await renderWithRouter(AboutPage, {
				pathPattern: '/about',
				initialEntry: '/about',
			})

			// eslint-disable-next-line @typescript-eslint/no-unsafe-argument
			const currentRoute = routerTestUtils.getCurrentRoute(router as any) // eslint-disable-line @typescript-eslint/no-explicit-any
			expect(currentRoute.pathname).toBe('/about')
		})
	})

	describe('Mock Route Creation', () => {
		it('creates mock routes for isolated testing', () => {
			const mockRoute = createMockRoute('/test', () => <div>Test Route</div>)

			expect(mockRoute).toBeDefined()
			// Just verify the route was created successfully
			expect(typeof mockRoute).toBe('object')
		})
	})
})
