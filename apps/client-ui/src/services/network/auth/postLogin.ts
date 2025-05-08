import { schemas } from '@repo/macro-ai-api-client'
import { z } from 'zod'

import { apiClient } from '@/lib/api'

type TLoginRequest = z.infer<typeof schemas.postAuthlogin_Body>

const postLogin = async ({ email, password }: TLoginRequest) => {
	const response = await apiClient.post('/auth/login', {
		email,
		password,
	})

	return response
}

export { postLogin, type TLoginRequest }
