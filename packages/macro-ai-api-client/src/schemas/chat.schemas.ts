import { z } from 'zod'

// ============================================================================
// SHARED SCHEMAS
// ============================================================================

// Base chat object schema
const chatSchema = z
	.object({
		id: z.string().uuid(),
		userId: z.string().uuid(),
		title: z.string().max(255),
		createdAt: z.string().nullable(),
		updatedAt: z.string().nullable(),
	})
	.passthrough()

// Chat message schema
const chatMessageSchema = z
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
	.passthrough()

// Pagination metadata schema
const paginationMetaSchema = z
	.object({
		page: z.number(),
		limit: z.number(),
		total: z.number(),
	})
	.passthrough()

// ============================================================================
// REQUEST SCHEMAS
// ============================================================================

// POST /chats request body
const postChats_Body = z
	.object({
		title: z.string().min(1).max(255),
	})
	.passthrough()

// PUT /chats/:id request body
const putChatsId_Body = z
	.object({
		title: z.string().min(1).max(255),
	})
	.passthrough()

// POST /chats/:id/stream request body (existing)
const postChatsIdstream_Body = z
	.object({
		messages: z
			.array(
				z
					.object({
						role: z.enum(['user', 'assistant', 'system']),
						content: z.string().min(1).max(10000),
					})
					.passthrough(),
			)
			.min(1),
	})
	.passthrough()

// ============================================================================
// RESPONSE SCHEMAS
// ============================================================================

// GET /chats response
const getChats_Response = z
	.object({
		success: z.boolean(),
		data: z.array(chatSchema),
		meta: paginationMetaSchema,
	})
	.passthrough()

// POST /chats response
const postChats_Response = z
	.object({
		success: z.boolean(),
		data: chatSchema,
	})
	.passthrough()

// GET /chats/:id response
const getChatsId_Response = z
	.object({
		success: z.boolean(),
		data: chatSchema.extend({
			messages: z.array(chatMessageSchema),
		}),
	})
	.passthrough()

// PUT /chats/:id response
const putChatsId_Response = z
	.object({
		success: z.boolean(),
		data: chatSchema,
	})
	.passthrough()

// DELETE /chats/:id response
const deleteChatsId_Response = z
	.object({
		success: z.boolean(),
		message: z.string(),
	})
	.partial()
	.passthrough()

// ============================================================================
// EXPORTS
// ============================================================================

export const chatSchemas = {
	// Request schemas
	postChats_Body,
	putChatsId_Body,
	postChatsIdstream_Body,
	// Response schemas
	getChats_Response,
	postChats_Response,
	getChatsId_Response,
	putChatsId_Response,
	deleteChatsId_Response,
	// Shared schemas
	chatSchema,
	chatMessageSchema,
	paginationMetaSchema,
}

// Individual exports for direct access
export {
	chatMessageSchema,
	chatSchema,
	deleteChatsId_Response,
	getChats_Response,
	getChatsId_Response,
	paginationMetaSchema,
	postChats_Body,
	postChats_Response,
	postChatsIdstream_Body,
	putChatsId_Body,
	putChatsId_Response,
}
