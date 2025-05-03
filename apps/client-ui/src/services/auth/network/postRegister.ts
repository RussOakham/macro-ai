import { schemas } from '@repo/macro-ai-api-client'
import { z } from 'zod'

import { apiClient } from '@/lib/api'

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
