/* eslint-disable func-style */
import { makeApi, Zodios, type ZodiosOptions } from '@zodios/core'
import { z } from 'zod'

const Register = z
	.object({ email: z.string(), password: z.string() })
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
			.object({ accessToken: z.string(), refreshToken: z.string() })
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
const ConfirmRegistration = z
	.object({ username: z.string(), code: z.number() })
	.passthrough()
const ResendConfirmationCode = z.object({ username: z.string() }).passthrough()
const Login = z
	.object({ email: z.string(), password: z.string() })
	.passthrough()
const GetUserResponse = z
	.object({ id: z.string(), email: z.string(), emailVerified: z.boolean() })
	.passthrough()
const postAuthconfirmForgotPassword_Body = z
	.object({
		email: z.string().email(),
		code: z.string(),
		newPassword: z.string(),
		confirmPassword: z.string(),
	})
	.passthrough()
const HealthResponse = z.object({ message: z.string() }).partial().passthrough()

export const schemas = {
	Register,
	AuthResponse,
	ErrorResponse,
	ConfirmRegistration,
	ResendConfirmationCode,
	Login,
	GetUserResponse,
	postAuthconfirmForgotPassword_Body,
	HealthResponse,
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
		response: z.object({ message: z.string() }).partial().passthrough(),
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
		response: z.object({ message: z.string() }).partial().passthrough(),
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
		requestFormat: 'json',
		parameters: [
			{
				name: 'body',
				type: 'Body',
				schema: Login,
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
					.partial()
					.passthrough(),
			})
			.partial()
			.passthrough(),
		errors: [
			{
				status: 400,
				description: `Invalid credentials`,
				schema: ErrorResponse,
			},
			{
				status: 401,
				description: `User not confirmed`,
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
					.partial()
					.passthrough(),
			})
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
		requestFormat: 'json',
		parameters: [
			{
				name: 'body',
				type: 'Body',
				schema: Register,
			},
		],
		response: AuthResponse,
		errors: [
			{
				status: 400,
				description: `Validation error`,
				schema: ErrorResponse,
			},
			{
				status: 409,
				description: `User already exists`,
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
		response: GetUserResponse,
		errors: [
			{
				status: 401,
				description: `Unauthorized - Invalid or expired token`,
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
		method: 'get',
		path: '/health',
		description: `Returns the current health status of the API`,
		requestFormat: 'json',
		response: z.object({ message: z.string() }).partial().passthrough(),
		errors: [
			{
				status: 500,
				description: `API is unhealthy`,
				schema: ErrorResponse,
			},
		],
	},
])

export const api = new Zodios(endpoints)

export function createApiClient(baseUrl: string, options?: ZodiosOptions) {
	return new Zodios(baseUrl, endpoints, options)
}
