// Utility Schemas

import { z } from 'zod'

/**
 * Password validation function
 * - Minimum length: 8 characters
 * - Maximum length: 15 characters
 * - Must contain at least 1 number
 * - Must contain at least 1 special character
 * - Must contain at least 1 uppercase letter
 * - Must contain at least 1 lowercase letter
 */
const passwordValidation = () =>
	z
		.string()
		.min(8, {
			message: 'Password must be at least 8 characters',
		})
		.max(15, {
			message: 'Password must be at most 15 characters',
		})
		.regex(/\d/, {
			message: 'Password must contain at least one number',
		})
		.regex(/[!@#$%^&*(),.?":{}|<>]/, {
			message: 'Password must contain at least one special character',
		})
		.regex(/[A-Z]/, {
			message: 'Password must contain at least one uppercase letter',
		})
		.regex(/[a-z]/, {
			message: 'Password must contain at least one lowercase letter',
		})

const emailValidation = () =>
	z.string().email({
		message: 'Invalid email address',
	})

export { emailValidation, passwordValidation }
