import {
	postAuthRegister,
	type RegisterRequest,
	zPostAuthRegisterResponse,
	zRegisterRequest,
} from '@repo/macro-ai-api-client'

import { apiClient } from '@/lib/api/clients'
import { safeValidateApiResponse } from '@/lib/validation/api-response'

// Type-safe endpoint for consumption using the generated SDK
const postRegister = async ({
	confirmPassword,
	email,
	password,
}: RegisterRequest) => {
	const { data, error } = await postAuthRegister({
		body: {
			confirmPassword,
			email,
			password,
		},
		client: apiClient,
	})

	if (error) {
		throw new Error(error.message)
	}

	const validatedData = safeValidateApiResponse(zPostAuthRegisterResponse, data)

	if (!validatedData.success) {
		throw new Error(validatedData.error)
	}

	return validatedData.data
}

export { postRegister, type RegisterRequest, zRegisterRequest }
