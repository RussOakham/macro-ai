import { apiClient } from '@/lib/api'
import type { Chat, ChatListResponse, PaginationOptions } from '@/lib/types'

/**
 * Transform API response dates from strings to Date objects
 */
const transformChatDates = (chat: {
	id: string
	userId: string
	title: string
	createdAt: string | null
	updatedAt: string | null
}): Chat => ({
	...chat,
	messages: [], // temporary to make linter happy
	createdAt: chat.createdAt ? new Date(chat.createdAt) : new Date(),
	updatedAt: chat.updatedAt ? new Date(chat.updatedAt) : new Date(),
})

// infer ReturnType of getChats
type TGetChatsResponse = Awaited<ReturnType<typeof getChats>>

/**
 * Get user's chats with pagination
 * @param options - Pagination options (page, limit)
 * @returns Promise<ChatListResponse>
 */
const getChats = async (
	options?: PaginationOptions,
): Promise<ChatListResponse> => {
	const params = new URLSearchParams()

	if (options?.page) {
		params.append('page', options.page.toString())
	}

	if (options?.limit) {
		params.append('limit', options.limit.toString())
	}

	const response = await apiClient.get('/chats', {
		queries: {
			page: options?.page,
			limit: options?.limit,
		},
	})

	// Transform the response to match frontend types
	return {
		...response,
		data: response.data.map(transformChatDates),
	}
}

export { getChats }
export type { TGetChatsResponse }
