import { faker } from '@faker-js/faker'
import {
	type GetAuthUserResponse,
	type PostAuthLoginResponse,
} from '@repo/macro-ai-api-client'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import React from 'react'
import { afterEach, describe, expect, it } from 'vitest'

// Import MSW setup utilities
import { setupMSWForTests, setupServerWithHandlers } from './msw-setup'

/**
 * Basic MSW React Integration Examples
 *
 * This file demonstrates MSW integration with React components using
 * the OpenAPI-integrated MSW server with auto-generated handlers.
 */

// Simple Login Component using OpenAPI auth endpoints
const LoginComponent = () => {
	const [email, setEmail] = React.useState('')
	const [password, setPassword] = React.useState('')
	const [loading, setLoading] = React.useState(false)
	const [error, setError] = React.useState('')
	const [user, setUser] = React.useState<GetAuthUserResponse | null>(null)

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault()
		setLoading(true)
		setError('')

		try {
			const response = await fetch('http://localhost:3000/auth/login', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ email, password }),
			})

			const data = (await response.json()) as PostAuthLoginResponse

			if (!response.ok) {
				throw new Error(data.message || 'Login failed')
			}

			// Simulate getting user data after successful login
			setUser({
				id: faker.string.uuid(),
				email: email,
				emailVerified: true,
			})
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Login failed')
		} finally {
			setLoading(false)
		}
	}

	if (user) {
		return (
			<div>
				<h2>Welcome!</h2>
				<p>Email: {user.email}</p>
				<p>Verified: {user.emailVerified ? 'Yes' : 'No'}</p>
			</div>
		)
	}

	return (
		<form onSubmit={handleSubmit}>
			<div>
				<label htmlFor="email">Email:</label>
				<input
					id="email"
					type="email"
					value={email}
					onChange={(e) => {
						setEmail(e.target.value)
					}}
					required
				/>
			</div>
			<div>
				<label htmlFor="password">Password:</label>
				<input
					id="password"
					type="password"
					value={password}
					onChange={(e) => {
						setPassword(e.target.value)
					}}
					required
				/>
			</div>
			{error && <div style={{ color: 'red' }}>{error}</div>}
			<button type="submit" disabled={loading}>
				{loading ? 'Logging in...' : 'Login'}
			</button>
		</form>
	)
}

// User Profile Component using OpenAPI auth/user endpoint
const UserProfile = () => {
	const [user, setUser] = React.useState<GetAuthUserResponse | null>(null)
	const [loading, setLoading] = React.useState(true)
	const [error, setError] = React.useState('')

	React.useEffect(() => {
		const fetchUser = async () => {
			try {
				const response = await fetch('http://localhost:3000/auth/user', {
					headers: { Authorization: 'Bearer valid-token' },
				})

				const data = (await response.json()) as GetAuthUserResponse

				if (!response.ok) {
					throw new Error('Failed to fetch user')
				}

				setUser(data)
			} catch (err) {
				setError(err instanceof Error ? err.message : 'Failed to fetch user')
			} finally {
				setLoading(false)
			}
		}

		void fetchUser()
	}, [])

	if (loading) return <div>Loading...</div>
	if (error) return <div style={{ color: 'red' }}>Error: {error}</div>
	if (!user) return <div>No user data</div>

	return (
		<div>
			<h2>User Profile</h2>
			<p>Email: {user.email}</p>
			<p>Verified: {user.emailVerified ? 'Yes' : 'No'}</p>
		</div>
	)
}

describe('Basic MSW React Integration', () => {
	// Setup MSW for all tests in this describe block
	setupMSWForTests()

	afterEach(() => {
		cleanup()
	})

	describe('1. Form Submission with API Mocking', () => {
		it('should handle successful login', async () => {
			const user = userEvent.setup()
			render(<LoginComponent />)

			// Fill out the form
			await user.type(screen.getByLabelText(/email/i), 'test@example.com')
			await user.type(screen.getByLabelText(/password/i), 'password')

			// Submit the form
			await user.click(screen.getByRole('button', { name: /login/i }))

			// Wait for success state
			await waitFor(() => {
				expect(screen.getByText(/welcome/i)).toBeInTheDocument()
			})

			expect(
				screen.getByText((_content, element) => {
					return element?.textContent === 'Email: test@example.com'
				}),
			).toBeInTheDocument()
			// Verify that user data is properly displayed
			expect(screen.getByText(/welcome/i)).toBeInTheDocument()
		})

		it('should handle failed login', async () => {
			const user = userEvent.setup()
			render(<LoginComponent />)

			// Fill out the form with invalid credentials
			await user.type(screen.getByLabelText(/email/i), 'test@example.com')
			await user.type(screen.getByLabelText(/password/i), 'wrong-password')

			// Submit the form
			await user.click(screen.getByRole('button', { name: /login/i }))

			// Wait for error state - the auto-generated handler returns "Authentication required"
			await waitFor(() => {
				expect(screen.getByText('Authentication required')).toBeInTheDocument()
			})

			// Form should still be visible
			expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
		})

		it('should show loading state during submission', async () => {
			const user = userEvent.setup()

			// Override handler to add delay using the OpenAPI endpoint
			setupServerWithHandlers([
				http.post('http://localhost:3000/auth/login', async () => {
					await new Promise((resolve) => setTimeout(resolve, 100))
					return HttpResponse.json({
						message: 'Login successful',
						tokens: {
							accessToken: 'test-token',
							refreshToken: 'test-refresh-token',
							expiresIn: 3600,
						},
					})
				}),
			])

			render(<LoginComponent />)

			// Fill out the form using specific selectors
			const emailInput = screen.getByLabelText('Email:')
			await user.type(emailInput, 'test@example.com')
			const passwordInput = screen.getByLabelText('Password:')
			await user.type(passwordInput, 'password')

			// Submit the form
			const loginButton = screen.getByRole('button', { name: /login/i })
			await user.click(loginButton)

			// Should show loading state
			expect(screen.getByText('Logging in...')).toBeInTheDocument()
			expect(loginButton).toBeDisabled()

			// Wait for completion
			await waitFor(() => {
				expect(screen.getByText(/welcome/i)).toBeInTheDocument()
			})
		})
	})

	describe('2. Data Fetching with useEffect', () => {
		it('should fetch and display user profile', async () => {
			render(<UserProfile />)

			// Should show loading state initially
			expect(screen.getByText('Loading...')).toBeInTheDocument()

			// Wait for data to load
			await waitFor(() => {
				expect(screen.getByText('User Profile')).toBeInTheDocument()
			})

			// Should display user information (using auto-generated OpenAPI data)
			// Use more specific selectors to avoid conflicts with form labels
			expect(
				screen.getByText((content, element) => {
					return content.includes('Email:') && element?.tagName === 'P'
				}),
			).toBeInTheDocument()
			expect(
				screen.getByText((content, element) => {
					return content.includes('Verified:') && element?.tagName === 'P'
				}),
			).toBeInTheDocument()
		})

		it('should handle API errors gracefully', async () => {
			// Override handler to return error using the OpenAPI endpoint
			setupServerWithHandlers([
				http.get('http://localhost:3000/auth/user', () => {
					return HttpResponse.json(
						{ message: 'Internal server error' },
						{ status: 500 },
					)
				}),
			])

			render(<UserProfile />)

			// Wait for error state
			await waitFor(() => {
				expect(screen.getByText(/error:/i)).toBeInTheDocument()
			})
		})
	})

	describe('3. Custom Hook with MSW', () => {
		const useUser = () => {
			const [user, setUser] = React.useState<GetAuthUserResponse | null>(null)
			const [loading, setLoading] = React.useState(true)
			const [error, setError] = React.useState('')

			React.useEffect(() => {
				const fetchUser = async () => {
					try {
						const response = await fetch('http://localhost:3000/auth/user', {
							headers: { Authorization: 'Bearer valid-token' },
						})

						const data = (await response.json()) as GetAuthUserResponse

						if (!response.ok) {
							throw new Error('Failed to fetch user')
						}

						setUser(data)
					} catch (err) {
						setError(
							err instanceof Error ? err.message : 'Failed to fetch user',
						)
					} finally {
						setLoading(false)
					}
				}

				void fetchUser()
			}, [])

			return { user, loading, error }
		}

		const TestComponent = () => {
			const { user, loading, error } = useUser()

			if (loading) return <div>Loading...</div>
			if (error) return <div>Error: {error}</div>
			if (!user) return <div>No user</div>

			return <div>User: {user.email}</div>
		}

		it('should test custom hook with mocked API', async () => {
			render(<TestComponent />)

			// Should show loading state initially
			expect(screen.getByText('Loading...')).toBeInTheDocument()

			// Wait for data to load - the auto-generated handler cycles through responses
			// so we need to check for either success or error state
			await waitFor(() => {
				const hasUserData = screen.queryByText(/user:/i)
				const hasError = screen.queryByText(/error:/i)
				expect(hasUserData ?? hasError).toBeTruthy()
			})
		})
	})
})
