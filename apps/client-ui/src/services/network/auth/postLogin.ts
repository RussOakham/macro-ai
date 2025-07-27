import { createAuthClient, schemas } from '@repo/macro-ai-api-client'
import { z } from 'zod'

import { validateEnvironment } from '@/lib/validation/environment'
import { emailValidation, passwordValidation } from '@/lib/validation/inputs'

const env = validateEnvironment()

// Create the auth client with proper typing
const authClient = createAuthClient(env.VITE_API_URL, {
	axiosConfig: {
		headers: {
			'X-API-KEY': env.VITE_API_KEY,
		},
		withCredentials: true,
	},
})

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
