import {
	getChatsById,
	GetChatsByIdData,
	zGetChatsByIdData,
	zGetChatsByIdResponse,
} from '@repo/macro-ai-api-client'

import { apiClient } from '@/lib/api/clients'
import { safeValidateApiResponse } from '@/lib/validation/api-response'

const getChatByIdRequestParamSchema = zGetChatsByIdData.shape.path.shape.id

type GetChatByIdRequestParam = NonNullable<GetChatsByIdData['path']>['id']

// Type-safe endpoint for consumption using the generated SDK
const getChatById = async (id: GetChatByIdRequestParam) => {
	const { data, error } = await getChatsById({
		client: apiClient,
		path: {
			id,
		},
	})

	if (error) {
		throw new Error(error.message)
	}

	const validatedData = safeValidateApiResponse(zGetChatsByIdResponse, data)

	if (!validatedData.success) {
		throw new Error(validatedData.error)
	}

	return validatedData.data
}

export {
	getChatById,
	type GetChatByIdRequestParam,
	getChatByIdRequestParamSchema,
}
