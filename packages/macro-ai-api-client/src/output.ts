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
const postChatsIdstream_Body = z
	.object({
		content: z.string().min(1).max(10000),
		role: z.enum(['user', 'assistant', 'system']).optional().default('user'),
	})
	.passthrough()

export const schemas = {
	postAuthregister_Body,
	postAuthconfirmRegistration_Body,
	postAuthlogin_Body,
	postAuthconfirmForgotPassword_Body,
	postChatsIdstream_Body,
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
		path: '/chats',
		description: `Retrieves all chats for the authenticated user with pagination support. Supports optional query parameters: page (default: 1) and limit (default: 20, max: 100).`,
		requestFormat: 'json',
		parameters: [
			{
				name: 'page',
				type: 'Query',
				schema: z.number().int().gte(1).optional().default(1),
			},
			{
				name: 'limit',
				type: 'Query',
				schema: z.number().int().gte(1).lte(100).optional().default(20),
			},
		],
		response: z
			.object({
				success: z.boolean(),
				data: z.array(
					z
						.object({
							id: z.string().uuid(),
							userId: z.string().uuid(),
							title: z.string().max(255),
							createdAt: z.string().nullable(),
							updatedAt: z.string().nullable(),
						})
						.passthrough(),
				),
				meta: z
					.object({ page: z.number(), limit: z.number(), total: z.number() })
					.passthrough(),
			})
			.passthrough(),
		errors: [
			{
				status: 401,
				description: `Authentication required`,
				schema: z.object({ message: z.string() }).passthrough(),
			},
			{
				status: 429,
				description: `Rate limit exceeded`,
				schema: z
					.object({ status: z.number(), message: z.string() })
					.passthrough(),
			},
			{
				status: 500,
				description: `Server error - Database or service error`,
				schema: z.object({ message: z.string() }).passthrough(),
			},
		],
	},
	{
		method: 'post',
		path: '/chats',
		description: `Creates a new chat conversation for the authenticated user.`,
		requestFormat: 'json',
		parameters: [
			{
				name: 'body',
				type: 'Body',
				schema: z.object({ title: z.string().min(1).max(255) }).passthrough(),
			},
		],
		response: z
			.object({
				success: z.boolean(),
				data: z
					.object({
						id: z.string().uuid(),
						userId: z.string().uuid(),
						title: z.string().max(255),
						createdAt: z.string().nullable(),
						updatedAt: z.string().nullable(),
					})
					.passthrough(),
			})
			.passthrough(),
		errors: [
			{
				status: 400,
				description: `Invalid request data`,
				schema: z
					.object({
						message: z.string(),
						details: z.record(z.unknown().nullable()).optional(),
					})
					.passthrough(),
			},
			{
				status: 401,
				description: `Authentication required`,
				schema: z.object({ message: z.string() }).passthrough(),
			},
			{
				status: 429,
				description: `Rate limit exceeded`,
				schema: z
					.object({ status: z.number(), message: z.string() })
					.passthrough(),
			},
			{
				status: 500,
				description: `Server error - Database or service error`,
				schema: z.object({ message: z.string() }).passthrough(),
			},
		],
	},
	{
		method: 'get',
		path: '/chats/:id',
		description: `Retrieves a specific chat with all its messages. User must own the chat.`,
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
				success: z.boolean(),
				data: z
					.object({
						id: z.string().uuid(),
						userId: z.string().uuid(),
						title: z.string(),
						createdAt: z.string(),
						updatedAt: z.string(),
						messages: z.array(
							z
								.object({
									id: z.string().uuid(),
									chatId: z.string().uuid(),
									role: z.string().max(20),
									content: z.string(),
									metadata: z.union([
										z.string(),
										z.number(),
										z.boolean(),
										z.unknown(),
										z.record(z.unknown().nullable()),
										z.array(z.unknown().nullable()),
										z.unknown(),
									]),
									embedding: z.array(z.number()).nullable(),
									createdAt: z.string().nullable(),
								})
								.passthrough(),
						),
					})
					.passthrough(),
			})
			.passthrough(),
		errors: [
			{
				status: 401,
				description: `Authentication required`,
				schema: z.object({ message: z.string() }).passthrough(),
			},
			{
				status: 404,
				description: `Chat not found or access denied`,
				schema: z.object({ message: z.string() }).passthrough(),
			},
			{
				status: 429,
				description: `Rate limit exceeded`,
				schema: z
					.object({ status: z.number(), message: z.string() })
					.passthrough(),
			},
			{
				status: 500,
				description: `Server error - Database or service error`,
				schema: z.object({ message: z.string() }).passthrough(),
			},
		],
	},
	{
		method: 'put',
		path: '/chats/:id',
		description: `Updates chat title. User must own the chat.`,
		requestFormat: 'json',
		parameters: [
			{
				name: 'body',
				type: 'Body',
				schema: z.object({ title: z.string().min(1).max(255) }).passthrough(),
			},
			{
				name: 'id',
				type: 'Path',
				schema: z.string().uuid(),
			},
		],
		response: z
			.object({
				success: z.boolean(),
				data: z
					.object({
						id: z.string().uuid(),
						userId: z.string().uuid(),
						title: z.string().max(255),
						createdAt: z.string().nullable(),
						updatedAt: z.string().nullable(),
					})
					.passthrough(),
			})
			.passthrough(),
		errors: [
			{
				status: 400,
				description: `Invalid request data`,
				schema: z
					.object({
						message: z.string(),
						details: z.record(z.unknown().nullable()).optional(),
					})
					.passthrough(),
			},
			{
				status: 401,
				description: `Authentication required`,
				schema: z.object({ message: z.string() }).passthrough(),
			},
			{
				status: 404,
				description: `Chat not found or access denied`,
				schema: z.object({ message: z.string() }).passthrough(),
			},
			{
				status: 429,
				description: `Rate limit exceeded`,
				schema: z
					.object({ status: z.number(), message: z.string() })
					.passthrough(),
			},
			{
				status: 500,
				description: `Server error - Database or service error`,
				schema: z.object({ message: z.string() }).passthrough(),
			},
		],
	},
	{
		method: 'delete',
		path: '/chats/:id',
		description: `Deletes a chat and all its messages. User must own the chat. This action cannot be undone.`,
		requestFormat: 'json',
		parameters: [
			{
				name: 'id',
				type: 'Path',
				schema: z.string().uuid(),
			},
		],
		response: z
			.object({ success: z.boolean(), message: z.string() })
			.partial()
			.passthrough(),
		errors: [
			{
				status: 401,
				description: `Authentication required`,
				schema: z.object({ message: z.string() }).passthrough(),
			},
			{
				status: 404,
				description: `Chat not found or access denied`,
				schema: z.object({ message: z.string() }).passthrough(),
			},
			{
				status: 429,
				description: `Rate limit exceeded`,
				schema: z
					.object({ status: z.number(), message: z.string() })
					.passthrough(),
			},
			{
				status: 500,
				description: `Server error - Database or service error`,
				schema: z.object({ message: z.string() }).passthrough(),
			},
		],
	},
	{
		method: 'post',
		path: '/chats/:id/stream',
		description: `Send a message and receive streaming AI response via Server-Sent Events`,
		requestFormat: 'json',
		parameters: [
			{
				name: 'body',
				description: `Message to send`,
				type: 'Body',
				schema: postChatsIdstream_Body,
			},
			{
				name: 'id',
				type: 'Path',
				schema: z.string().uuid(),
			},
		],
		response: z.void(),
		errors: [
			{
				status: 400,
				description: `Invalid request parameters`,
				schema: z
					.object({
						message: z.string(),
						details: z.record(z.unknown().nullable()).optional(),
					})
					.passthrough(),
			},
			{
				status: 401,
				description: `Authentication required`,
				schema: z.object({ message: z.string() }).passthrough(),
			},
			{
				status: 404,
				description: `Chat not found or access denied`,
				schema: z.object({ message: z.string() }).passthrough(),
			},
			{
				status: 429,
				description: `Rate limit exceeded`,
				schema: z
					.object({ status: z.number(), message: z.string() })
					.passthrough(),
			},
			{
				status: 500,
				description: `Internal server error`,
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
