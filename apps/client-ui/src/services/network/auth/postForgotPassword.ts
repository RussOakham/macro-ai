import { z } from 'zod'

import { apiClient } from '@/lib/api'

const forgotPasswordSchemaClient = z.object({
	email: z.string().email(),
})

type TForgotPasswordClient = z.infer<typeof forgotPasswordSchemaClient>

const postForgotPassword = async ({ email }: TForgotPasswordClient) => {
	const response = await apiClient.post('/auth/forgot-password', {
		email,
	})

	return response
}

export {
	forgotPasswordSchemaClient,
	postForgotPassword,
	type TForgotPasswordClient,
}
