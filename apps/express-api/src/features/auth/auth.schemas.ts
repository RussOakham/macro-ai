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
export const passwordValidation = () =>
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

export const emailValidation = () =>
	z.string().email({
		message: 'Invalid email address',
	})

export const registerSchema = z
	.object({
		email: emailValidation(),
		password: passwordValidation(),
		confirmPassword: passwordValidation(),
	})
	.refine((data) => data.password === data.confirmPassword, {
		message: 'Passwords do not match',
		path: ['confirmPassword'],
	})

export const confirmRegistrationSchema = z.object({
	username: emailValidation(),
	code: z.number(),
})

export const resendConfirmationCodeSchema = z.object({
	username: emailValidation(),
})

export const loginSchema = z.object({
	email: emailValidation(),
	password: passwordValidation(),
})

export const loginResponseSchema = z.object({
	accessToken: z.string(),
	refreshToken: z.string(),
	expiresIn: z.number(),
})

export const refreshTokenSchema = z.object({
	refreshToken: z.string({
		message: 'Invalid refresh token',
		required_error: 'Refresh token is required',
	}),
})

export const forgotPasswordSchema = z.object({
	email: emailValidation(),
})

export const confirmForgotPasswordSchema = z
	.object({
		email: emailValidation(),
		code: z
			.string()
			.min(6, 'Code must be at least 6 characters')
			.max(6, 'Code must be exactly 6 characters'),
		newPassword: passwordValidation(),
		confirmPassword: passwordValidation(),
	})
	.refine((data) => data.newPassword === data.confirmPassword, {
		message: 'Passwords do not match',
		path: ['confirmPassword'],
	})

export const getAuthUserSchema = z.object({
	accessToken: z.string({
		message: 'Invalid access token',
		required_error: 'Access token is required',
	}),
})

export const getAuthUserResponseSchema = z.object({
	id: z.string(),
	email: z.string(),
	emailVerified: z.boolean(),
})
