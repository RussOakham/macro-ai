import { schemas } from '@repo/types-macro-ai-api'
import { z } from 'zod'

import { apiClient } from '@/lib/api'

const confirmRegistrationSchemaClient = schemas.ConfirmRegistration.extend({
	code: z.string().length(6),
})

type TConfirmRegistrationClient = z.infer<
	typeof confirmRegistrationSchemaClient
>

const postConfirmRegistration = async ({
	username,
	code,
}: TConfirmRegistrationClient) => {
	const parsedCode = z.coerce.number().parse(code)

	const response = await apiClient.post('/auth/confirm-registration', {
		username,
		code: parsedCode,
	})

	return response
}

export {
	postConfirmRegistration,
	confirmRegistrationSchemaClient,
	type TConfirmRegistrationClient,
}
