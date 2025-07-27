// Chat API Types - auto-generated, do not edit manually
// Types are now inferred from Zod schemas for runtime validation and type safety

import type { z } from 'zod'

import type {
	deleteChatsId_Response,
	getChats_Response,
	getChatsId_Response,
	postChats_Body,
	postChats_Response,
	postChatsIdstream_Body,
	putChatsId_Body,
	putChatsId_Response,
} from '../schemas/chat.schemas.js'

// ============================================================================
// REQUEST TYPES (inferred from Zod schemas)
// ============================================================================

export type ChatPostChatsRequest = z.infer<typeof postChats_Body>

export type ChatPutChatsByIdRequest = z.infer<typeof putChatsId_Body>

export type ChatPostChatsByIdStreamRequest = z.infer<
	typeof postChatsIdstream_Body
>

// ============================================================================
// RESPONSE TYPES (inferred from Zod schemas)
// ============================================================================

export type ChatGetChatsResponse = z.infer<typeof getChats_Response>

export type ChatPostChatsResponse = z.infer<typeof postChats_Response>

export type ChatGetChatsByIdResponse = z.infer<typeof getChatsId_Response>

export type ChatPutChatsByIdResponse = z.infer<typeof putChatsId_Response>

export type ChatDeleteChatsByIdResponse = z.infer<typeof deleteChatsId_Response>
