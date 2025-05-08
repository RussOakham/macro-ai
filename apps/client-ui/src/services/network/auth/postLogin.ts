import { schemas } from '@repo/macro-ai-api-client'
import { z } from 'zod'

import { apiClient } from '@/lib/api'
import { emailValidation, passwordValidation } from '@/lib/validation/inputs'

const loginSchemaClient = schemas.postAuthlogin_Body.extend({
	email: emailValidation(),
	password: passwordValidation(),
})

type TLoginRequest = z.infer<typeof loginSchemaClient>

const postLogin = async ({ email, password }: TLoginRequest) => {
	const response = await apiClient.post('/auth/login', {
		email,
		password,
	})

	return response
}

export { loginSchemaClient, postLogin, type TLoginRequest }
