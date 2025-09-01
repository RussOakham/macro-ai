import { getUsersMe, zGetUsersMeResponse } from '@repo/macro-ai-api-client'

import { apiClient } from '@/lib/api/clients'
import { safeValidateApiResponse } from '@/lib/validation/api-response'

// Type-safe endpoint for consumption using the generated SDK
const getUser = async () => {
	const { data, error } = await getUsersMe({
		client: apiClient,
	})

	if (error) {
		throw new Error(error.message)
	}

	const validatedData = safeValidateApiResponse(zGetUsersMeResponse, data)

	if (!validatedData.success) {
		throw new Error(validatedData.error)
	}

	return validatedData.data
}

export { getUser }
