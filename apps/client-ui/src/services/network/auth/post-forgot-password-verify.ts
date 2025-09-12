import {
	type ConfirmForgotPasswordRequest,
	postAuthConfirmForgotPassword,
	zConfirmForgotPasswordRequest,
	zPostAuthConfirmForgotPasswordResponse,
} from '@repo/macro-ai-api-client'

import { apiClient } from '@/lib/api/clients'
import { safeValidateApiResponse } from '@/lib/validation/api-response'

// Type-safe endpoint for consumption using the generated SDK
const postForgotPasswordVerify = async ({
	code,
	confirmPassword,
	email,
	newPassword,
}: ConfirmForgotPasswordRequest) => {
	const { data, error } = await postAuthConfirmForgotPassword({
		body: {
			code,
			confirmPassword,
			email,
			newPassword,
		},
		client: apiClient,
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
