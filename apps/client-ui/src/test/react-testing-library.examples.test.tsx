import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { Button } from '@/components/ui/button'

import {
	createNetworkErrorScenarios,
	createTrackingMockApiClient,
	testErrorHandling,
} from './api-test-utils'
import { formTesting } from './component-test-utils'
import { setupMSWForTests, setupServerWithHandlers } from './msw-setup'

/**
 * Comprehensive React Testing Library Examples
 *
 * This file demonstrates best practices for testing React components
 * using @testing-library/react and @testing-library/user-event
 */

describe('React Testing Library Examples', () => {
	// Setup MSW for all tests in this describe block
	setupMSWForTests()

	beforeEach(() => {
		vi.clearAllMocks()
	})

	describe('1. Basic Component Rendering', () => {
		it('should render button with default props', () => {
			render(<Button>Click me</Button>)

			const button = screen.getByRole('button', { name: /click me/i })
			expect(button).toBeInTheDocument()
			expect(button).toHaveClass('bg-primary')
		})

		it('should render button with custom variant', () => {
			render(<Button variant="destructive">Delete</Button>)

			const button = screen.getByRole('button', { name: /delete/i })
			expect(button).toHaveClass('bg-destructive')
		})

		it('should render button with different sizes', () => {
			const { rerender } = render(<Button size="sm">Small</Button>)
			expect(screen.getByRole('button')).toHaveClass('h-8')

			rerender(<Button size="lg">Large</Button>)
			expect(screen.getByRole('button')).toHaveClass('h-10')
		})
	})

	describe('2. User Interactions', () => {
		it('should handle button click events', async () => {
			const handleClick = vi.fn()
			const user = userEvent.setup()

			render(<Button onClick={handleClick}>Click me</Button>)

			const button = screen.getByRole('button', { name: /click me/i })
			await user.click(button)

			expect(handleClick).toHaveBeenCalledTimes(1)
		})

		it('should handle keyboard interactions', async () => {
			const handleClick = vi.fn()
			const user = userEvent.setup()

			render(<Button onClick={handleClick}>Click me</Button>)

			const button = screen.getByRole('button', { name: /click me/i })
			button.focus()
			await user.keyboard('{Enter}')

			expect(handleClick).toHaveBeenCalledTimes(1)
		})

		it('should handle disabled state', async () => {
			const handleClick = vi.fn()
			const user = userEvent.setup()

			render(
				<Button onClick={handleClick} disabled>
					Disabled
				</Button>,
			)

			const button = screen.getByRole('button', { name: /disabled/i })
			expect(button).toBeDisabled()

			await user.click(button)
			expect(handleClick).not.toHaveBeenCalled()
		})
	})

	describe('3. Enhanced Form Testing with New Utilities', () => {
		it('should render a comprehensive form component', () => {
			const ComprehensiveForm = () => (
				<form data-testid="test-form">
					<div>
						<label htmlFor="email">Email</label>
						<input id="email" name="email" type="email" />
					</div>
					<div>
						<label htmlFor="name">Name</label>
						<input id="name" name="name" type="text" />
					</div>
					<div>
						<label htmlFor="country">Country</label>
						<select id="country" name="country">
							<option value="">Select a country</option>
							<option value="us">United States</option>
							<option value="uk">United Kingdom</option>
						</select>
					</div>
					<div>
						<label htmlFor="bio">Bio</label>
						<textarea id="bio" name="bio" />
					</div>
					<div>
						<label>
							<input name="newsletter" type="checkbox" />
							Subscribe to newsletter
						</label>
					</div>
					<div>
						<label>
							<input name="gender" type="radio" value="male" />
							Male
						</label>
						<label>
							<input name="gender" type="radio" value="female" />
							Female
						</label>
					</div>
					<Button type="submit">Submit</Button>
				</form>
			)

			render(<ComprehensiveForm />)

			expect(screen.getByTestId('test-form')).toBeInTheDocument()
			expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
			expect(screen.getByLabelText(/name/i)).toBeInTheDocument()
			expect(screen.getByLabelText(/country/i)).toBeInTheDocument()
			expect(screen.getByLabelText(/bio/i)).toBeInTheDocument()
			expect(
				screen.getByRole('button', { name: /submit/i }),
			).toBeInTheDocument()
		})

		it('should fill and validate text inputs using new utilities', async () => {
			const FormWithTextInputs = () => {
				const [formData, setFormData] = React.useState({
					email: '',
					name: '',
				})

				return (
					<form data-testid="text-form">
						<input
							name="email"
							type="email"
							value={formData.email}
							onChange={(e) => {
								setFormData((prev) => ({ ...prev, email: e.target.value }))
							}}
						/>
						<input
							name="name"
							type="text"
							value={formData.name}
							onChange={(e) => {
								setFormData((prev) => ({ ...prev, name: e.target.value }))
							}}
						/>
					</form>
				)
			}

			const { container } = render(<FormWithTextInputs />)
			// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
			const form = container.querySelector('form')!

			// Use new form testing utilities
			await formTesting.fillTextInputs(form, {
				email: 'test@example.com',
				name: 'John Doe',
			})

			// Validate using new utilities
			formTesting.validateTextInputs(form, {
				email: 'test@example.com',
				name: 'John Doe',
			})
		})

		it('should handle select dropdowns using new utilities', async () => {
			const FormWithSelect = () => {
				const [country, setCountry] = React.useState('')

				return (
					<form data-testid="select-form">
						<select
							name="country"
							value={country}
							onChange={(e) => {
								setCountry(e.target.value)
							}}
						>
							<option value="">Select a country</option>
							<option value="us">United States</option>
							<option value="uk">United Kingdom</option>
							<option value="ca">Canada</option>
						</select>
					</form>
				)
			}

			const { container } = render(<FormWithSelect />)
			// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
			const form = container.querySelector('form')!

			// Use new select testing utilities
			await formTesting.fillSelectFields(form, {
				country: 'us',
			})

			// Validate using new utilities
			formTesting.validateSelectFields(form, {
				country: 'us',
			})
		})

		it('should handle textarea fields using new utilities', async () => {
			const FormWithTextarea = () => {
				const [bio, setBio] = React.useState('')

				return (
					<form data-testid="textarea-form">
						<textarea
							name="bio"
							value={bio}
							onChange={(e) => {
								setBio(e.target.value)
							}}
						/>
					</form>
				)
			}

			const { container } = render(<FormWithTextarea />)
			// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
			const form = container.querySelector('form')!

			// Use new textarea testing utilities
			await formTesting.fillTextareaFields(form, {
				bio: 'This is a test bio with multiple lines.\nIt should handle line breaks properly.',
			})

			// Validate using new utilities
			formTesting.validateTextareaFields(form, {
				bio: 'This is a test bio with multiple lines.\nIt should handle line breaks properly.',
			})
		})

		it('should handle radio buttons using new utilities', async () => {
			const FormWithRadio = () => {
				const [gender, setGender] = React.useState('')

				return (
					<form data-testid="radio-form">
						<label>
							<input
								name="gender"
								type="radio"
								value="male"
								checked={gender === 'male'}
								onChange={(e) => {
									setGender(e.target.value)
								}}
							/>
							Male
						</label>
						<label>
							<input
								name="gender"
								type="radio"
								value="female"
								checked={gender === 'female'}
								onChange={(e) => {
									setGender(e.target.value)
								}}
							/>
							Female
						</label>
					</form>
				)
			}

			const { container } = render(<FormWithRadio />)
			// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
			const form = container.querySelector('form')!

			// Use new radio button testing utilities
			await formTesting.selectRadioButtons(form, {
				gender: 'female',
			})

			// Validate using new utilities
			formTesting.validateRadioButtons(form, {
				gender: 'female',
			})
		})

		it('should handle checkboxes using new utilities', async () => {
			const FormWithCheckboxes = () => {
				const [newsletter, setNewsletter] = React.useState(false)
				const [updates, setUpdates] = React.useState(false)

				return (
					<form data-testid="checkbox-form">
						<label>
							<input
								name="newsletter"
								type="checkbox"
								checked={newsletter}
								onChange={(e) => {
									setNewsletter(e.target.checked)
								}}
							/>
							Subscribe to newsletter
						</label>
						<label>
							<input
								name="updates"
								type="checkbox"
								checked={updates}
								onChange={(e) => {
									setUpdates(e.target.checked)
								}}
							/>
							Receive updates
						</label>
					</form>
				)
			}

			const { container } = render(<FormWithCheckboxes />)
			// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
			const form = container.querySelector('form')!

			// Use new checkbox testing utilities
			await formTesting.toggleCheckboxes(form, {
				newsletter: true,
				updates: false,
			})

			// Validate using new utilities
			formTesting.validateCheckboxes(form, {
				newsletter: true,
				updates: false,
			})
		})

		it('should handle form submission using new utilities', async () => {
			const handleSubmit = vi.fn()
			const FormWithSubmission = () => {
				const [email, setEmail] = React.useState('')

				return (
					<form
						data-testid="submit-form"
						onSubmit={(e) => {
							e.preventDefault()
							handleSubmit({ email })
						}}
					>
						<input
							name="email"
							type="email"
							value={email}
							onChange={(e) => {
								setEmail(e.target.value)
							}}
						/>
						<Button type="submit">Submit</Button>
					</form>
				)
			}

			const { container } = render(<FormWithSubmission />)
			// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
			const form = container.querySelector('form')!

			// Fill form and submit using new utilities
			await formTesting.fillTextInputs(form, {
				email: 'test@example.com',
			})

			await formTesting.submitForm(form)

			// Verify submission was called
			expect(handleSubmit).toHaveBeenCalledWith({
				email: 'test@example.com',
			})
		})
	})

	describe('4. Testing with Mock Data', () => {
		it('should render user data', () => {
			const mockUser = {
				email: 'test@example.com',
				name: 'Test User',
			}

			const UserDisplay = ({ user }: { user: typeof mockUser }) => (
				<div>
					<h2>{user.name}</h2>
					<p>{user.email}</p>
				</div>
			)

			render(<UserDisplay user={mockUser} />)

			expect(screen.getByText('Test User')).toBeInTheDocument()
			expect(screen.getByText('test@example.com')).toBeInTheDocument()
		})

		it('should handle conditional rendering', () => {
			const AuthStatus = ({
				isAuthenticated,
			}: {
				isAuthenticated: boolean
			}) => (
				<div>
					{isAuthenticated ? (
						<span>Logged in</span>
					) : (
						<span>Not logged in</span>
					)}
				</div>
			)

			const { rerender } = render(<AuthStatus isAuthenticated={true} />)
			expect(screen.getByText('Logged in')).toBeInTheDocument()

			rerender(<AuthStatus isAuthenticated={false} />)
			expect(screen.getByText('Not logged in')).toBeInTheDocument()
		})
	})

	describe('5. Async Operations Testing', () => {
		it('should handle loading states', async () => {
			const AsyncComponent = () => {
				const [loading, setLoading] = React.useState(false)
				const [data, setData] = React.useState<string | null>(null)

				const fetchData = async () => {
					setLoading(true)
					// Simulate async operation
					await new Promise((resolve) => setTimeout(resolve, 100))
					setData('Loaded data')
					setLoading(false)
				}

				return (
					<div>
						<button onClick={fetchData}>Load Data</button>
						{loading && <div>Loading...</div>}
						{data && <div>{data}</div>}
					</div>
				)
			}

			const user = userEvent.setup()
			render(<AsyncComponent />)

			const loadButton = screen.getByRole('button', { name: /load data/i })
			await user.click(loadButton)

			// Should show loading state
			expect(screen.getByText('Loading...')).toBeInTheDocument()

			// Should show data after loading
			await waitFor(() => {
				expect(screen.getByText('Loaded data')).toBeInTheDocument()
			})

			// Loading state should be gone
			expect(screen.queryByText('Loading...')).not.toBeInTheDocument()
		})
	})

	describe('6. Error Handling Testing', () => {
		it('should handle component errors gracefully', () => {
			const ErrorComponent = ({ shouldError }: { shouldError: boolean }) => {
				if (shouldError) {
					return <div>Error occurred</div>
				}
				return <div>Normal content</div>
			}

			const { rerender } = render(<ErrorComponent shouldError={false} />)
			expect(screen.getByText('Normal content')).toBeInTheDocument()

			rerender(<ErrorComponent shouldError={true} />)
			expect(screen.getByText('Error occurred')).toBeInTheDocument()
		})
	})

	describe('7. Accessibility Testing', () => {
		it('should have proper ARIA attributes', () => {
			render(
				<Button aria-label="Close dialog" aria-describedby="close-description">
					×
				</Button>,
			)

			const button = screen.getByRole('button', { name: 'Close dialog' })
			expect(button).toHaveAttribute('aria-label', 'Close dialog')
			expect(button).toHaveAttribute('aria-describedby', 'close-description')
		})

		it('should support keyboard navigation', async () => {
			const user = userEvent.setup()
			render(
				<div>
					<Button>First</Button>
					<Button>Second</Button>
					<Button>Third</Button>
				</div>,
			)

			const firstButton = screen.getByRole('button', { name: /first/i })
			const secondButton = screen.getByRole('button', { name: /second/i })

			firstButton.focus()
			expect(firstButton).toHaveFocus()

			await user.tab()
			expect(secondButton).toHaveFocus()
		})
	})

	describe('8. Custom Hooks Testing', () => {
		it('should test custom hook behavior', async () => {
			const user = userEvent.setup()
			const useCounter = (initialValue = 0) => {
				const [count, setCount] = React.useState(initialValue)
				const increment = () => {
					setCount((c) => c + 1)
				}
				const decrement = () => {
					setCount((c) => c - 1)
				}
				return { count, increment, decrement }
			}

			const Counter = () => {
				const { count, increment, decrement } = useCounter(5)

				return (
					<div>
						<span data-testid="count-hook">{count}</span>
						<button onClick={increment}>+</button>
						<button onClick={decrement}>-</button>
					</div>
				)
			}

			render(<Counter />)

			expect(screen.getByTestId('count-hook')).toHaveTextContent('5')

			const incrementButton = screen.getByRole('button', { name: '+' })
			const decrementButton = screen.getByRole('button', { name: '-' })

			// Test increment
			await user.click(incrementButton)
			expect(screen.getByTestId('count-hook')).toHaveTextContent('6')

			// Test decrement
			await user.click(decrementButton)
			expect(screen.getByTestId('count-hook')).toHaveTextContent('5')
		})
	})

	describe('9. Component Integration Testing', () => {
		it('should test component interaction', async () => {
			const user = userEvent.setup()

			const ParentComponent = () => {
				const [selectedItem, setSelectedItem] = React.useState<string | null>(
					null,
				)

				return (
					<div>
						<div data-testid="selected">{selectedItem ?? 'None'}</div>
						<Button
							onClick={() => {
								setSelectedItem('Item 1')
							}}
						>
							Select Item 1
						</Button>
						<Button
							onClick={() => {
								setSelectedItem('Item 2')
							}}
						>
							Select Item 2
						</Button>
						<Button
							onClick={() => {
								setSelectedItem(null)
							}}
						>
							Clear
						</Button>
					</div>
				)
			}

			render(<ParentComponent />)

			// Initial state
			expect(screen.getByTestId('selected')).toHaveTextContent('None')

			// Select first item
			await user.click(screen.getByRole('button', { name: /select item 1/i }))
			expect(screen.getByTestId('selected')).toHaveTextContent('Item 1')

			// Select second item
			await user.click(screen.getByRole('button', { name: /select item 2/i }))
			expect(screen.getByTestId('selected')).toHaveTextContent('Item 2')

			// Clear selection
			await user.click(screen.getByRole('button', { name: /clear/i }))
			expect(screen.getByTestId('selected')).toHaveTextContent('None')
		})
	})

	describe('10. Component State Testing', () => {
		it('should handle component state changes', async () => {
			const user = userEvent.setup()

			const StateComponent = () => {
				const [count, setCount] = React.useState(0)

				return (
					<div>
						<span data-testid="count-state">{count}</span>
						<button
							onClick={() => {
								setCount((c) => c + 1)
							}}
						>
							Increment
						</button>
						<button
							onClick={() => {
								setCount(0)
							}}
						>
							Reset
						</button>
					</div>
				)
			}

			render(<StateComponent />)

			// Initial state
			expect(screen.getByTestId('count-state')).toHaveTextContent('0')

			// Increment
			await user.click(screen.getByRole('button', { name: /increment/i }))
			expect(screen.getByTestId('count-state')).toHaveTextContent('1')

			// Increment again
			await user.click(screen.getByRole('button', { name: /increment/i }))
			expect(screen.getByTestId('count-state')).toHaveTextContent('2')

			// Reset
			await user.click(screen.getByRole('button', { name: /reset/i }))
			expect(screen.getByTestId('count-state')).toHaveTextContent('0')
		})
	})

	describe('11. Enhanced API Integration Testing', () => {
		it('should handle API data fetching with loading states', async () => {
			// Setup MSW handler for data fetching with delay to show loading state
			setupServerWithHandlers([
				http.get('http://localhost:3000/api/users', async () => {
					// Add delay to simulate network latency and show loading state
					await new Promise((resolve) => setTimeout(resolve, 100))
					return HttpResponse.json([
						{ id: 1, name: 'John Doe', email: 'john@example.com' },
						{ id: 2, name: 'Jane Smith', email: 'jane@example.com' },
					])
				}),
			])

			const user = userEvent.setup()

			const UserList = () => {
				const [users, setUsers] = React.useState<
					{ id: number; name: string; email: string }[]
				>([])
				const [loading, setLoading] = React.useState(false)
				const [error, setError] = React.useState<string | null>(null)

				const fetchUsers = async () => {
					setLoading(true)
					setError(null)
					try {
						const response = await fetch('http://localhost:3000/api/users')
						const data = (await response.json()) as {
							id: number
							name: string
							email: string
						}[]
						setUsers(data)
					} catch {
						setError('Failed to fetch users')
					} finally {
						setLoading(false)
					}
				}

				return (
					<div>
						<button onClick={fetchUsers}>Load Users</button>
						{loading && <div data-testid="loading">Loading...</div>}
						{error && <div data-testid="error">{error}</div>}
						<ul data-testid="user-list">
							{users.map((user) => (
								<li key={user.id} data-testid={`user-${user.id.toString()}`}>
									{user.name} - {user.email}
								</li>
							))}
						</ul>
					</div>
				)
			}

			render(<UserList />)

			// Click load button
			await user.click(screen.getByRole('button', { name: /load users/i }))

			// Should show loading state
			await waitFor(() => {
				expect(screen.getByTestId('loading')).toBeInTheDocument()
			})

			// Wait for data to load
			await waitFor(() => {
				expect(screen.getByTestId('user-1')).toBeInTheDocument()
			})

			// Should show user data
			expect(screen.getByTestId('user-1')).toHaveTextContent(
				'John Doe - john@example.com',
			)
			expect(screen.getByTestId('user-2')).toHaveTextContent(
				'Jane Smith - jane@example.com',
			)

			// Loading state should be gone
			await waitFor(() => {
				expect(screen.queryByTestId('loading')).not.toBeInTheDocument()
			})
		})

		it('should handle API errors gracefully', async () => {
			// Setup MSW handler for error scenario with delay to show loading state
			setupServerWithHandlers([
				http.get('http://localhost:3000/api/users', async () => {
					// Add delay to simulate network latency and show loading state
					await new Promise((resolve) => setTimeout(resolve, 100))
					return HttpResponse.json(
						{ message: 'Internal Server Error' },
						{ status: 500 },
					)
				}),
			])

			const user = userEvent.setup()

			const ErrorHandlingComponent = () => {
				const [error, setError] = React.useState<string | null>(null)
				const [loading, setLoading] = React.useState(false)

				const fetchData = async () => {
					setLoading(true)
					setError(null)
					try {
						const response = await fetch('http://localhost:3000/api/users')
						if (!response.ok) {
							throw new Error('Failed to fetch data')
						}
					} catch (err) {
						setError(err instanceof Error ? err.message : 'Unknown error')
					} finally {
						setLoading(false)
					}
				}

				return (
					<div>
						<button onClick={fetchData}>Fetch Data</button>
						{loading && <div data-testid="loading">Loading...</div>}
						{error && (
							<div data-testid="error" role="alert">
								{error}
							</div>
						)}
					</div>
				)
			}

			render(<ErrorHandlingComponent />)

			// Click fetch button
			await user.click(screen.getByRole('button', { name: /fetch data/i }))

			// Should show loading state
			await waitFor(() => {
				expect(screen.getByTestId('loading')).toBeInTheDocument()
			})

			// Wait for error to appear
			await waitFor(() => {
				expect(screen.getByTestId('error')).toBeInTheDocument()
			})

			// Should show error message
			expect(screen.getByTestId('error')).toHaveTextContent(
				'Failed to fetch data',
			)

			// Loading state should be gone
			await waitFor(() => {
				expect(screen.queryByTestId('loading')).not.toBeInTheDocument()
			})
		})

		it('should handle form submission with API integration', async () => {
			// Setup MSW handler for form submission
			setupServerWithHandlers([
				http.post('http://localhost:3000/api/contact', () => {
					return HttpResponse.json(
						{ message: 'Message sent successfully' },
						{ status: 201 },
					)
				}),
			])

			const user = userEvent.setup()

			const ContactForm = () => {
				const [formData, setFormData] = React.useState({
					name: '',
					email: '',
					message: '',
				})
				const [isSubmitting, setIsSubmitting] = React.useState(false)
				const [result, setResult] = React.useState<string | null>(null)

				const handleSubmit = async (e: React.FormEvent) => {
					e.preventDefault()
					setIsSubmitting(true)
					setResult(null)

					try {
						const response = await fetch('http://localhost:3000/api/contact', {
							method: 'POST',
							headers: {
								'Content-Type': 'application/json',
							},
							body: JSON.stringify(formData),
						})
						const data = (await response.json()) as { message: string }
						setResult(data.message)
					} catch {
						setResult('Failed to send message')
					} finally {
						setIsSubmitting(false)
					}
				}

				return (
					<form onSubmit={handleSubmit} data-testid="contact-form">
						<input
							name="name"
							type="text"
							value={formData.name}
							onChange={(e) => {
								setFormData((prev) => ({ ...prev, name: e.target.value }))
							}}
							placeholder="Name"
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
						<textarea
							name="message"
							value={formData.message}
							onChange={(e) => {
								setFormData((prev) => ({ ...prev, message: e.target.value }))
							}}
							placeholder="Message"
						/>
						<Button type="submit" disabled={isSubmitting}>
							{isSubmitting ? 'Sending...' : 'Send Message'}
						</Button>
						{result && <div data-testid="result">{result}</div>}
					</form>
				)
			}

			render(<ContactForm />)

			// Fill the form
			await user.type(screen.getByPlaceholderText('Name'), 'John Doe')
			await user.type(screen.getByPlaceholderText('Email'), 'john@example.com')
			await user.type(
				screen.getByPlaceholderText('Message'),
				'Hello, this is a test message.',
			)

			// Submit the form
			await user.click(screen.getByRole('button', { name: /send message/i }))

			// Wait for result
			await waitFor(() => {
				expect(screen.getByTestId('result')).toBeInTheDocument()
			})

			// Should show success message
			expect(screen.getByTestId('result')).toHaveTextContent(
				'Message sent successfully',
			)
		})

		it('should handle network errors during API calls', async () => {
			const mockClient = createTrackingMockApiClient()
			const errorScenarios = createNetworkErrorScenarios()

			// Test error handling
			const results = await testErrorHandling(mockClient, errorScenarios)

			// Verify all error scenarios were handled
			expect(results).toHaveLength(Object.keys(errorScenarios).length)
			results.forEach((result) => {
				expect(result.scenario).toBeDefined()
				expect(result.handled).toBe(true)
				expect(result.error).toBeDefined()
			})
		})

		it('should handle concurrent API requests', async () => {
			// Setup MSW handler with delay to simulate slow API
			setupServerWithHandlers([
				http.get('http://localhost:3000/api/data', () => {
					return new Promise((resolve) => {
						setTimeout(() => {
							resolve(
								HttpResponse.json(
									{ data: 'Response from API' },
									{ status: 200 },
								),
							)
						}, 100)
					})
				}),
			])

			const user = userEvent.setup()

			const ConcurrentRequests = () => {
				const [responses, setResponses] = React.useState<string[]>([])
				const [loading, setLoading] = React.useState(false)

				const makeRequests = async () => {
					setLoading(true)
					setResponses([])

					try {
						// Make multiple concurrent requests
						const promises = Array.from({ length: 3 }, () =>
							fetch('http://localhost:3000/api/data').then(
								(res) => res.json() as Promise<{ data: string }>,
							),
						)

						const results = await Promise.all(promises)
						setResponses(results.map((r) => r.data))
					} catch {
						setResponses(['Error occurred'])
					} finally {
						setLoading(false)
					}
				}

				return (
					<div>
						<button onClick={makeRequests}>Make Requests</button>
						{loading && <div data-testid="loading">Loading...</div>}
						<ul data-testid="responses">
							{responses.map((response, index) => (
								<li key={index} data-testid={`response-${index.toString()}`}>
									{response}
								</li>
							))}
						</ul>
					</div>
				)
			}

			render(<ConcurrentRequests />)

			// Click button to make requests
			await user.click(screen.getByRole('button', { name: /make requests/i }))

			// Should show loading state
			await waitFor(() => {
				expect(screen.getByTestId('loading')).toBeInTheDocument()
			})

			// Wait for all responses
			await waitFor(() => {
				expect(screen.getByTestId('response-0')).toBeInTheDocument()
			})

			// Should show all responses
			expect(screen.getByTestId('response-0')).toHaveTextContent(
				'Response from API',
			)
			expect(screen.getByTestId('response-1')).toHaveTextContent(
				'Response from API',
			)
			expect(screen.getByTestId('response-2')).toHaveTextContent(
				'Response from API',
			)

			// Loading state should be gone
			await waitFor(() => {
				expect(screen.queryByTestId('loading')).not.toBeInTheDocument()
			})
		})
	})
})
