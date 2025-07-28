import { putChatsId_Body } from '@repo/macro-ai-api-client'
import { z } from 'zod'

import { chatClient } from '@/lib/api/clients'
import type { ChatPutChatsByIdResponse } from '@/lib/types'

// Client-side validation schema extending API client schema
const updateChatSchemaClient = putChatsId_Body.extend({
	title: z
		.string()
		.min(1, 'Title is required')
		.max(255, 'Title must be less than 255 characters')
		.trim(),
})

// TypeScript type for the request (inferred from enhanced schema)
type TUpdateChatRequest = z.infer<typeof updateChatSchemaClient>

// Response type for updateChat API (using API client type)
type UpdateChatResponse = ChatPutChatsByIdResponse

/**
 * Update an existing chat title for the authenticated user
 * @param chatId - The ID of the chat to update
 * @param request - Chat update request with title
 * @returns Promise<UpdateChatResponse>
 */
const updateChat = async (chatId: string, request: TUpdateChatRequest) => {
	const response = await chatClient.put(
		`/chats/:id`,
		{
			title: request.title,
		},
		{
			params: {
				id: chatId,
			},
		},
	)

	return response
}

export { updateChat, updateChatSchemaClient }
export type { TUpdateChatRequest, UpdateChatResponse }
