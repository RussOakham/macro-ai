import { z } from 'zod'

import { authClient } from '@/lib/api/clients'

const forgotPasswordSchemaClient = z.object({
	email: z.string().email(),
})

type TForgotPasswordClient = z.infer<typeof forgotPasswordSchemaClient>

const postForgotPassword = async ({ email }: TForgotPasswordClient) => {
	const response = await authClient.post('/auth/forgot-password', {
		email,
	})

	return response
}

export {
	forgotPasswordSchemaClient,
	postForgotPassword,
	type TForgotPasswordClient,
}
