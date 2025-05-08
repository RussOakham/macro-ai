import { z } from 'zod'

import { apiClient } from '@/lib/api'

const resendConfirmationCodeSchemaClient = z.object({
	email: z.string().email(),
})

type TResendConfirmationCodeClient = z.infer<
	typeof resendConfirmationCodeSchemaClient
>

const postResendConfirmRegistrationCode = async ({
	email,
}: TResendConfirmationCodeClient) => {
	const response = await apiClient.post('/auth/resend-confirmation-code', {
		email,
	})

	return response
}

export {
	postResendConfirmRegistrationCode,
	resendConfirmationCodeSchemaClient,
	type TResendConfirmationCodeClient,
}
