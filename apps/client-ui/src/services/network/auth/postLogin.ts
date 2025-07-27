import { schemas } from '@repo/macro-ai-api-client'
import { z } from 'zod'

import { authClient } from '@/lib/api/clients'
import { emailValidation, passwordValidation } from '@/lib/validation/inputs'

const loginSchemaClient = schemas.postAuthlogin_Body.extend({
	email: emailValidation(),
	password: passwordValidation(),
})

type TLoginRequest = z.infer<typeof loginSchemaClient>

const postLogin = async ({ email, password }: TLoginRequest) => {
	// This should now have full type safety and intellisense
	const response = await authClient.post('/auth/login', {
		email,
		password,
	})

	return response
}

export { loginSchemaClient, postLogin, type TLoginRequest }
