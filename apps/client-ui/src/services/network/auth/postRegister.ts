import { schemas } from '@repo/macro-ai-api-client'
import { z } from 'zod'

import { apiClient } from '@/lib/api'
import { emailValidation, passwordValidation } from '@/lib/validation/inputs'

const registerSchemaClient = schemas.postAuthregister_Body
	.extend({
		email: emailValidation(),
		password: passwordValidation(),
		confirmPassword: passwordValidation(),
	})
	.refine((data) => data.password === data.confirmPassword, {
		message: 'Passwords do not match',
		path: ['confirmPassword'],
	})

type TRegister = z.infer<typeof registerSchemaClient>

const postRegister = async ({
	email,
	password,
	confirmPassword,
}: TRegister) => {
	const response = await apiClient.post('/auth/register', {
		email,
		password,
		confirmPassword,
	})

	return response
}

export { postRegister, registerSchemaClient, type TRegister }
