import {
	index,
	jsonb,
	pgTable,
	text,
	timestamp,
	uuid,
	varchar,
	vector,
} from 'drizzle-orm/pg-core'
import { createInsertSchema, createSelectSchema } from 'drizzle-zod'
import { z } from 'zod'

import { registerZodSchema } from '../../utils/swagger/openapi-registry.ts'
import { usersTable } from '../user/user.schemas.ts'

// Chats table for conversation metadata
export const chatsTable = pgTable(
	'chats',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		userId: uuid('user_id')
			.notNull()
			.references(() => usersTable.id, { onDelete: 'cascade' }),
		title: varchar('title', { length: 255 }).notNull(),
		createdAt: timestamp('created_at').defaultNow(),
		updatedAt: timestamp('updated_at').defaultNow(),
	},
	(table) => [
		index('idx_chats_user_id').on(table.userId),
		index('idx_chats_updated_at').on(table.updatedAt),
	],
)

// Messages table for individual chat messages
export const chatMessagesTable = pgTable(
	'chat_messages',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		chatId: uuid('chat_id')
			.notNull()
			.references(() => chatsTable.id, { onDelete: 'cascade' }),
		role: varchar('role', { length: 20 }).notNull(),
		content: text('content').notNull(),
		metadata: jsonb('metadata').default('{}'),
		embedding: vector('embedding', { dimensions: 1536 }), // OpenAI embedding dimensions
		createdAt: timestamp('created_at').defaultNow(),
	},
	(table) => [
		index('idx_chat_messages_chat_id').on(table.chatId),
		index('idx_chat_messages_created_at').on(table.createdAt),
		// pgvector index for similarity search
		index('idx_chat_messages_embedding').using(
			'hnsw',
			table.embedding.op('vector_cosine_ops'),
		),
	],
)

// Enhanced chat vectors table for semantic search across conversations
export const chatVectorsTable = pgTable(
	'chat_vectors',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		userId: uuid('user_id')
			.notNull()
			.references(() => usersTable.id, { onDelete: 'cascade' }),
		chatId: uuid('chat_id').references(() => chatsTable.id, {
			onDelete: 'cascade',
		}),
		messageId: uuid('message_id').references(() => chatMessagesTable.id, {
			onDelete: 'cascade',
		}),
		content: text('content').notNull(), // Searchable content
		embedding: vector('embedding', { dimensions: 1536 }),
		metadata: jsonb('metadata').default('{}'),
		createdAt: timestamp('created_at').defaultNow(),
		updatedAt: timestamp('updated_at').defaultNow(),
	},
	(table) => [
		index('idx_chat_vectors_user_id').on(table.userId),
		index('idx_chat_vectors_chat_id').on(table.chatId),
		// pgvector HNSW index for fast similarity search
		index('idx_chat_vectors_embedding').using(
			'hnsw',
			table.embedding.op('vector_cosine_ops'),
		),
	],
)

// Generate Zod schemas for type validation
const insertChatSchema = createInsertSchema(chatsTable)
const selectChatSchema = createSelectSchema(chatsTable)
const insertMessageSchema = createInsertSchema(chatMessagesTable)
const selectMessageSchema = createSelectSchema(chatMessagesTable)
const insertChatVectorSchema = createInsertSchema(chatVectorsTable)
const selectChatVectorSchema = createSelectSchema(chatVectorsTable)

// Convert Drizzle-generated schemas to OpenAPI
const chatSchema = registerZodSchema(
	'Chat',
	selectChatSchema.openapi({ description: 'Chat conversation metadata' }),
)

const chatMessageSchema = registerZodSchema(
	'ChatMessage',
	selectMessageSchema.openapi({ description: 'Individual chat message' }),
)

const chatVectorSchema = registerZodSchema(
	'ChatVector',
	selectChatVectorSchema.openapi({
		description: 'Chat vector for semantic search',
	}),
)

// API request/response schemas
const createChatRequestSchema = registerZodSchema(
	'CreateChatRequest',
	z.object({
		title: z.string().min(1).max(255).openapi({ description: 'Chat title' }),
	}),
	'Create new chat request',
)

const updateChatRequestSchema = registerZodSchema(
	'UpdateChatRequest',
	z.object({
		title: z.string().min(1).max(255).openapi({ description: 'Chat title' }),
	}),
	'Update chat request',
)

const sendMessageRequestSchema = registerZodSchema(
	'SendMessageRequest',
	z.object({
		content: z
			.string()
			.min(1)
			.max(10000)
			.openapi({ description: 'Message content' }),
		role: z.enum(['user', 'assistant', 'system']).default('user').openapi({
			description: 'Message role',
		}),
	}),
	'Send message request',
)

const searchChatRequestSchema = registerZodSchema(
	'SearchChatRequest',
	z.object({
		query: z.string().min(1).max(1000).openapi({ description: 'Search query' }),
		limit: z.number().min(1).max(50).default(10).openapi({
			description: 'Maximum number of results',
		}),
		threshold: z.number().min(0).max(1).default(0.7).openapi({
			description: 'Similarity threshold',
		}),
	}),
	'Semantic search request',
)

// Response schemas
const chatResponseSchema = registerZodSchema(
	'ChatResponse',
	z.object({
		success: z.boolean().openapi({ description: 'Request success status' }),
		data: chatSchema.openapi({ description: 'Chat data' }),
	}),
	'Chat response',
)

const chatListResponseSchema = registerZodSchema(
	'ChatListResponse',
	z.object({
		success: z.boolean().openapi({ description: 'Request success status' }),
		data: z.array(chatSchema).openapi({ description: 'List of chats' }),
		meta: z
			.object({
				page: z.number().openapi({ description: 'Current page number' }),
				limit: z.number().openapi({ description: 'Items per page' }),
				total: z.number().openapi({ description: 'Total number of items' }),
			})
			.openapi({ description: 'Pagination metadata' }),
	}),
	'Chat list response',
)

const chatWithMessagesResponseSchema = registerZodSchema(
	'ChatWithMessagesResponse',
	z.object({
		success: z.boolean().openapi({ description: 'Request success status' }),
		data: z
			.object({
				id: z.string().uuid().openapi({ description: 'Chat ID' }),
				userId: z.string().uuid().openapi({ description: 'User ID' }),
				title: z.string().openapi({ description: 'Chat title' }),
				createdAt: z.date().openapi({ description: 'Creation timestamp' }),
				updatedAt: z.date().openapi({ description: 'Last update timestamp' }),
				messages: z
					.array(chatMessageSchema)
					.openapi({ description: 'Chat messages' }),
			})
			.openapi({ description: 'Chat with messages' }),
	}),
	'Chat with messages response',
)

// Streaming endpoint schemas
const streamingEventSchema = registerZodSchema(
	'StreamingEvent',
	z.discriminatedUnion('type', [
		z.object({
			type: z
				.literal('connected')
				.openapi({ description: 'Connection established' }),
			message: z.string().openapi({ description: 'Connection message' }),
		}),
		z.object({
			type: z
				.literal('user_message')
				.openapi({ description: 'User message saved' }),
			message: chatMessageSchema.openapi({ description: 'Saved user message' }),
		}),
		z.object({
			type: z
				.literal('stream_start')
				.openapi({ description: 'AI response streaming started' }),
			messageId: z.string().uuid().openapi({ description: 'AI message ID' }),
		}),
		z.object({
			type: z.literal('chunk').openapi({ description: 'AI response chunk' }),
			content: z.string().openapi({ description: 'Chunk content' }),
			messageId: z.string().uuid().openapi({ description: 'AI message ID' }),
		}),
		z.object({
			type: z
				.literal('stream_complete')
				.openapi({ description: 'AI response streaming completed' }),
			messageId: z.string().uuid().openapi({ description: 'AI message ID' }),
			fullContent: z.string().openapi({ description: 'Complete AI response' }),
		}),
		z.object({
			type: z.literal('error').openapi({ description: 'Error occurred' }),
			error: z.string().openapi({ description: 'Error message' }),
		}),
	]),
	'Server-Sent Event for streaming chat',
)

// Type definitions for pgvector operations
export type Chat = typeof chatsTable.$inferSelect
export type NewChat = typeof chatsTable.$inferInsert
export type ChatMessage = typeof chatMessagesTable.$inferSelect
export type NewChatMessage = typeof chatMessagesTable.$inferInsert
export type ChatVector = typeof chatVectorsTable.$inferSelect
export type NewChatVector = typeof chatVectorsTable.$inferInsert

// Type definitions for API requests and responses
export type CreateChatRequest = z.infer<typeof createChatRequestSchema>
export type UpdateChatRequest = z.infer<typeof updateChatRequestSchema>
export type SendMessageRequest = z.infer<typeof sendMessageRequestSchema>
export type SearchChatRequest = z.infer<typeof searchChatRequestSchema>
export type ChatResponse = z.infer<typeof chatResponseSchema>
export type ChatListResponse = z.infer<typeof chatListResponseSchema>
export type ChatWithMessagesResponse = z.infer<
	typeof chatWithMessagesResponseSchema
>
export type StreamingEvent = z.infer<typeof streamingEventSchema>

// Export all schemas
export {
	chatListResponseSchema,
	chatMessageSchema,
	chatResponseSchema,
	chatSchema,
	chatVectorSchema,
	chatWithMessagesResponseSchema,
	createChatRequestSchema,
	insertChatSchema,
	insertChatVectorSchema,
	insertMessageSchema,
	searchChatRequestSchema,
	selectChatSchema,
	selectChatVectorSchema,
	selectMessageSchema,
	sendMessageRequestSchema,
	streamingEventSchema,
	updateChatRequestSchema,
}
