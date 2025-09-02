import React from 'react'
import { faker } from '@faker-js/faker'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

/**
 * Basic MSW React Integration Examples
 *
 * This file demonstrates MSW integration with React components
 */

// Create a simple server for this test
const server = setupServer(
	http.get('http://localhost:3000/api/user', ({ request }) => {
		const authHeader = request.headers.get('Authorization')

		if (authHeader === 'Bearer valid-token') {
			return HttpResponse.json({
				success: true,
				data: {
					id: faker.string.uuid(),
					email: faker.internet.email(),
					name: faker.person.fullName(),
					avatar: faker.image.avatar(),
					createdAt: faker.date.past().toISOString(),
					lastLoginAt: faker.date.recent().toISOString(),
				},
			})
		}

		return HttpResponse.json(
			{ success: false, error: { message: 'Unauthorized' } },
			{ status: 401 },
		)
	}),

	http.post('http://localhost:3000/api/login', async ({ request }) => {
		const body = (await request.json()) as { email: string; password: string }

		if (body.email === 'test@example.com' && body.password === 'password') {
			return HttpResponse.json({
				success: true,
				data: {
					user: {
						id: faker.string.uuid(),
						email: body.email,
						name: faker.person.fullName(),
						avatar: faker.image.avatar(),
						createdAt: faker.date.past().toISOString(),
					},
					token: faker.string.alphanumeric(64),
				},
			})
		}

		return HttpResponse.json(
			{ success: false, error: { message: 'Invalid credentials' } },
			{ status: 401 },
		)
	}),
)

// Types for our mock data
interface User {
	id: string
	email: string
	name: string
	avatar?: string
	createdAt: string
	lastLoginAt?: string
}

// Simple Login Component
const LoginComponent = () => {
	const [email, setEmail] = React.useState('')
	const [password, setPassword] = React.useState('')
	const [loading, setLoading] = React.useState(false)
	const [error, setError] = React.useState('')
	const [user, setUser] = React.useState<User | null>(null)

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault()
		setLoading(true)
		setError('')

		try {
			const response = await fetch('http://localhost:3000/api/login', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ email, password }),
			})

			const data = (await response.json()) as {
				success: boolean
				data?: { user: User }
				error?: { message: string }
			}

			if (!response.ok) {
				throw new Error(data.error?.message ?? 'Login failed')
			}

			if (data.data?.user) {
				setUser(data.data.user)
			}
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Login failed')
		} finally {
			setLoading(false)
		}
	}

	if (user) {
		return (
			<div>
				<h2>Welcome, {user.name}!</h2>
				<p>Email: {user.email}</p>
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

// User Profile Component
const UserProfile = () => {
	const [user, setUser] = React.useState<User | null>(null)
	const [loading, setLoading] = React.useState(true)
	const [error, setError] = React.useState('')

	React.useEffect(() => {
		const fetchUser = async () => {
			try {
				const response = await fetch('http://localhost:3000/api/user', {
					headers: { Authorization: 'Bearer valid-token' },
				})

				const data = (await response.json()) as {
					success: boolean
					data?: User
					error?: { message: string }
				}

				if (!response.ok) {
					throw new Error(data.error?.message ?? 'Failed to fetch user')
				}

				setUser(data.data ?? null)
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
			<p>Name: {user.name}</p>
			<p>Email: {user.email}</p>
		</div>
	)
}

describe('Basic MSW React Integration', () => {
	beforeEach(() => {
		server.listen({ onUnhandledRequest: 'warn' })
	})

	afterEach(() => {
		server.resetHandlers()
		server.close()
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

			// Wait for error state
			await waitFor(() => {
				expect(screen.getByText('Invalid credentials')).toBeInTheDocument()
			})

			// Form should still be visible
			expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
		})

		it('should show loading state during submission', async () => {
			const user = userEvent.setup()

			// Override handler to add delay
			server.use(
				http.post('http://localhost:3000/api/login', async () => {
					await new Promise((resolve) => setTimeout(resolve, 100))
					return HttpResponse.json({
						success: true,
						data: { user: { name: 'Test User', email: 'test@example.com' } },
					})
				}),
			)

			render(<LoginComponent />)

			// Fill out the form
			await user.type(screen.getByLabelText(/email/i), 'test@example.com')
			await user.type(screen.getByLabelText(/password/i), 'password')

			// Submit the form
			await user.click(screen.getByRole('button', { name: /login/i }))

			// Should show loading state
			expect(screen.getByText('Logging in...')).toBeInTheDocument()
			expect(screen.getByRole('button')).toBeDisabled()

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

			// Should display user information (using dynamic Faker data)
			expect(screen.getByText(/name:/i)).toBeInTheDocument()
			expect(screen.getByText(/email:/i)).toBeInTheDocument()
		})

		it('should handle API errors gracefully', async () => {
			// Override handler to return error
			server.use(
				http.get('http://localhost:3000/api/user', () => {
					return HttpResponse.json(
						{ success: false, error: { message: 'Network error' } },
						{ status: 500 },
					)
				}),
			)

			render(<UserProfile />)

			// Wait for error state
			await waitFor(() => {
				expect(screen.getByText('Error: Network error')).toBeInTheDocument()
			})
		})
	})

	describe('3. Custom Hook with MSW', () => {
		const useUser = () => {
			const [user, setUser] = React.useState<User | null>(null)
			const [loading, setLoading] = React.useState(true)
			const [error, setError] = React.useState('')

			React.useEffect(() => {
				const fetchUser = async () => {
					try {
						const response = await fetch('http://localhost:3000/api/user', {
							headers: { Authorization: 'Bearer valid-token' },
						})

						const data = (await response.json()) as {
							success: boolean
							data?: User
							error?: { message: string }
						}

						if (!response.ok) {
							throw new Error(data.error?.message ?? 'Failed to fetch user')
						}

						setUser(data.data ?? null)
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

			return <div>User: {user.name}</div>
		}

		it('should test custom hook with mocked API', async () => {
			render(<TestComponent />)

			// Should show loading state initially
			expect(screen.getByText('Loading...')).toBeInTheDocument()

			// Wait for data to load
			await waitFor(() => {
				expect(screen.getByText(/user:/i)).toBeInTheDocument()
			})
		})
	})
})
