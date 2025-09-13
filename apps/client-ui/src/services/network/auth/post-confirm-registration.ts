import {
	type ConfirmRegistration,
	postAuthConfirmRegistration,
	zConfirmRegistration,
	zPostAuthConfirmRegistrationResponse,
} from '@repo/macro-ai-api-client'

import { apiClient } from '@/lib/api/clients'
import { safeValidateApiResponse } from '@/lib/validation/api-response'

// Type-safe endpoint for consumption using the generated SDK
const postConfirmRegistration = async ({
	code,
	email,
}: ConfirmRegistration) => {
	const { data, error } = await postAuthConfirmRegistration({
		body: {
			code,
			email,
		},
		client: apiClient,
	})

	if (error) {
		throw new Error(error.message)
	}

	const validatedData = safeValidateApiResponse(
		zPostAuthConfirmRegistrationResponse,
		data,
	)

	if (!validatedData.success) {
		throw new Error(validatedData.error)
	}

	return validatedData.data
}

export {
	type ConfirmRegistration,
	postConfirmRegistration,
	zConfirmRegistration,
}
