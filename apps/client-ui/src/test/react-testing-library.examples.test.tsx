import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { Button } from '@/components/ui/button'

/**
 * Comprehensive React Testing Library Examples
 *
 * This file demonstrates best practices for testing React components
 * using @testing-library/react and @testing-library/user-event
 */

describe('React Testing Library Examples', () => {
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

			const button = screen.getByRole('button')
			await user.click(button)

			expect(handleClick).toHaveBeenCalledTimes(1)
		})

		it('should handle keyboard interactions', async () => {
			const handleClick = vi.fn()
			const user = userEvent.setup()

			render(<Button onClick={handleClick}>Click me</Button>)

			const button = screen.getByRole('button')
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

			const button = screen.getByRole('button')
			expect(button).toBeDisabled()

			await user.click(button)
			expect(handleClick).not.toHaveBeenCalled()
		})
	})

	describe('3. Simple Form Testing', () => {
		it('should render a simple form component', () => {
			const SimpleForm = () => (
				<form>
					<label htmlFor="email">Email</label>
					<input id="email" type="email" />
					<Button type="submit">Submit</Button>
				</form>
			)

			render(<SimpleForm />)

			expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
			expect(
				screen.getByRole('button', { name: /submit/i }),
			).toBeInTheDocument()
		})

		it('should handle form input', async () => {
			const user = userEvent.setup()
			const SimpleForm = () => {
				const [value, setValue] = React.useState('')
				return (
					<form>
						<label htmlFor="email">Email</label>
						<input
							id="email"
							type="email"
							value={value}
							onChange={(e) => {
								setValue(e.target.value)
							}}
						/>
						<Button type="submit">Submit</Button>
					</form>
				)
			}

			render(<SimpleForm />)

			const emailInput = screen.getByLabelText(/email/i)
			await user.type(emailInput, 'test@example.com')

			expect(emailInput).toHaveValue('test@example.com')
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

			const button = screen.getByRole('button')
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
						<span data-testid="count">{count}</span>
						<button onClick={increment}>+</button>
						<button onClick={decrement}>-</button>
					</div>
				)
			}

			render(<Counter />)

			expect(screen.getByTestId('count')).toHaveTextContent('5')

			const incrementButton = screen.getByRole('button', { name: '+' })
			const decrementButton = screen.getByRole('button', { name: '-' })

			// Test increment
			await user.click(incrementButton)
			expect(screen.getByTestId('count')).toHaveTextContent('6')

			// Test decrement
			await user.click(decrementButton)
			expect(screen.getByTestId('count')).toHaveTextContent('5')
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
						<span data-testid="count">{count}</span>
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
			expect(screen.getByTestId('count')).toHaveTextContent('0')

			// Increment
			await user.click(screen.getByRole('button', { name: /increment/i }))
			expect(screen.getByTestId('count')).toHaveTextContent('1')

			// Increment again
			await user.click(screen.getByRole('button', { name: /increment/i }))
			expect(screen.getByTestId('count')).toHaveTextContent('2')

			// Reset
			await user.click(screen.getByRole('button', { name: /reset/i }))
			expect(screen.getByTestId('count')).toHaveTextContent('0')
		})
	})
})
