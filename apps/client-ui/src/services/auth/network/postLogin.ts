import { schemas } from '@repo/types-macro-ai-api'

import { apiClient } from '@/lib/api'

import { z } from 'zod'

type TLogin = z.infer<typeof schemas.Login>

const postLogin = async ({ email, password }: TLogin) => {
	const response = await apiClient.post('/auth/login', {
		email,
		password,
	})

	return response
}

export { postLogin, type TLogin }
