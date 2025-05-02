import { schemas } from '@repo/types-macro-ai-api'

import { apiClient } from '@/lib/api'

import { z } from 'zod'

type TRegister = z.infer<typeof schemas.Register>

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

export { postRegister, type TRegister }
