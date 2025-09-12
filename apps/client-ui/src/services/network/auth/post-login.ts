import {
	postAuthLogin,
	zLoginRequest,
	zPostAuthLoginResponse,
} from '@repo/macro-ai-api-client'
import type { LoginRequestZodType as LoginRequest } from '@repo/macro-ai-api-client'

import { apiClient } from '@/lib/api/clients'
import { safeValidateApiResponse } from '@/lib/validation/api-response'

// Type-safe endpoint for consumption using the generated SDK
const postLogin = async ({ email, password }: LoginRequest) => {
	const { data, error } = await postAuthLogin({
		client: apiClient,
		body: {
			email,
			password,
		},
	})

	if (error) {
		throw new Error(error.message)
	}

	const validatedData = safeValidateApiResponse(zPostAuthLoginResponse, data)

	if (!validatedData.success) {
		throw new Error(validatedData.error)
	}

	return validatedData.data
}

export { type LoginRequest, postLogin, zLoginRequest }
