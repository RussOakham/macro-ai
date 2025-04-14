import { z } from 'zod'

// Base password validation that can be reused
const passwordSchema = z
	.string({
		required_error: 'Please enter your password',
	})
	.min(8, {
		message: 'Password must be at least 8 characters long',
	})

// Base email validation that can be reused
const emailSchema = z
	.string({
		required_error: 'Please enter your email address',
	})
	.email({
		message: 'Please enter a valid email address',
	})

export const loginSchema = z.object({
	email: emailSchema,
	password: passwordSchema,
})

export const registerSchema = z
	.object({
		email: emailSchema,
		password: passwordSchema,
		confirmPassword: z.string({
			required_error: 'Please confirm your password',
		}),
	})
	.refine((data) => data.password === data.confirmPassword, {
		message: 'Passwords do not match',
		path: ['confirmPassword'],
	})

export const confirmationSchema = z.object({
	username: emailSchema,
	code: z
		.string({
			required_error: 'Please enter the 6-digit code we sent to your email.',
		})
		.length(6, {
			message: 'Please enter all 6 digits.',
		})
		.regex(/^\d+$/, {
			message: 'Code must only contain numbers.',
		}),
})

export const getUserSchema = z.object({
	enabled: z.boolean().optional(),
})
