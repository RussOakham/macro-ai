/**
 * Pilot Tests for Enhanced Testing Utilities
 *
 * This file demonstrates the new testing utilities in action with real-world scenarios.
 * It serves as both documentation and validation of the enhanced testing capabilities.
 */

import React from 'react'
import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { Button } from '@/components/ui/button'

import { componentTesting, formTesting } from './component-test-utils'

describe('Pilot Tests - Enhanced Testing Utilities', () => {
	describe('Real-World Form Testing Scenarios', () => {
		it('should handle a complete user registration form', async () => {
			const RegistrationForm = () => {
				const [formData, setFormData] = React.useState({
					firstName: '',
					lastName: '',
					email: '',
					password: '',
					confirmPassword: '',
					country: '',
					dateOfBirth: '',
					bio: '',
					termsAccepted: false,
					newsletter: false,
					gender: '',
					experience: '',
				})

				const [errors, setErrors] = React.useState<Record<string, string>>({})
				const [isSubmitting, setIsSubmitting] = React.useState(false)

				const validateForm = () => {
					const newErrors: Record<string, string> = {}

					if (!formData.firstName)
						newErrors.firstName = 'First name is required'
					if (!formData.lastName) newErrors.lastName = 'Last name is required'
					if (!formData.email) newErrors.email = 'Email is required'
					if (!formData.password) newErrors.password = 'Password is required'
					if (formData.password !== formData.confirmPassword) {
						newErrors.confirmPassword = 'Passwords do not match'
					}
					if (!formData.termsAccepted)
						newErrors.termsAccepted = 'You must accept the terms'

					setErrors(newErrors)
					return Object.keys(newErrors).length === 0
				}

				const handleSubmit = async (e: React.FormEvent) => {
					e.preventDefault()
					if (!validateForm()) return

					setIsSubmitting(true)
					// Simulate API call
					await new Promise((resolve) => setTimeout(resolve, 100))
					setIsSubmitting(false)
				}

				return (
					<div data-testid="registration-container">
						<h1>User Registration</h1>
						<form data-testid="registration-form" onSubmit={handleSubmit}>
							{/* Personal Information */}
							<div>
								<label htmlFor="firstName">First Name *</label>
								<input
									id="firstName"
									name="firstName"
									type="text"
									value={formData.firstName}
									onChange={(e) => {
										setFormData((prev) => ({
											...prev,
											firstName: e.target.value,
										}))
									}}
								/>
								{errors.firstName && (
									<span data-testid="firstName-error">{errors.firstName}</span>
								)}
							</div>

							<div>
								<label htmlFor="lastName">Last Name *</label>
								<input
									id="lastName"
									name="lastName"
									type="text"
									value={formData.lastName}
									onChange={(e) => {
										setFormData((prev) => ({
											...prev,
											lastName: e.target.value,
										}))
									}}
								/>
								{errors.lastName && (
									<span data-testid="lastName-error">{errors.lastName}</span>
								)}
							</div>

							<div>
								<label htmlFor="email">Email *</label>
								<input
									id="email"
									name="email"
									type="email"
									value={formData.email}
									onChange={(e) => {
										setFormData((prev) => ({ ...prev, email: e.target.value }))
									}}
								/>
								{errors.email && (
									<span data-testid="email-error">{errors.email}</span>
								)}
							</div>

							<div>
								<label htmlFor="password">Password *</label>
								<input
									id="password"
									name="password"
									type="password"
									value={formData.password}
									onChange={(e) => {
										setFormData((prev) => ({
											...prev,
											password: e.target.value,
										}))
									}}
								/>
								{errors.password && (
									<span data-testid="password-error">{errors.password}</span>
								)}
							</div>

							<div>
								<label htmlFor="confirmPassword">Confirm Password *</label>
								<input
									id="confirmPassword"
									name="confirmPassword"
									type="password"
									value={formData.confirmPassword}
									onChange={(e) => {
										setFormData((prev) => ({
											...prev,
											confirmPassword: e.target.value,
										}))
									}}
								/>
								{errors.confirmPassword && (
									<span data-testid="confirmPassword-error">
										{errors.confirmPassword}
									</span>
								)}
							</div>

							{/* Additional Information */}
							<div>
								<label htmlFor="country">Country</label>
								<select
									id="country"
									name="country"
									value={formData.country}
									onChange={(e) => {
										setFormData((prev) => ({
											...prev,
											country: e.target.value,
										}))
									}}
								>
									<option value="">Select Country</option>
									<option value="us">United States</option>
									<option value="uk">United Kingdom</option>
									<option value="ca">Canada</option>
									<option value="au">Australia</option>
									<option value="de">Germany</option>
								</select>
							</div>

							<div>
								<label htmlFor="dateOfBirth">Date of Birth</label>
								<input
									id="dateOfBirth"
									name="dateOfBirth"
									type="date"
									value={formData.dateOfBirth}
									onChange={(e) => {
										setFormData((prev) => ({
											...prev,
											dateOfBirth: e.target.value,
										}))
									}}
								/>
							</div>

							<div>
								<label htmlFor="bio">Bio</label>
								<textarea
									id="bio"
									name="bio"
									value={formData.bio}
									onChange={(e) => {
										setFormData((prev) => ({ ...prev, bio: e.target.value }))
									}}
									placeholder="Tell us about yourself..."
								/>
							</div>

							{/* Preferences */}
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
								<label>
									<input
										name="gender"
										type="radio"
										value="other"
										checked={formData.gender === 'other'}
										onChange={(e) => {
											setFormData((prev) => ({
												...prev,
												gender: e.target.value,
											}))
										}}
									/>
									Other
								</label>
							</div>

							<div>
								<label htmlFor="experience">Experience Level</label>
								<select
									id="experience"
									name="experience"
									value={formData.experience}
									onChange={(e) => {
										setFormData((prev) => ({
											...prev,
											experience: e.target.value,
										}))
									}}
								>
									<option value="">Select Experience</option>
									<option value="beginner">Beginner</option>
									<option value="intermediate">Intermediate</option>
									<option value="advanced">Advanced</option>
									<option value="expert">Expert</option>
								</select>
							</div>

							{/* Checkboxes */}
							<div>
								<label>
									<input
										name="termsAccepted"
										type="checkbox"
										checked={formData.termsAccepted}
										onChange={(e) => {
											setFormData((prev) => ({
												...prev,
												termsAccepted: e.target.checked,
											}))
										}}
									/>
									I accept the terms and conditions *
								</label>
								{errors.termsAccepted && (
									<span data-testid="terms-error">{errors.termsAccepted}</span>
								)}
							</div>

							<div>
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
							</div>

							<Button type="submit" disabled={isSubmitting}>
								{isSubmitting ? 'Creating Account...' : 'Create Account'}
							</Button>
						</form>
					</div>
				)
			}

			const { container } = render(<RegistrationForm />)
			// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
			const form = container.querySelector('form')!

			// Test comprehensive form filling using new utilities
			await formTesting.fillTextInputs(form, {
				firstName: 'John',
				lastName: 'Doe',
				email: 'john.doe@example.com',
				password: 'SecurePassword123!',
				confirmPassword: 'SecurePassword123!',
				dateOfBirth: '1990-01-15',
			})

			await formTesting.fillSelectFields(form, {
				country: 'us',
				experience: 'intermediate',
			})

			await formTesting.fillTextareaFields(form, {
				bio: 'I am a passionate software developer with 5 years of experience in web development. I love working with React and TypeScript.',
			})

			await formTesting.selectRadioButtons(form, {
				gender: 'male',
			})

			await formTesting.toggleCheckboxes(form, {
				termsAccepted: true,
				newsletter: true,
			})

			// Validate all form fields using new utilities
			formTesting.validateTextInputs(form, {
				firstName: 'John',
				lastName: 'Doe',
				email: 'john.doe@example.com',
				password: 'SecurePassword123!',
				confirmPassword: 'SecurePassword123!',
				dateOfBirth: '1990-01-15',
			})

			formTesting.validateSelectFields(form, {
				country: 'us',
				experience: 'intermediate',
			})

			formTesting.validateTextareaFields(form, {
				bio: 'I am a passionate software developer with 5 years of experience in web development. I love working with React and TypeScript.',
			})

			formTesting.validateRadioButtons(form, {
				gender: 'male',
			})

			formTesting.validateCheckboxes(form, {
				termsAccepted: true,
				newsletter: true,
			})

			// Test form submission
			await formTesting.submitForm(form)

			// Verify no validation errors are shown
			componentTesting.assertElementNotExists('firstName-error')
			componentTesting.assertElementNotExists('lastName-error')
			componentTesting.assertElementNotExists('email-error')
			componentTesting.assertElementNotExists('password-error')
			componentTesting.assertElementNotExists('confirmPassword-error')
			componentTesting.assertElementNotExists('terms-error')
		})

		it('should handle form validation errors', async () => {
			const ValidationForm = () => {
				const [formData, setFormData] = React.useState({
					email: '',
					password: '',
					confirmPassword: '',
					termsAccepted: false,
				})

				const [errors, setErrors] = React.useState<Record<string, string>>({})

				const handleSubmit = (e: React.FormEvent) => {
					e.preventDefault()
					const newErrors: Record<string, string> = {}

					if (!formData.email) newErrors.email = 'Email is required'
					if (!formData.password) newErrors.password = 'Password is required'
					if (formData.password !== formData.confirmPassword) {
						newErrors.confirmPassword = 'Passwords do not match'
					}
					if (!formData.termsAccepted)
						newErrors.termsAccepted = 'You must accept the terms'

					setErrors(newErrors)
				}

				return (
					<form data-testid="validation-form" onSubmit={handleSubmit}>
						<input
							name="email"
							type="email"
							value={formData.email}
							onChange={(e) => {
								setFormData((prev) => ({ ...prev, email: e.target.value }))
							}}
						/>
						{errors.email && (
							<span data-testid="email-error">{errors.email}</span>
						)}

						<input
							name="password"
							type="password"
							value={formData.password}
							onChange={(e) => {
								setFormData((prev) => ({ ...prev, password: e.target.value }))
							}}
						/>
						{errors.password && (
							<span data-testid="password-error">{errors.password}</span>
						)}

						<input
							name="confirmPassword"
							type="password"
							value={formData.confirmPassword}
							onChange={(e) => {
								setFormData((prev) => ({
									...prev,
									confirmPassword: e.target.value,
								}))
							}}
						/>
						{errors.confirmPassword && (
							<span data-testid="confirmPassword-error">
								{errors.confirmPassword}
							</span>
						)}

						<label>
							<input
								name="termsAccepted"
								type="checkbox"
								checked={formData.termsAccepted}
								onChange={(e) => {
									setFormData((prev) => ({
										...prev,
										termsAccepted: e.target.checked,
									}))
								}}
							/>
							Accept terms
						</label>
						{errors.termsAccepted && (
							<span data-testid="terms-error">{errors.termsAccepted}</span>
						)}

						<Button type="submit">Submit</Button>
					</form>
				)
			}

			const { container } = render(<ValidationForm />)
			// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
			const form = container.querySelector('form')!

			// Submit empty form to trigger validation errors
			await formTesting.submitForm(form)

			// Verify required field validation errors are shown
			expect(
				componentTesting.getElementByTestId('email-error'),
			).toHaveTextContent('Email is required')
			expect(
				componentTesting.getElementByTestId('password-error'),
			).toHaveTextContent('Password is required')
			expect(
				componentTesting.getElementByTestId('terms-error'),
			).toHaveTextContent('You must accept the terms')

			// Test password mismatch validation
			await formTesting.fillTextInputs(form, {
				email: 'test@example.com',
				password: 'password123',
				confirmPassword: 'different123',
			})
			await formTesting.submitForm(form)

			// Verify password mismatch error is shown
			expect(
				componentTesting.getElementByTestId('confirmPassword-error'),
			).toHaveTextContent('Passwords do not match')
			expect(
				componentTesting.getElementByTestId('terms-error'),
			).toHaveTextContent('You must accept the terms')

			// Fill form with mismatched passwords
			await formTesting.fillTextInputs(form, {
				email: 'test@example.com',
				password: 'password123',
				confirmPassword: 'differentpassword',
			})

			await formTesting.toggleCheckboxes(form, {
				termsAccepted: true,
			})

			// Submit again
			await formTesting.submitForm(form)

			// Verify password mismatch error is still shown
			expect(
				componentTesting.getElementByTestId('confirmPassword-error'),
			).toHaveTextContent('Passwords do not match')

			// Fix password mismatch
			await formTesting.fillTextInputs(form, {
				confirmPassword: 'password123',
			})

			// Submit again
			await formTesting.submitForm(form)

			// Verify no errors are shown
			componentTesting.assertElementNotExists('email-error')
			componentTesting.assertElementNotExists('password-error')
			componentTesting.assertElementNotExists('confirmPassword-error')
			componentTesting.assertElementNotExists('terms-error')
		})
	})

	describe('Complex Component Interaction Testing', () => {
		it('should handle a multi-step wizard form', async () => {
			const MultiStepWizard = () => {
				const [currentStep, setCurrentStep] = React.useState(1)
				const [formData, setFormData] = React.useState({
					// Step 1: Personal Info
					name: '',
					email: '',
					// Step 2: Preferences
					theme: '',
					notifications: false,
					// Step 3: Additional Info
					bio: '',
					skills: [] as string[],
				})

				const steps = [
					{ id: 1, title: 'Personal Information' },
					{ id: 2, title: 'Preferences' },
					{ id: 3, title: 'Additional Information' },
				]

				const nextStep = () => {
					if (currentStep < steps.length) {
						setCurrentStep(currentStep + 1)
					}
				}

				const prevStep = () => {
					if (currentStep > 1) {
						setCurrentStep(currentStep - 1)
					}
				}

				const toggleSkill = (skill: string) => {
					setFormData((prev) => ({
						...prev,
						skills: prev.skills.includes(skill)
							? prev.skills.filter((s) => s !== skill)
							: [...prev.skills, skill],
					}))
				}

				return (
					<div data-testid="wizard-container">
						<div data-testid="step-indicator">
							{steps.map((step) => (
								<span
									key={step.id}
									data-testid={`step-${step.id.toString()}`}
									className={currentStep >= step.id ? 'active' : ''}
								>
									{step.title}
								</span>
							))}
						</div>

						<div data-testid="current-step">{currentStep}</div>

						{currentStep === 1 && (
							<div data-testid="step-1-content">
								<h2>Personal Information</h2>
								<form data-testid="step-1-form">
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
											setFormData((prev) => ({
												...prev,
												email: e.target.value,
											}))
										}}
										placeholder="Email"
									/>
								</form>
							</div>
						)}

						{currentStep === 2 && (
							<div data-testid="step-2-content">
								<h2>Preferences</h2>
								<form data-testid="step-2-form">
									<select
										name="theme"
										value={formData.theme}
										onChange={(e) => {
											setFormData((prev) => ({
												...prev,
												theme: e.target.value,
											}))
										}}
									>
										<option value="">Select Theme</option>
										<option value="light">Light</option>
										<option value="dark">Dark</option>
										<option value="auto">Auto</option>
									</select>
									<label>
										<input
											name="notifications"
											type="checkbox"
											checked={formData.notifications}
											onChange={(e) => {
												setFormData((prev) => ({
													...prev,
													notifications: e.target.checked,
												}))
											}}
										/>
										Enable notifications
									</label>
								</form>
							</div>
						)}

						{currentStep === 3 && (
							<div data-testid="step-3-content">
								<h2>Additional Information</h2>
								<form data-testid="step-3-form">
									<textarea
										name="bio"
										value={formData.bio}
										onChange={(e) => {
											setFormData((prev) => ({ ...prev, bio: e.target.value }))
										}}
										placeholder="Tell us about yourself"
									/>
									<div data-testid="skills-section">
										{['React', 'TypeScript', 'Node.js', 'Python', 'Java'].map(
											(skill) => (
												<label key={skill}>
													<input
														type="checkbox"
														checked={formData.skills.includes(skill)}
														onChange={() => {
															toggleSkill(skill)
														}}
													/>
													{skill}
												</label>
											),
										)}
									</div>
								</form>
							</div>
						)}

						<div data-testid="wizard-navigation">
							<Button
								data-testid="prev-btn"
								onClick={prevStep}
								disabled={currentStep === 1}
							>
								Previous
							</Button>
							<Button
								data-testid="next-btn"
								onClick={nextStep}
								disabled={currentStep === steps.length}
							>
								{currentStep === steps.length ? 'Finish' : 'Next'}
							</Button>
						</div>
					</div>
				)
			}

			render(<MultiStepWizard />)

			// Test initial state
			componentTesting.assertElementText('current-step', '1')
			expect(
				componentTesting.getElementByTestId('step-1-content'),
			).toBeInTheDocument()

			// Fill step 1
			const step1Form = componentTesting.getElementByTestId(
				'step-1-form',
			) as HTMLFormElement
			await formTesting.fillTextInputs(step1Form, {
				name: 'Jane Smith',
				email: 'jane@example.com',
			})

			// Navigate to step 2
			await componentTesting.clickElement('next-btn')
			componentTesting.assertElementText('current-step', '2')
			expect(
				componentTesting.getElementByTestId('step-2-content'),
			).toBeInTheDocument()

			// Fill step 2
			const step2Form = componentTesting.getElementByTestId(
				'step-2-form',
			) as HTMLFormElement
			await formTesting.fillSelectFields(step2Form, {
				theme: 'dark',
			})
			await formTesting.toggleCheckboxes(step2Form, {
				notifications: true,
			})

			// Navigate to step 3
			await componentTesting.clickElement('next-btn')
			componentTesting.assertElementText('current-step', '3')
			expect(
				componentTesting.getElementByTestId('step-3-content'),
			).toBeInTheDocument()

			// Fill step 3
			const step3Form = componentTesting.getElementByTestId(
				'step-3-form',
			) as HTMLFormElement
			await formTesting.fillTextareaFields(step3Form, {
				bio: 'Experienced developer with a passion for clean code and user experience.',
			})

			// Test going back to previous steps
			await componentTesting.clickElement('prev-btn')
			componentTesting.assertElementText('current-step', '2')

			// Verify step 2 data is preserved
			formTesting.validateSelectFields(step2Form, {
				theme: 'dark',
			})
			formTesting.validateCheckboxes(step2Form, {
				notifications: true,
			})

			// Go back to step 1
			await componentTesting.clickElement('prev-btn')
			componentTesting.assertElementText('current-step', '1')

			// Verify step 1 data is preserved
			formTesting.validateTextInputs(step1Form, {
				name: 'Jane Smith',
				email: 'jane@example.com',
			})
		})
	})

	describe('Performance and Edge Case Testing', () => {
		it('should handle rapid form interactions', async () => {
			const RapidForm = () => {
				const [values, setValues] = React.useState({
					field1: '',
					field2: '',
					field3: '',
				})

				return (
					<form data-testid="rapid-form">
						<input
							name="field1"
							value={values.field1}
							onChange={(e) => {
								setValues((prev) => ({ ...prev, field1: e.target.value }))
							}}
						/>
						<input
							name="field2"
							value={values.field2}
							onChange={(e) => {
								setValues((prev) => ({ ...prev, field2: e.target.value }))
							}}
						/>
						<input
							name="field3"
							value={values.field3}
							onChange={(e) => {
								setValues((prev) => ({ ...prev, field3: e.target.value }))
							}}
						/>
					</form>
				)
			}

			const { container } = render(<RapidForm />)
			// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
			const form = container.querySelector('form')!

			// Test rapid sequential form filling
			await formTesting.fillTextInputs(form, {
				field1: 'Value 1',
			})

			await formTesting.fillTextInputs(form, {
				field2: 'Value 2',
			})

			await formTesting.fillTextInputs(form, {
				field3: 'Value 3',
			})

			// Verify all values are set correctly
			formTesting.validateTextInputs(form, {
				field1: 'Value 1',
				field2: 'Value 2',
				field3: 'Value 3',
			})
		})

		it('should handle form with many fields efficiently', async () => {
			const LargeForm = () => {
				const [formData, setFormData] = React.useState(
					Object.fromEntries(
						Array.from({ length: 20 }, (_, i) => [`field${i.toString()}`, '']),
					),
				)

				return (
					<form data-testid="large-form">
						{Array.from({ length: 20 }, (_, i) => (
							<input
								key={i}
								name={`field${i.toString()}`}
								value={
									formData[`field${i.toString()}` as keyof typeof formData]
								}
								onChange={(e) => {
									setFormData((prev) => ({
										...prev,
										[`field${i.toString()}`]: e.target.value,
									}))
								}}
							/>
						))}
					</form>
				)
			}

			const { container } = render(<LargeForm />)
			// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
			const form = container.querySelector('form')!

			// Create test data for all fields
			const testData = Object.fromEntries(
				Array.from({ length: 20 }, (_, i) => [
					`field${i.toString()}`,
					`Test Value ${i.toString()}`,
				]),
			)

			// Fill all fields at once
			await formTesting.fillTextInputs(form, testData)

			// Validate all fields
			formTesting.validateTextInputs(form, testData)
		})
	})
})
