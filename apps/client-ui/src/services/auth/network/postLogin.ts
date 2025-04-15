import { IAuthResponse, TLogin } from '@repo/types-macro-ai-api'

import { axiosWithCredentials } from '@/lib/axios'

const postLogin = async ({ email, password }: TLogin) => {
	const response = await axiosWithCredentials.post<IAuthResponse>(
		'/auth/login',
		{
			email,
			password,
		},
	)

	return response
}

export { postLogin }
