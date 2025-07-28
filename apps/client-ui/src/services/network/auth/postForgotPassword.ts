import { postAuthforgotPassword_Body } from '@repo/macro-ai-api-client'
import { z } from 'zod'

import { authClient } from '@/lib/api/clients'
import { emailValidation } from '@/lib/validation/inputs'

const forgotPasswordSchemaClient = postAuthforgotPassword_Body.extend({
	email: emailValidation(),
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
