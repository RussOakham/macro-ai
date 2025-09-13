import {
	postAuthResendConfirmationCode,
	zPostAuthResendConfirmationCodeResponse,
	zResendConfirmationCode,
} from '@repo/macro-ai-api-client'
import type { ResendConfirmationCode } from '@repo/macro-ai-api-client'

import { apiClient } from '@/lib/api/clients'
import { safeValidateApiResponse } from '@/lib/validation/api-response'

// Type-safe endpoint for consumption using the generated SDK
const postResendConfirmRegistrationCode = async ({
	email,
}: ResendConfirmationCode) => {
	const { data, error } = await postAuthResendConfirmationCode({
		body: {
			email,
		},
		client: apiClient,
	})

	if (error) {
		throw new Error(error.message)
	}

	const validatedData = safeValidateApiResponse(
		zPostAuthResendConfirmationCodeResponse,
		data,
	)

	if (!validatedData.success) {
		throw new Error(validatedData.error)
	}

	return validatedData.data
}

export {
	postResendConfirmRegistrationCode,
	type ResendConfirmationCode,
	zResendConfirmationCode,
}
