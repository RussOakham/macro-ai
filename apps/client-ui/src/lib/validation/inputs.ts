// Utility Schemas

import { z } from 'zod'

/**
 * Secure password validation function
 * Requirements:
 * - Minimum 8 characters
 * - At least one uppercase letter (A-Z)
 * - At least one lowercase letter (a-z)
 * - At least one digit (0-9)
 * - At least one special character (!@#$%^&*()_+-=[]{}|;:,.<>?)
 */
const passwordValidation = () =>
	z
		.string()
		.min(8, {
			message: 'Password must be at least 8 characters long',
		})
		.regex(
			/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=[\]{}|;:,.<>?])/,
			{
				message:
					'Password must contain at least one uppercase letter, one lowercase letter, one digit, and one special character',
			},
		)

const emailValidation = () =>
	z.email({
		message: 'Invalid email address',
	})

export { emailValidation, passwordValidation }
