import {
	postChats,
	zCreateChatRequest,
	zPostChatsResponse,
} from '@repo/macro-ai-api-client'
import type { CreateChatRequest } from '@repo/macro-ai-api-client'

import { apiClient } from '@/lib/api/clients'
import { safeValidateApiResponse } from '@/lib/validation/api-response'

// Type-safe endpoint for consumption using the generated SDK
const postCreateChat = async ({ title }: CreateChatRequest) => {
	const { data, error } = await postChats({
		client: apiClient,
		body: {
			title,
		},
	})

	if (error) {
		throw new Error(error.message)
	}

	const validatedData = safeValidateApiResponse(zPostChatsResponse, data)

	if (!validatedData.success) {
		throw new Error(validatedData.error)
	}

	return validatedData.data
}

export { type CreateChatRequest, postCreateChat, zCreateChatRequest }
