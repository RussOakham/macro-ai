// MANUAL IMPLEMENTATION - Do not overwrite during generation
import { makeApi, Zodios, type ZodiosOptions } from '@zodios/core'
import { z } from 'zod'

import {
	postAuthconfirmForgotPassword_Body,
	postAuthconfirmRegistration_Body,
	postAuthlogin_Body,
	postAuthregister_Body,
} from '../schemas/auth.schemas'

const authEndpoints = makeApi([
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
])

export const authClient = new Zodios(authEndpoints)

export function createAuthClient(baseUrl: string, options?: ZodiosOptions) {
	return new Zodios(baseUrl, authEndpoints, options)
}

export { authEndpoints }
