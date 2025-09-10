import {
	postAuthRegister,
	zPostAuthRegisterResponse,
	zRegisterRequest,
	type RegisterRequest,
} from '@repo/macro-ai-api-client'

import { apiClient } from '@/lib/api/clients'
import { safeValidateApiResponse } from '@/lib/validation/api-response'

// Type-safe endpoint for consumption using the generated SDK
const postRegister = async ({
	email,
	password,
	confirmPassword,
}: RegisterRequest) => {
	const { data, error } = await postAuthRegister({
		client: apiClient,
		body: {
			email,
			password,
			confirmPassword,
		},
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
