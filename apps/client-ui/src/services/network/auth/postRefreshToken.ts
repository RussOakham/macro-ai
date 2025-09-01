import {
	postAuthRefresh,
	zPostAuthRefreshResponse,
} from '@repo/macro-ai-api-client'

import { apiClient } from '@/lib/api/clients'
import { safeValidateApiResponse } from '@/lib/validation/api-response'

// Type-safe endpoint for consumption using the generated SDK
const postRefreshToken = async () => {
	const { data, error } = await postAuthRefresh({
		client: apiClient,
	})

	if (error) {
		throw new Error(error.message)
	}

	const validatedData = safeValidateApiResponse(zPostAuthRefreshResponse, data)

	if (!validatedData.success) {
		throw new Error(validatedData.error)
	}

	return validatedData.data
}

export { postRefreshToken }
