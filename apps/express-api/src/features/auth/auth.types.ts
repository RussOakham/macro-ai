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

const registerSchema = z
	.object({
		email: z.string().email({
			message: 'Invalid email address',
		}),
		password: passwordValidation(),
		confirmPassword: passwordValidation(),
	})
	.refine((data) => data.password === data.confirmPassword, {
		message: 'Passwords do not match',
		path: ['confirmPassword'],
	})
type TRegister = z.infer<typeof registerSchema>

const confirmRegistrationSchema = z.object({
	username: z.string().email({
		message: 'Invalid email address',
	}),
	code: z.number(),
})
type TConfirmRegistration = z.infer<typeof confirmRegistrationSchema>

const resendConfirmationCodeSchema = z.object({
	username: z.string().email({
		message: 'Invalid email address',
	}),
})
type TResendConfirmationCode = z.infer<typeof resendConfirmationCodeSchema>

const loginSchema = z.object({
	email: z.string().email({
		message: 'Invalid email address',
	}),
	password: passwordValidation(),
})
type TLogin = z.infer<typeof loginSchema>

export {
	confirmRegistrationSchema,
	loginSchema,
	registerSchema,
	resendConfirmationCodeSchema,
}

export type { TRegister, TLogin, TConfirmRegistration, TResendConfirmationCode }
