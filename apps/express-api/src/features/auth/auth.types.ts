import { z } from 'zod'

/**
 * Password validation function
 *
 * Password maximum length: 15 characters
 * Password minimum length: 8 characters
 * Password requirements:
 * - Contains at least 1 number
 * - Contains at least 1 special character
 * - Contains at least 1 uppercase letter
 * - Contains at least 1 lowercase letter
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

const registerSchema = z.object({
	email: z.string().email({
		message: 'Invalid email address',
	}),
	password: passwordValidation(),
	username: z.string().min(5).max(15),
})
type TRegister = z.infer<typeof registerSchema>

export { registerSchema, type TRegister }
