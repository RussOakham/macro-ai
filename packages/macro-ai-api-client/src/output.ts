import { makeApi, Zodios, type ZodiosOptions } from '@zodios/core'
import { z } from 'zod'

const postAuthregister_Body = z
	.object({
		email: z.string().email(),
		password: z.string().min(8).max(15).regex(/\d/),
		confirmPassword: z.string().min(8).max(15).regex(/\d/),
	})
	.passthrough()
const postAuthconfirmRegistration_Body = z
	.object({ email: z.string().email(), code: z.number() })
	.passthrough()
const postAuthlogin_Body = z
	.object({
		email: z.string().email(),
		password: z.string().min(8).max(15).regex(/\d/),
	})
	.passthrough()
const postAuthconfirmForgotPassword_Body = z
	.object({
		email: z.string().email(),
		code: z.string().min(6).max(6),
		newPassword: z.string().min(8).max(15).regex(/\d/),
		confirmPassword: z.string().min(8).max(15).regex(/\d/),
	})
	.passthrough()

export const schemas = {
	postAuthregister_Body,
	postAuthconfirmRegistration_Body,
	postAuthlogin_Body,
	postAuthconfirmForgotPassword_Body,
}

const endpoints = makeApi([
	{
		method: 'post',
		path: '/auth/confirm-forgot-password',
		description: `Confirms password reset using the reset code and sets a new password.`,
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
				description: `Invalid reset code (CodeMismatchException) or request data validation failed`,
				schema: z.object({ message: z.string() }).passthrough(),
			},
			{
				status: 404,
				description: `User not found`,
				schema: z.object({ message: z.string() }).passthrough(),
			},
			{
				status: 410,
				description: `Reset code has expired (ExpiredCodeException)`,
				schema: z.object({ message: z.string() }).passthrough(),
			},
			{
				status: 429,
				description: `Too many password reset attempts - rate limit exceeded`,
				schema: z
					.object({ status: z.number(), message: z.string() })
					.passthrough(),
			},
			{
				status: 500,
				description: `Server error - Cognito or database error`,
				schema: z.object({ message: z.string() }).passthrough(),
			},
		],
	},
	{
		method: 'post',
		path: '/auth/confirm-registration',
		description: `Confirms user registration using the confirmation code sent via email.`,
		requestFormat: 'json',
		parameters: [
			{
				name: 'body',
				type: 'Body',
				schema: postAuthconfirmRegistration_Body,
			},
		],
		response: z.object({ message: z.string() }).passthrough(),
		errors: [
			{
				status: 400,
				description: `Invalid confirmation code (CodeMismatchException) or request data validation failed`,
				schema: z.object({ message: z.string() }).passthrough(),
			},
			{
				status: 403,
				description: `Forbidden - User already confirmed`,
				schema: z.object({ message: z.string() }).passthrough(),
			},
			{
				status: 404,
				description: `User not found`,
				schema: z.object({ message: z.string() }).passthrough(),
			},
			{
				status: 410,
				description: `Verification code has expired (ExpiredCodeException)`,
				schema: z.object({ message: z.string() }).passthrough(),
			},
			{
				status: 429,
				description: `Too many confirmation attempts - rate limit exceeded`,
				schema: z
					.object({ status: z.number(), message: z.string() })
					.passthrough(),
			},
			{
				status: 500,
				description: `Server error - Cognito or database error`,
				schema: z.object({ message: z.string() }).passthrough(),
			},
		],
	},
	{
		method: 'post',
		path: '/auth/forgot-password',
		description: `Initiates password reset process by sending a reset code to the user&#x27;s email address.`,
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
				description: `Invalid request data - validation failed`,
				schema: z
					.object({
						message: z.string(),
						details: z.record(z.unknown().nullable()).optional(),
					})
					.passthrough(),
			},
			{
				status: 404,
				description: `User not found`,
				schema: z.object({ message: z.string() }).passthrough(),
			},
			{
				status: 429,
				description: `Too many password reset attempts - rate limit exceeded`,
				schema: z
					.object({ status: z.number(), message: z.string() })
					.passthrough(),
			},
			{
				status: 500,
				description: `Server error - Cognito or database error`,
				schema: z.object({ message: z.string() }).passthrough(),
			},
		],
	},
	{
		method: 'post',
		path: '/auth/login',
		description: `Authenticates a user with email and password, returning access tokens upon successful login.`,
		requestFormat: 'json',
		parameters: [
			{
				name: 'body',
				type: 'Body',
				schema: postAuthlogin_Body,
			},
		],
		response: z
			.object({
				message: z.string(),
				tokens: z
					.object({
						accessToken: z.string(),
						refreshToken: z.string(),
						expiresIn: z.number(),
					})
					.passthrough(),
			})
			.passthrough(),
		errors: [
			{
				status: 400,
				description: `Invalid credentials or request data`,
				schema: z
					.object({
						message: z.string(),
						details: z.record(z.unknown().nullable()).optional(),
					})
					.passthrough(),
			},
			{
				status: 401,
				description: `Unauthorized - Invalid email or password`,
				schema: z.object({ message: z.string() }).passthrough(),
			},
			{
				status: 403,
				description: `Forbidden - User not confirmed (UserNotConfirmedException)`,
				schema: z.object({ message: z.string() }).passthrough(),
			},
			{
				status: 429,
				description: `Too many login attempts - rate limit exceeded`,
				schema: z
					.object({ status: z.number(), message: z.string() })
					.passthrough(),
			},
			{
				status: 500,
				description: `Server error - Cognito or database error`,
				schema: z.object({ message: z.string() }).passthrough(),
			},
		],
	},
	{
		method: 'post',
		path: '/auth/logout',
		description: `Logs out the authenticated user and invalidates their session.`,
		requestFormat: 'json',
		response: z.object({ message: z.string() }).passthrough(),
		errors: [
			{
				status: 401,
				description: `Unauthorized - Authentication required`,
				schema: z.object({ message: z.string() }).passthrough(),
			},
			{
				status: 500,
				description: `Server error - Cognito or database error`,
				schema: z.object({ message: z.string() }).passthrough(),
			},
		],
	},
	{
		method: 'post',
		path: '/auth/refresh',
		description: `Refreshes the user&#x27;s access token using a valid refresh token.`,
		requestFormat: 'json',
		response: z
			.object({
				message: z.string(),
				tokens: z
					.object({
						accessToken: z.string(),
						refreshToken: z.string(),
						expiresIn: z.number(),
					})
					.passthrough(),
			})
			.passthrough(),
		errors: [
			{
				status: 400,
				description: `Invalid refresh token or request data`,
				schema: z
					.object({
						message: z.string(),
						details: z.record(z.unknown().nullable()).optional(),
					})
					.passthrough(),
			},
			{
				status: 401,
				description: `Unauthorized - Invalid or expired refresh token`,
				schema: z.object({ message: z.string() }).passthrough(),
			},
			{
				status: 500,
				description: `Server error - Cognito or database error`,
				schema: z.object({ message: z.string() }).passthrough(),
			},
		],
	},
	{
		method: 'post',
		path: '/auth/register',
		description: `Creates a new user account with email and password. Sends confirmation email to verify the account.`,
		requestFormat: 'json',
		parameters: [
			{
				name: 'body',
				type: 'Body',
				schema: postAuthregister_Body,
			},
		],
		response: z.object({ message: z.string() }).passthrough(),
		errors: [
			{
				status: 400,
				description: `Invalid request data - validation failed or passwords do not match`,
				schema: z
					.object({
						message: z.string(),
						details: z.record(z.unknown().nullable()).optional(),
					})
					.passthrough(),
			},
			{
				status: 409,
				description: `Conflict - User already exists (from database check)`,
				schema: z.object({ message: z.string() }).passthrough(),
			},
			{
				status: 422,
				description: `User already exists in Cognito (UsernameExistsException)`,
				schema: z.object({ message: z.string() }).passthrough(),
			},
			{
				status: 429,
				description: `Too many registration attempts - rate limit exceeded`,
				schema: z
					.object({ status: z.number(), message: z.string() })
					.passthrough(),
			},
			{
				status: 500,
				description: `Server error - Cognito or database error`,
				schema: z.object({ message: z.string() }).passthrough(),
			},
		],
	},
	{
		method: 'post',
		path: '/auth/resend-confirmation-code',
		description: `Resends the confirmation code to the user&#x27;s email address for account verification.`,
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
				description: `Invalid request data - validation failed or invalid email format`,
				schema: z
					.object({
						message: z.string(),
						details: z.record(z.unknown().nullable()).optional(),
					})
					.passthrough(),
			},
			{
				status: 403,
				description: `Forbidden - User already confirmed`,
				schema: z.object({ message: z.string() }).passthrough(),
			},
			{
				status: 404,
				description: `User not found`,
				schema: z.object({ message: z.string() }).passthrough(),
			},
			{
				status: 429,
				description: `Too many resend attempts - rate limit exceeded`,
				schema: z
					.object({ status: z.number(), message: z.string() })
					.passthrough(),
			},
			{
				status: 500,
				description: `Server error - Cognito or database error`,
				schema: z.object({ message: z.string() }).passthrough(),
			},
		],
	},
	{
		method: 'get',
		path: '/auth/user',
		description: `Retrieves the authenticated user&#x27;s information from Cognito.`,
		requestFormat: 'json',
		response: z
			.object({ id: z.string(), email: z.string(), emailVerified: z.boolean() })
			.passthrough(),
		errors: [
			{
				status: 401,
				description: `Unauthorized - Authentication required`,
				schema: z.object({ message: z.string() }).passthrough(),
			},
			{
				status: 500,
				description: `Server error - Cognito or database error`,
				schema: z.object({ message: z.string() }).passthrough(),
			},
		],
	},
	{
		method: 'get',
		path: '/health',
		description: `Returns the current health status of the API service`,
		requestFormat: 'json',
		response: z.object({ message: z.string() }).passthrough(),
		errors: [
			{
				status: 429,
				description: `Too many requests - rate limit exceeded`,
				schema: z
					.object({ status: z.number(), message: z.string() })
					.passthrough(),
			},
			{
				status: 500,
				description: `Health check failed - internal server error`,
				schema: z.object({ message: z.string() }).passthrough(),
			},
		],
	},
	{
		method: 'get',
		path: '/system-info',
		description: `Returns detailed system information including Node.js version, platform, memory usage, and CPU statistics`,
		requestFormat: 'json',
		response: z
			.object({
				nodeVersion: z.string(),
				platform: z.string(),
				architecture: z.string(),
				uptime: z.number(),
				memoryUsage: z
					.object({
						rss: z.number(),
						heapTotal: z.number(),
						heapUsed: z.number(),
						external: z.number(),
					})
					.passthrough(),
				cpuUsage: z
					.object({ user: z.number(), system: z.number() })
					.passthrough(),
				timestamp: z.string(),
			})
			.passthrough(),
		errors: [
			{
				status: 429,
				description: `Too many requests - rate limit exceeded`,
				schema: z
					.object({ status: z.number(), message: z.string() })
					.passthrough(),
			},
			{
				status: 500,
				description: `Failed to retrieve system information - internal server error`,
				schema: z.object({ message: z.string() }).passthrough(),
			},
		],
	},
	{
		method: 'get',
		path: '/users/:id',
		description: `Retrieves a user&#x27;s profile information by their unique identifier. Requires authentication.`,
		requestFormat: 'json',
		parameters: [
			{
				name: 'id',
				type: 'Path',
				schema: z.string().uuid(),
			},
		],
		response: z
			.object({
				user: z
					.object({
						id: z.string().uuid(),
						email: z.string().max(255),
						emailVerified: z.boolean().nullable(),
						firstName: z.string().max(255).nullable(),
						lastName: z.string().max(255).nullable(),
						createdAt: z.string().nullable(),
						updatedAt: z.string().nullable(),
						lastLogin: z.string().nullable(),
					})
					.passthrough(),
			})
			.passthrough(),
		errors: [
			{
				status: 400,
				description: `Invalid user ID format or missing required parameters`,
				schema: z
					.object({
						message: z.string(),
						details: z.record(z.unknown().nullable()).optional(),
					})
					.passthrough(),
			},
			{
				status: 401,
				description: `Unauthorized - Authentication required, token expired, or invalid token`,
				schema: z.object({ message: z.string() }).passthrough(),
			},
			{
				status: 404,
				description: `User not found - No user exists with the specified ID`,
				schema: z.object({ message: z.string() }).passthrough(),
			},
			{
				status: 429,
				description: `Too many requests - rate limit exceeded`,
				schema: z
					.object({ status: z.number(), message: z.string() })
					.passthrough(),
			},
			{
				status: 500,
				description: `Internal server error - Database or service error`,
				schema: z.object({ message: z.string() }).passthrough(),
			},
		],
	},
	{
		method: 'get',
		path: '/users/me',
		description: `Retrieves the authenticated user&#x27;s profile information including personal details and account status`,
		requestFormat: 'json',
		response: z
			.object({
				user: z
					.object({
						id: z.string().uuid(),
						email: z.string().max(255),
						emailVerified: z.boolean().nullable(),
						firstName: z.string().max(255).nullable(),
						lastName: z.string().max(255).nullable(),
						createdAt: z.string().nullable(),
						updatedAt: z.string().nullable(),
						lastLogin: z.string().nullable(),
					})
					.passthrough(),
			})
			.passthrough(),
		errors: [
			{
				status: 400,
				description: `Invalid request - Authentication token validation failed`,
				schema: z
					.object({
						message: z.string(),
						details: z.record(z.unknown().nullable()).optional(),
					})
					.passthrough(),
			},
			{
				status: 401,
				description: `Unauthorized - Authentication required, token expired, or invalid token`,
				schema: z.object({ message: z.string() }).passthrough(),
			},
			{
				status: 404,
				description: `User not found - The authenticated user does not exist in the system`,
				schema: z.object({ message: z.string() }).passthrough(),
			},
			{
				status: 429,
				description: `Too many requests - rate limit exceeded`,
				schema: z
					.object({ status: z.number(), message: z.string() })
					.passthrough(),
			},
			{
				status: 500,
				description: `Internal server error - Database or service error`,
				schema: z.object({ message: z.string() }).passthrough(),
			},
		],
	},
])

export const api = new Zodios(endpoints)

export function createApiClient(baseUrl: string, options?: ZodiosOptions) {
	return new Zodios(baseUrl, endpoints, options)
}
