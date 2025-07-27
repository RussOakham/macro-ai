import { chatClient } from '@/lib/api/clients'
import type { ChatGetChatsByIdResponse } from '@/lib/types'

// Use API client response type for better type safety
type TGetChatByIdResponse = ChatGetChatsByIdResponse

/**
 * Get a specific chat with its messages by ID
 * @param chatId - The chat ID to retrieve
 * @returns Promise<ChatWithMessagesResponse>
 */
const getChatById = async (chatId: string) => {
	const response = await chatClient.get('/chats/:id', {
		params: {
			id: chatId,
		},
	})

	// Transform the response to match frontend types
	return response
}

export { getChatById }
export type { TGetChatByIdResponse }
