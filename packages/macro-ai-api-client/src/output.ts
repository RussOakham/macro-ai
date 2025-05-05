import { makeApi, Zodios, type ZodiosOptions } from '@zodios/core'
import { z } from 'zod'

const RegisterRequest = z
	.object({
		email: z.string(),
		password: z.string(),
		firstName: z.string().optional(),
		lastName: z.string().optional(),
	})
	.passthrough()
const AuthResponse = z
	.object({
		message: z.string(),
		user: z
			.object({ id: z.string(), email: z.string() })
			.partial()
			.passthrough()
			.optional(),
		tokens: z
			.object({
				accessToken: z.string(),
				refreshToken: z.string(),
				expiresIn: z.number(),
			})
			.partial()
			.passthrough()
			.optional(),
	})
	.passthrough()
const ErrorResponse = z
	.object({
		message: z.string(),
		details: z.object({}).partial().passthrough(),
	})
	.partial()
	.passthrough()
const LoginRequest = z
	.object({ email: z.string(), password: z.string() })
	.passthrough()
const TokenResponse = z
	.object({
		accessToken: z.string(),
		refreshToken: z.string(),
		expiresIn: z.number(),
	})
	.passthrough()
const UserProfile = z
	.object({
		id: z.string(),
		email: z.string(),
		emailVerified: z.boolean(),
		firstName: z.string().optional(),
		lastName: z.string().optional(),
		createdAt: z.string().datetime({ offset: true }).optional(),
		updatedAt: z.string().datetime({ offset: true }).optional(),
		lastLogin: z.string().datetime({ offset: true }).optional(),
	})
	.passthrough()
const ConfirmRegistration = z
	.object({ username: z.string(), code: z.number() })
	.passthrough()
const ResendConfirmationCode = z.object({ username: z.string() }).passthrough()
const GetAuthUserResponse = z
	.object({
		id: z.string(),
		email: z.string(),
		emailVerified: z.boolean(),
		firstName: z.string().optional(),
		lastName: z.string().optional(),
		createdAt: z.string().datetime({ offset: true }).optional(),
		updatedAt: z.string().datetime({ offset: true }).optional(),
		lastLogin: z.string().datetime({ offset: true }).optional(),
	})
	.passthrough()
const postAuthconfirmForgotPassword_Body = z
	.object({
		email: z.string().email(),
		code: z.string(),
		newPassword: z.string(),
		confirmPassword: z.string(),
	})
	.passthrough()

export const schemas = {
	RegisterRequest,
	AuthResponse,
	ErrorResponse,
	LoginRequest,
	TokenResponse,
	UserProfile,
	ConfirmRegistration,
	ResendConfirmationCode,
	GetAuthUserResponse,
	postAuthconfirmForgotPassword_Body,
}

const endpoints = makeApi([
	{
		method: 'post',
		path: '/auth/confirm-forgot-password',
		description: `Resets the user&#x27;s password using the confirmation code`,
		requestFormat: 'json',
		parameters: [
			{
				name: 'body',
				type: 'Body',
				schema: postAuthconfirmForgotPassword_Body,
			},
		],
		response: z.object({ message: z.string() }).passthrough(),
		errors: [
			{
				status: 400,
				description: `Bad Request - The request was malformed or contains invalid parameters`,
				schema: z
					.object({
						message: z.string(),
						details: z.object({}).partial().passthrough(),
					})
					.partial()
					.passthrough(),
			},
			{
				status: 404,
				description: `Not Found - The requested resource was not found`,
				schema: z.object({ message: z.string() }).partial().passthrough(),
			},
			{
				status: 500,
				description: `Server Error - An unexpected error occurred on the server`,
				schema: z
					.object({
						message: z.string(),
						details: z.object({}).partial().passthrough(),
					})
					.partial()
					.passthrough(),
			},
		],
	},
	{
		method: 'post',
		path: '/auth/confirm-registration',
		requestFormat: 'json',
		parameters: [
			{
				name: 'body',
				type: 'Body',
				schema: ConfirmRegistration,
			},
		],
		response: AuthResponse,
		errors: [
			{
				status: 400,
				description: `Invalid verification code`,
				schema: ErrorResponse,
			},
			{
				status: 404,
				description: `User not found`,
				schema: ErrorResponse,
			},
			{
				status: 500,
				description: `Internal server error`,
				schema: ErrorResponse,
			},
		],
	},
	{
		method: 'post',
		path: '/auth/forgot-password',
		description: `Sends a password reset code to the user&#x27;s email`,
		requestFormat: 'json',
		parameters: [
			{
				name: 'body',
				type: 'Body',
				schema: z.object({ email: z.string().email() }).passthrough(),
			},
		],
		response: z.object({ message: z.string() }).passthrough(),
		errors: [
			{
				status: 400,
				description: `Bad Request - The request was malformed or contains invalid parameters`,
				schema: z
					.object({
						message: z.string(),
						details: z.object({}).partial().passthrough(),
					})
					.partial()
					.passthrough(),
			},
			{
				status: 404,
				description: `Not Found - The requested resource was not found`,
				schema: z.object({ message: z.string() }).partial().passthrough(),
			},
			{
				status: 500,
				description: `Server Error - An unexpected error occurred on the server`,
				schema: z
					.object({
						message: z.string(),
						details: z.object({}).partial().passthrough(),
					})
					.partial()
					.passthrough(),
			},
		],
	},
	{
		method: 'post',
		path: '/auth/login',
		description: `Authenticates a user and returns tokens as cookies and in response body`,
		requestFormat: 'json',
		parameters: [
			{
				name: 'body',
				type: 'Body',
				schema: LoginRequest,
			},
		],
		response: z
			.object({ message: z.string(), tokens: TokenResponse, user: UserProfile })
			.partial()
			.passthrough(),
		errors: [
			{
				status: 400,
				description: `Invalid credentials`,
				schema: ErrorResponse,
			},
			{
				status: 500,
				description: `Internal server error`,
				schema: ErrorResponse,
			},
		],
	},
	{
		method: 'post',
		path: '/auth/logout',
		description: `Invalidates the user&#x27;s tokens and clears authentication cookies`,
		requestFormat: 'json',
		response: z.object({ message: z.string() }).partial().passthrough(),
		errors: [
			{
				status: 401,
				description: `Unauthorized - No valid session`,
				schema: ErrorResponse,
			},
			{
				status: 500,
				description: `Internal server error`,
				schema: ErrorResponse,
			},
		],
	},
	{
		method: 'post',
		path: '/auth/refresh',
		description: `Uses a refresh token to obtain a new access token`,
		requestFormat: 'json',
		response: z
			.object({ message: z.string(), tokens: TokenResponse })
			.partial()
			.passthrough(),
		errors: [
			{
				status: 401,
				description: `Invalid or expired refresh token`,
				schema: ErrorResponse,
			},
			{
				status: 500,
				description: `Internal server error`,
				schema: ErrorResponse,
			},
		],
	},
	{
		method: 'post',
		path: '/auth/register',
		description: `Creates a new user account in Cognito and the application database`,
		requestFormat: 'json',
		parameters: [
			{
				name: 'body',
				type: 'Body',
				schema: RegisterRequest,
			},
		],
		response: AuthResponse,
		errors: [
			{
				status: 400,
				description: `Invalid input or user already exists`,
				schema: ErrorResponse,
			},
			{
				status: 500,
				description: `Internal server error`,
				schema: ErrorResponse,
			},
		],
	},
	{
		method: 'post',
		path: '/auth/resend-confirmation-code',
		requestFormat: 'json',
		parameters: [
			{
				name: 'body',
				type: 'Body',
				schema: z.object({ username: z.string() }).passthrough(),
			},
		],
		response: z.void(),
		errors: [
			{
				status: 400,
				description: `Bad request`,
				schema: z.void(),
			},
			{
				status: 500,
				description: `Internal server error`,
				schema: z.void(),
			},
		],
	},
	{
		method: 'get',
		path: '/auth/user',
		description: `Retrieves the authenticated user&#x27;s profile information`,
		requestFormat: 'json',
		response: GetAuthUserResponse,
		errors: [
			{
				status: 401,
				description: `Unauthorized - Authentication required`,
				schema: z.union([
					z.object({ message: z.string() }).partial().passthrough(),
					z
						.object({ message: z.string(), code: z.string() })
						.partial()
						.passthrough(),
				]),
			},
			{
				status: 404,
				description: `User not found`,
				schema: ErrorResponse,
			},
			{
				status: 500,
				description: `Internal server error`,
				schema: ErrorResponse,
			},
		],
	},
	{
		method: 'get',
		path: '/health',
		description: `Returns the current health status of the API`,
		requestFormat: 'json',
		response: z.object({ message: z.string() }).partial().passthrough(),
		errors: [
			{
				status: 500,
				description: `API is unhealthy`,
				schema: z.object({ message: z.string() }).partial().passthrough(),
			},
		],
	},
	{
		method: 'get',
		path: '/users/me',
		description: `Returns the profile of the currently authenticated user`,
		requestFormat: 'json',
		response: UserProfile,
		errors: [
			{
				status: 401,
				description: `Unauthorized - Authentication required or token expired`,
				schema: ErrorResponse,
			},
			{
				status: 500,
				description: `Internal server error`,
				schema: ErrorResponse,
			},
		],
	},
])

export const api = new Zodios(endpoints)

export function createApiClient(baseUrl: string, options?: ZodiosOptions) {
	return new Zodios(baseUrl, endpoints, options)
}
