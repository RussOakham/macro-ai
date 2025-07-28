import { schemas } from '@repo/macro-ai-api-client'
import { z } from 'zod'

import { authClient } from '@/lib/api/clients'
import { emailValidation } from '@/lib/validation/inputs'

const confirmRegistrationSchemaClient =
	schemas.postAuthconfirmRegistration_Body.extend({
		email: emailValidation(),
		code: z.string().length(6),
	})

type TConfirmRegistrationClient = z.infer<
	typeof confirmRegistrationSchemaClient
>

const postConfirmRegistration = async ({
	email,
	code,
}: TConfirmRegistrationClient) => {
	// fix bug for leading zeros - create custom input OTP for number values?
	const parsedCode = z.coerce.number().parse(code)

	const response = await authClient.post('/auth/confirm-registration', {
		email,
		code: parsedCode,
	})

	return response
}

export {
	confirmRegistrationSchemaClient,
	postConfirmRegistration,
	type TConfirmRegistrationClient,
}
