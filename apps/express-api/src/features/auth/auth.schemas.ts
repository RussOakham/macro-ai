import { z } from 'zod'

import { registerZodSchema } from '../../utils/swagger/openapi-registry.ts'

// Utility Schemas

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

// Base auth response schema
const authResponseSchema = registerZodSchema(
	'AuthResponse',
	z.object({
		message: z.string().openapi({ description: 'Response message' }),
	}),
	'Generic authentication response',
)

// Registration Schemas
const registerUserRequestSchema = registerZodSchema(
	'RegisterRequest',
	z
		.object({
			email: emailValidation().openapi({ description: 'User email address' }),
			password: passwordValidation().openapi({ description: 'User password' }),
			confirmPassword: passwordValidation().openapi({
				description: 'Confirm password',
			}),
		})
		.refine((data) => data.password === data.confirmPassword, {
			message: 'Passwords do not match',
			path: ['confirmPassword'],
		}),
	'User registration request',
)

const registerUserResponseSchema = registerZodSchema(
	'RegisterResponse',
	authResponseSchema
		.extend({
			user: z.object({
				id: z.string().openapi({ description: 'User ID' }),
				email: z.string().openapi({ description: 'User email address' }),
			}),
		})
		.openapi({ description: 'User registration response' }),
	'User registration response',
)

// Confirm Registration Schemas
const confirmRegistrationRequestSchema = registerZodSchema(
	'ConfirmRegistration',
	z.object({
		email: emailValidation().openapi({ description: 'User email address' }),
		code: z
			.number()
			.openapi({ description: 'Verification code sent to email' }),
	}),
	'Confirm user registration with verification code',
)

const resendConfirmationCodeRequestSchema = registerZodSchema(
	'ResendConfirmationCode',
	z.object({
		email: emailValidation().openapi({ description: 'User email address' }),
	}),
	'Request to resend confirmation code',
)

// Login Request Schema
const loginRequestSchema = registerZodSchema(
	'LoginRequest',
	z.object({
		email: emailValidation().openapi({ description: 'User email address' }),
		password: passwordValidation().openapi({ description: 'User password' }),
	}),
	'User login request',
)

// Login Response Schema
const tokenResponseSchema = registerZodSchema(
	'TokenResponse',
	z.object({
		accessToken: z.string().openapi({ description: 'JWT access token' }),
		refreshToken: z.string().openapi({ description: 'JWT refresh token' }),
		expiresIn: z
			.number()
			.openapi({ description: 'Token expiration time in seconds' }),
	}),
	'Authentication tokens response',
)

// Register a generic auth response schema
const loginResponseSchema = registerZodSchema(
	'AuthResponse',
	authResponseSchema
		.extend({
			tokens: tokenResponseSchema.openapi({
				description: 'Authentication tokens',
			}),
		})
		.openapi({ description: 'Authentication response' }),
	'Generic authentication response',
)

// Forgot Password Schemas
const forgotPasswordRequestSchema = registerZodSchema(
	'ForgotPasswordRequest',
	z.object({
		email: emailValidation().openapi({ description: 'User email address' }),
	}),
	'Request to initiate password reset',
)

const confirmForgotPasswordRequestSchema = registerZodSchema(
	'ConfirmForgotPasswordRequest',
	z
		.object({
			email: emailValidation().openapi({ description: 'User email address' }),
			code: z
				.string()
				.min(6, 'Code must be at least 6 characters')
				.max(6, 'Code must be exactly 6 characters')
				.openapi({ description: 'Verification code sent to email' }),
			newPassword: passwordValidation().openapi({
				description: 'New password',
			}),
			confirmPassword: passwordValidation().openapi({
				description: 'Confirm new password',
			}),
		})
		.refine((data) => data.newPassword === data.confirmPassword, {
			message: 'Passwords do not match',
			path: ['confirmPassword'],
		}),
	'Request to confirm password reset with code',
)

// Get Authenticated User Schemas
const getAuthUserResponseSchema = registerZodSchema(
	'GetAuthUserResponse',
	z.object({
		id: z.string().openapi({ description: 'User ID' }),
		email: z.string().openapi({ description: 'User email address' }),
		emailVerified: z
			.boolean()
			.openapi({ description: 'Email verification status' }),
	}),
	'Authenticated user information response',
)

export {
	authResponseSchema,
	confirmForgotPasswordRequestSchema,
	confirmRegistrationRequestSchema,
	forgotPasswordRequestSchema,
	getAuthUserResponseSchema,
	loginRequestSchema,
	loginResponseSchema,
	registerUserRequestSchema,
	registerUserResponseSchema,
	resendConfirmationCodeRequestSchema,
}
