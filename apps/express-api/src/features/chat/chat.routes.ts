import { type Router } from 'express'
import { StatusCodes } from 'http-status-codes'
import { z } from 'zod'

import { verifyAuth } from '../../middleware/auth.middleware.ts'
import { apiRateLimiter } from '../../middleware/rate-limit.middleware.ts'
import { validate } from '../../middleware/validation.middleware.ts'
import {
	InternalServerErrorSchema,
	NotFoundErrorSchema,
	RateLimitErrorSchema,
	registry,
	UnauthorizedErrorSchema,
	ValidationErrorSchema,
} from '../../utils/swagger/openapi-registry.ts'
import { chatController } from './chat.controller.ts'
import {
	chatListResponseSchema,
	chatResponseSchema,
	chatWithMessagesResponseSchema,
	createChatRequestSchema,
	sendMessageRequestSchema,
} from './chat.schemas.ts'

// Register chat routes with OpenAPI documentation

// GET /chats - List user's chats
registry.registerPath({
	method: 'get',
	path: '/chats',
	tags: ['Chat Management'],
	summary: 'Get user chats',
	description:
		'Retrieves all chats for the authenticated user with pagination support. Supports optional query parameters: page (default: 1) and limit (default: 20, max: 100).',
	security: [{ bearerAuth: [] }],
	parameters: [
		{
			name: 'page',
			in: 'query',
			required: false,
			description: 'Page number for pagination',
			schema: {
				type: 'integer',
				minimum: 1,
				default: 1,
				example: 1,
			},
		},
		{
			name: 'limit',
			in: 'query',
			required: false,
			description: 'Number of chats per page (max 100)',
			schema: {
				type: 'integer',
				minimum: 1,
				maximum: 100,
				default: 20,
				example: 20,
			},
		},
	],
	responses: {
		[StatusCodes.OK]: {
			description: 'Successfully retrieved user chats',
			content: {
				'application/json': {
					schema: chatListResponseSchema,
				},
			},
		},
		[StatusCodes.UNAUTHORIZED]: {
			description: 'Authentication required',
			content: {
				'application/json': {
					schema: UnauthorizedErrorSchema,
				},
			},
		},
		[StatusCodes.TOO_MANY_REQUESTS]: {
			description: 'Rate limit exceeded',
			content: {
				'application/json': {
					schema: RateLimitErrorSchema,
				},
			},
		},
		[StatusCodes.INTERNAL_SERVER_ERROR]: {
			description: 'Server error - Database or service error',
			content: {
				'application/json': {
					schema: InternalServerErrorSchema,
				},
			},
		},
	},
})

// POST /chats - Create new chat
registry.registerPath({
	method: 'post',
	path: '/chats',
	tags: ['Chat Management'],
	summary: 'Create new chat',
	description: 'Creates a new chat conversation for the authenticated user.',
	security: [{ bearerAuth: [] }],
	request: {
		body: {
			content: {
				'application/json': {
					schema: createChatRequestSchema,
				},
			},
		},
	},
	responses: {
		[StatusCodes.CREATED]: {
			description: 'Chat created successfully',
			content: {
				'application/json': {
					schema: chatResponseSchema,
				},
			},
		},
		[StatusCodes.BAD_REQUEST]: {
			description: 'Invalid request data',
			content: {
				'application/json': {
					schema: ValidationErrorSchema,
				},
			},
		},
		[StatusCodes.UNAUTHORIZED]: {
			description: 'Authentication required',
			content: {
				'application/json': {
					schema: UnauthorizedErrorSchema,
				},
			},
		},
		[StatusCodes.TOO_MANY_REQUESTS]: {
			description: 'Rate limit exceeded',
			content: {
				'application/json': {
					schema: RateLimitErrorSchema,
				},
			},
		},
		[StatusCodes.INTERNAL_SERVER_ERROR]: {
			description: 'Server error - Database or service error',
			content: {
				'application/json': {
					schema: InternalServerErrorSchema,
				},
			},
		},
	},
})

// GET /chats/:id - Get specific chat with messages
registry.registerPath({
	method: 'get',
	path: '/chats/{id}',
	tags: ['Chat Management'],
	summary: 'Get chat by ID',
	description:
		'Retrieves a specific chat with all its messages. User must own the chat.',
	security: [{ bearerAuth: [] }],
	parameters: [
		{
			name: 'id',
			in: 'path',
			required: true,
			description: 'Chat ID',
			schema: {
				type: 'string',
				format: 'uuid',
				example: '123e4567-e89b-12d3-a456-426614174000',
			},
		},
	],
	responses: {
		[StatusCodes.OK]: {
			description: 'Successfully retrieved chat with messages',
			content: {
				'application/json': {
					schema: chatWithMessagesResponseSchema,
				},
			},
		},
		[StatusCodes.NOT_FOUND]: {
			description: 'Chat not found or access denied',
			content: {
				'application/json': {
					schema: NotFoundErrorSchema,
				},
			},
		},
		[StatusCodes.UNAUTHORIZED]: {
			description: 'Authentication required',
			content: {
				'application/json': {
					schema: UnauthorizedErrorSchema,
				},
			},
		},
		[StatusCodes.TOO_MANY_REQUESTS]: {
			description: 'Rate limit exceeded',
			content: {
				'application/json': {
					schema: RateLimitErrorSchema,
				},
			},
		},
		[StatusCodes.INTERNAL_SERVER_ERROR]: {
			description: 'Server error - Database or service error',
			content: {
				'application/json': {
					schema: InternalServerErrorSchema,
				},
			},
		},
	},
})

// PUT /chats/:id - Update chat title
registry.registerPath({
	method: 'put',
	path: '/chats/{id}',
	tags: ['Chat Management'],
	summary: 'Update chat',
	description: 'Updates chat title. User must own the chat.',
	security: [{ bearerAuth: [] }],
	parameters: [
		{
			name: 'id',
			in: 'path',
			required: true,
			description: 'Chat ID',
			schema: {
				type: 'string',
				format: 'uuid',
				example: '123e4567-e89b-12d3-a456-426614174000',
			},
		},
	],
	request: {
		body: {
			content: {
				'application/json': {
					schema: createChatRequestSchema, // Same schema as create (just title)
				},
			},
		},
	},
	responses: {
		[StatusCodes.OK]: {
			description: 'Chat updated successfully',
			content: {
				'application/json': {
					schema: chatResponseSchema,
				},
			},
		},
		[StatusCodes.BAD_REQUEST]: {
			description: 'Invalid request data',
			content: {
				'application/json': {
					schema: ValidationErrorSchema,
				},
			},
		},
		[StatusCodes.NOT_FOUND]: {
			description: 'Chat not found or access denied',
			content: {
				'application/json': {
					schema: NotFoundErrorSchema,
				},
			},
		},
		[StatusCodes.UNAUTHORIZED]: {
			description: 'Authentication required',
			content: {
				'application/json': {
					schema: UnauthorizedErrorSchema,
				},
			},
		},
		[StatusCodes.TOO_MANY_REQUESTS]: {
			description: 'Rate limit exceeded',
			content: {
				'application/json': {
					schema: RateLimitErrorSchema,
				},
			},
		},
		[StatusCodes.INTERNAL_SERVER_ERROR]: {
			description: 'Server error - Database or service error',
			content: {
				'application/json': {
					schema: InternalServerErrorSchema,
				},
			},
		},
	},
})

// DELETE /chats/:id - Delete chat
registry.registerPath({
	method: 'delete',
	path: '/chats/{id}',
	tags: ['Chat Management'],
	summary: 'Delete chat',
	description:
		'Deletes a chat and all its messages. User must own the chat. This action cannot be undone.',
	security: [{ bearerAuth: [] }],
	parameters: [
		{
			name: 'id',
			in: 'path',
			required: true,
			description: 'Chat ID',
			schema: {
				type: 'string',
				format: 'uuid',
				example: '123e4567-e89b-12d3-a456-426614174000',
			},
		},
	],
	responses: {
		[StatusCodes.OK]: {
			description: 'Chat deleted successfully',
			content: {
				'application/json': {
					schema: {
						type: 'object',
						properties: {
							success: {
								type: 'boolean',
								example: true,
							},
							message: {
								type: 'string',
								example: 'Chat deleted successfully',
							},
						},
					},
				},
			},
		},
		[StatusCodes.NOT_FOUND]: {
			description: 'Chat not found or access denied',
			content: {
				'application/json': {
					schema: NotFoundErrorSchema,
				},
			},
		},
		[StatusCodes.UNAUTHORIZED]: {
			description: 'Authentication required',
			content: {
				'application/json': {
					schema: UnauthorizedErrorSchema,
				},
			},
		},
		[StatusCodes.TOO_MANY_REQUESTS]: {
			description: 'Rate limit exceeded',
			content: {
				'application/json': {
					schema: RateLimitErrorSchema,
				},
			},
		},
		[StatusCodes.INTERNAL_SERVER_ERROR]: {
			description: 'Server error - Database or service error',
			content: {
				'application/json': {
					schema: InternalServerErrorSchema,
				},
			},
		},
	},
})

// POST /chats/:id/stream - Stream chat message response
registry.registerPath({
	method: 'post',
	path: '/chats/{id}/stream',
	description:
		'Send a message and receive streaming AI response via Server-Sent Events',
	summary: 'Stream chat message response',
	tags: ['Chat'],
	security: [{ bearerAuth: [] }],
	request: {
		params: z.object({
			id: z.uuid().openapi({ description: 'Chat ID' }),
		}),
		body: {
			description: 'Message to send',
			content: {
				'application/json': {
					schema: sendMessageRequestSchema,
				},
			},
		},
	},
	responses: {
		[StatusCodes.OK]: {
			description: 'Streaming text response compatible with Vercel AI SDK',
			content: {
				'text/plain': {
					schema: z.string().openapi({
						description: 'Plain text chunks streamed directly to client',
					}),
					examples: {
						streaming: {
							summary: 'AI response streaming',
							value: 'Hello, how can I help you today?',
						},
					},
				},
			},
		},
		[StatusCodes.BAD_REQUEST]: {
			description: 'Invalid request parameters',
			content: {
				'application/json': {
					schema: ValidationErrorSchema,
				},
			},
		},
		[StatusCodes.UNAUTHORIZED]: {
			description: 'Authentication required',
			content: {
				'application/json': {
					schema: UnauthorizedErrorSchema,
				},
			},
		},
		[StatusCodes.NOT_FOUND]: {
			description: 'Chat not found or access denied',
			content: {
				'application/json': {
					schema: NotFoundErrorSchema,
				},
			},
		},
		[StatusCodes.TOO_MANY_REQUESTS]: {
			description: 'Rate limit exceeded',
			content: {
				'application/json': {
					schema: RateLimitErrorSchema,
				},
			},
		},
		[StatusCodes.INTERNAL_SERVER_ERROR]: {
			description: 'Internal server error',
			content: {
				'application/json': {
					schema: InternalServerErrorSchema,
				},
			},
		},
	},
})

const chatRouter = (router: Router): void => {
	// All chat routes require authentication and rate limiting
	const basePath = '/chats'

	// GET /chats - List user's chats
	router.get(basePath, verifyAuth, apiRateLimiter, chatController.getChats)

	// POST /chats - Create new chat
	router.post(
		basePath,
		verifyAuth,
		apiRateLimiter,
		validate(createChatRequestSchema),
		chatController.createChat,
	)

	// GET /chats/:id - Get specific chat with messages
	router.get(
		`${basePath}/:id`,
		verifyAuth,
		apiRateLimiter,
		chatController.getChatById,
	)

	// PUT /chats/:id - Update chat title
	router.put(
		`${basePath}/:id`,
		verifyAuth,
		apiRateLimiter,
		validate(createChatRequestSchema),
		chatController.updateChat,
	)

	// DELETE /chats/:id - Delete chat
	router.delete(
		`${basePath}/:id`,
		verifyAuth,
		apiRateLimiter,
		chatController.deleteChat,
	)

	// POST /chats/:id/stream - Stream chat message response
	router.post(
		`${basePath}/:id/stream`,
		verifyAuth,
		apiRateLimiter,
		validate(sendMessageRequestSchema),
		chatController.streamChatMessage,
	)
}

export { chatRouter }
