import {
	deleteChatsById,
	type DeleteChatsByIdData,
	zDeleteChatsByIdData,
	zDeleteChatsByIdResponse,
} from '@repo/macro-ai-api-client'

import { apiClient } from '@/lib/api/clients'
import { safeValidateApiResponse } from '@/lib/validation/api-response'

const deleteChatRequestParamSchema = zDeleteChatsByIdData.shape.path.shape.id

type DeleteChatRequestParam = NonNullable<DeleteChatsByIdData['path']>['id']

// Type-safe endpoint for consumption using the generated SDK
const deleteChat = async (id: DeleteChatRequestParam) => {
	const { data, error } = await deleteChatsById({
		client: apiClient,
		path: {
			id,
		},
	})

	if (error) {
		throw new Error(error.message)
	}

	const validatedData = safeValidateApiResponse(zDeleteChatsByIdResponse, data)

	if (!validatedData.success) {
		throw new Error(validatedData.error)
	}

	return validatedData.data
}

export { deleteChat, type DeleteChatRequestParam, deleteChatRequestParamSchema }
