import {
	type ForgotPasswordRequest,
	postAuthForgotPassword,
	zForgotPasswordRequest,
	zPostAuthForgotPasswordResponse,
} from '@repo/macro-ai-api-client'

import { apiClient } from '@/lib/api/clients'
import { safeValidateApiResponse } from '@/lib/validation/api-response'

// Type-safe endpoint for consumption using the generated SDK
const postForgotPassword = async ({ email }: ForgotPasswordRequest) => {
	const { data, error } = await postAuthForgotPassword({
		body: {
			email,
		},
		client: apiClient,
	})

	if (error) {
		throw new Error(error.message)
	}

	const validatedData = safeValidateApiResponse(
		zPostAuthForgotPasswordResponse,
		data,
	)

	if (!validatedData.success) {
		throw new Error(validatedData.error)
	}

	return validatedData.data
}

export {
	type ForgotPasswordRequest,
	postForgotPassword,
	zForgotPasswordRequest,
}
