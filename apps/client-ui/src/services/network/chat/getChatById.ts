import { chatClient } from '@/lib/api/clients'

// Infer ReturnType of getChatById
type TGetChatByIdResponse = Awaited<ReturnType<typeof getChatById>>

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
