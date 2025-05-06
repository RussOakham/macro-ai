import { schemas } from '@repo/macro-ai-api-client'
import { z } from 'zod'

import { apiClient } from '@/lib/api'

type TLogin = z.infer<typeof schemas.LoginRequest>

const postLogin = async ({ email, password }: TLogin) => {
	const response = await apiClient.post('/auth/login', {
		email,
		password,
	})

	return response
}

export { postLogin, type TLogin }
