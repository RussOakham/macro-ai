import { z } from 'zod'

import { apiClient } from '@/lib/api'
import type { ApiResponse, Chat } from '@/lib/types'

// Client-side validation schema for createChat request
const createChatSchemaClient = z.object({
	title: z
		.string()
		.min(1, 'Title is required')
		.max(255, 'Title must be less than 255 characters')
		.trim(),
})

// TypeScript type for the request
type TCreateChatRequest = z.infer<typeof createChatSchemaClient>

// Response type for createChat API
type CreateChatResponse = ApiResponse<Chat>

/**
 * Create a new chat for the authenticated user
 * @param request - Chat creation request with title
 * @returns Promise<CreateChatResponse>
 */
const createChat = async (request: TCreateChatRequest) => {
	const response = await apiClient.post('/chats', {
		title: request.title,
	})

	// Transform the response to match frontend types
	return response
}

export { createChat, createChatSchemaClient }
export type { CreateChatResponse, TCreateChatRequest }
