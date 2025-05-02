import { apiClient } from '@/lib/api'

import { z } from 'zod'

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
	postForgotPassword,
	forgotPasswordSchemaClient,
	type TForgotPasswordClient,
}
