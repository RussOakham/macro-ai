/**
 * Standalone Test - Validates Enhanced Testing Utilities
 *
 * This test file validates that our enhanced testing utilities work correctly
 * without importing from config-testing package to avoid MSW setup issues.
 */

import React from 'react'
import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

// Import directly from our component-test-utils to avoid MSW setup
import { componentTesting, formTesting } from './component-test-utils'

describe('Enhanced Testing Utilities - Standalone Validation', () => {
	describe('Form Testing Utilities', () => {
		it('should fill and validate text inputs', async () => {
			const TestForm = () => {
				const [formData, setFormData] = React.useState({
					name: '',
					email: '',
				})

				return (
					<form data-testid="test-form-text">
						<input
							name="name"
							type="text"
							value={formData.name}
							onChange={(e) => {
								setFormData((prev) => ({ ...prev, name: e.target.value }))
							}}
						/>
						<input
							name="email"
							type="email"
							value={formData.email}
							onChange={(e) => {
								setFormData((prev) => ({ ...prev, email: e.target.value }))
							}}
						/>
					</form>
				)
			}

			const { container } = render(<TestForm />)
			// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
			const form = container.querySelector('form')!

			// Test filling text inputs
			await formTesting.fillTextInputs(form, {
				name: 'John Doe',
				email: 'john@example.com',
			})

			// Test validation
			formTesting.validateTextInputs(form, {
				name: 'John Doe',
				email: 'john@example.com',
			})
		})

		it('should fill and validate select fields', async () => {
			const TestForm = () => {
				const [country, setCountry] = React.useState('')

				return (
					<form data-testid="test-form-select">
						<select
							name="country"
							value={country}
							onChange={(e) => {
								setCountry(e.target.value)
							}}
						>
							<option value="">Select Country</option>
							<option value="us">United States</option>
							<option value="uk">United Kingdom</option>
						</select>
					</form>
				)
			}

			const { container } = render(<TestForm />)
			// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
			const form = container.querySelector('form')!

			// Test filling select field
			await formTesting.fillSelectFields(form, {
				country: 'us',
			})

			// Test validation
			formTesting.validateSelectFields(form, {
				country: 'us',
			})
		})

		it('should handle radio buttons', async () => {
			const TestForm = () => {
				const [gender, setGender] = React.useState('')

				return (
					<form data-testid="test-form-radio">
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

			const { container } = render(<TestForm />)
			// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
			const form = container.querySelector('form')!

			// Test selecting radio button
			await formTesting.selectRadioButtons(form, {
				gender: 'female',
			})

			// Test validation
			formTesting.validateRadioButtons(form, {
				gender: 'female',
			})
		})

		it('should handle checkboxes', async () => {
			const TestForm = () => {
				const [newsletter, setNewsletter] = React.useState(false)

				return (
					<form data-testid="test-form-checkbox">
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
					</form>
				)
			}

			const { container } = render(<TestForm />)
			// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
			const form = container.querySelector('form')!

			// Test toggling checkbox
			await formTesting.toggleCheckboxes(form, {
				newsletter: true,
			})

			// Test validation
			formTesting.validateCheckboxes(form, {
				newsletter: true,
			})
		})
	})

	describe('Component Testing Utilities', () => {
		it('should find elements by test id', () => {
			const TestComponent = () => (
				<div data-testid="test-container-standalone">
					<h1 data-testid="test-title-standalone">Test Title</h1>
					<p data-testid="test-content-standalone">Test content</p>
				</div>
			)

			render(<TestComponent />)

			// Test element finding
			expect(
				componentTesting.getElementByTestId('test-container-standalone'),
			).toBeInTheDocument()
			expect(
				componentTesting.getElementByTestId('test-title-standalone'),
			).toBeInTheDocument()
			expect(
				componentTesting.getElementByTestId('test-content-standalone'),
			).toBeInTheDocument()
		})

		it('should assert element text content', () => {
			const TestComponent = () => (
				<div>
					<h1 data-testid="title">Hello World</h1>
					<p data-testid="description">This is a test description</p>
				</div>
			)

			render(<TestComponent />)

			// Test text assertions
			componentTesting.assertElementText('title', 'Hello World')
			componentTesting.assertElementText(
				'description',
				'This is a test description',
			)
		})

		it('should check element existence', () => {
			const TestComponent = () => (
				<div>
					<h1 data-testid="visible-title">Visible Title</h1>
					{/* No hidden-title element */}
				</div>
			)

			render(<TestComponent />)

			// Test element existence
			expect(
				componentTesting.getElementByTestId('visible-title'),
			).toBeInTheDocument()
			componentTesting.assertElementNotExists('hidden-title')
		})
	})

	describe('Integration Test - Complete Form Workflow', () => {
		it('should handle a complete form workflow', async () => {
			const CompleteForm = () => {
				const [formData, setFormData] = React.useState({
					name: '',
					email: '',
					country: '',
					newsletter: false,
					gender: '',
				})

				const handleSubmit = (e: React.FormEvent) => {
					e.preventDefault()
					// Form submission logic would go here
				}

				return (
					<div data-testid="form-container">
						<h1 data-testid="form-title">Complete Registration Form</h1>
						<form data-testid="complete-form" onSubmit={handleSubmit}>
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
							</select>
							<label>
								<input
									name="gender"
									type="radio"
									value="male"
									checked={formData.gender === 'male'}
									onChange={(e) => {
										setFormData((prev) => ({ ...prev, gender: e.target.value }))
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
										setFormData((prev) => ({ ...prev, gender: e.target.value }))
									}}
								/>
								Female
							</label>
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
							<button type="submit" data-testid="submit-btn">
								Submit
							</button>
						</form>
					</div>
				)
			}

			const { container } = render(<CompleteForm />)
			// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
			const form = container.querySelector('form')!

			// Test component rendering
			expect(
				componentTesting.getElementByTestId('form-container'),
			).toBeInTheDocument()
			componentTesting.assertElementText(
				'form-title',
				'Complete Registration Form',
			)

			// Test comprehensive form filling
			await formTesting.fillTextInputs(form, {
				name: 'Jane Smith',
				email: 'jane@example.com',
			})

			await formTesting.fillSelectFields(form, {
				country: 'uk',
			})

			await formTesting.selectRadioButtons(form, {
				gender: 'female',
			})

			await formTesting.toggleCheckboxes(form, {
				newsletter: true,
			})

			// Test comprehensive validation
			formTesting.validateTextInputs(form, {
				name: 'Jane Smith',
				email: 'jane@example.com',
			})

			formTesting.validateSelectFields(form, {
				country: 'uk',
			})

			formTesting.validateRadioButtons(form, {
				gender: 'female',
			})

			formTesting.validateCheckboxes(form, {
				newsletter: true,
			})

			// Test form submission
			await formTesting.submitForm(form)

			// Verify submit button exists
			expect(
				componentTesting.getElementByTestId('submit-btn'),
			).toBeInTheDocument()
		})
	})
})
