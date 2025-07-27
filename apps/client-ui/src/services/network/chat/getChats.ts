import { chatClient } from '@/lib/api/clients'
import type { ChatGetChatsResponse, PaginationOptions } from '@/lib/types'
import { validateGetChatsResponse } from '@/lib/validation/api-response'

// Use API client response type for better type safety
type TGetChatsResponse = ChatGetChatsResponse

/**
 * Get user's chats with pagination
 * @param options - Pagination options (page, limit)
 * @returns Promise<ChatListResponse>
 */
const getChats = async (options?: PaginationOptions) => {
	const response = await chatClient.get('/chats', {
		queries: {
			page: options?.page,
			limit: options?.limit,
		},
	})

	// Validate response at runtime for type safety
	return validateGetChatsResponse(response)
}

export { getChats }
export type { TGetChatsResponse }
