import {
	getAuthUser as getAuthUserSdk,
	GetAuthUserResponse,
	zGetAuthUserResponse,
} from '@repo/macro-ai-api-client'

import { apiClient } from '@/lib/api/clients'
import { safeValidateApiResponse } from '@/lib/validation/api-response'

// Type-safe endpoint for consumption using the generated SDK
const getAuthUser = async () => {
	const { data, error } = await getAuthUserSdk({
		client: apiClient,
	})

	if (error) {
		throw new Error(error.message)
	}

	const validatedData = safeValidateApiResponse(zGetAuthUserResponse, data)

	if (!validatedData.success) {
		throw new Error(validatedData.error)
	}

	return validatedData.data
}

export { getAuthUser, type GetAuthUserResponse, zGetAuthUserResponse }
