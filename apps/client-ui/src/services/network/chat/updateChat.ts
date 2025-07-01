import { z } from 'zod'

import { apiClient } from '@/lib/api'

// Client-side validation schema for updateChat request
// Uses same validation as createChat since backend uses createChatRequestSchema
const updateChatSchemaClient = z.object({
	title: z
		.string()
		.min(1, 'Title is required')
		.max(255, 'Title must be less than 255 characters')
		.trim(),
})

// TypeScript type for the request
type TUpdateChatRequest = z.infer<typeof updateChatSchemaClient>

// Response type for updateChat API
type UpdateChatResponse = Awaited<ReturnType<typeof updateChat>>

/**
 * Update an existing chat title for the authenticated user
 * @param chatId - The ID of the chat to update
 * @param request - Chat update request with title
 * @returns Promise<UpdateChatResponse>
 */
const updateChat = async (chatId: string, request: TUpdateChatRequest) => {
	const response = await apiClient.put(
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
