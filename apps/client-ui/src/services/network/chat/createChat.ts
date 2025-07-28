import { postChats_Body } from '@repo/macro-ai-api-client'
import { z } from 'zod'

import { chatClient } from '@/lib/api/clients'
import type { ChatPostChatsResponse } from '@/lib/types'
import { validateCreateChatResponse } from '@/lib/validation/api-response'

// Client-side validation schema extending API client schema
const createChatSchemaClient = postChats_Body.extend({
	title: z
		.string()
		.min(1, 'Title is required')
		.max(255, 'Title must be less than 255 characters')
		.trim(),
})

// TypeScript type for the request (inferred from enhanced schema)
type TCreateChatRequest = z.infer<typeof createChatSchemaClient>

// Response type for createChat API (using API client type)
type CreateChatResponse = ChatPostChatsResponse

/**
 * Create a new chat for the authenticated user
 * @param request - Chat creation request with title
 * @returns Promise<CreateChatResponse>
 */
const createChat = async (request: TCreateChatRequest) => {
	// This should now have full type safety and intellisense
	const response = await chatClient.post('/chats', {
		title: request.title,
	})

	// Validate response at runtime for type safety
	return validateCreateChatResponse(response)
}

export { createChat, createChatSchemaClient }
export type { CreateChatResponse, TCreateChatRequest }
