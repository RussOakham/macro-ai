import {
	postAuthConfirmForgotPassword,
	zConfirmForgotPasswordRequest,
	zPostAuthConfirmForgotPasswordResponse,
	type ConfirmForgotPasswordRequest,
} from '@repo/macro-ai-api-client'

import { apiClient } from '@/lib/api/clients'
import { safeValidateApiResponse } from '@/lib/validation/api-response'

// Type-safe endpoint for consumption using the generated SDK
const postForgotPasswordVerify = async ({
	code,
	email,
	newPassword,
	confirmPassword,
}: ConfirmForgotPasswordRequest) => {
	const { data, error } = await postAuthConfirmForgotPassword({
		client: apiClient,
		body: {
			code,
			email,
			newPassword,
			confirmPassword,
		},
	})

	if (error) {
		throw new Error(error.message)
	}

	const validatedData = safeValidateApiResponse(
		zPostAuthConfirmForgotPasswordResponse,
		data,
	)

	if (!validatedData.success) {
		throw new Error(validatedData.error)
	}

	return validatedData.data
}

export {
	type ConfirmForgotPasswordRequest,
	postForgotPasswordVerify,
	zConfirmForgotPasswordRequest,
}
