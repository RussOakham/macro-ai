// MANUAL IMPLEMENTATION - Do not overwrite during generation
import { makeApi, Zodios, type ZodiosOptions } from '@zodios/core'
import { z } from 'zod'

import { postChatsIdstream_Body } from '../schemas/chat.schemas'

const chatEndpoints = makeApi([
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
])

export const chatClient = new Zodios(chatEndpoints)

export function createChatClient(baseUrl: string, options?: ZodiosOptions) {
	return new Zodios(baseUrl, chatEndpoints, options)
}

export { chatEndpoints }
