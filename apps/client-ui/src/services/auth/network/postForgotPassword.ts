import { IAuthResponse, TForgotPassword } from '@repo/types-macro-ai-api'

import { axios } from '@/lib/axios'

const postForgotPassword = async ({ email }: TForgotPassword) => {
	const response = await axios.post<IAuthResponse>('/auth/forgot-password', {
		email,
	})

	return response
}

export { postForgotPassword }
