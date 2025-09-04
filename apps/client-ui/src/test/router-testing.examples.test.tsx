/**
 * TanStack Router Testing Examples
 *
 * Key examples demonstrating the new simplified router testing approach
 * based on https://dev.to/saltorgil/testing-tanstack-router-4io3
 */

import React from 'react'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { componentTesting, formTesting } from './component-test-utils'
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
				uniqueId: 'basic-routing',
			})

			expect(screen.getByText('Home Page')).toBeInTheDocument()
			expect(screen.getByTestId('about-link')).toBeInTheDocument()
		})

		it('renders component at specific route', async () => {
			await renderWithRouter(AboutPage, {
				pathPattern: '/about',
				uniqueId: 'specific-route',
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
				uniqueId: 'dynamic-routes',
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
				uniqueId: 'authenticated-context',
			})

			expect(screen.getByText('Protected Content')).toBeInTheDocument()
		})

		it('renders component with unauthenticated context', async () => {
			await renderWithRouter(ProtectedPage, {
				pathPattern: '/dashboard',
				initialEntry: '/dashboard',
				uniqueId: 'unauthenticated-context',
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
				uniqueId: 'router-navigation',
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
				uniqueId: 'current-route-info',
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

	describe('Enhanced Component Testing with New Utilities', () => {
		it('should test component rendering with enhanced utilities', async () => {
			const EnhancedHomePage = () => {
				const [count, setCount] = React.useState(0)

				return (
					<div data-testid="enhanced-home">
						<h1>Enhanced Home Page</h1>
						<div data-testid="counter">{count}</div>
						<button
							data-testid="increment-btn"
							onClick={() => {
								setCount((c) => c + 1)
							}}
						>
							Increment
						</button>
						<form data-testid="user-form">
							<input name="name" type="text" placeholder="Name" />
							<input name="email" type="email" placeholder="Email" />
							<button type="submit">Save User</button>
						</form>
					</div>
				)
			}

			await renderWithRouter(EnhancedHomePage, {
				pathPattern: '/enhanced-home',
				initialEntry: '/enhanced-home',
				uniqueId: 'enhanced-home',
			})

			// Use enhanced component testing utilities
			expect(
				componentTesting.getElementByTestId('enhanced-home'),
			).toBeInTheDocument()
			expect(componentTesting.getElementByTestId('counter')).toHaveTextContent(
				'0',
			)
			expect(
				componentTesting.getElementByTestId('increment-btn'),
			).toBeInTheDocument()
		})

		it('should test component interactions with enhanced utilities', async () => {
			const InteractivePage = () => {
				const [count, setCount] = React.useState(0)
				const [message, setMessage] = React.useState('')

				return (
					<div data-testid="interactive-page">
						<div data-testid="count-display">{count}</div>
						<div data-testid="message-display">{message}</div>
						<button
							data-testid="increment"
							onClick={() => {
								setCount((c) => c + 1)
							}}
						>
							+
						</button>
						<button
							data-testid="decrement"
							onClick={() => {
								setCount((c) => c - 1)
							}}
						>
							-
						</button>
						<button
							data-testid="set-message"
							onClick={() => {
								setMessage('Hello World!')
							}}
						>
							Set Message
						</button>
					</div>
				)
			}

			await renderWithRouter(InteractivePage, {
				pathPattern: '/interactive',
				initialEntry: '/interactive',
				uniqueId: 'interactive-page',
			})

			// Test initial state
			componentTesting.assertElementText('count-display', '0')
			componentTesting.assertElementText('message-display', '')

			// Test interactions
			await componentTesting.clickElement('increment')
			componentTesting.assertElementText('count-display', '1')

			await componentTesting.clickElement('increment')
			componentTesting.assertElementText('count-display', '2')

			await componentTesting.clickElement('decrement')
			componentTesting.assertElementText('count-display', '1')

			await componentTesting.clickElement('set-message')
			componentTesting.assertElementText('message-display', 'Hello World!')
		})

		it('should test form interactions with enhanced utilities', async () => {
			const FormPage = () => {
				const [formData, setFormData] = React.useState({
					name: '',
					email: '',
					country: '',
					bio: '',
					newsletter: false,
					gender: '',
				})

				const handleSubmit = (e: React.FormEvent) => {
					e.preventDefault()
					// Form submission logic would go here
				}

				return (
					<div data-testid="form-page">
						<h1>User Registration</h1>
						<form data-testid="registration-form" onSubmit={handleSubmit}>
							<input
								name="name"
								type="text"
								value={formData.name}
								onChange={(e) => {
									setFormData((prev) => ({ ...prev, name: e.target.value }))
								}}
								placeholder="Full Name"
							/>
							<input
								name="email"
								type="email"
								value={formData.email}
								onChange={(e) => {
									setFormData((prev) => ({ ...prev, email: e.target.value }))
								}}
								placeholder="Email"
							/>
							<select
								name="country"
								value={formData.country}
								onChange={(e) => {
									setFormData((prev) => ({ ...prev, country: e.target.value }))
								}}
							>
								<option value="">Select Country</option>
								<option value="us">United States</option>
								<option value="uk">United Kingdom</option>
								<option value="ca">Canada</option>
							</select>
							<textarea
								name="bio"
								value={formData.bio}
								onChange={(e) => {
									setFormData((prev) => ({ ...prev, bio: e.target.value }))
								}}
								placeholder="Tell us about yourself"
							/>
							<label>
								<input
									name="newsletter"
									type="checkbox"
									checked={formData.newsletter}
									onChange={(e) => {
										setFormData((prev) => ({
											...prev,
											newsletter: e.target.checked,
										}))
									}}
								/>
								Subscribe to newsletter
							</label>
							<div>
								<label>
									<input
										name="gender"
										type="radio"
										value="male"
										checked={formData.gender === 'male'}
										onChange={(e) => {
											setFormData((prev) => ({
												...prev,
												gender: e.target.value,
											}))
										}}
									/>
									Male
								</label>
								<label>
									<input
										name="gender"
										type="radio"
										value="female"
										checked={formData.gender === 'female'}
										onChange={(e) => {
											setFormData((prev) => ({
												...prev,
												gender: e.target.value,
											}))
										}}
									/>
									Female
								</label>
							</div>
							<button type="submit">Register</button>
						</form>
					</div>
				)
			}

			const { renderResult } = await renderWithRouter(FormPage, {
				pathPattern: '/register',
				initialEntry: '/register',
				uniqueId: 'form-page',
			})

			// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
			const form = renderResult.container.querySelector('form')!

			// Test comprehensive form filling with new utilities
			await formTesting.fillTextInputs(form, {
				name: 'John Doe',
				email: 'john@example.com',
			})

			await formTesting.fillSelectFields(form, {
				country: 'us',
			})

			await formTesting.fillTextareaFields(form, {
				bio: 'I am a software developer with 5 years of experience.',
			})

			await formTesting.toggleCheckboxes(form, {
				newsletter: true,
			})

			await formTesting.selectRadioButtons(form, {
				gender: 'male',
			})

			// Validate all form fields
			formTesting.validateTextInputs(form, {
				name: 'John Doe',
				email: 'john@example.com',
			})

			formTesting.validateSelectFields(form, {
				country: 'us',
			})

			formTesting.validateTextareaFields(form, {
				bio: 'I am a software developer with 5 years of experience.',
			})

			formTesting.validateCheckboxes(form, {
				newsletter: true,
			})

			formTesting.validateRadioButtons(form, {
				gender: 'male',
			})

			// Test form submission
			await formTesting.submitForm(form)
		})

		it('should test component state management with enhanced utilities', async () => {
			const StatefulPage = () => {
				const [items, setItems] = React.useState<string[]>([])
				const [newItem, setNewItem] = React.useState('')

				const addItem = () => {
					if (newItem.trim()) {
						setItems((prev) => [...prev, newItem.trim()])
						setNewItem('')
					}
				}

				const removeItem = (index: number) => {
					setItems((prev) => prev.filter((_, i) => i !== index))
				}

				return (
					<div data-testid="stateful-page">
						<h1>Item Manager</h1>
						<div data-testid="item-count">Items: {items.length}</div>
						<form data-testid="add-item-form">
							<input
								name="newItem"
								type="text"
								value={newItem}
								onChange={(e) => {
									setNewItem(e.target.value)
								}}
								placeholder="Add new item"
							/>
							<button type="button" onClick={addItem}>
								Add Item
							</button>
						</form>
						<ul data-testid="item-list">
							{items.map((item, index) => (
								<li key={index} data-testid={`item-${index.toString()}`}>
									{item}
									<button
										data-testid={`remove-${index.toString()}`}
										onClick={() => {
											removeItem(index)
										}}
									>
										Remove
									</button>
								</li>
							))}
						</ul>
					</div>
				)
			}

			const { renderResult } = await renderWithRouter(StatefulPage, {
				pathPattern: '/items',
				initialEntry: '/items',
				uniqueId: 'stateful-page',
			})

			// Test initial state
			componentTesting.assertElementText('item-count', 'Items: 0')
			componentTesting.assertElementNotExists('item-0')

			// Add items using form utilities
			// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
			const form = renderResult.container.querySelector('form')!
			await formTesting.fillTextInputs(form, { newItem: 'First Item' })
			// Click the add button within the form
			const addButton = renderResult.container.querySelector(
				'[data-testid="add-item-form"] button',
			)
			expect(addButton).toBeInTheDocument()
			// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
			fireEvent.click(addButton!)

			// Verify item was added
			componentTesting.assertElementText('item-count', 'Items: 1')
			componentTesting.assertElementText('item-0', 'First Item')

			// Add another item
			await formTesting.fillTextInputs(form, { newItem: 'Second Item' })
			// Click the add button within the form
			const addButton2 = renderResult.container.querySelector(
				'[data-testid="add-item-form"] button',
			)
			expect(addButton2).toBeInTheDocument()
			// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
			fireEvent.click(addButton2!)

			// Verify both items exist
			componentTesting.assertElementText('item-count', 'Items: 2')
			componentTesting.assertElementText('item-0', 'First Item')
			componentTesting.assertElementText('item-1', 'Second Item')

			// Remove first item
			await componentTesting.clickElement('remove-0')

			// Verify item was removed and second item moved to index 0
			componentTesting.assertElementText('item-count', 'Items: 1')
			componentTesting.assertElementText('item-0', 'Second Item') // Second item moved to index 0
			componentTesting.assertElementNotExists('item-1') // Original second item index no longer exists
		})
	})
})
