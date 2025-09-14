import {
	type GetChatsData,
	getChats as getChatsEndpoint,
	type GetChatsResponse,
	zGetChatsData,
	zGetChatsResponse,
} from '@repo/macro-ai-api-client'

import { apiClient } from '@/lib/api/clients'
import { safeValidateApiResponse } from '@/lib/validation/api-response'

type GetChatsOptions = NonNullable<GetChatsData['query']>

const getChatsRequestQuerySchema = zGetChatsData.shape.query.unwrap()

// Type-safe endpoint for consumption using the generated SDK
const getChats = async (options?: GetChatsOptions) => {
	const { data, error } = await getChatsEndpoint({
		client: apiClient,
		query: { limit: options?.limit, page: options?.page },
	})

	if (error) {
		throw new Error(error.message)
	}

	const validatedData = safeValidateApiResponse(zGetChatsResponse, data)

	if (!validatedData.success) {
		throw new Error(validatedData.error)
	}

	return validatedData.data
}

export {
	getChats,
	type GetChatsOptions,
	getChatsRequestQuerySchema,
	type GetChatsResponse,
}
