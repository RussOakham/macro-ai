import { makeApi, Zodios, type ZodiosOptions } from '@zodios/core'
import { z } from 'zod'

import {
	getUsersId_Response,
	getUsersMe_Response,
} from '../schemas/user.schemas.js'

const userEndpoints = makeApi([
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
		response: getUsersId_Response,
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
		response: getUsersMe_Response,
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

export const userClient = new Zodios(userEndpoints)

export function createUserClient(baseUrl: string, options?: ZodiosOptions) {
	return new Zodios(baseUrl, userEndpoints, options)
}

export { userEndpoints }
