import {
	putChatsById,
	zPutChatsByIdData,
	zPutChatsByIdResponse,
} from '@repo/macro-ai-api-client'
import type { PutChatsByIdData } from '@repo/macro-ai-api-client'

import { apiClient } from '@/lib/api/clients'
import { safeValidateApiResponse } from '@/lib/validation/api-response'

// Extract the body schema from the generated schema
const updateChatRequestBodySchema = zPutChatsByIdData.shape.body.unwrap()

type UpdateChatRequestBody = NonNullable<PutChatsByIdData['body']>
// Type for the request body (non-nullable)
type UpdateChatRequestParam = NonNullable<PutChatsByIdData['path']>['id']

// Type-safe endpoint for consumption using the generated SDK
const updateChatById = async (
	id: UpdateChatRequestParam,
	{ title }: UpdateChatRequestBody,
) => {
	const { data, error } = await putChatsById({
		body: {
			title,
		},
		client: apiClient,
		path: {
			id,
		},
	})

	if (error) {
		throw new Error(error.message)
	}

	const validatedData = safeValidateApiResponse(zPutChatsByIdResponse, data)

	if (!validatedData.success) {
		throw new Error(validatedData.error)
	}

	return validatedData.data
}

export {
	updateChatById,
	type UpdateChatRequestBody,
	updateChatRequestBodySchema,
	type UpdateChatRequestParam,
}
