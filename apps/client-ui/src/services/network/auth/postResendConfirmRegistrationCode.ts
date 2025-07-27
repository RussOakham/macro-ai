import { z } from 'zod'

import { authClient } from '@/lib/api/clients'

const resendConfirmationCodeSchemaClient = z.object({
	email: z.string().email(),
})

type TResendConfirmationCodeClient = z.infer<
	typeof resendConfirmationCodeSchemaClient
>

const postResendConfirmRegistrationCode = async ({
	email,
}: TResendConfirmationCodeClient) => {
	const response = await authClient.post('/auth/resend-confirmation-code', {
		email,
	})

	return response
}

export {
	postResendConfirmRegistrationCode,
	resendConfirmationCodeSchemaClient,
	type TResendConfirmationCodeClient,
}
