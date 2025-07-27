import { chatClient } from '@/lib/api/clients'

// Response type for deleteChat API - inferred from auto-generated client
type DeleteChatResponse = Awaited<ReturnType<typeof deleteChat>>

/**
 * Delete an existing chat and all its messages for the authenticated user
 * @param chatId - The ID of the chat to delete
 * @returns Promise<DeleteChatResponse>
 */
const deleteChat = async (chatId: string) => {
	const response = await chatClient.delete('/chats/:id', undefined, {
		params: {
			id: chatId,
		},
	})

	return response
}

export { deleteChat }
export type { DeleteChatResponse }
