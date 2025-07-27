import { createChatClient } from '@repo/macro-ai-api-client'

import type { PaginationOptions } from '@/lib/types'
import { validateEnvironment } from '@/lib/validation/environment'

const env = validateEnvironment()

// Create the chat client with proper typing
const chatClient = createChatClient(env.VITE_API_URL, {
	axiosConfig: {
		headers: {
			'X-API-KEY': env.VITE_API_KEY,
		},
		withCredentials: true,
	},
})

// infer ReturnType of getChats
type TGetChatsResponse = Awaited<ReturnType<typeof getChats>>

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

	// Transform the response to match frontend types
	return response
}

export { getChats }
export type { TGetChatsResponse }
