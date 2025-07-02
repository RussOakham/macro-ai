import { apiClient } from '@/lib/api'
import type { PaginationOptions } from '@/lib/types'

// infer ReturnType of getChats
type TGetChatsResponse = Awaited<ReturnType<typeof getChats>>

/**
 * Get user's chats with pagination
 * @param options - Pagination options (page, limit)
 * @returns Promise<ChatListResponse>
 */
const getChats = async (options?: PaginationOptions) => {
	const response = await apiClient.get('/chats', {
		queries: {
			page: options?.page,
			limit: options?.limit,
		},
	})

	// Transform the response to match frontend types
	return response
}

export { getChats }
export type { TGetChatsResponse }
