import { postAuthresendConfirmationCode_Body } from '@repo/macro-ai-api-client'
import { z } from 'zod'

import { authClient } from '@/lib/api/clients'
import { emailValidation } from '@/lib/validation/inputs'

const resendConfirmationCodeSchemaClient =
	postAuthresendConfirmationCode_Body.extend({
		email: emailValidation(),
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
