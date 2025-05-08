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
				description: `Unauthorized - Authentication required`,
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
				schema: z
					.object({
						message: z.string(),
						details: z.record(z.unknown().nullable()).optional(),
					})
					.passthrough(),
			},
			{
				status: 409,
				description: `Conflict - User already confirmed`,
				schema: z
					.object({
						message: z.string(),
						details: z.record(z.unknown().nullable()).optional(),
					})
					.passthrough(),
			},
			{
				status: 429,
				description: `Too many requests`,
				schema: z
					.object({
						message: z.string(),
						details: z.record(z.unknown().nullable()).optional(),
					})
					.passthrough(),
			},
			{
				status: 500,
				description: `Server error`,
				schema: z
					.object({
						message: z.string(),
						details: z.record(z.unknown().nullable()).optional(),
					})
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
				schema: postAuthconfirmRegistration_Body,
			},
		],
		response: z.object({ message: z.string() }).passthrough(),
		errors: [
			{
				status: 400,
				description: `Invalid confirmation code`,
				schema: z
					.object({
						message: z.string(),
						details: z.record(z.unknown().nullable()).optional(),
					})
					.passthrough(),
			},
			{
				status: 401,
				description: `Unauthorized - Authentication required`,
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
				schema: z
					.object({
						message: z.string(),
						details: z.record(z.unknown().nullable()).optional(),
					})
					.passthrough(),
			},
			{
				status: 409,
				description: `Conflict - User already confirmed`,
				schema: z
					.object({
						message: z.string(),
						details: z.record(z.unknown().nullable()).optional(),
					})
					.passthrough(),
			},
			{
				status: 429,
				description: `Too many requests`,
				schema: z
					.object({
						message: z.string(),
						details: z.record(z.unknown().nullable()).optional(),
					})
					.passthrough(),
			},
			{
				status: 500,
				description: `Server error`,
				schema: z
					.object({
						message: z.string(),
						details: z.record(z.unknown().nullable()).optional(),
					})
					.passthrough(),
			},
		],
	},
	{
		method: 'post',
		path: '/auth/forgot-password',
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
				description: `Unauthorized - Authentication required`,
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
				schema: z
					.object({
						message: z.string(),
						details: z.record(z.unknown().nullable()).optional(),
					})
					.passthrough(),
			},
			{
				status: 409,
				description: `Conflict - User already confirmed`,
				schema: z
					.object({
						message: z.string(),
						details: z.record(z.unknown().nullable()).optional(),
					})
					.passthrough(),
			},
			{
				status: 429,
				description: `Too many requests`,
				schema: z
					.object({
						message: z.string(),
						details: z.record(z.unknown().nullable()).optional(),
					})
					.passthrough(),
			},
			{
				status: 500,
				description: `Server error`,
				schema: z
					.object({
						message: z.string(),
						details: z.record(z.unknown().nullable()).optional(),
					})
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
				description: `Invalid credentials`,
				schema: z
					.object({
						message: z.string(),
						details: z.record(z.unknown().nullable()).optional(),
					})
					.passthrough(),
			},
			{
				status: 401,
				description: `Unauthorized - Authentication required`,
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
				schema: z
					.object({
						message: z.string(),
						details: z.record(z.unknown().nullable()).optional(),
					})
					.passthrough(),
			},
			{
				status: 409,
				description: `Conflict - User already confirmed`,
				schema: z
					.object({
						message: z.string(),
						details: z.record(z.unknown().nullable()).optional(),
					})
					.passthrough(),
			},
			{
				status: 429,
				description: `Too many requests`,
				schema: z
					.object({
						message: z.string(),
						details: z.record(z.unknown().nullable()).optional(),
					})
					.passthrough(),
			},
			{
				status: 500,
				description: `Server error`,
				schema: z
					.object({
						message: z.string(),
						details: z.record(z.unknown().nullable()).optional(),
					})
					.passthrough(),
			},
		],
	},
	{
		method: 'post',
		path: '/auth/logout',
		requestFormat: 'json',
		response: z.object({ message: z.string() }).passthrough(),
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
				description: `Unauthorized - Authentication required`,
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
				schema: z
					.object({
						message: z.string(),
						details: z.record(z.unknown().nullable()).optional(),
					})
					.passthrough(),
			},
			{
				status: 409,
				description: `Conflict - User already confirmed`,
				schema: z
					.object({
						message: z.string(),
						details: z.record(z.unknown().nullable()).optional(),
					})
					.passthrough(),
			},
			{
				status: 429,
				description: `Too many requests`,
				schema: z
					.object({
						message: z.string(),
						details: z.record(z.unknown().nullable()).optional(),
					})
					.passthrough(),
			},
			{
				status: 500,
				description: `Server error`,
				schema: z
					.object({
						message: z.string(),
						details: z.record(z.unknown().nullable()).optional(),
					})
					.passthrough(),
			},
		],
	},
	{
		method: 'post',
		path: '/auth/refresh',
		requestFormat: 'json',
		response: z
			.object({
				email: z.string().email(),
				password: z.string().min(8).max(15).regex(/\d/),
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
				description: `Unauthorized - Authentication required`,
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
				schema: z
					.object({
						message: z.string(),
						details: z.record(z.unknown().nullable()).optional(),
					})
					.passthrough(),
			},
			{
				status: 409,
				description: `Conflict - User already confirmed`,
				schema: z
					.object({
						message: z.string(),
						details: z.record(z.unknown().nullable()).optional(),
					})
					.passthrough(),
			},
			{
				status: 429,
				description: `Too many requests`,
				schema: z
					.object({
						message: z.string(),
						details: z.record(z.unknown().nullable()).optional(),
					})
					.passthrough(),
			},
			{
				status: 500,
				description: `Server error`,
				schema: z
					.object({
						message: z.string(),
						details: z.record(z.unknown().nullable()).optional(),
					})
					.passthrough(),
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
				schema: postAuthregister_Body,
			},
		],
		response: z.object({ message: z.string() }).passthrough(),
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
				description: `Unauthorized - Authentication required`,
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
				schema: z
					.object({
						message: z.string(),
						details: z.record(z.unknown().nullable()).optional(),
					})
					.passthrough(),
			},
			{
				status: 409,
				description: `Conflict - User already confirmed`,
				schema: z
					.object({
						message: z.string(),
						details: z.record(z.unknown().nullable()).optional(),
					})
					.passthrough(),
			},
			{
				status: 429,
				description: `Too many requests`,
				schema: z
					.object({
						message: z.string(),
						details: z.record(z.unknown().nullable()).optional(),
					})
					.passthrough(),
			},
			{
				status: 500,
				description: `Server error`,
				schema: z
					.object({
						message: z.string(),
						details: z.record(z.unknown().nullable()).optional(),
					})
					.passthrough(),
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
				schema: z.object({ email: z.string().email() }).passthrough(),
			},
		],
		response: z.object({ message: z.string() }).passthrough(),
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
				description: `Unauthorized - Authentication required`,
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
				schema: z
					.object({
						message: z.string(),
						details: z.record(z.unknown().nullable()).optional(),
					})
					.passthrough(),
			},
			{
				status: 409,
				description: `Conflict - User already confirmed`,
				schema: z
					.object({
						message: z.string(),
						details: z.record(z.unknown().nullable()).optional(),
					})
					.passthrough(),
			},
			{
				status: 429,
				description: `Too many requests`,
				schema: z
					.object({
						message: z.string(),
						details: z.record(z.unknown().nullable()).optional(),
					})
					.passthrough(),
			},
			{
				status: 500,
				description: `Server error`,
				schema: z
					.object({
						message: z.string(),
						details: z.record(z.unknown().nullable()).optional(),
					})
					.passthrough(),
			},
		],
	},
	{
		method: 'get',
		path: '/auth/user',
		requestFormat: 'json',
		response: z
			.object({ id: z.string(), email: z.string(), emailVerified: z.boolean() })
			.passthrough(),
		errors: [
			{
				status: 401,
				description: `Unauthorized - Authentication required`,
				schema: z
					.object({
						message: z.string(),
						details: z.record(z.unknown().nullable()).optional(),
					})
					.passthrough(),
			},
			{
				status: 500,
				description: `Server error`,
				schema: z
					.object({
						message: z.string(),
						details: z.record(z.unknown().nullable()).optional(),
					})
					.passthrough(),
			},
		],
	},
	{
		method: 'get',
		path: '/health',
		requestFormat: 'json',
		response: z.object({ message: z.string() }).passthrough(),
		errors: [
			{
				status: 500,
				description: `Health check failed`,
				schema: z.object({ message: z.string() }).passthrough(),
			},
		],
	},
	{
		method: 'get',
		path: '/users/me',
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
				description: `Unauthorized - Authentication required`,
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
				schema: z
					.object({
						message: z.string(),
						details: z.record(z.unknown().nullable()).optional(),
					})
					.passthrough(),
			},
			{
				status: 409,
				description: `Conflict - User already confirmed`,
				schema: z
					.object({
						message: z.string(),
						details: z.record(z.unknown().nullable()).optional(),
					})
					.passthrough(),
			},
			{
				status: 429,
				description: `Too many requests`,
				schema: z
					.object({
						message: z.string(),
						details: z.record(z.unknown().nullable()).optional(),
					})
					.passthrough(),
			},
			{
				status: 500,
				description: `Server error`,
				schema: z
					.object({
						message: z.string(),
						details: z.record(z.unknown().nullable()).optional(),
					})
					.passthrough(),
			},
		],
	},
])

export const api = new Zodios(endpoints)

export function createApiClient(baseUrl: string, options?: ZodiosOptions) {
	return new Zodios(baseUrl, endpoints, options)
}
